const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  ytdlpInfo: url => ipcRenderer.invoke('ytdlp:info', url),
  ytdlpDownload: opts => ipcRenderer.invoke('ytdlp:download', opts),

  onProgress: cb => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('ytdlp:progress', handler)
    return () => ipcRenderer.removeListener('ytdlp:progress', handler)
  },

  onLog: cb => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('ytdlp:log', handler)
    return () => ipcRenderer.removeListener('ytdlp:log', handler)
  },

  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: data => ipcRenderer.invoke('config:save', data),

  openPath: p => ipcRenderer.invoke('shell:openPath', p),

  youtubeAuthorize: payload => ipcRenderer.invoke('youtube:authorize', payload)
})