<template>
  <div class="view dashboard">
    <div class="view-header">
      <div>
        <h1>Dashboard</h1>
        <p class="view-sub">Channel overview & recent activity</p>
      </div>
      <button class="btn-secondary" @click="refresh" :disabled="yt.isLoading">
        <span :class="{ spin: yt.isLoading }">↻</span>
        Refresh
      </button>
    </div>

    <!-- Not authenticated -->
    <div v-if="!yt.isAuthenticated" class="auth-prompt">
      <div class="auth-icon">↑</div>
      <h2>Connect your YouTube channel</h2>
      <p>Go to <strong>Settings</strong> to add your API credentials and authenticate.</p>
      <router-link to="/settings" class="btn-primary" style="display:inline-flex">
        Open Settings →
      </router-link>
    </div>

    <template v-else>
      <!-- Stats row -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Subscribers</div>
          <div class="stat-value accent-green">{{ formatNum(yt.channelStats?.subscriberCount) }}</div>
          <div class="stat-sub">total</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Views</div>
          <div class="stat-value">{{ formatNum(yt.channelStats?.viewCount) }}</div>
          <div class="stat-sub">lifetime</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Videos</div>
          <div class="stat-value accent-purple">{{ formatNum(yt.channelStats?.videoCount) }}</div>
          <div class="stat-sub">uploaded</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Queue</div>
          <div class="stat-value accent-red">{{ pendingCount }}</div>
          <div class="stat-sub">pending</div>
        </div>
      </div>

      <!-- Recent videos -->
      <div class="section-header">
        <span>Recent Videos</span>
        <span class="mono" style="font-size:11px;color:var(--text2)">{{ yt.recentVideos.length }} shown</span>
      </div>

      <div v-if="yt.isLoading && !yt.recentVideos.length" class="loading-rows">
        <div v-for="i in 5" :key="i" class="skeleton-row" />
      </div>

      <div class="video-list">
        <transition-group name="slide-up">
          <div v-for="video in yt.recentVideos" :key="video.id" class="video-row">
            <img :src="video.snippet.thumbnails?.default?.url" class="video-thumb" />
            <div class="video-info">
              <div class="video-title">{{ video.snippet.title }}</div>
              <div class="video-meta">
                <span class="mono">{{ formatDate(video.snippet.publishedAt) }}</span>
                <span class="dot">·</span>
                <span class="mono">{{ formatNum(video.statistics?.viewCount) }} views</span>
                <span class="dot">·</span>
                <span class="mono">{{ formatNum(video.statistics?.likeCount) }} likes</span>
              </div>
            </div>
            <div class="video-status">
              <span :class="privacyClass(video.status?.privacyStatus)">
                {{ video.status?.privacyStatus }}
              </span>
            </div>
          </div>
        </transition-group>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useYouTubeStore } from '@/stores/youtube'
import { useQueueStore } from '@/stores/queue'

const yt = useYouTubeStore()
const queue = useQueueStore()

const pendingCount = computed(() =>
  queue.items.filter(i => ['pending','downloading','uploading'].includes(i.status)).length
)

function formatNum(n) {
  if (!n) return '0'
  const num = parseInt(n)
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function privacyClass(s) {
  return `badge badge-${s === 'public' ? 'done' : s === 'private' ? 'pending' : 'downloading'}`
}

async function refresh() {
  await yt.fetchChannelInfo()
  await yt.fetchRecentVideos()
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; overflow: hidden; padding: 28px; gap: 20px; }
.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-shrink: 0;
}
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }

.auth-prompt {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
}
.auth-icon {
  font-size: 48px;
  color: var(--accent);
  line-height: 1;
}
.auth-prompt h2 { font-size: 20px; }
.auth-prompt p { color: var(--text2); max-width: 380px; line-height: 1.6; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  flex-shrink: 0;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
}
.stat-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text2);
  font-family: var(--font-mono);
  margin-bottom: 8px;
}
.stat-value {
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}
.stat-sub { font-size: 11px; color: var(--text2); margin-top: 4px; font-family: var(--font-mono); }
.accent-green { color: var(--green); }
.accent-purple { color: #a78bfa; }
.accent-red { color: var(--accent); }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text2);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.video-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.video-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: var(--radius);
  transition: background 0.12s;
  border: 1px solid transparent;
}
.video-row:hover { background: var(--surface); border-color: var(--border); }
.video-thumb {
  width: 80px;
  height: 45px;
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--surface2);
}
.video-info { flex: 1; min-width: 0; }
.video-title {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 5px;
}
.video-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text2); }
.dot { color: var(--border2); }
.video-status { flex-shrink: 0; }

.skeleton-row {
  height: 65px;
  background: var(--surface);
  border-radius: var(--radius);
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% { opacity: 0.4; }
  50% { opacity: 0.7; }
  100% { opacity: 0.4; }
}

.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
</style>
