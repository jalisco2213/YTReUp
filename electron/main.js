const { app, BrowserWindow, ipcMain, shell, dialog, clipboard } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const http = require('http')
const https = require('https')
const crypto = require('crypto')

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
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../public/icon.png')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

function getYtDlpPath() {
  if (isDev) return 'yt-dlp'
  const bin = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  return path.join(process.resourcesPath, 'bin', bin)
}

ipcMain.handle('ytdlp:info', async (event, url) => {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn(getYtDlpPath(), ['--dump-json', '--no-playlist', url])
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

ipcMain.handle('ytdlp:download', async (event, { url, outputDir, format }) => {
  return new Promise((resolve, reject) => {
    const dir = outputDir || os.tmpdir()
    const outTemplate = path.join(dir, '%(id)s.%(ext)s')

    const args = [
      '--no-playlist',
      '-f',
      format || 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format',
      'mp4',
      '-o',
      outTemplate,
      '--newline',
      url
    ]

    const ytdlp = spawn(getYtDlpPath(), args)
    let lastFile = ''
    let stderr = ''

    ytdlp.stdout.on('data', data => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean)

      for (const line of lines) {
        const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+([^\s]+)\s+at\s+([^\s]+)/)
        if (progressMatch) {
          mainWindow?.webContents.send('ytdlp:progress', {
            percent: parseFloat(progressMatch[1]),
            size: progressMatch[2],
            speed: progressMatch[3]
          })
        }

        const destMatch = line.match(/\[download\] Destination: (.+)/)
        const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)

        if (destMatch) lastFile = destMatch[1]
        if (mergeMatch) lastFile = mergeMatch[1]
      }
    })

    ytdlp.stderr.on('data', d => {
      stderr += d.toString()
      mainWindow?.webContents.send('ytdlp:log', d.toString())
    })

    ytdlp.on('close', code => {
      if (code !== 0) return reject(new Error(stderr || 'Download failed'))

      if (!lastFile) {
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith('.mp4'))
          .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
          .sort((a, b) => b.t - a.t)

        if (files.length) lastFile = path.join(dir, files[0].f)
      }

      resolve({ filePath: lastFile })
    })
  })
})

const configPath = path.join(app.getPath('userData'), 'config.json')

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch {
    return {}
  }
}

function writeConfig(data) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
  return true
}

ipcMain.handle('config:load', () => readConfig())
ipcMain.handle('config:save', (event, data) => writeConfig(data))
ipcMain.handle('shell:openPath', (event, p) => shell.openPath(p))
ipcMain.handle('shell:openExternal', (event, url) => shell.openExternal(url))
ipcMain.handle('clipboard:writeText', (event, text) => clipboard.writeText(String(text || '')))

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })

  if (result.canceled || !result.filePaths?.length) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] })
  if (result.canceled || !result.filePaths?.length) return null
  return result.filePaths[0]
})

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createPkce() {
  const codeVerifier = base64Url(crypto.randomBytes(64))
  const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest())
  return { codeVerifier, codeChallenge }
}

function htmlResponse(title, text) {
  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body{margin:0;min-height:100vh;background:#080810;color:#e8e8f0;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center}
.box{max-width:520px;padding:28px;background:#16162a;border:1px solid #2a2a48;border-radius:10px;text-align:center}
h1{margin:0 0 12px;font-size:24px}
p{margin:0;color:#9090b0;line-height:1.6}
</style>
</head>
<body><div class="box"><h1>${title}</h1><p>${text}</p></div></body>
</html>`
}

function waitForOAuthCode({ clientId, scope }) {
  return new Promise((resolve, reject) => {
    const state = crypto.randomBytes(24).toString('hex')
    const { codeVerifier, codeChallenge } = createPkce()

    let completed = false
    let timeout = null
    let redirectUri = ''
    let localOrigin = ''

    const server = http.createServer((req, res) => {
      try {
        if (completed) {
          res.writeHead(204)
          res.end()
          return
        }

        const requestUrl = new URL(req.url || '/', localOrigin || 'http://127.0.0.1')

        if (requestUrl.pathname !== '/oauth2callback') {
          res.writeHead(204)
          res.end()
          return
        }

        const code = requestUrl.searchParams.get('code')
        const receivedState = requestUrl.searchParams.get('state')
        const oauthError = requestUrl.searchParams.get('error')

        if (oauthError) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlResponse('Authorization cancelled', 'You can close this tab and return to the app.'))
          finish(new Error(oauthError))
          return
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlResponse('Authorization failed', 'Google did not return an authorization code.'))
          finish(new Error('Google did not return an authorization code'))
          return
        }

        if (receivedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlResponse('Authorization failed', 'Invalid OAuth state.'))
          finish(new Error('Invalid OAuth state'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(htmlResponse('YouTube connected', 'You can close this tab and return to the app.'))
        finish(null, { code, redirectUri, codeVerifier })
      } catch (e) {
        try {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlResponse('Authorization failed', 'Unexpected local OAuth server error.'))
        } catch {}

        finish(e)
      }
    })

    function finish(err, result) {
      if (completed) return
      completed = true

      if (timeout) clearTimeout(timeout)

      try {
        server.close()
      } catch {}

      if (err) reject(err)
      else resolve(result)
    }

    server.on('error', err => finish(err))

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : null

      if (!port) {
        finish(new Error('Failed to start local OAuth server'))
        return
      }

      localOrigin = `http://127.0.0.1:${port}`
      redirectUri = `${localOrigin}/oauth2callback`

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        access_type: 'offline',
        prompt: 'consent',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      })

      timeout = setTimeout(() => {
        finish(new Error('Authorization timeout'))
      }, 300000)

      try {
        await shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
      } catch (e) {
        finish(e)
      }
    })
  })
}

function postForm(endpoint, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString()
    const url = new URL(endpoint)

    const req = https.request({
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let raw = ''

      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw || '{}'))
        } catch {
          reject(new Error(raw || 'Failed to parse OAuth response'))
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

ipcMain.handle('youtube:authorize', async (event, payload) => {
  const clientId = String(payload?.clientId || '').trim()
  const clientSecret = String(payload?.clientSecret || '').trim()

  if (!clientId || !clientSecret) {
    throw new Error('Client ID and Client Secret are required')
  }

  const scope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube'
  ].join(' ')

  const { code, redirectUri, codeVerifier } = await waitForOAuthCode({ clientId, scope })

  const data = await postForm('https://oauth2.googleapis.com/token', {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  })

  if (data.error) {
    throw new Error(data.error_description || data.error)
  }

  if (!data.access_token) {
    throw new Error('Google did not return an access token')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || null,
    scope: data.scope || '',
    tokenType: data.token_type || 'Bearer'
  }
})
