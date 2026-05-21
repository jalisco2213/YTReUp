<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Download</h1>
        <p class="view-sub">Fetch video from URL via yt-dlp</p>
      </div>
    </div>

    <div class="content">
      <!-- URL input -->
      <div class="card">
        <label class="label">Video URL</label>
        <div class="url-row">
          <input
            v-model="url"
            placeholder="https://..."
            @keyup.enter="fetchInfo"
            :disabled="loading"
          />
          <button class="btn-secondary" @click="fetchInfo" :disabled="loading || !url.trim()">
            <span v-if="loading" class="spin">↻</span>
            <span v-else>→</span>
            {{ loading ? 'Fetching…' : 'Get Info' }}
          </button>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <!-- Video preview -->
      <transition name="slide-up">
        <div v-if="videoInfo" class="card video-preview">
          <div class="preview-left">
            <img :src="videoInfo.thumbnail" class="preview-thumb" />
          </div>
          <div class="preview-right">
            <div class="preview-title">{{ videoInfo.title }}</div>
            <div class="preview-meta">
              <span class="mono">{{ videoInfo.uploader }}</span>
              <span class="dot">·</span>
              <span class="mono">{{ formatDuration(videoInfo.duration) }}</span>
              <span class="dot">·</span>
              <span class="mono">{{ formatNum(videoInfo.view_count) }} views</span>
            </div>
            <div class="preview-desc">{{ videoInfo.description?.slice(0, 200) }}{{ videoInfo.description?.length > 200 ? '…' : '' }}</div>

            <!-- Format select -->
            <div style="margin-top:16px">
              <label class="label">Quality</label>
              <select v-model="selectedFormat">
                <option value="bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best">Best (auto)</option>
                <option value="bestvideo[height<=1080]+bestaudio/best[height<=1080]">1080p</option>
                <option value="bestvideo[height<=720]+bestaudio/best[height<=720]">720p</option>
                <option value="bestvideo[height<=480]+bestaudio/best[height<=480]">480p</option>
              </select>
            </div>

            <div class="preview-actions">
              <button class="btn-primary" @click="startDownload" :disabled="downloading">
                <span v-if="downloading" class="spin">↻</span>
                <span v-else>↓</span>
                {{ downloading ? 'Downloading…' : 'Download' }}
              </button>
              <button class="btn-secondary" @click="addToQueue">
                <span>⊞</span> Add to Queue
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- Progress -->
      <transition name="slide-up">
        <div v-if="downloading" class="card progress-card">
          <div class="progress-header">
            <span class="label" style="margin:0">Downloading</span>
            <span class="mono" style="font-size:12px;color:var(--accent)">{{ progress.percent?.toFixed(1) }}%</span>
          </div>
          <div class="progress-bar" style="margin:10px 0">
            <div class="progress-fill" :style="{ width: progress.percent + '%' }" />
          </div>
          <div class="progress-meta">
            <span class="mono">{{ progress.size || '—' }}</span>
            <span class="mono" style="color:var(--text2)">at {{ progress.speed || '—' }}</span>
          </div>
        </div>
      </transition>

      <!-- Download done -->
      <transition name="slide-up">
        <div v-if="downloadedFile" class="card done-card">
          <div class="done-icon">✓</div>
          <div>
            <div class="done-title">Download complete</div>
            <div class="done-path mono">{{ downloadedFile }}</div>
          </div>
          <div class="done-actions">
            <button class="btn-success" @click="goUpload">Upload to YouTube →</button>
            <button class="btn-ghost" @click="openFolder">Open folder</button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQueueStore } from '@/stores/queue'

const router = useRouter()
const queue = useQueueStore()

const url = ref('')
const videoInfo = ref(null)
const loading = ref(false)
const error = ref('')
const selectedFormat = ref('bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best')
const downloading = ref(false)
const progress = ref({ percent: 0, size: '', speed: '' })
const downloadedFile = ref('')

let removeProgress = null
let removeLog = null

onMounted(() => {
  removeProgress = window.electron?.onProgress(p => { progress.value = p })
  removeLog = window.electron?.onLog(() => {})
})
onUnmounted(() => {
  removeProgress?.()
  removeLog?.()
})

async function fetchInfo() {
  if (!url.value.trim()) return
  loading.value = true
  error.value = ''
  videoInfo.value = null
  try {
    videoInfo.value = await window.electron.ytdlpInfo(url.value.trim())
  } catch (e) {
    error.value = e.message || 'Failed to fetch video info'
  } finally {
    loading.value = false
  }
}

async function startDownload() {
  if (!videoInfo.value) return
  downloading.value = true
  downloadedFile.value = ''
  progress.value = { percent: 0, size: '', speed: '' }
  try {
    const result = await window.electron.ytdlpDownload({
      url: url.value.trim(),
      format: selectedFormat.value,
    })
    downloadedFile.value = result.filePath
  } catch (e) {
    error.value = e.message
  } finally {
    downloading.value = false
  }
}

function addToQueue() {
  if (!videoInfo.value) return
  queue.addItem(url.value.trim(), videoInfo.value)
  router.push('/queue')
}

function goUpload() {
  router.push({ path: '/upload', query: { file: downloadedFile.value, title: videoInfo.value?.title } })
}

function openFolder() {
  const dir = downloadedFile.value.replace(/[/\\][^/\\]+$/, '')
  window.electron?.openPath(dir)
}

function formatDuration(s) {
  if (!s) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

function formatNum(n) {
  if (!n) return '0'
  const num = parseInt(n)
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px; gap: 20px; overflow-y: auto; }
.view-header { flex-shrink: 0; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.content { display: flex; flex-direction: column; gap: 16px; }

.url-row { display: flex; gap: 10px; align-items: stretch; }
.url-row input { flex: 1; }
.url-row button { flex-shrink: 0; white-space: nowrap; }

.error-msg {
  color: var(--accent);
  font-size: 12px;
  font-family: var(--font-mono);
  margin-top: 8px;
}

.video-preview { display: flex; gap: 20px; align-items: flex-start; }
.preview-left { flex-shrink: 0; }
.preview-thumb {
  width: 240px;
  height: 135px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--surface2);
}
.preview-right { flex: 1; min-width: 0; }
.preview-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; line-height: 1.4; }
.preview-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text2); margin-bottom: 10px; }
.dot { color: var(--border2); }
.preview-desc { font-size: 12px; color: var(--text2); line-height: 1.6; }
.preview-actions { display: flex; gap: 10px; margin-top: 16px; }

.progress-card {}
.progress-header { display: flex; justify-content: space-between; align-items: center; }
.progress-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text2); }

.done-card {
  display: flex;
  align-items: center;
  gap: 16px;
  border-color: rgba(0, 245, 160, 0.2);
}
.done-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 245, 160, 0.1);
  color: var(--green);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.done-title { font-weight: 700; margin-bottom: 4px; }
.done-path { font-size: 11px; color: var(--text2); word-break: break-all; }
.done-actions { margin-left: auto; display: flex; gap: 8px; flex-shrink: 0; }

.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
</style>
