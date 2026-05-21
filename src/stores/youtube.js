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

  const CLIENT_ID = ref('')
  const CLIENT_SECRET = ref('')

  const isAuthenticated = computed(() => !!accessToken.value)
  const hasCredentials = computed(() => !!CLIENT_ID.value && !!CLIENT_SECRET.value)

  async function loadConfigSafe() {
    try {
      return await window.electron.loadConfig()
    } catch {
      return {}
    }
  }

  async function saveConfigPatch(patch) {
    const cfg = await loadConfigSafe()
    await window.electron.saveConfig({ ...cfg, ...patch })
  }

  async function loadConfig() {
    const cfg = await loadConfigSafe()
    CLIENT_ID.value = cfg.clientId || ''
    CLIENT_SECRET.value = cfg.clientSecret || ''
    accessToken.value = cfg.accessToken || null
    refreshToken.value = cfg.refreshToken || null
  }

  async function saveCredentials(clientId, clientSecret) {
    const nextClientId = String(clientId || '').trim()
    const nextClientSecret = String(clientSecret || '').trim()

    if (!nextClientId || !nextClientSecret) {
      throw new Error('Client ID and Client Secret are required')
    }

    const cfg = await loadConfigSafe()
    const changed = cfg.clientId !== nextClientId || cfg.clientSecret !== nextClientSecret

    const nextConfig = {
      ...cfg,
      clientId: nextClientId,
      clientSecret: nextClientSecret
    }

    CLIENT_ID.value = nextClientId
    CLIENT_SECRET.value = nextClientSecret

    if (changed) {
      nextConfig.accessToken = null
      nextConfig.refreshToken = null
      accessToken.value = null
      refreshToken.value = null
      channelInfo.value = null
      channelStats.value = null
      recentVideos.value = []
    }

    await window.electron.saveConfig(nextConfig)
  }

  async function saveTokens(access, refresh) {
    accessToken.value = access || null
    refreshToken.value = refresh || refreshToken.value || null

    await saveConfigPatch({
      accessToken: accessToken.value,
      refreshToken: refreshToken.value
    })
  }

  async function authorize() {
    if (!CLIENT_ID.value || !CLIENT_SECRET.value) {
      throw new Error('Save Client ID and Client Secret first')
    }

    isLoading.value = true
    error.value = null

    try {
      const data = await window.electron.youtubeAuthorize({
        clientId: CLIENT_ID.value,
        clientSecret: CLIENT_SECRET.value
      })

      await saveTokens(data.accessToken, data.refreshToken || refreshToken.value)
      await fetchChannelInfo()
      await fetchRecentVideos()

      return data
    } catch (e) {
      error.value = e.message || 'Authorization failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function refreshAccessToken() {
    if (!refreshToken.value) {
      throw new Error('Refresh token is missing. Connect YouTube again.')
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken.value,
        client_id: CLIENT_ID.value,
        client_secret: CLIENT_SECRET.value,
        grant_type: 'refresh_token'
      })
    })

    const data = await res.json()

    if (data.error) {
      throw new Error(data.error_description || data.error)
    }

    if (!data.access_token) {
      throw new Error('Google did not return a new access token')
    }

    await saveTokens(data.access_token, refreshToken.value)

    return data
  }

  async function apiFetch(url, options = {}) {
    if (!accessToken.value && refreshToken.value) {
      await refreshAccessToken()
    }

    if (!accessToken.value) {
      throw new Error('YouTube is not connected')
    }

    const buildOptions = () => ({
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
        ...(options.headers || {})
      }
    })

    let res = await fetch(url, buildOptions())

    if (res.status === 401 && refreshToken.value) {
      await refreshAccessToken()
      res = await fetch(url, buildOptions())
    }

    return res
  }

  async function readJson(res) {
    const text = await res.text()

    if (!text) return {}

    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }

  function apiError(data, fallback) {
    return data?.error?.message || data?.error_description || data?.error || fallback
  }

  async function fetchChannelInfo() {
    isLoading.value = true
    error.value = null

    try {
      const res = await apiFetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&mine=true')
      const data = await readJson(res)

      if (!res.ok) {
        throw new Error(apiError(data, 'Failed to fetch channel info'))
      }

      if (!data.items?.length) {
        throw new Error('No YouTube channel found on this Google account')
      }

      channelInfo.value = data.items[0].snippet
      channelStats.value = data.items[0].statistics

      return data.items[0]
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchRecentVideos(maxResults = 10) {
    isLoading.value = true
    error.value = null

    try {
      const chRes = await apiFetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true')
      const chData = await readJson(chRes)

      if (!chRes.ok) {
        throw new Error(apiError(chData, 'Failed to fetch channel uploads playlist'))
      }

      const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads

      if (!uploadsId) {
        recentVideos.value = []
        return []
      }

      const plRes = await apiFetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsId)}&maxResults=${maxResults}`)
      const plData = await readJson(plRes)

      if (!plRes.ok) {
        throw new Error(apiError(plData, 'Failed to fetch recent videos'))
      }

      const ids = plData.items?.map(i => i.contentDetails.videoId).filter(Boolean).join(',')

      if (!ids) {
        recentVideos.value = []
        return []
      }

      const vRes = await apiFetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${encodeURIComponent(ids)}`)
      const vData = await readJson(vRes)

      if (!vRes.ok) {
        throw new Error(apiError(vData, 'Failed to fetch videos'))
      }

      recentVideos.value = vData.items || []

      return recentVideos.value
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function uploadVideo({
    filePath,
    title,
    description,
    tags,
    categoryId,
    privacyStatus,
    publishAt,
    defaultLanguage,
    license,
    embeddable,
    notifySubscribers,
    madeForKids,
    ratingsVisible,
    onProgress
  }) {
    const snippet = {
      title,
      description: description || '',
      tags: tags || [],
      categoryId: categoryId || '22'
    }

    if (defaultLanguage) {
      snippet.defaultLanguage = defaultLanguage
    }

    const status = {
      privacyStatus: privacyStatus || 'private',
      license: license || 'youtube',
      embeddable: embeddable !== false,
      publicStatsViewable: ratingsVisible !== false,
      selfDeclaredMadeForKids: !!madeForKids
    }

    if (publishAt) {
      status.publishAt = publishAt
    }

    const notifyParam = notifySubscribers !== false ? 'true' : 'false'

    const initRes = await apiFetch(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${notifyParam}`, {
      method: 'POST',
      headers: {
        'X-Upload-Content-Type': 'video/mp4',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ snippet, status })
    })

    const initData = await readJson(initRes)

    if (!initRes.ok) {
      throw new Error(apiError(initData, 'Failed to start upload'))
    }

    const uploadUrl = initRes.headers.get('Location')

    if (!uploadUrl) {
      throw new Error('Failed to get upload URL')
    }

    const fileRes = await fetch(`file://${filePath}`)

    if (!fileRes.ok) {
      throw new Error('Failed to read video file')
    }

    const fileBuffer = await fileRes.arrayBuffer()
    const fileSize = fileBuffer.byteLength
    const chunkSize = 5 * 1024 * 1024

    let offset = 0
    let result = null

    while (offset < fileSize) {
      const end = Math.min(offset + chunkSize, fileSize)
      const chunk = fileBuffer.slice(offset, end)

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes ${offset}-${end - 1}/${fileSize}`
        },
        body: chunk
      })

      if (res.status === 200 || res.status === 201) {
        result = await res.json()
        if (onProgress) onProgress(100)
        break
      }

      if (res.status === 308) {
        const range = res.headers.get('Range')
        offset = range ? parseInt(range.split('-')[1], 10) + 1 : end
        if (onProgress) onProgress(Math.round((offset / fileSize) * 100))
        continue
      }

      const errText = await res.text()
      throw new Error(`Upload failed (${res.status}): ${errText}`)
    }

    return result
  }

  async function uploadThumbnail(videoId, file) {
    const buf = await file.arrayBuffer()

    const res = await apiFetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/jpeg'
      },
      body: buf
    })

    const data = await readJson(res)

    if (!res.ok) {
      throw new Error(apiError(data, 'Thumbnail upload failed'))
    }

    return data
  }

  async function logout() {
    accessToken.value = null
    refreshToken.value = null
    channelInfo.value = null
    channelStats.value = null
    recentVideos.value = []
    await saveConfigPatch({ accessToken: null, refreshToken: null })
  }

  return {
    accessToken,
    refreshToken,
    channelInfo,
    channelStats,
    recentVideos,
    isLoading,
    error,
    isAuthenticated,
    hasCredentials,
    CLIENT_ID,
    CLIENT_SECRET,
    loadConfig,
    saveCredentials,
    saveTokens,
    authorize,
    refreshAccessToken,
    fetchChannelInfo,
    fetchRecentVideos,
    uploadVideo,
    uploadThumbnail,
    logout
  }
})