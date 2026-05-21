<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Settings</h1>
        <p class="view-sub">API credentials & authentication</p>
      </div>
    </div>

    <div class="content">
      <!-- API Credentials -->
      <div class="section-title">Google API Credentials</div>
      <div class="card">
        <p class="hint">
          Create a project at <strong>console.cloud.google.com</strong>, enable YouTube Data API v3,
          create OAuth 2.0 credentials (Desktop app), and paste the Client ID and Secret below.
        </p>
        <div class="field">
          <label class="label">Client ID</label>
          <input v-model="clientId" placeholder="xxxx.apps.googleusercontent.com" type="password" />
        </div>
        <div class="field">
          <label class="label">Client Secret</label>
          <input v-model="clientSecret" placeholder="GOCSPX-…" type="password" />
        </div>
        <button class="btn-secondary" @click="saveCredentials" :disabled="saving">
          {{ saving ? 'Saving…' : '✓ Save Credentials' }}
        </button>
      </div>

      <!-- OAuth Auth -->
      <div class="section-title">Authentication</div>
      <div class="card">
        <div v-if="yt.isAuthenticated" class="auth-status connected">
          <div class="status-dot green" />
          <span>Connected</span>
          <span v-if="yt.channelInfo" class="mono" style="font-size:11px;color:var(--text2)">
            — {{ yt.channelInfo.title }}
          </span>
          <button class="btn-ghost" style="margin-left:auto;color:var(--accent)" @click="disconnect">
            Disconnect
          </button>
        </div>
        <div v-else class="auth-status">
          <div class="status-dot red" />
          <span style="color:var(--text2)">Not authenticated</span>
        </div>

        <div v-if="!yt.isAuthenticated" style="margin-top:16px">
          <div class="oauth-steps">
            <div class="step">
              <div class="step-num">1</div>
              <div>Save your credentials above, then click the button below to open Google's auth page</div>
            </div>
            <div class="step">
              <div class="step-num">2</div>
              <div>Authorise the app in your browser and copy the code Google provides</div>
            </div>
            <div class="step">
              <div class="step-num">3</div>
              <div>Paste the code here and click Verify</div>
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:16px;align-items:flex-start">
            <button class="btn-primary" @click="openAuth" :disabled="!clientId || !clientSecret">
              → Open Google Auth
            </button>
          </div>

          <div v-if="authOpened" style="margin-top:14px">
            <label class="label">Paste auth code</label>
            <div style="display:flex;gap:10px">
              <input v-model="authCode" placeholder="4/0AXxxxxxx…" />
              <button class="btn-success" @click="verify" :disabled="!authCode || verifying">
                <span v-if="verifying" class="spin">↻</span>
                {{ verifying ? 'Verifying…' : 'Verify' }}
              </button>
            </div>
          </div>

          <div v-if="authError" class="error-msg">{{ authError }}</div>
        </div>
      </div>

      <!-- Download settings -->
      <div class="section-title">Download</div>
      <div class="card">
        <div class="field">
          <label class="label">Default download directory</label>
          <input v-model="downloadDir" placeholder="Leave empty for system temp" />
        </div>
        <button class="btn-secondary" @click="saveDownloadSettings">Save</button>
      </div>

      <!-- Info -->
      <div class="card info-card">
        <div class="info-row">
          <span class="mono" style="color:var(--text2)">yt-dlp</span>
          <span class="mono badge badge-done">required in PATH</span>
        </div>
        <div class="info-row">
          <span class="mono" style="color:var(--text2)">YouTube API quota</span>
          <span class="mono" style="color:var(--yellow)">~6 uploads/day (free tier)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useYouTubeStore } from '@/stores/youtube'

const yt = useYouTubeStore()

const clientId = ref('')
const clientSecret = ref('')
const downloadDir = ref('')
const saving = ref(false)
const authOpened = ref(false)
const authCode = ref('')
const verifying = ref(false)
const authError = ref('')

onMounted(async () => {
  const cfg = await window.electron.loadConfig()
  clientId.value = cfg.clientId || ''
  clientSecret.value = cfg.clientSecret || ''
  downloadDir.value = cfg.downloadDir || ''
})

async function saveCredentials() {
  saving.value = true
  const cfg = await window.electron.loadConfig()
  await window.electron.saveConfig({ ...cfg, clientId: clientId.value, clientSecret: clientSecret.value })
  yt.CLIENT_ID = clientId.value
  yt.CLIENT_SECRET = clientSecret.value
  await yt.loadConfig()
  saving.value = false
}

async function saveDownloadSettings() {
  const cfg = await window.electron.loadConfig()
  await window.electron.saveConfig({ ...cfg, downloadDir: downloadDir.value })
}

function openAuth() {
  yt.CLIENT_ID.value = clientId.value
  yt.CLIENT_SECRET.value = clientSecret.value
  const url = yt.getAuthUrl()
  window.electron.openAuth(url)
  authOpened.value = true
}

async function verify() {
  authError.value = ''
  verifying.value = true
  try {
    await yt.exchangeCode(authCode.value.trim())
    await yt.fetchChannelInfo()
    await yt.fetchRecentVideos()
    authOpened.value = false
    authCode.value = ''
  } catch (e) {
    authError.value = e.message
  } finally {
    verifying.value = false
  }
}

async function disconnect() {
  yt.logout()
  const cfg = await window.electron.loadConfig()
  await window.electron.saveConfig({ ...cfg, accessToken: null, refreshToken: null })
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px; gap: 16px; overflow-y: auto; }
.view-header { flex-shrink: 0; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }

.content { display: flex; flex-direction: column; gap: 12px; }

.section-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text2);
  font-family: var(--font-mono);
  margin-top: 8px;
}

.hint { font-size: 12px; color: var(--text2); line-height: 1.6; margin-bottom: 16px; }
.hint strong { color: var(--text); }

.field { margin-bottom: 14px; }
.field:last-of-type { margin-bottom: 16px; }

.auth-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.green { background: var(--green); box-shadow: 0 0 6px var(--green); }
.status-dot.red { background: var(--accent); }

.oauth-steps { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.step { display: flex; gap: 12px; align-items: flex-start; font-size: 13px; color: var(--text2); line-height: 1.5; }
.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.error-msg { color: var(--accent); font-size: 12px; font-family: var(--font-mono); margin-top: 10px; }

.info-card { display: flex; flex-direction: column; gap: 10px; }
.info-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }

.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
</style>
