const { app, BrowserWindow, ipcMain, shell, dialog, clipboard } = require('electron')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const http = require('http')
const https = require('https')
const crypto = require('crypto')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const ytDlpDownloadBase = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'

let mainWindow
let ytDlpPathPromise = null

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

  mainWindow.on('closed', () => {
    mainWindow = null
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

function getPathKey(env) {
  return Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

function getToolDirs() {
  const dirs = [
    path.join(__dirname, '..', 'bin'),
    path.join(process.cwd(), 'bin')
  ]

  try {
    dirs.push(path.join(process.resourcesPath, 'bin'))
  } catch {}

  try {
    dirs.push(path.join(app.getPath('userData'), 'bin'))
  } catch {}

  return unique(dirs)
}

function buildToolEnv() {
  const env = { ...process.env }
  const key = getPathKey(env)
  const current = env[key] || ''
  env[key] = unique([...getToolDirs(), current]).join(path.delimiter)
  return env
}

function getYtDlpNames() {
  if (process.platform === 'win32') return ['yt-dlp.exe']
  if (process.platform === 'darwin') return ['yt-dlp', 'yt-dlp_macos']
  return ['yt-dlp']
}

function getFfmpegNames() {
  if (process.platform === 'win32') return ['ffmpeg.exe']
  return ['ffmpeg']
}

function getYtDlpAssetName() {
  if (process.platform === 'win32') return 'yt-dlp.exe'
  if (process.platform === 'darwin') return 'yt-dlp_macos'
  return 'yt-dlp'
}

function getLocalYtDlpFileName() {
  if (process.platform === 'win32') return 'yt-dlp.exe'
  return 'yt-dlp'
}

function ensureExecutable(filePath) {
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(filePath, 0o755)
    } catch {}
  }
}

function findExistingFile(names) {
  const dirs = getToolDirs()

  for (const dir of dirs) {
    for (const name of names) {
      const filePath = path.join(dir, name)

      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          ensureExecutable(filePath)
          return filePath
        }
      } catch {}
    }
  }

  return null
}

function commandExists(command) {
  try {
    const result = spawnSync(command, ['--version'], {
      stdio: 'ignore',
      windowsHide: true,
      env: buildToolEnv()
    })

    return !result.error && result.status === 0
  } catch {
    return false
  }
}

function getFfmpegPath() {
  const local = findExistingFile(getFfmpegNames())
  if (local) return local
  if (commandExists('ffmpeg')) return 'ffmpeg'
  return null
}

function downloadFile(url, targetPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Too many redirects while downloading yt-dlp'))
      return
    }

    const client = url.startsWith('https:') ? https : http
    const tempPath = `${targetPath}.download`

    const req = client.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        const nextUrl = new URL(res.headers.location, url).toString()
        downloadFile(nextUrl, targetPath, redirects + 1).then(resolve).catch(reject)
        return
      }

      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`Failed to download yt-dlp: HTTP ${res.statusCode}`))
        return
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true })

      const stream = fs.createWriteStream(tempPath)
      res.pipe(stream)

      stream.on('finish', () => {
        stream.close(() => {
          try {
            fs.renameSync(tempPath, targetPath)
            ensureExecutable(targetPath)
            resolve(targetPath)
          } catch (e) {
            reject(e)
          }
        })
      })

      stream.on('error', err => {
        try {
          fs.unlinkSync(tempPath)
        } catch {}

        reject(err)
      })
    })

    req.on('error', err => {
      try {
        fs.unlinkSync(tempPath)
      } catch {}

      reject(err)
    })

    req.setTimeout(60000, () => {
      req.destroy(new Error('yt-dlp download timeout'))
    })
  })
}

async function installYtDlp() {
  const dir = path.join(app.getPath('userData'), 'bin')
  const targetPath = path.join(dir, getLocalYtDlpFileName())
  const assetName = getYtDlpAssetName()
  const url = `${ytDlpDownloadBase}/${assetName}`

  mainWindow?.webContents.send('ytdlp:log', 'Установка yt-dlp...')

  await downloadFile(url, targetPath)
  return targetPath
}

async function ensureYtDlpPath() {
  if (!ytDlpPathPromise) {
    ytDlpPathPromise = (async () => {
      const local = findExistingFile(getYtDlpNames())
      if (local) return local

      if (commandExists('yt-dlp')) return 'yt-dlp'

      try {
        return await installYtDlp()
      } catch (e) {
        throw new Error(`yt-dlp не найден и не удалось скачать его автоматически. ${e.message || e}`)
      }
    })().catch(err => {
      ytDlpPathPromise = null
      throw err
    })
  }

  return ytDlpPathPromise
}

function cleanProcessError(stderr) {
  const text = String(stderr || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-10)
    .join('\n')

  return text || 'Неизвестная ошибка yt-dlp'
}

function getSpawnErrorMessage(error) {
  if (error?.code === 'ENOENT') {
    return 'yt-dlp не найден. Приложение не смогло найти или запустить downloader.'
  }

  if (error?.code === 'EACCES') {
    return 'Нет прав на запуск yt-dlp. На macOS/Linux нужно дать файлу права chmod +x.'
  }

  return error?.message || 'Ошибка запуска yt-dlp'
}

function createYtDlpProcess(command, params) {
  return spawn(command, params, {
    windowsHide: true,
    env: buildToolEnv()
  })
}

ipcMain.handle('ytdlp:info', async (event, url) => {
  const ytdlpPath = await ensureYtDlpPath()

  return new Promise((resolve, reject) => {
    const ytdlp = createYtDlpProcess(ytdlpPath, ['--dump-json', '--no-playlist', url])

    let stdout = ''
    let stderr = ''
    let done = false

    function finish(err, data) {
      if (done) return
      done = true

      if (err) reject(err)
      else resolve(data)
    }

    ytdlp.stdout.on('data', d => {
      stdout += d.toString()
    })

    ytdlp.stderr.on('data', d => {
      stderr += d.toString()
      mainWindow?.webContents.send('ytdlp:log', d.toString())
    })

    ytdlp.on('error', err => {
      finish(new Error(getSpawnErrorMessage(err)))
    })

    ytdlp.on('close', code => {
      if (done) return

      if (code !== 0) {
        finish(new Error(cleanProcessError(stderr)))
        return
      }

      try {
        finish(null, JSON.parse(stdout))
      } catch {
        finish(new Error('Не удалось прочитать данные видео'))
      }
    })
  })
})

ipcMain.handle('ytdlp:download', async (event, { url, outputDir, format }) => {
  const ytdlpPath = await ensureYtDlpPath()

  return new Promise((resolve, reject) => {
    const dir = outputDir || os.tmpdir()

    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {
      reject(new Error(`Не удалось открыть папку для скачивания: ${e.message || e}`))
      return
    }

    const outTemplate = path.join(dir, '%(title).80s-%(id)s.%(ext)s')
    const ffmpegPath = getFfmpegPath()
    const hasFfmpeg = Boolean(ffmpegPath)
    const requestedFormat = format || 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
    const finalFormat = !hasFfmpeg && requestedFormat.includes('+') ? 'best[ext=mp4]/best' : requestedFormat

    const args = [
      '--no-playlist',
      '--restrict-filenames',
      '--windows-filenames',
      '-f',
      finalFormat,
      '--merge-output-format',
      'mp4',
      '-o',
      outTemplate,
      '--newline'
    ]

    if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
      args.push('--ffmpeg-location', path.dirname(ffmpegPath))
    }

    args.push(url)

    if (!hasFfmpeg && requestedFormat.includes('+')) {
      mainWindow?.webContents.send('ytdlp:log', 'ffmpeg не найден, используется совместимый MP4-формат без склейки видео и аудио.')
    }

    const ytdlp = createYtDlpProcess(ytdlpPath, args)

    let lastFile = ''
    let stderr = ''
    let done = false

    function finish(err, data) {
      if (done) return
      done = true

      if (err) reject(err)
      else resolve(data)
    }

    ytdlp.stdout.on('data', data => {
      const lines = data.toString().split(/\r?\n/).filter(Boolean)

      for (const line of lines) {
        const progressMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+~?\s*([^\s]+).*?\sat\s+([^\s]+)/i)

        if (progressMatch) {
          mainWindow?.webContents.send('ytdlp:progress', {
            percent: Number.parseFloat(progressMatch[1]),
            size: progressMatch[2],
            speed: progressMatch[3]
          })
        }

        const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/i)
        const mergeMatch = line.match(/\[Merger\]\s+Merging formats into\s+"(.+)"/i)
        const alreadyMatch = line.match(/\[download\]\s+(.+)\s+has already been downloaded/i)

        if (destMatch) lastFile = destMatch[1].trim()
        if (mergeMatch) lastFile = mergeMatch[1].trim()
        if (alreadyMatch) lastFile = alreadyMatch[1].trim()
      }
    })

    ytdlp.stderr.on('data', d => {
      const text = d.toString()
      stderr += text
      mainWindow?.webContents.send('ytdlp:log', text)
    })

    ytdlp.on('error', err => {
      finish(new Error(getSpawnErrorMessage(err)))
    })

    ytdlp.on('close', code => {
      if (done) return

      if (code !== 0) {
        finish(new Error(cleanProcessError(stderr) || 'Ошибка скачивания видео'))
        return
      }

      if (!lastFile) {
        try {
          const files = fs.readdirSync(dir)
            .filter(f => /\.(mp4|mkv|webm|mov|m4v)$/i.test(f))
            .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t)

          if (files.length) lastFile = path.join(dir, files[0].f)
        } catch {}
      }

      if (!lastFile) {
        finish(new Error('Видео скачано, но путь к файлу не найден'))
        return
      }

      mainWindow?.webContents.send('ytdlp:progress', {
        percent: 100,
        size: '',
        speed: ''
      })

      finish(null, { filePath: lastFile })
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
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  })

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

      res.on('data', chunk => {
        raw += chunk
      })

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