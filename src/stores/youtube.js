import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

function parseDuration(value) {
  if (!value) return 0
  const match = String(value).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (parseInt(match[1] || '0') * 3600) + (parseInt(match[2] || '0') * 60) + parseInt(match[3] || '0')
}

function normalizeVideo(video) {
  const seconds = parseDuration(video?.contentDetails?.duration)
  return {
    ...video,
    durationSeconds: seconds,
    videoType: seconds > 0 && seconds <= 60 ? 'shorts' : 'video'
  }
}

export const useYouTubeStore = defineStore('youtube', () => {
  const accessToken = ref(null)
  const refreshToken = ref(null)
  const channelInfo = ref(null)
  const channelStats = ref(null)
  const recentVideos = ref([])
  const videos = ref([])
  const videosNextPageToken = ref('')
  const selectedVideo = ref(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
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

    CLIENT_ID.value = nextClientId
    CLIENT_SECRET.value = nextClientSecret

    const nextConfig = {
      ...cfg,
      clientId: nextClientId,
      clientSecret: nextClientSecret
    }

    if (changed) {
      nextConfig.accessToken = null
      nextConfig.refreshToken = null
      accessToken.value = null
      refreshToken.value = null
      channelInfo.value = null
      channelStats.value = null
      recentVideos.value = []
      videos.value = []
      selectedVideo.value = null
      videosNextPageToken.value = ''
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
      await fetchRecentVideos(12)
      await fetchVideos({ maxResults: 25 })
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

  function buildUrl(endpoint, params) {
    const url = new URL(endpoint)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    })
    return url.toString()
  }

  async function fetchChannelInfo() {
    isLoading.value = true
    error.value = null

    try {
      const res = await apiFetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,contentDetails&mine=true')
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

  async function getUploadsPlaylistId() {
    const res = await apiFetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true')
    const data = await readJson(res)

    if (!res.ok) {
      throw new Error(apiError(data, 'Failed to fetch channel uploads playlist'))
    }

    return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || ''
  }

  async function fetchVideosByIds(ids) {
    const cleanIds = Array.isArray(ids) ? ids.filter(Boolean) : []
    if (!cleanIds.length) return []

    const res = await apiFetch(buildUrl('https://www.googleapis.com/youtube/v3/videos', {
      part: 'snippet,statistics,status,contentDetails,recordingDetails,localizations',
      id: cleanIds.join(',')
    }))
    const data = await readJson(res)

    if (!res.ok) {
      throw new Error(apiError(data, 'Failed to fetch videos'))
    }

    return (data.items || []).map(normalizeVideo)
  }

  async function fetchRecentVideos(maxResults = 12) {
    isLoading.value = true
    error.value = null

    try {
      const uploadsId = await getUploadsPlaylistId()
      if (!uploadsId) {
        recentVideos.value = []
        return []
      }

      const plRes = await apiFetch(buildUrl('https://www.googleapis.com/youtube/v3/playlistItems', {
        part: 'snippet,contentDetails',
        playlistId: uploadsId,
        maxResults: Math.min(Math.max(parseInt(maxResults || 12), 1), 50)
      }))
      const plData = await readJson(plRes)

      if (!plRes.ok) {
        throw new Error(apiError(plData, 'Failed to fetch recent videos'))
      }

      const ids = plData.items?.map(i => i.contentDetails?.videoId).filter(Boolean) || []
      recentVideos.value = await fetchVideosByIds(ids)
      return recentVideos.value
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchVideos({ maxResults = 25, pageToken = '', append = false, query = '' } = {}) {
    isLoading.value = true
    error.value = null

    try {
      const limit = Math.min(Math.max(parseInt(maxResults || 25), 1), 50)
      let ids = []
      let next = ''

      if (String(query || '').trim()) {
        const searchRes = await apiFetch(buildUrl('https://www.googleapis.com/youtube/v3/search', {
          part: 'snippet',
          forMine: 'true',
          type: 'video',
          q: String(query).trim(),
          maxResults: limit,
          pageToken
        }))
        const searchData = await readJson(searchRes)

        if (!searchRes.ok) {
          throw new Error(apiError(searchData, 'Failed to search videos'))
        }

        ids = searchData.items?.map(i => i.id?.videoId).filter(Boolean) || []
        next = searchData.nextPageToken || ''
      } else {
        const uploadsId = await getUploadsPlaylistId()
        if (!uploadsId) {
          videos.value = []
          videosNextPageToken.value = ''
          return []
        }

        const plRes = await apiFetch(buildUrl('https://www.googleapis.com/youtube/v3/playlistItems', {
          part: 'snippet,contentDetails',
          playlistId: uploadsId,
          maxResults: limit,
          pageToken
        }))
        const plData = await readJson(plRes)

        if (!plRes.ok) {
          throw new Error(apiError(plData, 'Failed to fetch videos'))
        }

        ids = plData.items?.map(i => i.contentDetails?.videoId).filter(Boolean) || []
        next = plData.nextPageToken || ''
      }

      const list = await fetchVideosByIds(ids)
      videos.value = append ? [...videos.value, ...list] : list
      videosNextPageToken.value = next
      return videos.value
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function fetchVideoDetails(videoId) {
    if (!videoId) throw new Error('Video ID is required')

    isLoading.value = true
    error.value = null

    try {
      const list = await fetchVideosByIds([videoId])
      if (!list.length) throw new Error('Video not found')
      selectedVideo.value = list[0]
      return list[0]
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function buildVideoPayload(currentVideo, patch) {
    const snippet = {
      title: patch.title ?? currentVideo?.snippet?.title ?? '',
      description: patch.description ?? currentVideo?.snippet?.description ?? '',
      tags: Array.isArray(patch.tags) ? patch.tags : (currentVideo?.snippet?.tags || []),
      categoryId: patch.categoryId ?? currentVideo?.snippet?.categoryId ?? '22'
    }

    const defaultLanguage = patch.defaultLanguage ?? currentVideo?.snippet?.defaultLanguage
    if (defaultLanguage) snippet.defaultLanguage = defaultLanguage

    const status = {
      privacyStatus: patch.privacyStatus ?? currentVideo?.status?.privacyStatus ?? 'private',
      license: patch.license ?? currentVideo?.status?.license ?? 'youtube',
      embeddable: patch.embeddable ?? currentVideo?.status?.embeddable ?? true,
      publicStatsViewable: patch.ratingsVisible ?? currentVideo?.status?.publicStatsViewable ?? true,
      selfDeclaredMadeForKids: patch.madeForKids ?? currentVideo?.status?.selfDeclaredMadeForKids ?? false
    }

    const publishAt = patch.publishAt ?? currentVideo?.status?.publishAt
    if (publishAt && status.privacyStatus === 'private') status.publishAt = publishAt

    return {
      id: currentVideo.id,
      snippet,
      status
    }
  }

  async function updateVideo(videoId, patch) {
    isSaving.value = true
    error.value = null

    try {
      const current = selectedVideo.value?.id === videoId ? selectedVideo.value : await fetchVideoDetails(videoId)
      const payload = buildVideoPayload(current, patch)

      const res = await apiFetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await readJson(res)

      if (!res.ok) {
        throw new Error(apiError(data, 'Failed to update video'))
      }

      const normalized = normalizeVideo(data)
      selectedVideo.value = normalized
      videos.value = videos.value.map(v => v.id === normalized.id ? normalized : v)
      recentVideos.value = recentVideos.value.map(v => v.id === normalized.id ? normalized : v)
      return normalized
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      isSaving.value = false
    }
  }

  function createUploadSessionId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
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
    const targetPath = String(filePath || '').trim()

    if (!targetPath) {
      throw new Error('Выберите видеофайл')
    }

    if (!window.electron?.youtubeUploadVideo) {
      throw new Error('Файловый мост Electron недоступен. Проверь preload.js и перезапусти приложение.')
    }

    if (!accessToken.value && refreshToken.value) {
      await refreshAccessToken()
    }

    if (!accessToken.value) {
      throw new Error('YouTube is not connected')
    }

    const snippet = {
      title,
      description: description || '',
      tags: tags || [],
      categoryId: categoryId || '22'
    }

    if (defaultLanguage) snippet.defaultLanguage = defaultLanguage

    const status = {
      privacyStatus: privacyStatus === 'scheduled' ? 'private' : (privacyStatus || 'private'),
      license: license || 'youtube',
      embeddable: embeddable !== false,
      publicStatsViewable: ratingsVisible !== false,
      selfDeclaredMadeForKids: !!madeForKids
    }

    if (publishAt && privacyStatus === 'scheduled') {
      status.publishAt = new Date(publishAt).toISOString()
    }

    const sessionId = createUploadSessionId()
    let removeProgress = null

    if (window.electron?.onYouTubeUploadProgress && typeof onProgress === 'function') {
      removeProgress = window.electron.onYouTubeUploadProgress(data => {
        if (data?.id === sessionId) onProgress(data.percent || 0)
      })
    }

    const payload = () => ({
      sessionId,
      accessToken: accessToken.value,
      filePath: targetPath,
      snippet,
      status,
      notifySubscribers: notifySubscribers !== false
    })

    try {
      if (typeof onProgress === 'function') onProgress(0)

      try {
        const result = await window.electron.youtubeUploadVideo(payload())
        if (typeof onProgress === 'function') onProgress(100)
        if (result?.id) fetchRecentVideos(12).catch(() => {})
        return result
      } catch (e) {
        const message = e.message || String(e)

        if (message.includes('(401)') && refreshToken.value) {
          await refreshAccessToken()
          const result = await window.electron.youtubeUploadVideo(payload())
          if (typeof onProgress === 'function') onProgress(100)
          if (result?.id) fetchRecentVideos(12).catch(() => {})
          return result
        }

        throw e
      }
    } finally {
      removeProgress?.()
    }
  }

  async function uploadThumbnail(videoId, file) {
    const buf = await file.arrayBuffer()

    const res = await apiFetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg' },
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
    videos.value = []
    selectedVideo.value = null
    videosNextPageToken.value = ''
    await saveConfigPatch({ accessToken: null, refreshToken: null })
  }

  return {
    accessToken,
    refreshToken,
    channelInfo,
    channelStats,
    recentVideos,
    videos,
    videosNextPageToken,
    selectedVideo,
    isLoading,
    isSaving,
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
    fetchVideos,
    fetchVideoDetails,
    updateVideo,
    uploadVideo,
    uploadThumbnail,
    logout,
    parseDuration
  }
})
