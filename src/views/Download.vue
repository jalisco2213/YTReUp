<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>{{ t('download.title') }}</h1>
        <p class="view-sub">{{ t('download.subtitle') }}</p>
      </div>
    </div>

    <div class="content">
      <div class="card">
        <label class="label">{{ t('download.url') }}</label>
        <div class="url-row">
          <input v-model="url" :placeholder="t('download.urlPlaceholder')" @keyup.enter="fetchInfo" :disabled="loading" />
          <button class="btn-secondary" @click="fetchInfo" :disabled="loading || !url.trim()">
            <span v-if="loading" class="spin">↻</span>
            <span v-else>→</span>
            {{ loading ? t('download.fetching') : t('download.getInfo') }}
          </button>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

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
              <span class="mono">{{ formatNum(videoInfo.view_count) }} {{ t('common.views') }}</span>
            </div>
            <div class="preview-desc">{{ videoInfo.description?.slice(0, 220) }}{{ videoInfo.description?.length > 220 ? '…' : '' }}</div>

            <div class="form-row">
              <div class="field quality-field">
                <label class="label">{{ t('download.quality') }}</label>
                <select v-model="selectedFormat">
                  <option value="bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best">{{ t('download.best') }}</option>
                  <option value="bestvideo[height<=1080]+bestaudio/best[height<=1080]">1080p</option>
                  <option value="bestvideo[height<=720]+bestaudio/best[height<=720]">720p</option>
                  <option value="bestvideo[height<=480]+bestaudio/best[height<=480]">480p</option>
                </select>
              </div>
              <div class="field dir-field">
                <label class="label">{{ t('settings.downloadDir') }}</label>
                <div class="dir-row">
                  <input v-model="downloadDir" :placeholder="t('settings.downloadPlaceholder')" />
                  <button class="btn-secondary" @click="chooseFolder">{{ t('common.select') }}</button>
                </div>
              </div>
            </div>

            <div class="preview-actions">
              <button class="btn-primary" @click="startDownload" :disabled="downloading">
                <span v-if="downloading" class="spin">↻</span>
                <span v-else>↓</span>
                {{ downloading ? t('download.downloading') : t('download.download') }}
              </button>
              <button class="btn-secondary" @click="addToQueue"><span>⊞</span> {{ t('download.addToQueue') }}</button>
            </div>
          </div>
        </div>
      </transition>

      <transition name="slide-up">
        <div v-if="downloading" class="card progress-card">
          <div class="progress-header">
            <span class="label">{{ t('download.downloading') }}</span>
            <span class="mono percent">{{ progress.percent?.toFixed(1) }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progress.percent + '%' }" />
          </div>
          <div class="progress-meta">
            <span class="mono">{{ progress.size || '—' }}</span>
            <span class="mono">{{ progress.speed || '—' }}</span>
          </div>
        </div>
      </transition>

      <transition name="slide-up">
        <div v-if="downloadedFile" class="card done-card">
          <div class="done-icon">✓</div>
          <div>
            <div class="done-title">{{ t('download.complete') }}</div>
            <div class="done-path mono">{{ downloadedFile }}</div>
          </div>
          <div class="done-actions">
            <button class="btn-success" @click="goUpload">{{ t('download.uploadToYoutube') }} →</button>
            <button class="btn-ghost" @click="openFolder">{{ t('download.openFolder') }}</button>
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
import { useI18nStore } from '@/stores/i18n'

const router = useRouter()
const queue = useQueueStore()
const i18n = useI18nStore()
const t = i18n.t

const url = ref('')
const videoInfo = ref(null)
const loading = ref(false)
const error = ref('')
const selectedFormat = ref('bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best')
const downloading = ref(false)
const progress = ref({ percent: 0, size: '', speed: '' })
const downloadedFile = ref('')
const downloadDir = ref('')

let removeProgress = null
let removeLog = null

onMounted(async () => {
  const cfg = await window.electron.loadConfig()
  downloadDir.value = cfg.downloadDir || ''
  removeProgress = window.electron?.onProgress(p => { progress.value = p })
  removeLog = window.electron?.onLog(() => {})
})

onUnmounted(() => {
  removeProgress?.()
  removeLog?.()
})

async function chooseFolder() {
  const folder = await window.electron?.openDirectory()
  if (folder) downloadDir.value = folder
}

async function fetchInfo() {
  if (!url.value.trim()) return
  loading.value = true
  error.value = ''
  videoInfo.value = null

  try {
    videoInfo.value = await window.electron.ytdlpInfo(url.value.trim())
  } catch (e) {
    error.value = e.message || t('download.failedInfo')
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
      outputDir: downloadDir.value || undefined
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
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
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
.error-msg { color: var(--accent); font-size: 12px; font-family: var(--font-mono); margin-top: 8px; }
.video-preview { display: flex; gap: 20px; align-items: flex-start; }
.preview-left { flex-shrink: 0; }
.preview-thumb { width: 240px; height: 135px; object-fit: cover; border-radius: 4px; background: var(--surface2); }
.preview-right { flex: 1; min-width: 0; }
.preview-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; line-height: 1.4; }
.preview-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text2); margin-bottom: 10px; flex-wrap: wrap; }
.dot { color: var(--border2); }
.preview-desc { font-size: 12px; color: var(--text2); line-height: 1.6; }
.form-row { display: grid; grid-template-columns: 220px 1fr; gap: 12px; margin-top: 16px; }
.field { min-width: 0; }
.dir-row { display: flex; gap: 8px; }
.dir-row input { flex: 1; }
.preview-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.progress-header { display: flex; justify-content: space-between; align-items: center; }
.progress-header .label { margin: 0; }
.progress-bar { margin: 10px 0; }
.percent { font-size: 12px; color: var(--accent); }
.progress-meta { display: flex; gap: 12px; font-size: 12px; color: var(--text2); }
.done-card { display: flex; align-items: center; gap: 16px; border-color: rgba(0, 245, 160, 0.2); }
.done-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(0, 245, 160, 0.1); color: var(--green); font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.done-title { font-weight: 700; margin-bottom: 4px; }
.done-path { font-size: 11px; color: var(--text2); word-break: break-all; }
.done-actions { margin-left: auto; display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
@media (max-width: 1000px) { .video-preview { flex-direction: column; } .form-row { grid-template-columns: 1fr; } }
</style>
