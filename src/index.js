const { app, BrowserWindow } = require('electron');
const path = require('path');

const http = require('http');
let WebSocketServer = require('ws').Server;
let port = 3011;
let wsPort = 3010;

const fs = require('fs');


const options = 
{
};

const server = http.createServer(options, function(req, res) 
{
  fs.readFile('index2.html', 'UTF-8', function(error, data)
  {
      res.writeHead(200, {'Content-Type':'text/html'});
      res.write(data);
      res.end();
      if(error)
      {
        console.log(error);
      }
  });
});
server.listen(3011);
console.log('server running...');

let wssendPoint = http.createServer({
//  key: fs.readFileSync('server.key'),
//  cert: fs.readFileSync('server.crt')
}, (req, res) => {
  // ダミーリクエスト処理
  res.writeHead(200);
  res.end("All glory to WebSockets!\n");
}).listen(wsPort);



let wssServer = new WebSocketServer(
{
  server: wssendPoint
});
console.log('websocket server start. port=' + wsPort);

wssServer.on('connection', function(ws) {
  console.log('-- websocket connected --');
  ws.on('message', function(message) {
      wssServer.clients.forEach(function each(client) 
      {
          if (isSame(ws, client)) 
          {
              console.log('- skip sender -');
          } 
          else 
          {
              client.send(message);
          }
      });
  });
});

function isSame(ws1, ws2) 
{
  return (ws1 === ws2);     
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => 
{
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 500,
  });
  mainWindow.setMenuBarVisibility(false);
  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => 
{
  if (process.platform !== 'darwin') 
  {
    app.quit();
  }
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // On certificate error we disable default behaviour (stop loading the page)
  // and we then say "it is all fine - true" to the callback
  event.preventDefault();
  callback(true);
});

app.on('activate', () => 
{
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
