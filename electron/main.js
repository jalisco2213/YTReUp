const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn, execFile } = require('child_process')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// Window controls
ipcMain.on('window:minimize', () => mainWindow.minimize())
ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window:close', () => mainWindow.close())

// yt-dlp binary path
function getYtDlpPath() {
  if (isDev) return 'yt-dlp' // must be in PATH during dev
  const bin = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  return path.join(process.resourcesPath, 'bin', bin)
}

// Get video info before download
ipcMain.handle('ytdlp:info', async (event, url) => {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn(getYtDlpPath(), [
      '--dump-json',
      '--no-playlist',
      url
    ])
    let stdout = ''
    let stderr = ''
    ytdlp.stdout.on('data', d => stdout += d)
    ytdlp.stderr.on('data', d => stderr += d)
    ytdlp.on('close', code => {
      if (code !== 0) return reject(new Error(stderr || 'yt-dlp failed'))
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error('Failed to parse video info'))
      }
    })
  })
})

// Download video
ipcMain.handle('ytdlp:download', async (event, { url, outputDir, format }) => {
  return new Promise((resolve, reject) => {
    const outTemplate = path.join(outputDir || os.tmpdir(), '%(id)s.%(ext)s')
    const args = [
      '--no-playlist',
      '-f', format || 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '-o', outTemplate,
      '--newline',
      url
    ]

    const ytdlp = spawn(getYtDlpPath(), args)
    let lastFile = ''

    ytdlp.stdout.on('data', data => {
      const line = data.toString().trim()
      // Parse progress lines
      const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)/)
      if (progressMatch) {
        mainWindow.webContents.send('ytdlp:progress', {
          percent: parseFloat(progressMatch[1]),
          size: progressMatch[2],
          speed: progressMatch[3],
        })
      }
      // Capture output file
      const destMatch = line.match(/\[download\] Destination: (.+)/)
      const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)
      if (destMatch) lastFile = destMatch[1]
      if (mergeMatch) lastFile = mergeMatch[1]
    })

    ytdlp.stderr.on('data', d => {
      mainWindow.webContents.send('ytdlp:log', d.toString())
    })

    ytdlp.on('close', code => {
      if (code !== 0) return reject(new Error('Download failed'))
      // Find the actual downloaded file
      if (!lastFile) {
        // fallback: scan tmpdir for recent mp4
        const files = fs.readdirSync(outputDir || os.tmpdir())
          .filter(f => f.endsWith('.mp4'))
          .map(f => ({ f, t: fs.statSync(path.join(outputDir || os.tmpdir(), f)).mtimeMs }))
          .sort((a, b) => b.t - a.t)
        if (files.length) lastFile = path.join(outputDir || os.tmpdir(), files[0].f)
      }
      resolve({ filePath: lastFile })
    })
  })
})

// Store/load config
const configPath = path.join(app.getPath('userData'), 'config.json')

ipcMain.handle('config:load', () => {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
})

ipcMain.handle('config:save', (event, data) => {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
  return true
})

// Open folder
ipcMain.handle('shell:openPath', (event, p) => shell.openPath(p))

// YouTube OAuth flow
ipcMain.handle('youtube:openAuth', async (event, authUrl) => {
  shell.openExternal(authUrl)
  return true
})
