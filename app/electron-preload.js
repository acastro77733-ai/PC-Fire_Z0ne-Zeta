const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  platform: process.platform,
  
  // File System
  selectDirectory: () => ipcRenderer.invoke('dialog:select-dir'),
  readFile: (path) => ipcRenderer.invoke('fs:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:write', path, content),
  readDir: (path) => ipcRenderer.invoke('fs:read-dir', path),
  
  // Shell
  runShell: (cmd, env) => ipcRenderer.invoke('shell:exec', cmd, env)
});