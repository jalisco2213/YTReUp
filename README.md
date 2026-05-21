# YTReUp

Desktop app for downloading videos (via yt-dlp) and uploading them to YouTube.
Built with Vue 3 + Electron.

---

## Prerequisites

- **Node.js** 18+
- **yt-dlp** installed and available in your system PATH
  - macOS: `brew install yt-dlp`
  - Linux: `pip install yt-dlp`
  - Windows: download from https://github.com/yt-dlp/yt-dlp/releases

---

## Setup

```bash
npm install
```

---

## Dev mode

```bash
npm run dev
```

This starts Vite on port 5173 and Electron pointing at it.

---

## Build

```bash
npm run build
```

Output in `dist-electron/`.

---

## YouTube API Setup

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable **YouTube Data API v3**
4. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Choose **Desktop app**, give it a name
6. Copy the **Client ID** and **Client Secret**
7. Open YTReUp → **Settings**, paste credentials, click Save
8. Click **Open Google Auth**, authorise in browser, copy the code
9. Paste the code in Settings → Verify

### API Quota note

Free tier: **10,000 units/day**. Each video upload costs 1600 units → ~6 uploads/day.
To increase: apply for quota increase in Google Cloud Console.

---

## Project structure

```
ytreup/
├── electron/
│   ├── main.js          # Electron main process (IPC, yt-dlp, config)
│   └── preload.js       # Context bridge (exposes electron API to renderer)
├── src/
│   ├── views/
│   │   ├── Dashboard.vue   # Channel stats + recent videos
│   │   ├── Download.vue    # URL → yt-dlp download
│   │   ├── Upload.vue      # File → YouTube upload
│   │   ├── Queue.vue       # Batch download + upload pipeline
│   │   └── Settings.vue    # API credentials + OAuth
│   ├── stores/
│   │   ├── youtube.js      # Pinia store: auth, API calls, channel data
│   │   └── queue.js        # Pinia store: download/upload queue
│   ├── App.vue             # Shell: titlebar, sidebar, router-view
│   ├── router.js
│   ├── main.js
│   └── style.css
├── index.html
├── vite.config.js
└── package.json
```

---

## Notes

- Config (tokens, credentials, settings) stored in Electron's `userData` directory
- yt-dlp binary: in dev, must be in PATH; in production build, place in `bin/` folder
- Upload uses YouTube resumable upload API (handles large files)
- Token refresh is handled automatically on 401 responses
