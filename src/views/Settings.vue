<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>{{ t('settings.title') }}</h1>
        <p class="view-sub">{{ t('settings.subtitle') }}</p>
      </div>
    </div>

    <div class="content">
      <div class="section-title">{{ t('settings.preferences') }}</div>
      <div class="card prefs-card">
        <div class="field">
          <label class="label">{{ t('app.language') }}</label>
          <select v-model="language" @change="changeLanguage">
            <option v-for="item in i18n.availableLanguages" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
      </div>

      <div class="section-title">{{ t('settings.credentials') }}</div>
      <div class="card">
        <p class="hint">{{ t('settings.credentialsHint') }}</p>

        <div class="field">
          <label class="label">{{ t('settings.clientId') }}</label>
          <input v-model="clientId" placeholder="xxxx.apps.googleusercontent.com" type="password" autocomplete="off" />
        </div>

        <div class="field">
          <label class="label">{{ t('settings.clientSecret') }}</label>
          <input v-model="clientSecret" placeholder="GOCSPX-…" type="password" autocomplete="off" />
        </div>

        <div class="actions">
          <button class="btn-secondary" @click="saveCredentials" :disabled="saving || !clientId || !clientSecret">
            {{ saving ? t('common.saving') : `✓ ${t('settings.saveCredentials')}` }}
          </button>
          <button class="btn-primary" @click="connect" :disabled="connecting || !clientId || !clientSecret">
            <span v-if="connecting" class="spin">↻</span>
            <span v-else>→</span>
            {{ connecting ? t('settings.connecting') : t('settings.connect') }}
          </button>
        </div>

        <div v-if="saveSuccess" class="success-msg">{{ saveSuccess }}</div>
        <div v-if="authError" class="error-msg">{{ authError }}</div>
      </div>

      <div class="section-title">{{ t('settings.authentication') }}</div>
      <div class="card">
        <div v-if="yt.isAuthenticated" class="auth-status connected">
          <div class="status-dot green" />
          <div class="auth-text">
            <div>{{ t('settings.connected') }}</div>
            <div v-if="yt.channelInfo" class="mono auth-channel">{{ yt.channelInfo.title }}</div>
          </div>
          <div class="auth-actions">
            <button class="btn-secondary" @click="refreshChannel" :disabled="refreshing">
              <span v-if="refreshing" class="spin">↻</span>
              {{ refreshing ? t('common.refreshing') : t('common.refresh') }}
            </button>
            <button class="btn-ghost danger" @click="disconnect">{{ t('settings.disconnect') }}</button>
          </div>
        </div>

        <div v-else class="auth-status">
          <div class="status-dot red" />
          <div class="auth-text">
            <div>{{ t('settings.notAuthenticated') }}</div>
            <div class="mono auth-channel">{{ t('dashboard.authText') }}</div>
          </div>
        </div>
      </div>

      <div class="section-title">{{ t('settings.download') }}</div>
      <div class="card">
        <div class="field with-button">
          <div class="grow">
            <label class="label">{{ t('settings.downloadDir') }}</label>
            <input v-model="downloadDir" :placeholder="t('settings.downloadPlaceholder')" />
          </div>
          <button class="btn-secondary choose-btn" @click="chooseFolder">{{ t('common.selectFolder') }}</button>
        </div>
        <button class="btn-secondary" @click="saveDownloadSettings" :disabled="savingDownload">
          {{ savingDownload ? t('common.saving') : t('common.save') }}
        </button>
        <div v-if="downloadSuccess" class="success-msg">{{ downloadSuccess }}</div>
      </div>

      <div class="card info-card">
        <div class="info-row">
          <span class="mono">{{ t('settings.oauthMode') }}</span>
          <span class="mono badge badge-done">{{ t('settings.desktopLoopback') }}</span>
        </div>
        <div class="info-row">
          <span class="mono">yt-dlp</span>
          <span class="mono badge badge-done">PATH / bin</span>
        </div>
        <div class="info-row">
          <span class="mono">{{ t('settings.apiQuota') }}</span>
          <span class="mono quota">{{ t('settings.quotaText') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useYouTubeStore } from '@/stores/youtube'
import { useI18nStore } from '@/stores/i18n'

const yt = useYouTubeStore()
const i18n = useI18nStore()
const t = i18n.t

const clientId = ref('')
const clientSecret = ref('')
const downloadDir = ref('')
const language = ref('ru')
const saving = ref(false)
const connecting = ref(false)
const refreshing = ref(false)
const savingDownload = ref(false)
const authError = ref('')
const saveSuccess = ref('')
const downloadSuccess = ref('')

onMounted(async () => {
  await i18n.loadLanguage()
  language.value = i18n.language
  await yt.loadConfig()
  const cfg = await window.electron.loadConfig()
  clientId.value = cfg.clientId || ''
  clientSecret.value = cfg.clientSecret || ''
  downloadDir.value = cfg.downloadDir || ''

  if (yt.isAuthenticated && !yt.channelInfo) {
    try {
      await yt.fetchChannelInfo()
      await yt.fetchRecentVideos(12)
    } catch {}
  }
})

async function changeLanguage() {
  await i18n.setLanguage(language.value)
}

async function saveCredentials() {
  authError.value = ''
  saveSuccess.value = ''
  saving.value = true

  try {
    await yt.saveCredentials(clientId.value, clientSecret.value)
    saveSuccess.value = t('settings.savedCredentials')
  } catch (e) {
    authError.value = e.message || 'Failed to save credentials'
  } finally {
    saving.value = false
  }
}

async function connect() {
  authError.value = ''
  saveSuccess.value = ''
  connecting.value = true

  try {
    await yt.saveCredentials(clientId.value, clientSecret.value)
    await yt.authorize()
    saveSuccess.value = t('settings.connectedSuccess')
  } catch (e) {
    authError.value = e.message || 'Failed to connect YouTube'
  } finally {
    connecting.value = false
  }
}

async function refreshChannel() {
  authError.value = ''
  refreshing.value = true

  try {
    await yt.fetchChannelInfo()
    await yt.fetchRecentVideos(12)
  } catch (e) {
    authError.value = e.message || 'Failed to refresh channel'
  } finally {
    refreshing.value = false
  }
}

async function chooseFolder() {
  const folder = await window.electron?.openDirectory()
  if (folder) downloadDir.value = folder
}

async function saveDownloadSettings() {
  savingDownload.value = true
  downloadSuccess.value = ''

  try {
    const cfg = await window.electron.loadConfig()
    await window.electron.saveConfig({ ...cfg, downloadDir: downloadDir.value })
    downloadSuccess.value = t('common.saved')
  } finally {
    savingDownload.value = false
  }
}

async function disconnect() {
  authError.value = ''
  saveSuccess.value = ''

  try {
    await yt.logout()
    saveSuccess.value = t('settings.disconnected')
  } catch (e) {
    authError.value = e.message || 'Failed to disconnect'
  }
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px; gap: 16px; overflow-y: auto; }
.view-header { flex-shrink: 0; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.content { display: flex; flex-direction: column; gap: 12px; }
.section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text2); font-family: var(--font-mono); margin-top: 8px; }
.hint { font-size: 12px; color: var(--text2); line-height: 1.6; margin-bottom: 16px; }
.field { margin-bottom: 14px; }
.field:last-of-type { margin-bottom: 16px; }
.with-button { display: flex; gap: 10px; align-items: flex-end; }
.grow { flex: 1; }
.choose-btn { flex-shrink: 0; height: 39px; }
.actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.auth-status { display: flex; align-items: center; gap: 10px; font-weight: 600; }
.auth-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.auth-channel { font-size: 11px; color: var(--text2); font-weight: 400; word-break: break-all; }
.auth-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.green { background: var(--green); box-shadow: 0 0 6px var(--green); }
.status-dot.red { background: var(--accent); }
.error-msg { color: var(--accent); font-size: 12px; font-family: var(--font-mono); margin-top: 10px; }
.success-msg { color: var(--green); font-size: 12px; font-family: var(--font-mono); margin-top: 10px; }
.info-card { display: flex; flex-direction: column; gap: 10px; }
.info-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; gap: 12px; }
.info-row > span:first-child { color: var(--text2); }
.quota { color: var(--yellow); }
.danger { color: var(--accent); }
.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
</style>
