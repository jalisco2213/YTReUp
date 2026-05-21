import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useQueueStore = defineStore('queue', () => {
  const items = ref([]) // { id, url, videoInfo, filePath, uploadMeta, status, progress, error, createdAt }

  function addItem(url, videoInfo) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    items.value.push({
      id,
      url,
      videoInfo,
      filePath: null,
      uploadMeta: null,
      status: 'pending', // pending | downloading | downloaded | uploading | done | error
      progress: 0,
      speed: '',
      error: null,
      createdAt: new Date().toISOString(),
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
    items.value = items.value.filter(i => i.status !== 'done')
  }

  return { items, addItem, updateItem, removeItem, clearDone }
})
