<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>{{ t('upload.title') }}</h1>
        <p class="view-sub">{{ t('upload.subtitle') }}</p>
      </div>
    </div>

    <div v-if="!yt.isAuthenticated" class="auth-warn card">
      <span>⚠</span>
      <span>{{ t('upload.auth') }} <router-link to="/settings">{{ t('nav.settings') }} →</router-link></span>
    </div>

    <div class="layout">
      <div class="col-left">
        <div class="card section">
          <div class="section-head">{{ t('upload.videoFile') }}</div>
          <label class="label">{{ t('upload.filePath') }}</label>
          <div class="file-row">
            <input v-model="filePath" placeholder="/path/to/video.mp4" />
            <button class="btn-secondary" @click="chooseFile">{{ t('common.selectFile') }}</button>
          </div>
        </div>

        <div class="card section">
          <div class="section-head">{{ t('upload.basicInfo') }}</div>

          <label class="label">{{ t('common.title') }} <span class="required">*</span></label>
          <input v-model="meta.title" :placeholder="t('upload.titlePlaceholder')" maxlength="100" />
          <div class="char-count">{{ meta.title.length }}/100</div>

          <label class="label spaced">{{ t('common.description') }}</label>
          <textarea v-model="meta.description" :placeholder="t('upload.descriptionPlaceholder')" rows="7" maxlength="5000" />
          <div class="char-count">{{ meta.description.length }}/5000</div>

          <label class="label spaced">{{ t('common.tags') }} <span class="hint-inline">({{ t('upload.commaSeparated') }})</span></label>
          <input v-model="tagsRaw" placeholder="tag1, tag2, tag3" />
          <div class="tags-preview" v-if="parsedTags.length">
            <span v-for="tag in parsedTags" :key="tag" class="tag-chip">{{ tag }}</span>
          </div>
        </div>

        <div class="card section">
          <div class="section-head">{{ t('upload.thumbnail') }}</div>
          <div
            class="thumb-drop"
            :class="{ 'has-thumb': thumbnailPreview, 'drag-over': dragOver }"
            @click="triggerThumbPick"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent="onThumbDrop"
          >
            <img v-if="thumbnailPreview" :src="thumbnailPreview" class="thumb-img" />
            <div v-else class="thumb-placeholder">
              <span class="thumb-icon">⊕</span>
              <span class="thumb-label">{{ t('upload.thumbnailPick') }}</span>
              <span class="thumb-hint">{{ t('upload.thumbnailHint') }}</span>
            </div>
            <div v-if="thumbnailPreview" class="thumb-overlay"><span>{{ t('upload.change') }}</span></div>
          </div>
          <input ref="thumbInput" type="file" accept="image/*" style="display:none" @change="onThumbPick" />
          <button v-if="thumbnailPreview" class="btn-ghost remove-thumb" @click.stop="clearThumb">✕ {{ t('upload.removeThumbnail') }}</button>
        </div>
      </div>

      <div class="col-right">
        <div class="card section">
          <div class="section-head">{{ t('upload.visibility') }}</div>
          <div class="privacy-list">
            <label v-for="opt in privacyOpts" :key="opt.value" class="privacy-opt">
              <input type="radio" v-model="meta.privacyStatus" :value="opt.value" />
              <div class="privacy-label">
                <span class="privacy-icon">{{ opt.icon }}</span>
                <div class="privacy-text">
                  <div class="privacy-name">{{ opt.label }}</div>
                  <div class="privacy-desc">{{ opt.desc }}</div>
                </div>
                <div class="radio-dot" />
              </div>
            </label>
          </div>

          <div v-if="meta.privacyStatus === 'scheduled'" class="spaced">
            <label class="label">{{ t('upload.publishDate') }}</label>
            <input type="datetime-local" v-model="meta.publishAt" />
          </div>
        </div>

        <div class="card section">
          <div class="section-head">{{ local('Плейлист', 'Playlist') }}</div>
          <label class="label">{{ local('Добавить после загрузки', 'Add after upload') }}</label>
          <div class="playlist-row">
            <select v-model="meta.playlistId" :disabled="playlistsLoading">
              <option value="">{{ local('Не добавлять в плейлист', 'Do not add to playlist') }}</option>
              <option v-for="playlist in yt.playlists" :key="playlist.id" :value="playlist.id">
                {{ playlist.snippet?.title || playlist.id }}
              </option>
            </select>
            <button class="btn-secondary" @click="loadPlaylists" :disabled="playlistsLoading || !yt.isAuthenticated">
              <span :class="{ spin: playlistsLoading }">↻</span>
            </button>
          </div>
          <div class="mini-hint">{{ local('Выбери плейлист, и ролик автоматически попадёт туда после загрузки.', 'Select a playlist and the uploaded video will be added automatically.') }}</div>
        </div>

        <div class="card section">
          <div class="section-head">{{ t('upload.classification') }}</div>

          <label class="label">{{ t('common.category') }}</label>
          <select v-model="meta.categoryId">
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>

          <label class="label spaced">{{ t('common.language') }}</label>
          <select v-model="meta.defaultLanguage">
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

        <div class="card section">
          <div class="section-head">{{ t('upload.advanced') }}</div>

          <label class="label">{{ t('upload.recordingLocation') }}</label>
          <input v-model="meta.recordingLocation" :placeholder="t('upload.recordingPlaceholder')" />

          <label class="label spaced">{{ t('common.license') }}</label>
          <select v-model="meta.license">
            <option value="youtube">Standard YouTube License</option>
            <option value="creativeCommon">Creative Commons — Attribution</option>
          </select>

          <div class="toggle-row spaced">
            <div>
              <div class="toggle-label">{{ t('upload.allowEmbedding') }}</div>
              <div class="toggle-desc">{{ t('upload.allowEmbeddingDesc') }}</div>
            </div>
            <button class="toggle" :class="{ on: meta.embeddable }" @click="meta.embeddable = !meta.embeddable"><span /></button>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">{{ t('upload.notifySubscribers') }}</div>
              <div class="toggle-desc">{{ t('upload.notifySubscribersDesc') }}</div>
            </div>
            <button class="toggle" :class="{ on: meta.notifySubscribers }" @click="meta.notifySubscribers = !meta.notifySubscribers"><span /></button>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">{{ t('upload.madeForKids') }}</div>
              <div class="toggle-desc">{{ t('upload.madeForKidsDesc') }}</div>
            </div>
            <button class="toggle" :class="{ on: meta.madeForKids }" @click="meta.madeForKids = !meta.madeForKids"><span /></button>
          </div>

          <label class="label spaced">{{ t('upload.ratingsVisible') }}</label>
          <select v-model="meta.ratingsVisible">
            <option :value="true">{{ t('upload.visible') }}</option>
            <option :value="false">{{ t('upload.hidden') }}</option>
          </select>
        </div>

        <transition name="slide-up">
          <div v-if="uploadPhase" class="card progress-card">
            <div class="progress-header">
              <span class="label">{{ phaseLabel }}</span>
              <span class="mono pct">{{ uploadPhase === 'uploading' ? uploadPct + '%' : '' }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :class="{ indeterminate: uploadPhase !== 'uploading' }" :style="uploadPhase === 'uploading' ? { width: uploadPct + '%' } : {}" />
            </div>
            <div v-if="uploadPhase === 'thumbnail'" class="phase-label mono">{{ t('upload.settingThumbnail') }}</div>
          </div>
        </transition>

        <transition name="slide-up">
          <div v-if="uploadResult" class="card done-card">
            <div class="done-icon">✓</div>
            <div>
              <div class="done-title">{{ t('upload.uploaded') }}</div>
              <div class="mono video-link">youtu.be/{{ uploadResult.id }}</div>
              <div v-if="meta.playlistId" class="mono playlist-done">{{ local('Добавлено в плейлист', 'Added to playlist') }}</div>
            </div>
            <button class="btn-ghost" @click="openVideo(uploadResult.id)">{{ t('common.open') }} →</button>
          </div>
        </transition>

        <div v-if="error" class="error-msg card">{{ error }}</div>

        <button class="btn-primary upload-btn" @click="upload" :disabled="!!uploadPhase || !yt.isAuthenticated || !filePath || !meta.title">
          <span v-if="uploadPhase" class="spin">↻</span>
          <span v-else>↑</span>
          {{ uploadPhase ? phaseLabel : t('upload.uploadToYoutube') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useYouTubeStore } from '@/stores/youtube'
import { useI18nStore } from '@/stores/i18n'

const route = useRoute()
const yt = useYouTubeStore()
const i18n = useI18nStore()
const t = i18n.t

const filePath = ref('')
const tagsRaw = ref('')
const thumbnailFile = ref(null)
const thumbnailPreview = ref('')
const thumbInput = ref(null)
const dragOver = ref(false)
const uploadPhase = ref('')
const uploadPct = ref(0)
const uploadResult = ref(null)
const error = ref('')
const playlistsLoading = ref(false)

const meta = ref({
  title: '',
  description: '',
  categoryId: '22',
  privacyStatus: 'private',
  publishAt: '',
  defaultLanguage: '',
  recordingLocation: '',
  license: 'youtube',
  embeddable: true,
  notifySubscribers: true,
  madeForKids: false,
  ratingsVisible: true,
  playlistId: ''
})

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

const privacyOpts = computed(() => [
  { value: 'private', icon: '◆', label: t('common.private'), desc: local('Видно только тебе и выбранным людям', 'Only you and selected people can watch') },
  { value: 'unlisted', icon: '◇', label: t('common.unlisted'), desc: local('Доступно только по ссылке', 'Anyone with the link can watch') },
  { value: 'public', icon: '●', label: t('common.public'), desc: local('Видео видно всем', 'Visible to everyone') },
  { value: 'scheduled', icon: '◷', label: t('common.scheduled'), desc: local('Публикация в выбранное время', 'Publish at selected time') }
])

const parsedTags = computed(() => tagsRaw.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 500))

const phaseLabel = computed(() => {
  if (uploadPhase.value === 'uploading') return local('Загрузка видео…', 'Uploading video…')
  if (uploadPhase.value === 'thumbnail') return t('upload.settingThumbnail')
  return t('common.loading')
})

onMounted(async () => {
  if (route.query.file) filePath.value = String(route.query.file)
  if (route.query.title) meta.value.title = String(route.query.title).slice(0, 100)
  if (yt.isAuthenticated) await loadPlaylists()
})

function currentLang() {
  return i18n.language?.value || i18n.language || 'ru'
}

function local(ru, en) {
  return currentLang() === 'en' ? en : ru
}

async function loadPlaylists() {
  playlistsLoading.value = true
  try {
    await yt.fetchPlaylists()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    playlistsLoading.value = false
  }
}

async function chooseFile() {
  const file = await window.electron?.openFile()
  if (file) filePath.value = file
}

function triggerThumbPick() {
  thumbInput.value?.click()
}

function onThumbPick(e) {
  const file = e.target.files?.[0]
  if (file) setThumb(file)
}

function onThumbDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) setThumb(file)
}

function setThumb(file) {
  if (!file.type.startsWith('image/')) return
  clearThumb()
  thumbnailFile.value = file
  thumbnailPreview.value = URL.createObjectURL(file)
}

function clearThumb() {
  thumbnailFile.value = null
  if (thumbnailPreview.value) URL.revokeObjectURL(thumbnailPreview.value)
  thumbnailPreview.value = ''
  if (thumbInput.value) thumbInput.value.value = ''
}

async function upload() {
  error.value = ''
  uploadResult.value = null
  uploadPhase.value = 'uploading'
  uploadPct.value = 0

  try {
    const result = await yt.uploadVideo({
      filePath: filePath.value,
      title: meta.value.title,
      description: meta.value.description,
      tags: parsedTags.value,
      categoryId: meta.value.categoryId,
      privacyStatus: meta.value.privacyStatus,
      publishAt: meta.value.publishAt,
      defaultLanguage: meta.value.defaultLanguage,
      license: meta.value.license,
      embeddable: meta.value.embeddable,
      notifySubscribers: meta.value.notifySubscribers,
      madeForKids: meta.value.madeForKids,
      ratingsVisible: meta.value.ratingsVisible,
      playlistId: meta.value.playlistId,
      onProgress: p => uploadPct.value = p
    })

    if (thumbnailFile.value && result?.id) {
      uploadPhase.value = 'thumbnail'
      await yt.uploadThumbnail(result.id, thumbnailFile.value)
    }

    uploadResult.value = result
    uploadPhase.value = ''
    await yt.fetchRecentVideos(12).catch(() => {})
    await yt.fetchVideos({ maxResults: 25 }).catch(() => {})
  } catch (e) {
    error.value = e.message || String(e)
    uploadPhase.value = ''
  }
}

function openVideo(id) {
  window.electron?.openExternal(`https://youtu.be/${id}`)
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px; gap: 16px; overflow-y: auto; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }
.auth-warn { display: flex; align-items: center; gap: 10px; color: var(--yellow); }
.auth-warn a { color: var(--text); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 390px; gap: 16px; align-items: start; }
.col-left, .col-right { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.section-head { font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text); margin-bottom: 16px; }
.file-row { display: flex; gap: 8px; }
.file-row input { flex: 1; }
.required { color: var(--accent); }
.spaced { margin-top: 14px; }
textarea { resize: vertical; min-height: 150px; }
.char-count { text-align: right; color: var(--text2); font-size: 11px; font-family: var(--font-mono); margin-top: 4px; }
.hint-inline { color: var(--text2); font-weight: 400; text-transform: none; letter-spacing: 0; }
.tags-preview { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.tag-chip { font-size: 11px; background: var(--surface2); border: 1px solid var(--border); color: var(--text2); padding: 4px 8px; border-radius: 99px; }
.thumb-drop { position: relative; height: 220px; border: 2px dashed var(--border); border-radius: var(--radius); background: var(--bg2); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; transition: border-color 0.12s, background 0.12s; }
.thumb-drop:hover, .thumb-drop.drag-over { border-color: var(--accent3); background: var(--surface2); }
.thumb-img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: var(--text2); }
.thumb-icon { font-size: 34px; color: var(--accent); }
.thumb-label { color: var(--text); font-weight: 700; }
.thumb-hint { font-size: 11px; max-width: 260px; line-height: 1.4; }
.thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.12s; font-weight: 700; }
.thumb-drop:hover .thumb-overlay { opacity: 1; }
.remove-thumb { margin-top: 8px; font-size: 12px; color: var(--accent); }
.playlist-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; }
.playlist-row button { padding: 10px 13px; }
.mini-hint { color: var(--text2); font-size: 12px; line-height: 1.45; margin-top: 8px; }
.playlist-done { color: var(--green); font-size: 11px; margin-top: 4px; }
.privacy-list { display: flex; flex-direction: column; gap: 8px; }
.privacy-opt input { display: none; }
.privacy-label { display: flex; align-items: center; gap: 12px; border: 1px solid var(--border); background: var(--bg2); border-radius: var(--radius); padding: 12px; cursor: pointer; transition: all 0.12s; }
.privacy-opt input:checked + .privacy-label { border-color: var(--accent3); background: var(--surface2); }
.privacy-icon { color: var(--accent); font-size: 16px; width: 18px; text-align: center; }
.privacy-text { flex: 1; }
.privacy-name { font-weight: 700; font-size: 13px; }
.privacy-desc { color: var(--text2); font-size: 12px; margin-top: 3px; line-height: 1.4; }
.radio-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border2); }
.privacy-opt input:checked + .privacy-label .radio-dot { border-color: var(--accent); background: var(--accent); box-shadow: inset 0 0 0 3px var(--surface2); }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.toggle-row:last-of-type { border-bottom: none; }
.toggle-label { font-weight: 700; font-size: 13px; }
.toggle-desc { color: var(--text2); font-size: 12px; margin-top: 3px; }
.toggle { width: 46px; height: 26px; padding: 0; border-radius: 99px; background: var(--surface2); border: 1px solid var(--border); position: relative; flex-shrink: 0; }
.toggle span { position: absolute; width: 20px; height: 20px; border-radius: 50%; background: var(--text2); left: 3px; top: 2px; transition: all 0.15s; }
.toggle.on { background: rgba(0,245,160,0.12); border-color: rgba(0,245,160,0.35); }
.toggle.on span { left: 21px; background: var(--green); }
.progress-header { display: flex; justify-content: space-between; align-items: center; }
.progress-header .label { margin: 0; }
.progress-bar { margin: 10px 0; }
.pct { font-size: 12px; color: var(--accent); }
.phase-label { font-size: 12px; color: var(--text2); }
.indeterminate { width: 45%; animation: indeterminate 1s infinite ease-in-out; }
@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(230%); } }
.done-card { display: flex; align-items: center; gap: 14px; border-color: rgba(0,245,160,0.25); }
.done-icon { width: 36px; height: 36px; border-radius: 50%; background: rgba(0,245,160,0.1); color: var(--green); display: flex; align-items: center; justify-content: center; font-weight: 800; }
.done-title { font-weight: 800; }
.video-link { color: var(--text2); font-size: 11px; }
.upload-btn { width: 100%; justify-content: center; }
.error-msg { color: var(--accent); font-size: 12px; font-family: var(--font-mono); line-height: 1.5; }
.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
@media (max-width: 1080px) { .layout { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .file-row, .playlist-row { grid-template-columns: 1fr; display: grid; } }
</style>
