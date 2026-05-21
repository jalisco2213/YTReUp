import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useYouTubeStore = defineStore('youtube', () => {
  const accessToken = ref(null)
  const refreshToken = ref(null)
  const channelInfo = ref(null)
  const channelStats = ref(null)
  const recentVideos = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => !!accessToken.value)

  const CLIENT_ID = ref('')
  const CLIENT_SECRET = ref('')

  async function loadConfig() {
    const cfg = await window.electron.loadConfig()
    CLIENT_ID.value = cfg.clientId || ''
    CLIENT_SECRET.value = cfg.clientSecret || ''
    accessToken.value = cfg.accessToken || null
    refreshToken.value = cfg.refreshToken || null
  }

  async function saveTokens(access, refresh) {
    accessToken.value = access
    refreshToken.value = refresh
    const cfg = await window.electron.loadConfig()
    await window.electron.saveConfig({ ...cfg, accessToken: access, refreshToken: refresh })
  }

  function getAuthUrl() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID.value,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
    })
    return `https://accounts.google.com/o/oauth2/auth?${params}`
  }

  async function exchangeCode(code) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID.value,
        client_secret: CLIENT_SECRET.value,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'authorization_code',
      })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error_description || data.error)
    await saveTokens(data.access_token, data.refresh_token || refreshToken.value)
    return data
  }

  async function refreshAccessToken() {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken.value,
        client_id: CLIENT_ID.value,
        client_secret: CLIENT_SECRET.value,
        grant_type: 'refresh_token',
      })
    })
    const data = await res.json()
    if (data.access_token) {
      await saveTokens(data.access_token, refreshToken.value)
    }
    return data
  }

  async function apiFetch(url, options = {}) {
    let res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken.value}`,
        'Content-Type': 'application/json',
        ...options.headers,
      }
    })
    if (res.status === 401) {
      await refreshAccessToken()
      res = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken.value}`,
          'Content-Type': 'application/json',
          ...options.headers,
        }
      })
    }
    return res
  }

  async function fetchChannelInfo() {
    isLoading.value = true
    error.value = null
    try {
      const res = await apiFetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&mine=true'
      )
      const data = await res.json()
      if (!data.items?.length) throw new Error('No channel found')
      channelInfo.value = data.items[0].snippet
      channelStats.value = data.items[0].statistics
    } catch (e) {
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  async function fetchRecentVideos(maxResults = 10) {
    isLoading.value = true
    try {
      // First get uploads playlist
      const chRes = await apiFetch(
        'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true'
      )
      const chData = await chRes.json()
      const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
      if (!uploadsId) return

      const plRes = await apiFetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=${maxResults}`
      )
      const plData = await plRes.json()
      const ids = plData.items?.map(i => i.contentDetails.videoId).join(',')
      if (!ids) return

      const vRes = await apiFetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${ids}`
      )
      const vData = await vRes.json()
      recentVideos.value = vData.items || []
    } catch (e) {
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  async function uploadVideo({
    filePath, title, description, tags, categoryId,
    privacyStatus, publishAt, defaultLanguage,
    license, embeddable, notifySubscribers, madeForKids,
    commentStatus, ratingsVisible, onProgress,
  }) {
    const snippet = {
      title,
      description: description || '',
      tags: tags || [],
      categoryId: categoryId || '22',
    }
    if (defaultLanguage) snippet.defaultLanguage = defaultLanguage

    const status = {
      privacyStatus: privacyStatus || 'private',
      license: license || 'youtube',
      embeddable: embeddable !== false,
      publicStatsViewable: ratingsVisible !== false,
      selfDeclaredMadeForKids: !!madeForKids,
    }
    if (publishAt) status.publishAt = publishAt

    const notifyParam = notifySubscribers !== false ? 'true' : 'false'
    const initRes = await apiFetch(
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${notifyParam}`,
      {
        method: 'POST',
        headers: {
          'X-Upload-Content-Type': 'video/mp4',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snippet, status })
      }
    )
    const uploadUrl = initRes.headers.get('Location')
    if (!uploadUrl) throw new Error('Failed to get upload URL')

    const fileRes = await fetch(`file://${filePath}`)
    const fileBuffer = await fileRes.arrayBuffer()
    const fileSize = fileBuffer.byteLength

    const CHUNK = 5 * 1024 * 1024
    let offset = 0
    let result = null

    while (offset < fileSize) {
      const end = Math.min(offset + CHUNK, fileSize)
      const chunk = fileBuffer.slice(offset, end)

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${offset}-${end - 1}/${fileSize}`,
        },
        body: chunk,
      })

      offset = end
      if (onProgress) onProgress(Math.round((offset / fileSize) * 100))

      if (res.status === 200 || res.status === 201) {
        result = await res.json()
        break
      } else if (res.status === 308) {
        const range = res.headers.get('Range')
        if (range) offset = parseInt(range.split('-')[1]) + 1
      } else {
        const err = await res.text()
        throw new Error(`Upload failed (${res.status}): ${err}`)
      }
    }

    return result
  }

  async function uploadThumbnail(videoId, file) {
    const buf = await file.arrayBuffer()
    const res = await apiFetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
      {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: buf,
      }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Thumbnail upload failed: ${err}`)
    }
    return res.json()
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    channelInfo.value = null
    channelStats.value = null
    recentVideos.value = []
  }

  return {
    accessToken, refreshToken, channelInfo, channelStats, recentVideos,
    isLoading, error, isAuthenticated, CLIENT_ID, CLIENT_SECRET,
    loadConfig, saveTokens, getAuthUrl, exchangeCode, refreshAccessToken,
    fetchChannelInfo, fetchRecentVideos, uploadVideo, uploadThumbnail, logout,
  }
})
