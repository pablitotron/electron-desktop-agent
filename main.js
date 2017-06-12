const {app, Tray, Menu, BrowserWindow} = require('electron');
const url = require('url');
const path = require('path');

const iconPath = path.join(__dirname, '/img/icon.png');
let appIcon = null;
let win = null;

app.on('ready', function() {
  win = new BrowserWindow({
    show: false,
    icon: iconPath,
    width: 640,
    height: 480
  })

  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  appIcon = new Tray(iconPath);
  var contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: function() {
        win.show();
        //win.toggleDevTools();
      }
    },
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      selector: 'terminate:',
    }
  ]);
  appIcon.setToolTip('Hermes Desktop Agent');
  appIcon.setContextMenu(contextMenu);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
