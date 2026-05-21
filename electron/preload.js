const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Window
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // yt-dlp
  ytdlpInfo: (url) => ipcRenderer.invoke('ytdlp:info', url),
  ytdlpDownload: (opts) => ipcRenderer.invoke('ytdlp:download', opts),
  onProgress: (cb) => {
    ipcRenderer.on('ytdlp:progress', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('ytdlp:progress')
  },
  onLog: (cb) => {
    ipcRenderer.on('ytdlp:log', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('ytdlp:log')
  },

  // Config
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),

  // Shell
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  // YouTube auth
  openAuth: (url) => ipcRenderer.invoke('youtube:openAuth', url),
})
