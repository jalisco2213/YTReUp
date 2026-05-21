<template>
  <div class="view videos-page">
    <div class="view-header">
      <div>
        <h1>{{ t('videos.title') }}</h1>
        <p class="view-sub">{{ t('videos.subtitle') }}</p>
      </div>
      <button class="btn-secondary" @click="reload" :disabled="yt.isLoading">
        <span :class="{ spin: yt.isLoading }">↻</span>
        {{ yt.isLoading ? t('common.refreshing') : t('common.refresh') }}
      </button>
    </div>

    <div v-if="!yt.isAuthenticated" class="auth-prompt card">
      <div class="auth-icon">▶</div>
      <h2>{{ t('dashboard.authTitle') }}</h2>
      <p>{{ t('dashboard.authText') }}</p>
      <router-link to="/settings" class="btn-primary link-btn">{{ t('dashboard.openSettings') }} →</router-link>
    </div>

    <template v-else>
      <div class="toolbar card">
        <div class="search-box">
          <label class="label">{{ t('common.search') }}</label>
          <div class="search-row">
            <input v-model="query" :placeholder="t('videos.searchPlaceholder')" @keyup.enter="reload" />
            <button class="btn-secondary" @click="reload" :disabled="yt.isLoading">
              {{ t('common.search') }}
            </button>
            <button v-if="query" class="btn-ghost" @click="clearSearch">{{ t('common.clear') }}</button>
          </div>
          <div class="mini-hint">{{ t('videos.searchQuota') }}</div>
        </div>

        <div class="filter-box">
          <label class="label">{{ t('videos.filter') }}</label>
          <div class="segmented">
            <button :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">{{ t('common.all') }}</button>
            <button :class="{ active: typeFilter === 'video' }" @click="typeFilter = 'video'">{{ t('common.videos') }}</button>
            <button :class="{ active: typeFilter === 'shorts' }" @click="typeFilter = 'shorts'">{{ t('common.shorts') }}</button>
          </div>
        </div>

        <div class="amount-box">
          <label class="label">{{ t('videos.amount') }}</label>
          <select v-model="maxResults" @change="reload">
            <option :value="12">12</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
        </div>
      </div>

      <div class="content-grid">
        <div class="list-panel card">
          <div class="panel-head">
            <span>{{ filteredVideos.length }} {{ t('dashboard.shown') }}</span>
            <span class="mono">{{ typeFilterLabel }}</span>
          </div>

          <div class="hint-card">{{ t('videos.hint') }}</div>

          <div v-if="yt.isLoading && !yt.videos.length" class="loading-list">
            <div v-for="i in 6" :key="i" class="skeleton-row" />
          </div>

          <div v-else-if="!filteredVideos.length" class="empty">
            <div class="empty-icon">⌕</div>
            <h2>{{ t('videos.emptyTitle') }}</h2>
            <p>{{ t('videos.emptyText') }}</p>
          </div>

          <div v-else class="video-list">
            <div
              v-for="video in filteredVideos"
              :key="video.id"
              class="video-card"
              :class="{ selected: selected?.id === video.id }"
              @click="selectVideo(video.id)"
            >
              <div class="thumb-wrap">
                <img :src="thumb(video)" class="thumb" />
                <span class="duration-badge">{{ formatDuration(video.durationSeconds) }}</span>
              </div>
              <div class="video-main">
                <div class="video-title">{{ video.snippet.title }}</div>
                <div class="video-desc">{{ video.snippet.description || '—' }}</div>
                <div class="video-meta">
                  <span class="mono">{{ formatDate(video.snippet.publishedAt) }}</span>
                  <span class="dot">·</span>
                  <span class="mono">{{ formatNum(video.statistics?.viewCount) }} {{ t('common.views') }}</span>
                  <span class="dot">·</span>
                  <span class="mono">{{ formatNum(video.statistics?.likeCount) }} {{ t('common.likes') }}</span>
                </div>
              </div>
              <div class="video-side">
                <span class="badge" :class="video.videoType === 'shorts' ? 'badge-downloading' : 'badge-downloaded'">
                  {{ video.videoType === 'shorts' ? t('common.shorts') : t('common.videos') }}
                </span>
                <span :class="privacyClass(video.status?.privacyStatus)">{{ privacyLabel(video.status?.privacyStatus) }}</span>
              </div>
            </div>
          </div>

          <button
            v-if="yt.videosNextPageToken"
            class="btn-secondary load-more"
            @click="loadMore"
            :disabled="yt.isLoading"
          >
            <span :class="{ spin: yt.isLoading }">↻</span>
            {{ t('common.loadMore') }}
          </button>
        </div>

        <div class="details-panel card">
          <div v-if="!selected" class="details-empty">
            <div class="details-icon">▶</div>
            <h2>{{ t('videos.details') }}</h2>
            <p>{{ t('videos.selectVideo') }}</p>
          </div>

          <template v-else>
            <div class="details-head">
              <div>
                <div class="section-title">{{ t('videos.details') }}</div>
                <h2>{{ selected.snippet.title }}</h2>
              </div>
              <span :class="privacyClass(selected.status?.privacyStatus)">{{ privacyLabel(selected.status?.privacyStatus) }}</span>
            </div>

            <img :src="largeThumb(selected)" class="detail-thumb" />

            <div class="quick-actions">
              <button class="btn-secondary" @click="openOnYoutube(selected.id)">{{ t('videos.openOnYouTube') }} →</button>
              <button class="btn-secondary" @click="copyLink(selected.id)">{{ copied ? t('common.copied') : t('videos.copyLink') }}</button>
            </div>

            <div class="metrics-grid">
              <div>
                <span>{{ t('common.views') }}</span>
                <strong>{{ formatNum(selected.statistics?.viewCount) }}</strong>
              </div>
              <div>
                <span>{{ t('common.likes') }}</span>
                <strong>{{ formatNum(selected.statistics?.likeCount) }}</strong>
              </div>
              <div>
                <span>{{ t('common.comments') }}</span>
                <strong>{{ formatNum(selected.statistics?.commentCount) }}</strong>
              </div>
              <div>
                <span>{{ t('common.duration') }}</span>
                <strong>{{ formatDuration(selected.durationSeconds) }}</strong>
              </div>
            </div>

            <div class="form-grid">
              <div class="field full">
                <label class="label">{{ t('common.title') }}</label>
                <input v-model="edit.title" maxlength="100" />
                <div class="char-count">{{ edit.title.length }}/100</div>
              </div>

              <div class="field full">
                <label class="label">{{ t('common.description') }}</label>
                <textarea v-model="edit.description" rows="7" maxlength="5000" />
                <div class="char-count">{{ edit.description.length }}/5000</div>
              </div>

              <div class="field full">
                <label class="label">{{ t('common.tags') }}</label>
                <input v-model="edit.tagsRaw" placeholder="tag1, tag2, tag3" />
                <div v-if="parsedTags.length" class="tags-preview">
                  <span v-for="tag in parsedTags" :key="tag" class="tag-chip">{{ tag }}</span>
                </div>
              </div>

              <div class="field">
                <label class="label">{{ t('common.privacy') }}</label>
                <select v-model="edit.privacyStatus">
                  <option value="public">{{ t('common.public') }}</option>
                  <option value="unlisted">{{ t('common.unlisted') }}</option>
                  <option value="private">{{ t('common.private') }}</option>
                </select>
              </div>

              <div class="field">
                <label class="label">{{ t('common.category') }}</label>
                <select v-model="edit.categoryId">
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </div>

              <div class="field">
                <label class="label">{{ t('common.language') }}</label>
                <select v-model="edit.defaultLanguage">
                  <option value="">{{ t('common.notSet') }}</option>
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                  <option value="uk">Українська</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="pt">Português</option>
                </select>
              </div>

              <div class="field">
                <label class="label">{{ t('common.license') }}</label>
                <select v-model="edit.license">
                  <option value="youtube">Standard YouTube License</option>
                  <option value="creativeCommon">Creative Commons</option>
                </select>
              </div>
            </div>

            <div class="toggles">
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">{{ t('videos.madeForKids') }}</div>
                  <div class="toggle-desc">{{ edit.madeForKids ? t('common.yes') : t('common.no') }}</div>
                </div>
                <button class="toggle" :class="{ on: edit.madeForKids }" @click="edit.madeForKids = !edit.madeForKids"><span /></button>
              </div>
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">{{ t('videos.embeddable') }}</div>
                  <div class="toggle-desc">{{ edit.embeddable ? t('common.yes') : t('common.no') }}</div>
                </div>
                <button class="toggle" :class="{ on: edit.embeddable }" @click="edit.embeddable = !edit.embeddable"><span /></button>
              </div>
              <div class="toggle-row">
                <div>
                  <div class="toggle-label">{{ t('videos.ratingsVisible') }}</div>
                  <div class="toggle-desc">{{ edit.ratingsVisible ? t('common.yes') : t('common.no') }}</div>
                </div>
                <button class="toggle" :class="{ on: edit.ratingsVisible }" @click="edit.ratingsVisible = !edit.ratingsVisible"><span /></button>
              </div>
            </div>

            <div v-if="saveMessage" class="success-msg">{{ saveMessage }}</div>
            <div v-if="error" class="error-msg">{{ error }}</div>

            <button class="btn-primary save-btn" @click="saveVideo" :disabled="yt.isSaving || !edit.title">
              <span v-if="yt.isSaving" class="spin">↻</span>
              {{ yt.isSaving ? t('common.savingChanges') : t('common.saveChanges') }}
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useYouTubeStore } from '@/stores/youtube'
import { useI18nStore } from '@/stores/i18n'

const route = useRoute()
const router = useRouter()
const yt = useYouTubeStore()
const i18n = useI18nStore()
const t = i18n.t

const query = ref('')
const typeFilter = ref('all')
const maxResults = ref(25)
const copied = ref(false)
const saveMessage = ref('')
const error = ref('')
const selected = computed(() => yt.selectedVideo)

const categories = [
  { id: '1', name: 'Film & Animation' },
  { id: '2', name: 'Autos & Vehicles' },
  { id: '10', name: 'Music' },
  { id: '15', name: 'Pets & Animals' },
  { id: '17', name: 'Sports' },
  { id: '19', name: 'Travel & Events' },
  { id: '20', name: 'Gaming' },
  { id: '22', name: 'People & Blogs' },
  { id: '23', name: 'Comedy' },
  { id: '24', name: 'Entertainment' },
  { id: '25', name: 'News & Politics' },
  { id: '26', name: 'Howto & Style' },
  { id: '27', name: 'Education' },
  { id: '28', name: 'Science & Technology' }
]

const edit = ref({
  title: '',
  description: '',
  tagsRaw: '',
  privacyStatus: 'private',
  categoryId: '22',
  defaultLanguage: '',
  license: 'youtube',
  madeForKids: false,
  embeddable: true,
  ratingsVisible: true
})

const parsedTags = computed(() => edit.value.tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 500))

const filteredVideos = computed(() => {
  if (typeFilter.value === 'all') return yt.videos
  return yt.videos.filter(video => video.videoType === typeFilter.value)
})

const typeFilterLabel = computed(() => {
  if (typeFilter.value === 'shorts') return t('common.shorts')
  if (typeFilter.value === 'video') return t('common.videos')
  return t('common.all')
})

watch(() => yt.selectedVideo, video => {
  if (!video) return
  edit.value = {
    title: video.snippet?.title || '',
    description: video.snippet?.description || '',
    tagsRaw: (video.snippet?.tags || []).join(', '),
    privacyStatus: video.status?.privacyStatus || 'private',
    categoryId: video.snippet?.categoryId || '22',
    defaultLanguage: video.snippet?.defaultLanguage || '',
    license: video.status?.license || 'youtube',
    madeForKids: !!video.status?.selfDeclaredMadeForKids || !!video.status?.madeForKids,
    embeddable: video.status?.embeddable !== false,
    ratingsVisible: video.status?.publicStatsViewable !== false
  }
}, { immediate: true })

onMounted(async () => {
  if (!yt.isAuthenticated) return
  if (!yt.videos.length) await reload()
  if (route.query.id) await selectVideo(String(route.query.id))
})

async function reload() {
  error.value = ''
  saveMessage.value = ''
  try {
    await yt.fetchVideos({ maxResults: maxResults.value, query: query.value })
  } catch (e) {
    error.value = e.message
  }
}

async function loadMore() {
  error.value = ''
  try {
    await yt.fetchVideos({ maxResults: maxResults.value, query: query.value, pageToken: yt.videosNextPageToken, append: true })
  } catch (e) {
    error.value = e.message
  }
}

async function clearSearch() {
  query.value = ''
  await reload()
}

async function selectVideo(id) {
  error.value = ''
  saveMessage.value = ''
  try {
    await yt.fetchVideoDetails(id)
    router.replace({ path: '/videos', query: { id } })
  } catch (e) {
    error.value = e.message
  }
}

async function saveVideo() {
  if (!selected.value) return
  error.value = ''
  saveMessage.value = ''

  try {
    await yt.updateVideo(selected.value.id, {
      title: edit.value.title,
      description: edit.value.description,
      tags: parsedTags.value,
      privacyStatus: edit.value.privacyStatus,
      categoryId: edit.value.categoryId,
      defaultLanguage: edit.value.defaultLanguage,
      license: edit.value.license,
      madeForKids: edit.value.madeForKids,
      embeddable: edit.value.embeddable,
      ratingsVisible: edit.value.ratingsVisible
    })
    saveMessage.value = t('videos.videoSaved')
  } catch (e) {
    error.value = e.message
  }
}

function formatNum(n) {
  if (!n) return '0'
  const num = parseInt(n)
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

function formatDate(d) {
  if (!d) return ''
  const locale = i18n.language === 'ru' ? 'ru-RU' : 'en-GB'
  return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function privacyClass(s) {
  return `badge badge-${s === 'public' ? 'done' : s === 'private' ? 'pending' : 'downloading'}`
}

function privacyLabel(s) {
  if (s === 'public') return t('common.public')
  if (s === 'unlisted') return t('common.unlisted')
  return t('common.private')
}

function thumb(video) {
  return video?.snippet?.thumbnails?.medium?.url || video?.snippet?.thumbnails?.default?.url || ''
}

function largeThumb(video) {
  return video?.snippet?.thumbnails?.maxres?.url || video?.snippet?.thumbnails?.high?.url || video?.snippet?.thumbnails?.medium?.url || ''
}

function openOnYoutube(id) {
  window.electron?.openExternal(`https://youtu.be/${id}`)
}

async function copyLink(id) {
  await window.electron?.writeClipboard(`https://youtu.be/${id}`)
  copied.value = true
  setTimeout(() => copied.value = false, 1400)
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px; gap: 16px; overflow: hidden; }
.view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-shrink: 0; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.link-btn { text-decoration: none; }

.auth-prompt { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
.auth-icon { font-size: 44px; color: var(--accent); }
.auth-prompt p { color: var(--text2); max-width: 420px; line-height: 1.6; }

.toolbar { display: grid; grid-template-columns: 1fr auto 120px; gap: 16px; align-items: end; flex-shrink: 0; }
.search-row { display: flex; gap: 8px; }
.search-row input { min-width: 260px; }
.mini-hint { font-size: 11px; color: var(--text2); margin-top: 8px; line-height: 1.4; }
.segmented { display: flex; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 3px; }
.segmented button { padding: 8px 12px; background: transparent; color: var(--text2); border-radius: 4px; white-space: nowrap; }
.segmented button.active { background: var(--surface2); color: var(--text); }

.content-grid { display: grid; grid-template-columns: minmax(420px, 1fr) 430px; gap: 16px; min-height: 0; flex: 1; }
.list-panel, .details-panel { min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.panel-head { display: flex; align-items: center; justify-content: space-between; color: var(--text2); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }
.hint-card { padding: 10px 12px; border: 1px solid var(--border); background: var(--bg2); color: var(--text2); border-radius: var(--radius); font-size: 12px; line-height: 1.5; margin-bottom: 10px; }
.video-list { overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 2px; }
.video-card { display: grid; grid-template-columns: 128px 1fr auto; gap: 12px; align-items: center; border: 1px solid var(--border); background: var(--bg2); padding: 10px; border-radius: var(--radius); cursor: pointer; transition: border-color 0.12s, background 0.12s; }
.video-card:hover, .video-card.selected { border-color: var(--border2); background: var(--surface2); }
.thumb-wrap { position: relative; width: 128px; height: 72px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
.thumb { width: 100%; height: 100%; object-fit: cover; }
.duration-badge { position: absolute; right: 5px; bottom: 5px; background: rgba(0,0,0,0.75); color: white; font-size: 10px; font-family: var(--font-mono); padding: 2px 5px; border-radius: 3px; }
.video-main { min-width: 0; }
.video-title { font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.video-desc { color: var(--text2); font-size: 12px; line-height: 1.4; height: 34px; overflow: hidden; margin: 5px 0; }
.video-meta { display: flex; gap: 6px; align-items: center; color: var(--text2); font-size: 11px; flex-wrap: wrap; }
.video-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.dot { color: var(--border2); }
.load-more { margin-top: 12px; justify-content: center; }
.empty, .details-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text2); text-align: center; }
.empty h2, .details-empty h2 { color: var(--text); }
.empty p, .details-empty p { max-width: 320px; line-height: 1.6; }
.empty-icon, .details-icon { font-size: 38px; color: var(--border2); }
.skeleton-row { height: 94px; background: var(--bg2); border-radius: var(--radius); animation: shimmer 1.4s infinite; margin-bottom: 8px; }
@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 0.72; } 100% { opacity: 0.4; } }

.details-panel { overflow-y: auto; }
.details-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.details-head h2 { font-size: 16px; line-height: 1.35; margin-top: 4px; }
.section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text2); font-family: var(--font-mono); }
.detail-thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--radius); background: var(--surface2); margin-bottom: 12px; }
.quick-actions { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
.metrics-grid div { border: 1px solid var(--border); background: var(--bg2); border-radius: var(--radius); padding: 10px; }
.metrics-grid span { display: block; font-size: 10px; color: var(--text2); font-family: var(--font-mono); text-transform: uppercase; margin-bottom: 5px; }
.metrics-grid strong { font-size: 15px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field.full { grid-column: 1 / -1; }
.field textarea { resize: vertical; min-height: 130px; }
.char-count { text-align: right; color: var(--text2); font-size: 11px; font-family: var(--font-mono); margin-top: 4px; }
.tags-preview { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.tag-chip { font-size: 11px; background: var(--surface2); border: 1px solid var(--border); color: var(--text2); padding: 4px 8px; border-radius: 99px; }
.toggles { margin-top: 14px; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; background: var(--bg2); border-bottom: 1px solid var(--border); }
.toggle-row:last-child { border-bottom: none; }
.toggle-label { font-weight: 700; font-size: 13px; }
.toggle-desc { color: var(--text2); font-size: 12px; margin-top: 3px; }
.toggle { width: 46px; height: 26px; padding: 0; border-radius: 99px; background: var(--surface2); border: 1px solid var(--border); position: relative; }
.toggle span { position: absolute; width: 20px; height: 20px; border-radius: 50%; background: var(--text2); left: 3px; top: 2px; transition: all 0.15s; }
.toggle.on { background: rgba(0,245,160,0.12); border-color: rgba(0,245,160,0.35); }
.toggle.on span { left: 21px; background: var(--green); }
.save-btn { width: 100%; justify-content: center; margin-top: 14px; }
.success-msg, .error-msg { font-size: 12px; font-family: var(--font-mono); margin-top: 12px; }
.success-msg { color: var(--green); }
.error-msg { color: var(--accent); }
.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
@media (max-width: 1180px) { .content-grid { grid-template-columns: 1fr; overflow-y: auto; } .details-panel { min-height: 620px; } .toolbar { grid-template-columns: 1fr; } }
</style>
