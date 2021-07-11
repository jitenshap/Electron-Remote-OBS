window.onload = function()
{
    let localStream = null;
    let peerConnection = null;
    let sdpValue = '';
    let dataChannel;
    
    RTCPeerConnection = window.RTCPeerConnection;

    const localVideo = document.getElementById('livePreview');
    const recButton = document.getElementById('recButton');
    const liveButton = document.getElementById('liveButton'); 
    const muteController = document.getElementById("muteController");
    const sceneController = document.getElementById("sceneController");
    const recTimecode = document.getElementById("recTimecode");
    const liveTimecode = document.getElementById("liveTimecode");
    const recPath = document.getElementById("recPath");

    let polling = null;

    // connect-server
    const wsUrl = 'ws://localhost:3010';
    let signalingSocket = new WebSocket(wsUrl);

    signalingSocket.onopen = function(event) 
    {
        console.log("WebRTC Socket Connected");
    };
    signalingSocket.onerror = function(error) 
    {
        console.log("WebRTC Socket: " + error);
    };
    signalingSocket.onclose = function(event) 
    {
        console.log("WebRTC Socket closed");
    };
    signalingSocket.onmessage = function(event) 
    {
        let message = JSON.parse(event.data);
        if (message.type === 'offer') 
        {
            let offer = new window.RTCSessionDescription(message);
            setOffer(offer);
        }
        if (message.type === 'answer') 
        {
            let answer = new window.RTCSessionDescription(message);
            setAnswer(answer);
        }
    };

    function startVideo() 
    {
        navigator.mediaDevices.enumerateDevices().then(function(devices)
        {
            devices.filter(e => e.kind == 'videoinput').forEach(function(e)
            {
                console.log(
                    'deviceId == ' + e.deviceId + '\n' +
                    'groupId == ' + e.groupId + '\n' +
                    'label == ' + e.label + '\n\n'
                );  
                if(e.label == "OBS Virtual Camera")
                {
                    navigator.mediaDevices.getUserMedia({video: {deviceId: e.deviceId}, audio: false}).then(function(stream)
                    {
                        localStream = stream;
                        localVideo.srcObject = stream;
                        localVideo.play();
                    });
                }
            });
        });
    }

    function connect() {
        if (peerConnection) {
            console.log('already connecting.')
            return;
        }
        makeOffer();
    }

    function makeOffer() 
    {
        peerConnection = prepareNewConnection();
        peerConnection.createOffer()
        .then(function(sessionDescription) 
        {
            console.log('-- createOffer() succsess in promise');
            return peerConnection.setLocalDescription(sessionDescription);
        }).then(function() 
        {
            console.log('-- setLocalDescription() succsess in promise');
        }).catch(function(error) 
        {
            console.error(error);
        });
    }

    function setAnswer(sessionDescription) 
    {
        if (!peerConnection) 
        {
            return;
        }
        peerConnection.setRemoteDescription(sessionDescription)
        .then(function() 
        {
            console.log('setRemoteDescription(answer) succsess in promise');
        }).catch(function(error) 
        {
            console.error('setRemoteDescription(answer) ERROR: ', error);
        });
    }

    function setOffer(sessionDescription) 
    {
        if (peerConnection) 
        {
            hangUp();
        }
        peerConnection = prepareNewConnection();
        peerConnection.setRemoteDescription(sessionDescription)
        .then(function() 
        {
            makeAnswer();
        }).catch(function(error) 
        {
            console.error('setRemoteDescription(offer) ERROR: ', error);
        });
    }

    function makeAnswer() 
    {
        if (!peerConnection) 
        {
            return;
        }
        peerConnection.createAnswer()
        .then(function(sessionDescription) 
        {
            return peerConnection.setLocalDescription(sessionDescription);
        }).then(function() 
        {
            console.log('setLocalDescription() succsess in promise');
        }).catch(function(error) 
        {
            console.log(error);
        });
    }


    function prepareNewConnection() 
    {
        let pcConfig = {"iceServers":[]};
        let peer = new RTCPeerConnection(pcConfig);

        if ('ontrack' in peer) 
        {
            console.log('-- ontrack');
            peer.ontrack = function(event) 
            {
            };
        } 
        else 
        {
            console.log('-- onaddstream');
            peer.onaddstream = function(event) 
            {
            }
        }

        peer.onicecandidate = function(event) 
        {
            if (event.candidate) 
            {
                //
            } 
            else 
            {
                sdpValue = peer.localDescription.sdp;

                // sending server.
                // オブジェクトをJSONの文字列に置き換え.
                let message = JSON.stringify(peer.localDescription);
                signalingSocket.send(message);
            }
        }

        peer.oniceconnectionstatechange = function() 
        {
            if (peer.iceConnectionState === 'disconnected') 
            {
                hangUp();
            }
        };

        peer.onremovestream = function(event) 
        {
        }

        // localStreamの追加.
        if (localStream) 
        {
            peer.addStream(localStream);
        }

        dataChannel = peer.createDataChannel("OBS");
        dataChannel.onmessage = function(evt)
        {
            console.log("Received: " + evt.data);
            ws.send(evt.data);
        }
        dataChannel.onopen = function()
        {
            console.log("Data channel is open");            
        }
        dataChannel.onclose = function()
        {
            console.log("Data channel is closed");
        }

        peer.ondatachannel = function(evt) 
        {
            dataChannel = evt.channel;
        };
        return peer;
    }

    function hangUp() 
    {
        if (peerConnection) 
        {
            peerConnection.close();
            peerConnection = null;
        }
    }

    startVideo();
    connect();

    let ws = null;
    let currentMessageId = 0;
    let audioSources = [];
    let lastScene = "";
    let reconnect;

    function connectOBS()
    {
        function sendOBS(command)
        {
            ws.send(command);
        }

        clearInterval(reconnect);
        reconnect = setInterval(function()
        {
            try
            {
                if(ws == null)
                {
                    ws = new WebSocket("ws://localhost:4444");
                    ws.onopen = function()
                    {
                        clearInterval(reconnect);
                        document.getElementById("monitor").style.backgroundColor = "gray";
                        let command = {};
                
                        command["message-id"] = currentMessageId.toString();
                        command["request-type"] = "GetStreamingStatus";
                        sendOBS(command);
                        currentMessageId ++;
                
                        command["message-id"] = currentMessageId.toString();
                        command["request-type"] = "StartVirtualCam";
                        sendOBS(command);
                        currentMessageId ++;   
                
                        command["message-id"] = currentMessageId.toString();
                        command["request-type"] = "GetSourcesList";
                        sendOBS(command);
                        currentMessageId ++;
                
                        command["message-id"] = currentMessageId.toString();
                        command["request-type"] = "GetSceneList";
                        sendOBS(command);
                        currentMessageId ++;        
                
                        setTimeout(() => 
                        {
                            command["message-id"] = currentMessageId.toString();
                            command["request-type"] = "GetCurrentScene";
                            sendOBS(command);
                            currentMessageId ++;
                        }, 1000);    
                    }
                
                
                    ws.onclose = function()
                    {
                        resetScenes();
                        resetMutes();
                        document.getElementById("monitor").style.backgroundColor = "red";
                        ws = null;
                        console.log("OBS Socket disconnected");
                        connectOBS();
                    }
                
                    ws.onmessage = function(evt)
                    {
                        let json = JSON.parse(evt.data);
                        console.log(json);
                        try
                        {
                            dataChannel.send(evt.data);
                        }
                        catch(e)
                        {
                
                        }
                        if(json["update-type"] == "SourceMuteStateChanged")
                        {
                            let muteButton = document.getElementById(json.sourceName + "Mute");
                            if(json.muted)
                            {
                                muteButton.style.backgroundColor = "orange";
                                muteButton.value = "Unmute";
                            }
                            else
                            {
                                muteButton.style.backgroundColor = "gray";
                                muteButton.value = "Mute";
                            }    
                        }
                        else if(json["update-type"] == "SwitchScenes")
                        {
                            let currentScene = json["scene-name"].replace(/ /g, '') + "Scene";
                            let currentSceneButton = document.getElementById(currentScene);
                            currentSceneButton.style.backgroundColor = "orange";
                            let lastSceneButton = document.getElementById(lastScene);
                            lastSceneButton.style.backgroundColor = "gray";
                            lastScene = currentScene;
                        }
                        else if(json["update-type"] == "RecordingStarting")
                        {
                            recButton.style.backgroundColor = "yellow";
                        }
                        else if(json["update-type"] == "RecordingStarted")
                        {
                            recButton.style.backgroundColor = "red";
                            pollStatus();
                            recButton.value = "REC Stop";
                        }
                        else if(json["update-type"] == "RecordingStopping")
                        {
                            recButton.style.backgroundColor = "yellow";
                        }
                        else if(json["update-type"] == "RecordingStopped")
                        {
                            recButton.style.backgroundColor = "gray";
                            clearTimeout(polling);
                            polling = null;
                            recButton.value = "REC Start";
                        }
                        else if(json["update-type"] == "StreamingStarting")
                        {
                            liveButton.style.backgroundColor = "yellow";
                        }
                        else if(json["update-type"] == "StreamStarted")
                        {
                            liveButton.style.backgroundColor = "red";
                            liveButton.value = "LIVE Stop";
                        }
                        else if(json["update-type"] == "StreamStopping")
                        {
                            liveButton.style.backgroundColor = "yellow";
                        }
                        else if(json["update-type"] == "StreamStopped")
                        {
                            liveButton.style.backgroundColor = "gray";
                            liveButton.value = "LIVE Start";
                        }
                        else if(json["update-type"] == "StreamStatus")
                        {
                            liveTimecode.innerHTML = json["stream-timecode"];
                        }
                        else if(json.scenes != undefined)
                        {
                            if(json["current-scene"] != undefined)
                            {
                                lastScene = json["current-scene"].replace(/ /g, '') + "Scene";
                            }    
                            setScenes(json.scenes);
                        }
                        else if(json.sources != undefined && json.sources[0].typeId != undefined)
                        {
                            setMutes(json.sources);
                        }
                        else if(json.name != undefined)
                        {
                            if(json.muted != undefined)
                            {
                                let muteButton = document.getElementById(json.name + "Mute");
                                if(json.muted)
                                {
                                    muteButton.style.backgroundColor = "orange";
                                    muteButton.value = "Unmute";
                                }
                                else
                                {
                                    muteButton.style.backgroundColor = "gray";
                                    muteButton.value = "Mute";
                                }                          
                            }
                        }
                        else if(json.recording != undefined && json.streaming != undefined)
                        {
                            if(json.recording == false)
                            {
                                recButton.style.backgroundColor = "gray";
                            }
                            else
                            {
                                recButton.style.backgroundColor = "red";
                            }
                            if(json.streaming == false)
                            {
                                liveButton.style.backgroundColor = "gray";
                            }
                            else
                            {
                                liveButton.style.backgroundColor = "red";
                            }
                
                        }
                        else if(json.isRecording != undefined && json.recordTimecode != undefined && json.recordingFilename)
                        {
                            recTimecode.innerHTML = json.recordTimecode;
                            recPath.innerHTML = json.recordingFilename;
                        }
                    }    
                }
            }
            catch(e)
            {
                console.log(e);
            }
        }, 2000);
    }
    connectOBS();

    recButton.onclick = function()
    {
        let cmd = {};
        cmd["message-id"] = currentMessageId.toString();
        cmd["request-type"] = "StartStopRecording";
        sendOBS(cmd);
        currentMessageId ++;
    }

    liveButton.onclick = function()
    {
        let cmd = {};
        cmd["message-id"] = currentMessageId.toString();
        cmd["request-type"] = "StartStopStreaming";
        sendOBS(cmd);
        currentMessageId ++;    
    }

    function pollStatus()
    {
        if(polling == null)
        {
            polling = setInterval(function()
            {
                let command = {};
                command["message-id"] = currentMessageId.toString();
                command["request-type"] = "GetRecordingStatus";
                sendOBS(command);
                currentMessageId ++;
            }, 1000);    
        }
    }

    function resetScenes()
    {
        return new Promise(function(resolve,reject)
        {
            while(true)
            {
                if(sceneController.firstChild == null || sceneController.firstChild == undefined)
                {
                    console.log("flushed scenes");
                    resolve(sceneController.innerHTML);
                    break;
                }
                else
                {
                    sceneController.removeChild(sceneController.firstChild);
                }
            }
        });
    }

    function resetMutes()
    {
        return new Promise(function(resolve,reject)
        {
            while(true)
            {
                if(muteController.firstChild == null || muteController.firstChild == undefined)
                {
                    console.log("flushed mutes");
                    resolve(muteController.innerHTML);
                    break;
                }
                else
                {
                    muteController.removeChild(muteController.firstChild);
                }
            }
        });
    }

    async function setScenes(scenes)
    {
        resetScenes().then(function(resolve, reject)
        {
            scenes.forEach(function(scene)
            {
                console.log("Adding scene: " + scene);
                let description = document.createElement("div");
                description.style.color = "white";
                description.style.backgroundColor = "black";
                description.style.float = "left";
                description.style.width = "100px";
                description.style.height = "80px";
                description.style.margin = "5px";
                description.style.padding = "5px";
                description.style.textAlign = "center";
                description.style.position = "relative";
                description.style["border-radius"] = "7px";
                description.innerHTML = scene.name + "<br>";
                sceneController.appendChild(description);
                let button = document.createElement("input");
                button.type = "button";
                button.value = "";
                button.class = "squareButton";
                button.id = (scene.name.replace(/ /g, '') + "Scene");
                if(button.id == lastScene)
                {
                    button.style.backgroundColor = "orange";
                }
                else
                {
                    button.style.backgroundColor = "gray";
                }
                button.style.position = "absolute";
                button.style.width = "75px";
                button.style.height = "40px";
                button.style.top = "auto";
                button.style.bottom = "10px";
                button.style.left = "0";
                button.style.right = "0";
                button.style.padding = "0px";
                button.style.margin = "auto";
                button.style["border-radius"] = "7px";
                button.addEventListener("click", function()
                {
                    let cmd = {};
                    cmd["message-id"] = currentMessageId.toString();
                    cmd["request-type"] = "SetCurrentScene";
                    cmd["scene-name"] = scene.name;
                    sendOBS(cmd);
                    currentMessageId ++;
                });
                description.appendChild(button);
            });
    
        });

    }

    async function setMutes(sources)
    {
        resetMutes().then(function(resolve, reject)
        {
            sources.forEach(function(source)
            {
                if(source.typeId == "wasapi_output_capture" || source.typeId == "wasapi_input_capture")
                {
                    console.log("Adding scene: " + source.name);
                    let command = {};
                    audioSources.push(source.name);
                    let description = document.createElement("div");
                    description.style.color = "white";
                    description.style.backgroundColor = "black";
                    description.style.float = "left";
                    description.style.width = "100px";
                    description.style.height = "100px";
                    description.style.margin = "10px";
                    description.style.padding = "5px";
                    description.style.textAlign = "center";
                    description.style.position = "relative";
                    description.style["border-radius"] = "7px";
                    description.innerHTML = source.name + "<br>";
                    muteController.appendChild(description);
                    let button = document.createElement("input");
                    button.type = "button";
                    button.value = "Mute";
                    button.class = "squareButton";
                    button.id = source.name + "Mute";
                    button.backgroundColor = "gray";
                    button.style.position = "absolute";
                    button.style.width = "75px";
                    button.style.height = "40px";
                    button.style.top = "auto";
                    button.style.bottom = "10px";
                    button.style.left = "0";
                    button.style.right = "0";
                    button.style.padding = "0px";
                    button.style.margin = "auto";
                    button.style["border-radius"] = "7px";
                    button.addEventListener("click", function()
                        {
                            let cmd = {};
                            cmd["message-id"] = currentMessageId.toString();
                            cmd["request-type"] = "SetMute";
                            cmd["source"] = source.name;
                            if(button.style.backgroundColor == "orange")
                            {
                                cmd["mute"] = false;    
                            }
                            else
                            {
                                cmd["mute"] = true;
                            }
                            sendOBS(cmd);
                            currentMessageId ++;
                        }
                    );
                    description.appendChild(button);
                    command["message-id"] = currentMessageId.toString();
                    command["request-type"] = "GetMute";
                    command["source"] = source.name;
                    sendOBS(command);
                    currentMessageId ++;    
                }                        
            });
        });
    }
}
