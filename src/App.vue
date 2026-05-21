<script setup>
import { computed, onMounted } from 'vue'
import { useYouTubeStore } from '@/stores/youtube'
import { useQueueStore } from '@/stores/queue'
import { useI18nStore } from '@/stores/i18n'

const yt = useYouTubeStore()
const queue = useQueueStore()
const i18n = useI18nStore()
const t = i18n.t

const supportUrl = 'https://discord.com/users/325196577624817674'

const language = computed(() => i18n.language?.value || i18n.language || 'ru')

const pendingCount = computed(() => {
  return queue.items.filter(i => ['pending', 'downloading', 'uploading'].includes(i.status)).length
})

const supportText = computed(() => {
  return language.value === 'en'
    ? 'Need help or found a bug? Contact support'
    : 'Нужна помощь или нашли ошибку? Напишите в поддержку'
})

function formatNum(n) {
  if (!n) return '0'

  const num = parseInt(n, 10)

  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`

  return num.toString()
}

function minimize() {
  window.electron?.minimize()
}

function maximize() {
  window.electron?.maximize()
}

function close() {
  window.electron?.close()
}

function openSupport() {
  window.electron?.openExternal(supportUrl)
}

onMounted(async () => {
  await i18n.loadLanguage()
  await yt.loadConfig()

  if (yt.isAuthenticated) {
    yt.fetchChannelInfo().catch(() => {})
    yt.fetchRecentVideos(12).catch(() => {})
  }
})
</script>

<template>
  <div class="app-shell">
    <div class="titlebar" @dblclick="maximize">
      <div class="titlebar-logo">
        <span class="logo-icon">▲</span>
        <span class="logo-text">YTREUP</span>
      </div>

      <div class="titlebar-drag" />

      <div class="titlebar-language">
        <button class="lang-btn" :class="{ active: language === 'ru' }" @click.stop="i18n.setLanguage('ru')">RU</button>
        <button class="lang-btn" :class="{ active: language === 'en' }" @click.stop="i18n.setLanguage('en')">EN</button>
      </div>

      <div class="titlebar-controls">
        <button class="wc wc-min" @click="minimize">—</button>
        <button class="wc wc-max" @click="maximize">□</button>
        <button class="wc wc-close" @click="close">✕</button>
      </div>
    </div>

    <div class="app-body">
      <nav class="sidebar">
        <router-link to="/dashboard" class="nav-item">
          <span class="nav-icon">◈</span>
          <span>{{ t('nav.dashboard') }}</span>
        </router-link>

        <router-link to="/download" class="nav-item">
          <span class="nav-icon">↓</span>
          <span>{{ t('nav.download') }}</span>
          <span v-if="pendingCount > 0" class="nav-badge">{{ pendingCount }}</span>
        </router-link>

        <router-link to="/upload" class="nav-item">
          <span class="nav-icon">↑</span>
          <span>{{ t('nav.upload') }}</span>
        </router-link>

        <router-link to="/videos" class="nav-item">
          <span class="nav-icon">▶</span>
          <span>{{ t('nav.videos') }}</span>
        </router-link>

        <div class="sidebar-spacer" />

        <router-link to="/settings" class="nav-item">
          <span class="nav-icon">⚙</span>
          <span>{{ t('nav.settings') }}</span>
        </router-link>

        <div v-if="yt.isAuthenticated && yt.channelInfo" class="sidebar-channel">
          <div class="channel-avatar">
            <img v-if="yt.channelInfo.thumbnails?.default?.url" :src="yt.channelInfo.thumbnails.default.url" />
            <span v-else>{{ yt.channelInfo.title?.[0] || '?' }}</span>
          </div>

          <div class="channel-meta">
            <div class="channel-name">{{ yt.channelInfo.title }}</div>
            <div class="channel-subs">{{ formatNum(yt.channelStats?.subscriberCount) }} {{ t('app.subscribersShort') }}</div>
          </div>
        </div>

        <div v-else-if="yt.isAuthenticated" class="sidebar-channel-loading">
          <div class="pulse-dot" />
          <span>{{ t('app.loading') }}</span>
        </div>
      </nav>

      <div class="content-shell">
        <main class="main-content">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </main>

        <footer class="support-footer">
          <div class="support-footer__info">
            <span class="support-footer__dot"></span>
            <span>{{ supportText }}</span>
          </div>

          <button class="support-footer__link" @click="openSupport">
            <span class="support-footer__icon">◉</span>
            <span>Discord: jalisco</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
}

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

.titlebar-drag {
  flex: 1;
}

.titlebar-language {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.lang-btn {
  height: 24px;
  padding: 0 8px;
  background: transparent;
  color: var(--text2);
  border: 1px solid transparent;
  font-size: 10px;
  font-family: var(--font-mono);
}

.lang-btn.active {
  color: var(--text);
  border-color: var(--border2);
  background: var(--surface);
}

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

.wc:hover {
  background: var(--surface2);
  color: var(--text);
}

.wc-close:hover {
  background: var(--accent) !important;
  color: white;
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  width: 210px;
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

.nav-item:hover {
  background: var(--surface);
  color: var(--text);
}

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

.sidebar-spacer {
  flex: 1;
}

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
  background: var(--surface2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
  overflow: hidden;
}

.channel-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.channel-meta {
  min-width: 0;
}

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

.content-shell {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.support-footer {
  height: 38px;
  flex-shrink: 0;
  background: var(--bg2);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 14px;
  user-select: none;
}

.support-footer__info {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text2);
  font-size: 12px;
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.support-footer__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 12px rgba(0, 245, 160, 0.45);
  flex-shrink: 0;
}

.support-footer__link {
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.support-footer__link:hover {
  background: var(--surface2);
  border-color: var(--border2);
  color: white;
  transform: translateY(-1px);
}

.support-footer__icon {
  color: var(--accent3);
  font-size: 10px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}

@media (max-width: 760px) {
  .sidebar {
    width: 74px;
  }

  .nav-item span:not(.nav-icon):not(.nav-badge) {
    display: none;
  }

  .sidebar-channel,
  .sidebar-channel-loading {
    display: none;
  }

  .support-footer {
    height: 44px;
    align-items: stretch;
    padding: 0 10px;
  }

  .support-footer__info {
    font-size: 10px;
  }

  .support-footer__link {
    height: auto;
    align-self: center;
  }
}
</style>