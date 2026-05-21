<template>
  <div class="app-shell">
    <!-- Custom titlebar -->
    <div class="titlebar" @dblclick="maximize">
      <div class="titlebar-logo">
        <span class="logo-icon">▲</span>
        <span class="logo-text">YTREUP</span>
      </div>
      <div class="titlebar-drag" />
      <div class="titlebar-controls">
        <button class="wc wc-min" @click="minimize" title="Minimise">—</button>
        <button class="wc wc-max" @click="maximize" title="Maximise">&#9633;</button>
        <button class="wc wc-close" @click="close" title="Close">✕</button>
      </div>
    </div>

    <div class="app-body">
      <!-- Sidebar -->
      <nav class="sidebar">
        <router-link to="/dashboard" class="nav-item">
          <span class="nav-icon">◈</span>
          <span>Dashboard</span>
        </router-link>
        <router-link to="/download" class="nav-item">
          <span class="nav-icon">↓</span>
          <span>Download</span>
        </router-link>
        <router-link to="/upload" class="nav-item">
          <span class="nav-icon">↑</span>
          <span>Upload</span>
        </router-link>
        <router-link to="/queue" class="nav-item">
          <span class="nav-icon">⊞</span>
          <span>Queue</span>
          <span v-if="pendingCount > 0" class="nav-badge">{{ pendingCount }}</span>
        </router-link>
        <div class="sidebar-spacer" />
        <router-link to="/settings" class="nav-item">
          <span class="nav-icon">⚙</span>
          <span>Settings</span>
        </router-link>

        <!-- Channel mini info -->
        <div v-if="yt.isAuthenticated && yt.channelInfo" class="sidebar-channel">
          <div class="channel-avatar">{{ yt.channelInfo.title?.[0] || '?' }}</div>
          <div class="channel-meta">
            <div class="channel-name">{{ yt.channelInfo.title }}</div>
            <div class="channel-subs">{{ formatNum(yt.channelStats?.subscriberCount) }} subs</div>
          </div>
        </div>
        <div v-else-if="yt.isAuthenticated" class="sidebar-channel-loading">
          <div class="pulse-dot" />
          <span>Loading...</span>
        </div>
      </nav>

      <!-- Main content -->
      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
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

function minimize() { window.electron?.minimize() }
function maximize() { window.electron?.maximize() }
function close() { window.electron?.close() }

onMounted(async () => {
  await yt.loadConfig()
  if (yt.isAuthenticated) {
    yt.fetchChannelInfo()
    yt.fetchRecentVideos()
  }
})
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

/* Titlebar */
.titlebar {
  height: 40px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  -webkit-app-region: drag;
  flex-shrink: 0;
  user-select: none;
  padding: 0 12px;
  gap: 12px;
}
.titlebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.logo-icon {
  color: var(--accent);
  font-size: 14px;
}
.logo-text {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.2em;
  color: var(--text);
}
.titlebar-drag { flex: 1; }
.titlebar-controls {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}
.wc {
  width: 28px;
  height: 24px;
  background: transparent;
  color: var(--text2);
  font-size: 12px;
  padding: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}
.wc:hover { background: var(--surface2); color: var(--text); }
.wc-close:hover { background: var(--accent) !important; color: white; }

/* Body */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 200px;
  background: var(--bg2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  gap: 2px;
  flex-shrink: 0;
  overflow-y: auto;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  color: var(--text2);
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.12s;
  position: relative;
}
.nav-item:hover { background: var(--surface); color: var(--text); }
.nav-item.router-link-active {
  background: var(--surface2);
  color: var(--text);
  border-left: 2px solid var(--accent);
}
.nav-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
  color: inherit;
}
.nav-badge {
  margin-left: auto;
  background: var(--accent);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  font-family: var(--font-mono);
}
.sidebar-spacer { flex: 1; }

.sidebar-channel {
  margin-top: 8px;
  padding: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  gap: 10px;
}
.channel-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent3), var(--accent));
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
}
.channel-meta { min-width: 0; }
.channel-name {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.channel-subs {
  font-size: 11px;
  color: var(--text2);
  font-family: var(--font-mono);
}
.sidebar-channel-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  color: var(--text2);
  font-size: 12px;
}
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent3);
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

/* Main */
.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
