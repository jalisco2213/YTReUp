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
    path.join(process.cwd(), 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/opt/local/bin'
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

  const absolutePaths = process.platform === 'win32'
    ? []
    : [
        '/opt/homebrew/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        '/bin/ffmpeg',
        '/opt/local/bin/ffmpeg'
      ]

  for (const filePath of absolutePaths) {
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        ensureExecutable(filePath)
        return filePath
      }
    } catch {}
  }

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

function parseProgressLine(line) {
  const percentMatch = line.match(/\[download\]\s+([\d.]+)%/i)
  if (!percentMatch) return null

  const sizeMatch = line.match(/\s+of\s+~?\s*([0-9.]+[A-Za-z]+(?:i?B)?)/i)
  const speedMatch = line.match(/\s+at\s+([^\s]+\/s)/i)
  const etaMatch = line.match(/\s+ETA\s+([0-9:]+)/i)

  return {
    percent: Number.parseFloat(percentMatch[1]),
    size: sizeMatch?.[1] || '',
    speed: speedMatch?.[1] || '',
    eta: etaMatch?.[1] || ''
  }
}

function compatibleMp4Format(height) {
  const limit = height ? `[height<=${height}]` : ''

  return [
    `bestvideo${limit}[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]`,
    `best${limit}[ext=mp4][vcodec^=avc1]`,
    `bestvideo${limit}[vcodec^=avc1]+bestaudio[ext=m4a]`,
    `bestvideo${limit}[vcodec^=avc1]+bestaudio`,
    `bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]`,
    `best[ext=mp4][vcodec^=avc1]`
  ].join('/')
}

function normalizeFormat(format) {
  const raw = String(format || '').trim()
  const heightMatch = raw.match(/height\s*<=\s*(\d+)/)

  if (raw === '2160') return compatibleMp4Format(2160)
  if (raw === '1440') return compatibleMp4Format(1440)
  if (raw === '1080') return compatibleMp4Format(1080)
  if (raw === '720') return compatibleMp4Format(720)
  if (raw === '480') return compatibleMp4Format(480)

  if (!raw || raw === 'best') return compatibleMp4Format(null)
  if (heightMatch?.[1]) return compatibleMp4Format(heightMatch[1])
  if (raw.includes('bestvideo') || raw.includes('bestaudio') || raw.includes('best[')) return compatibleMp4Format(null)

  return raw
}

function getMimeByPath(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase()
  const map = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo'
  }
  return map[ext] || 'application/octet-stream'
}

function requestBuffer(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString)
    const client = url.protocol === 'http:' ? http : https
    const body = options.body === undefined || options.body === null
      ? null
      : Buffer.isBuffer(options.body)
        ? options.body
        : Buffer.from(options.body)

    const headers = { ...(options.headers || {}) }

    if (body && !Object.keys(headers).some(key => key.toLowerCase() === 'content-length')) {
      headers['Content-Length'] = body.length
    }

    const req = client.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: options.method || 'GET',
      headers
    }, res => {
      const chunks = []

      res.on('data', chunk => {
        chunks.push(chunk)
      })

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers || {},
          body: Buffer.concat(chunks)
        })
      })
    })

    req.on('error', reject)

    req.setTimeout(options.timeout || 0, () => {
      req.destroy(new Error('Request timeout'))
    })

    if (body) req.write(body)
    req.end()
  })
}

function parseJsonBuffer(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '')
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

function getUploadError(data, fallback) {
  return data?.error?.message || data?.error_description || data?.error || data?.raw || fallback
}

function sendYoutubeUploadProgress(id, percent) {
  mainWindow?.webContents.send('youtube:upload-progress', {
    id,
    percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  })
}

async function uploadVideoToYoutube(payload) {
  const accessToken = String(payload?.accessToken || '').trim()
  const filePath = String(payload?.filePath || '').trim()
  const sessionId = String(payload?.sessionId || crypto.randomUUID())
  const notifySubscribers = payload?.notifySubscribers !== false ? 'true' : 'false'

  if (!accessToken) throw new Error('YouTube access token is missing')
  if (!filePath) throw new Error('Путь к файлу не указан')

  const stat = fs.statSync(filePath)
  if (!stat.isFile()) throw new Error('Выбранный путь не является файлом')
  if (!stat.size) throw new Error('Файл пустой или недоступен для чтения')

  const mime = getMimeByPath(filePath)
  const fileSize = stat.size
  const body = JSON.stringify({ snippet: payload.snippet || {}, status: payload.status || {} })

  sendYoutubeUploadProgress(sessionId, 0)

  const init = await requestBuffer(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${encodeURIComponent(notifySubscribers)}`, {
    method: 'POST',
    timeout: 60000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(fileSize),
      'Content-Type': 'application/json; charset=utf-8'
    },
    body
  })

  const uploadUrl = init.headers.location

  if (![200, 201].includes(init.statusCode) || !uploadUrl) {
    const data = parseJsonBuffer(init.body)
    throw new Error(`Upload init failed (${init.statusCode}): ${getUploadError(data, 'Failed to start upload')}`)
  }

  const handle = await fs.promises.open(filePath, 'r')
  const chunkSize = 8 * 1024 * 1024
  let offset = 0
  let result = null

  try {
    while (offset < fileSize) {
      const end = Math.min(offset + chunkSize, fileSize)
      const length = end - offset
      const buffer = Buffer.alloc(length)
      const read = await handle.read(buffer, 0, length, offset)
      const chunk = buffer.subarray(0, read.bytesRead)

      const res = await requestBuffer(uploadUrl, {
        method: 'PUT',
        timeout: 0,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': mime,
          'Content-Length': String(chunk.length),
          'Content-Range': `bytes ${offset}-${offset + chunk.length - 1}/${fileSize}`
        },
        body: chunk
      })

      if ([200, 201].includes(res.statusCode)) {
        result = parseJsonBuffer(res.body)
        sendYoutubeUploadProgress(sessionId, 100)
        break
      }

      if (res.statusCode === 308) {
        const range = res.headers.range
        offset = range ? Number(String(range).split('-').pop()) + 1 : end
        sendYoutubeUploadProgress(sessionId, (offset / fileSize) * 100)
        continue
      }

      const data = parseJsonBuffer(res.body)
      throw new Error(`Upload failed (${res.statusCode}): ${getUploadError(data, 'Failed to upload video')}`)
    }
  } finally {
    await handle.close()
  }

  if (!result?.id) {
    throw new Error('YouTube не вернул ID загруженного видео')
  }

  return result
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
    const finalFormat = normalizeFormat(format)

    if (!ffmpegPath && finalFormat.includes('+')) {
      reject(new Error('Для скачивания MP4 в хорошем качестве нужен ffmpeg. Установи ffmpeg или положи его в папку bin.'))
      return
    }

    const args = [
      '--no-playlist',
      '--restrict-filenames',
      '--windows-filenames',
      '--newline',
      '--progress',
      '--no-mtime',
      '--check-formats',
      '-f',
      finalFormat,
      '--merge-output-format',
      'mp4',
      '-o',
      outTemplate
    ]

    if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
      args.push('--ffmpeg-location', path.dirname(ffmpegPath))
    }

    args.push(url)

    mainWindow?.webContents.send('ytdlp:progress', {
      percent: 0,
      size: '',
      speed: '',
      eta: ''
    })

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
        const progress = parseProgressLine(line)

        if (progress) {
          mainWindow?.webContents.send('ytdlp:progress', progress)
        }

        const destMatch = line.match(/\[download\]\s+Destination:\s+(.+)/i)
        const mergeMatch = line.match(/\[Merger\]\s+Merging formats into\s+"(.+)"/i)
        const moveMatch = line.match(/\[MoveFiles\]\s+Moving file\s+"(.+?)"\s+to\s+"(.+?)"/i)
        const alreadyMatch = line.match(/\[download\]\s+(.+)\s+has already been downloaded/i)

        if (destMatch) lastFile = destMatch[1].trim()
        if (mergeMatch) lastFile = mergeMatch[1].trim()
        if (moveMatch) lastFile = moveMatch[2].trim()
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

      if (/\.(m4a|mp3|aac|opus|ogg|wav)$/i.test(lastFile)) {
        finish(new Error('Скачался только аудиофайл. Нужно выбрать MP4/H.264 формат и убедиться, что ffmpeg доступен.'))
        return
      }

      mainWindow?.webContents.send('ytdlp:progress', {
        percent: 100,
        size: '',
        speed: '',
        eta: '00:00'
      })

      finish(null, { filePath: lastFile })
    })
  })
})

ipcMain.handle('youtube:uploadVideo', async (event, payload) => uploadVideoToYoutube(payload))

ipcMain.handle('file:stat', async (event, filePath) => {
  const target = String(filePath || '').trim()

  if (!target) throw new Error('Путь к файлу не указан')

  const stat = fs.statSync(target)

  if (!stat.isFile()) throw new Error('Выбранный путь не является файлом')

  return {
    size: stat.size,
    name: path.basename(target),
    mime: getMimeByPath(target)
  }
})

ipcMain.handle('file:readChunk', async (event, payload) => {
  const filePath = String(payload?.filePath || '').trim()
  const start = Math.max(0, Number(payload?.start || 0))
  const end = Math.max(start, Number(payload?.end || 0))
  const length = Math.max(0, end - start)

  if (!filePath) throw new Error('Путь к файлу не указан')
  if (!length) return new ArrayBuffer(0)

  const handle = await fs.promises.open(filePath, 'r')

  try {
    const buffer = Buffer.alloc(length)
    const result = await handle.read(buffer, 0, length, start)
    const chunk = buffer.subarray(0, result.bytesRead)
    return chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
  } finally {
    await handle.close()
  }
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
