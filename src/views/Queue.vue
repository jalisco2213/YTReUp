<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Queue</h1>
        <p class="view-sub">Batch download & upload pipeline</p>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" @click="queue.clearDone()" v-if="hasDone">Clear done</button>
        <button class="btn-primary" @click="runAll" :disabled="isRunning || !hasPending">
          <span v-if="isRunning" class="spin">↻</span>
          <span v-else>▶</span>
          {{ isRunning ? 'Running…' : 'Run All' }}
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!queue.items.length" class="empty">
      <div class="empty-icon">⊞</div>
      <h2>Queue is empty</h2>
      <p>Add videos from the <strong>Download</strong> tab using "Add to Queue"</p>
    </div>

    <div v-else class="queue-list">
      <transition-group name="slide-up">
        <div v-for="item in queue.items" :key="item.id" class="queue-item">
          <div class="item-thumb">
            <img v-if="item.videoInfo?.thumbnail" :src="item.videoInfo.thumbnail" />
            <div v-else class="thumb-placeholder">▶</div>
          </div>
          <div class="item-info">
            <div class="item-title">{{ item.videoInfo?.title || item.url }}</div>
            <div class="item-url mono">{{ item.url }}</div>
            <div v-if="item.status === 'downloading' || item.status === 'uploading'" class="item-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: item.progress + '%' }" />
              </div>
              <span class="mono" style="font-size:11px;color:var(--text2)">
                {{ item.speed || '' }} {{ item.progress?.toFixed(1) }}%
              </span>
            </div>
            <div v-if="item.error" class="item-error">{{ item.error }}</div>
          </div>
          <div class="item-right">
            <span :class="badgeClass(item.status)">{{ item.status }}</span>
            <button class="btn-ghost" style="padding:4px 8px;font-size:12px" @click="queue.removeItem(item.id)">✕</button>
          </div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useQueueStore } from '@/stores/queue'
import { useYouTubeStore } from '@/stores/youtube'

const queue = useQueueStore()
const yt = useYouTubeStore()

const isRunning = ref(false)

const hasDone = computed(() => queue.items.some(i => i.status === 'done'))
const hasPending = computed(() => queue.items.some(i => i.status === 'pending'))

let removeProgress = null

onMounted(() => {
  removeProgress = window.electron?.onProgress(() => {})
})
onUnmounted(() => removeProgress?.())

async function runAll() {
  if (isRunning.value) return
  isRunning.value = true

  // Process pending items one by one
  for (const item of queue.items.filter(i => i.status === 'pending')) {
    // Download
    queue.updateItem(item.id, { status: 'downloading', progress: 0 })
    const removeP = window.electron?.onProgress(p => {
      queue.updateItem(item.id, { progress: p.percent, speed: p.speed })
    })
    try {
      const result = await window.electron.ytdlpDownload({ url: item.url })
      queue.updateItem(item.id, { status: 'downloaded', filePath: result.filePath, progress: 100 })
      removeP?.()
    } catch (e) {
      queue.updateItem(item.id, { status: 'error', error: e.message })
      removeP?.()
      continue
    }

    // Upload if authenticated
    if (yt.isAuthenticated) {
      queue.updateItem(item.id, { status: 'uploading' })
      try {
        const uploadMeta = item.uploadMeta || {
          title: item.videoInfo?.title || 'Untitled',
          description: item.videoInfo?.description || '',
          privacyStatus: 'private',
        }
        await yt.uploadVideo({
          filePath: item.filePath,
          ...uploadMeta,
        })
        queue.updateItem(item.id, { status: 'done' })
      } catch (e) {
        queue.updateItem(item.id, { status: 'error', error: e.message })
      }
    } else {
      // Just mark as downloaded if no auth
      queue.updateItem(item.id, { status: 'downloaded' })
    }
  }

  isRunning.value = false
  if (yt.isAuthenticated) yt.fetchRecentVideos()
}

function badgeClass(status) {
  return `badge badge-${status}`
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px; gap: 20px; overflow: hidden; }
.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-shrink: 0;
}
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.header-actions { display: flex; gap: 10px; align-items: center; }

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  color: var(--text2);
}
.empty-icon { font-size: 40px; color: var(--border2); }
.empty h2 { font-size: 18px; color: var(--text); }
.empty p { font-size: 13px; max-width: 320px; line-height: 1.6; }

.queue-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.queue-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  transition: border-color 0.12s;
}
.queue-item:hover { border-color: var(--border2); }

.item-thumb {
  width: 80px;
  height: 45px;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--surface2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { color: var(--text2); font-size: 18px; }

.item-info { flex: 1; min-width: 0; }
.item-title { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.item-url { font-size: 11px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; }
.item-progress { display: flex; flex-direction: column; gap: 4px; }
.item-error { font-size: 11px; color: var(--accent); font-family: var(--font-mono); margin-top: 6px; }

.item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }

.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
</style>
