import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useQueueStore = defineStore('queue', () => {
  const items = ref([])

  function loadQueue() {
    try {
      const raw = localStorage.getItem('ytreup.queue')
      items.value = raw ? JSON.parse(raw) : []
    } catch {
      items.value = []
    }
  }

  function addItem(url, videoInfo, options = {}) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    items.value.push({
      id,
      url,
      videoInfo,
      filePath: null,
      uploadMeta: null,
      format: options.format || null,
      outputDir: options.outputDir || null,
      status: 'pending',
      progress: 0,
      size: '',
      speed: '',
      etaSeconds: null,
      error: null,
      startedAt: null,
      createdAt: new Date().toISOString()
    })

    return id
  }

  function updateItem(id, patch) {
    const idx = items.value.findIndex(i => i.id === id)
    if (idx !== -1) Object.assign(items.value[idx], patch)
  }

  function removeItem(id) {
    items.value = items.value.filter(i => i.id !== id)
  }

  function clearDone() {
    items.value = items.value.filter(i => !['done', 'downloaded'].includes(i.status))
  }

  function clearAll() {
    items.value = []
  }

  loadQueue()

  watch(items, value => {
    try {
      localStorage.setItem('ytreup.queue', JSON.stringify(value))
    } catch {}
  }, { deep: true })

  return { items, loadQueue, addItem, updateItem, removeItem, clearDone, clearAll }
})