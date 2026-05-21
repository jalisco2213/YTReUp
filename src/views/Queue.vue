<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>{{ t('queue.title') }}</h1>
        <p class="view-sub">{{ t('queue.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="processAll" :disabled="processing || !queue.items.length">
          <span v-if="processing" class="spin">↻</span>
          {{ t('queue.processAll') }}
        </button>
        <button class="btn-ghost" @click="queue.clearDone">{{ t('queue.clearDone') }}</button>
      </div>
    </div>

    <div v-if="!queue.items.length" class="empty">
      <div class="empty-icon">⊞</div>
      <h2>{{ t('queue.emptyTitle') }}</h2>
      <p>{{ t('queue.emptyText') }}</p>
      <router-link to="/download" class="btn-primary link-btn">{{ t('nav.download') }} →</router-link>
    </div>

    <div v-else class="queue-list">
      <div v-for="item in queue.items" :key="item.id" class="queue-item">
        <div class="item-thumb">
          <img v-if="item.videoInfo?.thumbnail" :src="item.videoInfo.thumbnail" />
          <span v-else class="thumb-placeholder">▶</span>
        </div>

        <div class="item-info">
          <div class="item-title">{{ item.videoInfo?.title || item.url }}</div>
          <div class="item-url mono">{{ item.url }}</div>
          <div class="item-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: item.progress + '%' }" />
            </div>
            <div class="progress-meta mono">
              <span>{{ item.progress || 0 }}%</span>
              <span>{{ item.speed || '—' }}</span>
            </div>
          </div>
          <div v-if="item.error" class="item-error">{{ item.error }}</div>
        </div>

        <div class="item-right">
          <span :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
          <div class="item-actions">
            <button v-if="item.filePath" class="btn-ghost" @click="goUpload(item)">{{ t('nav.upload') }}</button>
            <button class="btn-ghost danger" @click="queue.removeItem(item.id)">✕</button>
          </div>
        </div>
      </div>
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
const processing = ref(false)
let removeProgress = null

onMounted(() => {
  removeProgress = window.electron?.onProgress(progress => {
    const item = queue.items.find(i => i.status === 'downloading')
    if (item) queue.updateItem(item.id, { progress: Math.round(progress.percent || 0), speed: progress.speed || '' })
  })
})

onUnmounted(() => removeProgress?.())

function statusClass(status) {
  const map = {
    pending: 'badge badge-pending',
    downloading: 'badge badge-downloading',
    downloaded: 'badge badge-downloaded',
    uploading: 'badge badge-uploading',
    done: 'badge badge-done',
    error: 'badge badge-error'
  }
  return map[status] || 'badge badge-pending'
}

function statusLabel(status) {
  return t(`queue.${status || 'pending'}`)
}

async function processAll() {
  if (processing.value) return
  processing.value = true

  for (const item of queue.items) {
    if (!['pending', 'error'].includes(item.status)) continue

    try {
      queue.updateItem(item.id, { status: 'downloading', progress: 0, error: null })
      const cfg = await window.electron.loadConfig()
      const result = await window.electron.ytdlpDownload({ url: item.url, outputDir: cfg.downloadDir || undefined })
      queue.updateItem(item.id, { status: 'downloaded', filePath: result.filePath, progress: 100 })
    } catch (e) {
      queue.updateItem(item.id, { status: 'error', error: e.message || String(e) })
    }
  }

  processing.value = false
}

function goUpload(item) {
  router.push({ path: '/upload', query: { file: item.filePath, title: item.videoInfo?.title } })
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px; gap: 20px; overflow: hidden; }
.view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-shrink: 0; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.link-btn { text-decoration: none; }
.empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; color: var(--text2); }
.empty-icon { font-size: 40px; color: var(--border2); }
.empty h2 { font-size: 18px; color: var(--text); }
.empty p { font-size: 13px; max-width: 320px; line-height: 1.6; }
.queue-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.queue-item { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; transition: border-color 0.12s; }
.queue-item:hover { border-color: var(--border2); }
.item-thumb { width: 96px; height: 54px; border-radius: 3px; overflow: hidden; flex-shrink: 0; background: var(--surface2); display: flex; align-items: center; justify-content: center; }
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { color: var(--text2); font-size: 18px; }
.item-info { flex: 1; min-width: 0; }
.item-title { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.item-url { font-size: 11px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; }
.item-progress { display: flex; flex-direction: column; gap: 4px; }
.progress-meta { display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); }
.item-error { font-size: 11px; color: var(--accent); font-family: var(--font-mono); margin-top: 6px; }
.item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
.item-actions { display: flex; gap: 6px; }
.danger { color: var(--accent); }
.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
</style>
