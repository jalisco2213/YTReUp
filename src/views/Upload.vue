<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>Upload</h1>
        <p class="view-sub">Publish video to YouTube channel</p>
      </div>
    </div>

    <div v-if="!yt.isAuthenticated" class="auth-warn card">
      <span>⚠</span>
      <span>Not authenticated. <router-link to="/settings">Set up credentials →</router-link></span>
    </div>

    <div class="layout">
      <!-- LEFT COLUMN -->
      <div class="col-left">

        <!-- Video file -->
        <div class="card section">
          <div class="section-head">Video file</div>
          <label class="label">File path</label>
          <input v-model="filePath" placeholder="/path/to/video.mp4" />
        </div>

        <!-- Basic info -->
        <div class="card section">
          <div class="section-head">Basic info</div>

          <label class="label">Title <span class="required">*</span></label>
          <input v-model="meta.title" placeholder="Video title" maxlength="100" />
          <div class="char-count">{{ meta.title.length }}/100</div>

          <label class="label" style="margin-top:14px">Description</label>
          <textarea
            v-model="meta.description"
            placeholder="Tell viewers about your video…"
            rows="5"
            maxlength="5000"
            style="resize:vertical"
          />
          <div class="char-count">{{ meta.description.length }}/5000</div>

          <label class="label" style="margin-top:14px">Tags <span class="hint-inline">(comma separated)</span></label>
          <input v-model="tagsRaw" placeholder="tag1, tag2, tag3" />
          <div class="tags-preview" v-if="parsedTags.length">
            <span v-for="tag in parsedTags" :key="tag" class="tag-chip">{{ tag }}</span>
          </div>
        </div>

        <!-- Thumbnail -->
        <div class="card section">
          <div class="section-head">Thumbnail</div>
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
              <span class="thumb-label">Click or drag image</span>
              <span class="thumb-hint">JPG, PNG, GIF · max 2MB · 1280×720 recommended</span>
            </div>
            <div v-if="thumbnailPreview" class="thumb-overlay">
              <span>Change</span>
            </div>
          </div>
          <input ref="thumbInput" type="file" accept="image/*" style="display:none" @change="onThumbPick" />
          <button v-if="thumbnailPreview" class="btn-ghost" style="margin-top:8px;font-size:12px;color:var(--accent)" @click.stop="clearThumb">
            ✕ Remove thumbnail
          </button>
        </div>

      </div>

      <!-- RIGHT COLUMN -->
      <div class="col-right">

        <!-- Visibility -->
        <div class="card section">
          <div class="section-head">Visibility</div>
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

          <!-- Scheduled publish -->
          <div v-if="meta.privacyStatus === 'scheduled'" style="margin-top:14px">
            <label class="label">Publish date & time</label>
            <input type="datetime-local" v-model="meta.publishAt" />
          </div>
        </div>

        <!-- Category & Language -->
        <div class="card section">
          <div class="section-head">Classification</div>

          <label class="label">Category</label>
          <select v-model="meta.categoryId">
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>

          <label class="label" style="margin-top:14px">Default language</label>
          <select v-model="meta.defaultLanguage">
            <option value="">— Not set —</option>
            <option value="en">English</option>
            <option value="ru">Russian</option>
            <option value="uk">Ukrainian</option>
            <option value="de">German</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
          </select>
        </div>

        <!-- Advanced -->
        <div class="card section">
          <div class="section-head">Advanced</div>

          <label class="label">Recording location</label>
          <input v-model="meta.recordingLocation" placeholder="e.g. Kyiv, Ukraine" />

          <label class="label" style="margin-top:14px">License</label>
          <select v-model="meta.license">
            <option value="youtube">Standard YouTube License</option>
            <option value="creativeCommon">Creative Commons — Attribution</option>
          </select>

          <div class="toggle-row" style="margin-top:14px">
            <div>
              <div class="toggle-label">Allow embedding</div>
              <div class="toggle-desc">Let others embed this video</div>
            </div>
            <div class="toggle" :class="{ on: meta.embeddable }" @click="meta.embeddable = !meta.embeddable">
              <div class="toggle-knob" />
            </div>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Notify subscribers</div>
              <div class="toggle-desc">Send notification on publish</div>
            </div>
            <div class="toggle" :class="{ on: meta.notifySubscribers }" @click="meta.notifySubscribers = !meta.notifySubscribers">
              <div class="toggle-knob" />
            </div>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Made for kids</div>
              <div class="toggle-desc">Required by COPPA</div>
            </div>
            <div class="toggle" :class="{ on: meta.madeForKids }" @click="meta.madeForKids = !meta.madeForKids">
              <div class="toggle-knob" />
            </div>
          </div>

          <label class="label" style="margin-top:14px">Age restriction</label>
          <select v-model="meta.ageGating">
            <option value="none">None</option>
            <option value="restricted">Restricted (18+)</option>
          </select>

          <label class="label" style="margin-top:14px">Comments</label>
          <select v-model="meta.commentStatus">
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="moderated">Hold all for review</option>
          </select>

          <label class="label" style="margin-top:14px">Ratings visible</label>
          <select v-model="meta.ratingsVisible">
            <option value="true">Visible</option>
            <option value="false">Hidden</option>
          </select>
        </div>

        <!-- Upload progress -->
        <transition name="slide-up">
          <div v-if="uploadPhase" class="card progress-card">
            <div class="progress-header">
              <span class="label" style="margin:0">{{ phaseLabel }}</span>
              <span class="mono" style="font-size:12px;color:var(--accent)">
                {{ uploadPhase === 'uploading' ? uploadPct + '%' : '' }}
              </span>
            </div>
            <div class="progress-bar" style="margin:10px 0">
              <div
                class="progress-fill"
                :class="{ indeterminate: uploadPhase !== 'uploading' }"
                :style="uploadPhase === 'uploading' ? { width: uploadPct + '%' } : {}"
              />
            </div>
            <div v-if="uploadPhase === 'thumbnail'" class="phase-label mono">Setting thumbnail…</div>
          </div>
        </transition>

        <!-- Done -->
        <transition name="slide-up">
          <div v-if="uploadResult" class="card done-card">
            <div class="done-icon">✓</div>
            <div>
              <div class="done-title">Uploaded!</div>
              <div class="mono" style="font-size:11px;color:var(--text2)">youtu.be/{{ uploadResult.id }}</div>
            </div>
            <button class="btn-ghost" @click="openVideo(uploadResult.id)" style="margin-left:auto">Open →</button>
          </div>
        </transition>

        <div v-if="error" class="error-msg card">{{ error }}</div>

        <button
          class="btn-primary upload-btn"
          @click="upload"
          :disabled="!!uploadPhase || !yt.isAuthenticated || !filePath || !meta.title"
        >
          <span v-if="uploadPhase" class="spin">↻</span>
          <span v-else>↑</span>
          {{ uploadPhase ? phaseLabel : 'Upload to YouTube' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useYouTubeStore } from '@/stores/youtube'

const route = useRoute()
const yt = useYouTubeStore()

const filePath = ref('')
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
  ageGating: 'none',
  commentStatus: 'enabled',
  ratingsVisible: 'true',
})
const tagsRaw = ref('')
const parsedTags = computed(() =>
  tagsRaw.value.split(',').map(t => t.trim()).filter(Boolean)
)

const thumbnailFile = ref(null)
const thumbnailPreview = ref('')
const thumbInput = ref(null)
const dragOver = ref(false)

const uploadPhase = ref('') // '' | 'uploading' | 'thumbnail' | 'updating'
const uploadPct = ref(0)
const uploadResult = ref(null)
const error = ref('')

const privacyOpts = [
  { value: 'private',   icon: '🔒', label: 'Private',   desc: 'Only you can see' },
  { value: 'unlisted',  icon: '🔗', label: 'Unlisted',  desc: 'Anyone with the link' },
  { value: 'public',    icon: '🌐', label: 'Public',    desc: 'Visible to everyone' },
  { value: 'scheduled', icon: '🕐', label: 'Scheduled', desc: 'Publish at a set time' },
]

const categories = [
  { id: '1',  name: 'Film & Animation' },
  { id: '2',  name: 'Autos & Vehicles' },
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
  { id: '28', name: 'Science & Technology' },
]

const phaseLabel = computed(() => ({
  uploading: 'Uploading video…',
  thumbnail: 'Setting thumbnail…',
  updating: 'Finalising…',
}[uploadPhase.value] || ''))

onMounted(() => {
  if (route.query.file) filePath.value = route.query.file
  if (route.query.title) meta.value.title = route.query.title
})

function triggerThumbPick() { thumbInput.value?.click() }

function onThumbPick(e) {
  const file = e.target.files?.[0]
  if (file) setThumb(file)
}

function onThumbDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer.files?.[0]
  if (file && file.type.startsWith('image/')) setThumb(file)
}

function setThumb(file) {
  thumbnailFile.value = file
  const reader = new FileReader()
  reader.onload = e => { thumbnailPreview.value = e.target.result }
  reader.readAsDataURL(file)
}

function clearThumb() {
  thumbnailFile.value = null
  thumbnailPreview.value = ''
  if (thumbInput.value) thumbInput.value.value = ''
}

async function upload() {
  if (!filePath.value || !meta.value.title) {
    error.value = 'File path and title are required'
    return
  }
  uploadPhase.value = 'uploading'
  uploadPct.value = 0
  uploadResult.value = null
  error.value = ''

  try {
    // Build status object with all advanced settings
    const privacyStatus = meta.value.privacyStatus === 'scheduled' ? 'private' : meta.value.privacyStatus
    const publishAt = meta.value.privacyStatus === 'scheduled' && meta.value.publishAt
      ? new Date(meta.value.publishAt).toISOString()
      : undefined

    const result = await yt.uploadVideo({
      filePath: filePath.value,
      title: meta.value.title,
      description: meta.value.description,
      tags: parsedTags.value,
      categoryId: meta.value.categoryId,
      privacyStatus,
      publishAt,
      defaultLanguage: meta.value.defaultLanguage || undefined,
      license: meta.value.license,
      embeddable: meta.value.embeddable,
      notifySubscribers: meta.value.notifySubscribers,
      madeForKids: meta.value.madeForKids,
      selfDeclaredMadeForKids: meta.value.madeForKids,
      commentStatus: meta.value.commentStatus,
      ratingsVisible: meta.value.ratingsVisible === 'true',
      onProgress: pct => { uploadPct.value = pct },
    })

    // Upload thumbnail if provided
    if (thumbnailFile.value && result?.id) {
      uploadPhase.value = 'thumbnail'
      await yt.uploadThumbnail(result.id, thumbnailFile.value)
    }

    uploadResult.value = result
    await yt.fetchRecentVideos()
  } catch (e) {
    error.value = e.message
  } finally {
    uploadPhase.value = ''
  }
}

function openVideo(id) {
  window.open(`https://youtu.be/${id}`, '_blank')
}
</script>

<style scoped>
.view { display: flex; flex-direction: column; height: 100%; padding: 28px 28px 0; gap: 16px; overflow: hidden; }
.view-header { flex-shrink: 0; }
.view-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
.view-sub { color: var(--text2); font-size: 13px; margin-top: 4px; }

.auth-warn {
  display: flex; align-items: center; gap: 10px;
  color: var(--yellow); border-color: rgba(255,214,10,0.2); font-size: 13px; flex-shrink: 0;
}
.auth-warn a { color: var(--yellow); }

/* Two-column layout */
.layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  flex: 1;
  overflow: hidden;
}
.col-left, .col-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding-bottom: 28px;
}

.card.section { display: flex; flex-direction: column; }
.section-head {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text2);
  font-family: var(--font-mono);
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.char-count { font-size: 11px; color: var(--text2); font-family: var(--font-mono); text-align: right; margin-top: 4px; }
.hint-inline { font-size: 11px; color: var(--text2); font-weight: 400; text-transform: none; letter-spacing: 0; }
.required { color: var(--accent); }

.tags-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.tag-chip {
  background: rgba(124,58,237,0.12);
  border: 1px solid rgba(124,58,237,0.25);
  color: #a78bfa;
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 3px 9px;
  border-radius: 99px;
}

/* Thumbnail drop zone */
.thumb-drop {
  border: 1.5px dashed var(--border2);
  border-radius: var(--radius);
  height: 180px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-drop:hover, .thumb-drop.drag-over {
  border-color: var(--accent3);
  background: rgba(124,58,237,0.04);
}
.thumb-drop.has-thumb { border-style: solid; border-color: var(--border); }
.thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text2); }
.thumb-icon { font-size: 28px; color: var(--border2); }
.thumb-label { font-size: 13px; font-weight: 600; }
.thumb-hint { font-size: 11px; font-family: var(--font-mono); color: var(--text2); opacity: 0.6; }
.thumb-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.15s;
}
.thumb-drop.has-thumb:hover .thumb-overlay { opacity: 1; }

/* Privacy options */
.privacy-list { display: flex; flex-direction: column; gap: 8px; }
.privacy-opt { cursor: pointer; }
.privacy-opt input[type=radio] { display: none; }
.privacy-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 0.12s;
}
.privacy-opt input:checked + .privacy-label {
  border-color: var(--accent3);
  background: rgba(124,58,237,0.07);
}
.privacy-icon { font-size: 18px; flex-shrink: 0; }
.privacy-text { flex: 1; }
.privacy-name { font-weight: 700; font-size: 13px; }
.privacy-desc { font-size: 11px; color: var(--text2); font-family: var(--font-mono); }
.radio-dot {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border2);
  flex-shrink: 0;
  transition: all 0.12s;
}
.privacy-opt input:checked + .privacy-label .radio-dot {
  border-color: var(--accent3);
  background: var(--accent3);
  box-shadow: 0 0 6px rgba(124,58,237,0.5);
}

/* Toggles */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.toggle-row:last-of-type { border-bottom: none; }
.toggle-label { font-size: 13px; font-weight: 600; }
.toggle-desc { font-size: 11px; color: var(--text2); font-family: var(--font-mono); margin-top: 2px; }
.toggle {
  width: 36px; height: 20px;
  border-radius: 10px;
  background: var(--surface2);
  border: 1px solid var(--border);
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}
.toggle.on { background: var(--accent3); border-color: var(--accent3); }
.toggle-knob {
  position: absolute;
  top: 2px; left: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
}
.toggle.on .toggle-knob { transform: translateX(16px); }

/* Progress */
.progress-card {}
.progress-header { display: flex; justify-content: space-between; align-items: center; }
.phase-label { font-size: 11px; color: var(--text2); margin-top: 6px; }
.indeterminate {
  width: 40% !important;
  animation: indeterminate 1.4s infinite ease-in-out;
}
@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}

/* Done */
.done-card {
  display: flex; align-items: center; gap: 14px;
  border-color: rgba(0,245,160,0.2);
}
.done-icon {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(0,245,160,0.1); color: var(--green);
  font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.done-title { font-weight: 700; font-size: 13px; margin-bottom: 3px; }

.error-msg { color: var(--accent); font-size: 12px; font-family: var(--font-mono); border-color: rgba(255,61,110,0.2); }

.upload-btn { width: 100%; justify-content: center; font-size: 15px; padding: 14px; }

.spin { display: inline-block; animation: rotate 0.8s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
</style>
