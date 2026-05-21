<template>
  <div class="view dashboard">
    <div class="view-header">
      <div>
        <h1>{{ t('dashboard.title') }}</h1>
        <p class="view-sub">{{ t('dashboard.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <router-link to="/videos" class="btn-secondary link-btn">{{ t('dashboard.openVideos') }} →</router-link>
        <button class="btn-secondary" @click="refresh" :disabled="yt.isLoading">
          <span :class="{ spin: yt.isLoading }">↻</span>
          {{ yt.isLoading ? t('common.refreshing') : t('common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="!yt.isAuthenticated" class="auth-prompt">
      <div class="auth-icon">↑</div>
      <h2>{{ t('dashboard.authTitle') }}</h2>
      <p>{{ t('dashboard.authText') }}</p>
      <router-link to="/settings" class="btn-primary link-btn">{{ t('dashboard.openSettings') }} →</router-link>
    </div>

    <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">{{ t('dashboard.subscribers') }}</div>
          <div class="stat-value accent-green">{{ formatNum(yt.channelStats?.subscriberCount) }}</div>
          <div class="stat-sub">{{ t('dashboard.total') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('dashboard.totalViews') }}</div>
          <div class="stat-value">{{ formatNum(yt.channelStats?.viewCount) }}</div>
          <div class="stat-sub">{{ t('dashboard.lifetime') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('dashboard.videos') }}</div>
          <div class="stat-value accent-purple">{{ formatNum(yt.channelStats?.videoCount) }}</div>
          <div class="stat-sub">{{ t('dashboard.uploaded') }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('dashboard.queue') }}</div>
          <div class="stat-value accent-red">{{ pendingCount }}</div>
          <div class="stat-sub">{{ t('dashboard.pending') }}</div>
        </div>
      </div>

      <div class="section-header">
        <span>{{ t('dashboard.recentVideos') }}</span>
        <span class="mono">{{ yt.recentVideos.length }} {{ t('dashboard.shown') }}</span>
      </div>

      <div v-if="yt.isLoading && !yt.recentVideos.length" class="loading-rows">
        <div v-for="i in 5" :key="i" class="skeleton-row" />
      </div>

      <div class="video-list">
        <transition-group name="slide-up">
          <div v-for="video in yt.recentVideos" :key="video.id" class="video-row" @click="openDetails(video.id)">
            <img :src="thumb(video)" class="video-thumb" />
            <div class="video-info">
              <div class="video-title">{{ video.snippet.title }}</div>
              <div class="video-meta">
                <span class="mono">{{ formatDate(video.snippet.publishedAt) }}</span>
                <span class="dot">·</span>
                <span class="mono">{{ formatDuration(video.durationSeconds) }}</span>
                <span class="dot">·</span>
                <span class="mono">{{ formatNum(video.statistics?.viewCount) }} {{ t('common.views') }}</span>
                <span class="dot">·</span>
                <span class="mono">{{ video.videoType === 'shorts' ? t('common.shorts') : t('common.videos') }}</span>
              </div>
            </div>
            <div class="video-status">
              <span :class="privacyClass(video.status?.privacyStatus)">{{ privacyLabel(video.status?.privacyStatus) }}</span>
            </div>
          </div>
        </transition-group>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useYouTubeStore } from '@/stores/youtube'
import { useQueueStore } from '@/stores/queue'
import { useI18nStore } from '@/stores/i18n'

const router = useRouter()
const yt = useYouTubeStore()
const queue = useQueueStore()
const i18n = useI18nStore()
const t = i18n.t

const pendingCount = computed(() => queue.items.filter(i => ['pending', 'downloading', 'uploading'].includes(i.status)).length)

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

async function refresh() {
  await yt.fetchChannelInfo()
  await yt.fetchRecentVideos(12)
}

function openDetails(id) {
  router.push({ path: '/videos', query: { id } })
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; overflow: hidden; padding: 28px; gap: 20px; }
.view-header { display: flex; align-items: flex-start; justify-content: space-between; flex-shrink: 0; gap: 14px; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.link-btn { text-decoration: none; }

.auth-prompt { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; }
.auth-icon { font-size: 48px; color: var(--accent); line-height: 1; }
.auth-prompt h2 { font-size: 20px; }
.auth-prompt p { color: var(--text2); max-width: 380px; line-height: 1.6; }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; flex-shrink: 0; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
.stat-label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text2); font-family: var(--font-mono); margin-bottom: 8px; }
.stat-value { font-size: 30px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
.stat-sub { font-size: 11px; color: var(--text2); margin-top: 4px; font-family: var(--font-mono); }
.accent-green { color: var(--green); }
.accent-purple { color: #a78bfa; }
.accent-red { color: var(--accent); }

.section-header { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text2); padding-bottom: 8px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.section-header .mono { font-size: 11px; color: var(--text2); }
.video-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.video-row { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-radius: var(--radius); transition: background 0.12s; border: 1px solid transparent; cursor: pointer; }
.video-row:hover { background: var(--surface); border-color: var(--border); }
.video-thumb { width: 80px; height: 45px; border-radius: 3px; object-fit: cover; flex-shrink: 0; background: var(--surface2); }
.video-info { flex: 1; min-width: 0; }
.video-title { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px; }
.video-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text2); flex-wrap: wrap; }
.dot { color: var(--border2); }
.video-status { flex-shrink: 0; }
.skeleton-row { height: 65px; background: var(--surface); border-radius: var(--radius); animation: shimmer 1.4s infinite; }
@keyframes shimmer { 0% { opacity: 0.4; } 50% { opacity: 0.7; } 100% { opacity: 0.4; } }
.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
@media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .header-actions { flex-direction: column; align-items: flex-end; } }
</style>
