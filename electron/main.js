// Hush, Then Bloom — desktop wrapper (Electron)
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
function create() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 640, minHeight: 360,
    backgroundColor: '#03030a', title: 'Hush, Then Bloom', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  if (process.env.HTB_SHOT) { // automated smoke test: save a screenshot and quit
    setTimeout(async () => { const img = await win.webContents.capturePage(); require('fs').writeFileSync(process.env.HTB_SHOT, img.toPNG()); app.quit(); }, 5000);
  }
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) { win.setFullScreen(false); }
  });
}
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
