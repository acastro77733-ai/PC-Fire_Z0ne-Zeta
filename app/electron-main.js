const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { sanitizeShellCommand } = require('./services/safety.mjs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      nodeIntegration: false, // Security: Keep true isolation
      contextIsolation: true,
      sandbox: false // Required for some Node APIs in preload
    },
    icon: path.join(__dirname, 'icon.png') // Assuming an icon exists
  });

  // In dev, load localhost. In prod, load build file.
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:1234';
  mainWindow.loadURL(startUrl);
  
  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS (Native Capabilities) ---

// 1. File System
ipcMain.handle('fs:read', async (_, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:write', async (_, filePath, content) => {
  try {
    // Ensure dir exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:read-dir', async (_, dirPath) => {
  try {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true });
    const files = dirents.map(dirent => ({
      name: dirent.name,
      kind: dirent.isDirectory() ? 'directory' : 'file',
      path: path.join(dirPath, dirent.name)
    }));
    return { success: true, files };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 2. Dialogs
ipcMain.handle('dialog:select-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 3. Shell Execution
ipcMain.handle('shell:exec', async (_, command, envVars = {}) => {
  return new Promise((resolve) => {
    // Merge current env with provided vars
    const env = { ...process.env, ...envVars };
    
    exec(command, { env, cwd: process.env.HOME || process.cwd() }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout || '',
        stderr: stderr || (error ? error.message : '')
      });
    });
  });
});