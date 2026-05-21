<template>
  <div class="view">
    <div class="view-header">
      <div>
        <h1>{{ t("download.title") }}</h1>
        <p class="view-sub">{{ t("download.subtitle") }}</p>
      </div>
    </div>

    <div class="content">
      <div class="card">
        <label class="label">{{ t("download.url") }}</label>

        <div class="url-row">
          <input
            v-model="url"
            :placeholder="t('download.urlPlaceholder')"
            @keyup.enter="fetchInfo"
            :disabled="loading"
          />
          <button
            class="btn-secondary"
            @click="fetchInfo"
            :disabled="loading || !url.trim()"
          >
            <span v-if="loading" class="spin">↻</span>
            <span v-else>→</span>
            {{ loading ? t("download.fetching") : t("download.getInfo") }}
          </button>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <transition name="slide-up">
        <div v-if="loading" class="card loader-card">
          <div class="loader-icon"><span></span></div>

          <div class="loader-info">
            <div class="loader-title">
              {{
                local(
                  "Проверяем ссылку и получаем данные видео",
                  "Checking link and fetching video info"
                )
              }}
            </div>
            <div class="loader-text">
              {{ local("Прошло", "Elapsed") }}:
              <span class="mono">{{ formatTime(fetchElapsedSeconds) }}</span>
              <span class="loader-separator">·</span>
              {{ local("примерно осталось", "approx. left") }}:
              <span class="mono">{{ formatTime(fetchRemainingSeconds) }}</span>
            </div>

            <div class="loader-line">
              <div class="loader-fill" :style="{ width: `${fetchLoaderPercent}%` }" />
            </div>
          </div>
        </div>
      </transition>

      <div class="card queue-card">
        <div class="queue-head">
          <div>
            <h2>{{ t("queue.title") }}</h2>
            <p>{{ t("queue.subtitle") }}</p>
          </div>

          <div class="queue-actions">
            <button
              class="btn-secondary"
              @click="processAll"
              :disabled="processing || downloading || !processableCount"
            >
              <span v-if="processing" class="spin">↻</span>
              <span v-else>▶</span>
              {{ t("queue.processAll") }}
            </button>

            <button
              class="btn-ghost"
              @click="queue.clearDone"
              :disabled="!queue.items.length"
            >
              {{ t("queue.clearDone") }}
            </button>
          </div>
        </div>

        <div v-if="!queue.items.length" class="empty">
          <div class="empty-icon">⊞</div>
          <h3>{{ t("queue.emptyTitle") }}</h3>
          <p>{{ t("queue.emptyText") }}</p>
        </div>

        <div v-else class="queue-list">
          <div v-for="item in queue.items" :key="item.id" class="queue-item">
            <div class="item-thumb">
              <img v-if="item.videoInfo?.thumbnail" :src="item.videoInfo.thumbnail" />
              <span v-else>▶</span>
            </div>

            <div class="item-info">
              <div class="item-top">
                <div>
                  <div class="item-title">{{ item.videoInfo?.title || item.url }}</div>
                  <div class="item-url mono">{{ item.url }}</div>
                </div>

                <span :class="statusClass(item.status)">{{
                  statusLabel(item.status)
                }}</span>
              </div>

              <div class="item-progress">
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    :style="{ width: `${safePercent(item.progress)}%` }"
                  />
                </div>

                <div class="progress-meta">
                  <span class="mono">{{ displayPercent(item.progress) }}%</span>
                  <span class="mono">{{ item.size || "—" }}</span>
                  <span class="mono">{{ item.speed || "—" }}</span>
                  <span class="mono"
                    >{{ local("осталось", "left") }}: {{ queueEta(item) }}</span
                  >
                </div>
              </div>

              <div v-if="item.error" class="item-error">{{ item.error }}</div>
              <div v-if="item.filePath" class="item-file mono">{{ item.filePath }}</div>

              <div class="item-actions">
                <button
                  v-if="canStartItem(item)"
                  class="btn-secondary"
                  @click="downloadQueueItem(item)"
                  :disabled="processing || downloading || processingItemId === item.id"
                >
                  <span v-if="processingItemId === item.id" class="spin">↻</span>
                  <span v-else>↓</span>
                  {{ t("download.download") }}
                </button>

                <button
                  v-if="item.filePath"
                  class="btn-success"
                  @click="goUpload(item.filePath, item.videoInfo?.title)"
                >
                  {{ t("nav.upload") }}
                </button>

                <button
                  v-if="item.filePath"
                  class="btn-ghost"
                  @click="openFolder(item.filePath)"
                >
                  {{ t("download.openFolder") }}
                </button>

                <button class="btn-ghost danger" @click="queue.removeItem(item.id)">
                  {{ t("common.remove") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <transition name="slide-up">
        <div v-if="videoInfo" class="card video-preview">
          <div class="preview-left">
            <img :src="videoInfo.thumbnail" class="preview-thumb" />
          </div>

          <div class="preview-right">
            <div class="preview-title">{{ videoInfo.title }}</div>

            <div class="preview-meta">
              <span class="mono">{{ videoInfo.uploader }}</span>
              <span class="dot">·</span>
              <span class="mono">{{ formatDuration(videoInfo.duration) }}</span>
              <span class="dot">·</span>
              <span class="mono"
                >{{ formatNum(videoInfo.view_count) }} {{ t("common.views") }}</span
              >
            </div>

            <div class="preview-desc">
              {{ videoInfo.description?.slice(0, 220)
              }}{{ videoInfo.description?.length > 220 ? "…" : "" }}
            </div>

            <div class="form-row">
              <div class="field">
                <label class="label">{{ t("download.quality") }}</label>
                <select v-model="selectedFormat">
                  <option value="best">
                    {{ local("Лучшее качество", "Best quality") }}
                  </option>
                  <option value="2160">2160p 4K</option>
                  <option value="1440">1440p 2K</option>
                  <option value="1080">1080p Full HD</option>
                  <option value="720">720p HD</option>
                  <option value="480">480p</option>
                </select>
              </div>

              <div class="field">
                <label class="label">{{ t("settings.downloadDir") }}</label>
                <div class="dir-row">
                  <input
                    v-model="downloadDir"
                    :placeholder="t('settings.downloadPlaceholder')"
                  />
                  <button class="btn-secondary" @click="chooseFolder">
                    {{ t("common.select") }}
                  </button>
                </div>
              </div>
            </div>

            <div class="quality-hint">
              {{
                local(
                  "Для 720p/1080p/2K/4K нужен ffmpeg. Без него YouTube часто отдаёт только низкое качество.",
                  "720p/1080p/2K/4K requires ffmpeg. Without it YouTube often returns low quality only."
                )
              }}
            </div>

            <div class="preview-actions">
              <button
                class="btn-primary"
                @click="startDownload"
                :disabled="downloading || processing"
              >
                <span v-if="downloading" class="spin">↻</span>
                <span v-else>↓</span>
                {{ downloading ? t("download.downloading") : t("download.download") }}
              </button>

              <button
                class="btn-secondary"
                @click="addToQueue"
                :disabled="downloading || processing"
              >
                <span>⊞</span>
                {{ t("download.addToQueue") }}
              </button>
            </div>

            <transition name="slide-up">
              <div v-if="queueNotice" class="notice-card">
                <span>✓</span>
                <span>{{ queueNotice }}</span>
              </div>
            </transition>
          </div>
        </div>
      </transition>

      <transition name="slide-up">
        <div v-if="downloading" class="card progress-card">
          <div class="progress-header">
            <span class="label">{{ t("download.downloading") }}</span>
            <span class="mono percent">{{ displayPercent(progress.percent) }}%</span>
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${safePercent(progress.percent)}%` }"
            />
          </div>

          <div class="download-loader">
            <div class="loader-icon small"><span></span></div>

            <div>
              <div class="loader-title">
                {{
                  local(
                    "Видео скачивается в хорошем качестве",
                    "Video is downloading in high quality"
                  )
                }}
              </div>
              <div class="loader-text">
                {{ local("Прошло", "Elapsed") }}:
                <span class="mono">{{ formatTime(downloadElapsedSeconds) }}</span>
                <span class="loader-separator">·</span>
                {{ local("осталось", "left") }}:
                <span class="mono">{{ downloadEta }}</span>
              </div>
            </div>
          </div>

          <div class="progress-meta">
            <span class="mono">{{ progress.size || "—" }}</span>
            <span class="mono">{{ progress.speed || "—" }}</span>
            <span class="mono">{{
              progress.eta ? `${local("ETA", "ETA")}: ${progress.eta}` : ""
            }}</span>
          </div>
        </div>
      </transition>

      <transition name="slide-up">
        <div v-if="downloadedFile" class="card done-card">
          <div class="done-icon">✓</div>

          <div class="done-info">
            <div class="done-title">{{ t("download.complete") }}</div>
            <div class="done-path mono">{{ downloadedFile }}</div>
          </div>

          <div class="done-actions">
            <button
              class="btn-success"
              @click="goUpload(downloadedFile, videoInfo?.title)"
            >
              {{ t("download.uploadToYoutube") }} →
            </button>

            <button class="btn-ghost" @click="openFolder(downloadedFile)">
              {{ t("download.openFolder") }}
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useQueueStore } from "@/stores/queue";
import { useI18nStore } from "@/stores/i18n";

const router = useRouter();
const queue = useQueueStore();
const i18n = useI18nStore();
const t = i18n.t;

const url = ref("");
const videoInfo = ref(null);
const loading = ref(false);
const error = ref("");
const selectedFormat = ref("1080");
const downloading = ref(false);
const processing = ref(false);
const processingItemId = ref("");
const activeQueueItemId = ref("");
const progress = ref({ percent: 0, size: "", speed: "", eta: "" });
const downloadedFile = ref("");
const downloadDir = ref("");
const queueNotice = ref("");
const fetchStartedAt = ref(0);
const downloadStartedAt = ref(0);
const now = ref(Date.now());

let removeProgress = null;
let removeLog = null;
let clock = null;
let noticeTimer = null;

const processableCount = computed(
  () => queue.items.filter((item) => ["pending", "error"].includes(item.status)).length
);

const fetchElapsedSeconds = computed(() => {
  if (!loading.value || !fetchStartedAt.value) return 0;
  return Math.max(0, Math.floor((now.value - fetchStartedAt.value) / 1000));
});

const fetchRemainingSeconds = computed(() => {
  return Math.max(1, 20 - fetchElapsedSeconds.value);
});

const fetchLoaderPercent = computed(() => {
  return Math.min(96, Math.max(8, Math.round((fetchElapsedSeconds.value / 20) * 100)));
});

const downloadElapsedSeconds = computed(() => {
  if (!downloading.value || !downloadStartedAt.value) return 0;
  return Math.max(0, Math.floor((now.value - downloadStartedAt.value) / 1000));
});

const downloadEta = computed(() => {
  if (progress.value.eta) return progress.value.eta;

  const eta = estimateRemainingSeconds(progress.value.percent, downloadStartedAt.value);
  return eta === null ? local("считаем...", "calculating...") : formatTime(eta);
});

onMounted(async () => {
  const cfg = await window.electron.loadConfig();
  downloadDir.value = cfg.downloadDir || "";

  clock = setInterval(() => {
    now.value = Date.now();
  }, 1000);

  removeProgress = window.electron?.onProgress((data) => {
    const normalized = {
      percent: safePercent(data?.percent),
      size: data?.size || "",
      speed: data?.speed || "",
      eta: data?.eta || "",
    };

    if (activeQueueItemId.value) {
      const item = queue.items.find((i) => i.id === activeQueueItemId.value);

      queue.updateItem(activeQueueItemId.value, {
        progress: normalized.percent,
        size: normalized.size,
        speed: normalized.speed,
        eta: normalized.eta,
        etaSeconds: normalized.eta
          ? null
          : estimateRemainingSeconds(normalized.percent, item?.startedAt || Date.now()),
      });

      return;
    }

    progress.value = normalized;
  });

  removeLog = window.electron?.onLog(() => {});
});

onUnmounted(() => {
  removeProgress?.();
  removeLog?.();

  if (clock) clearInterval(clock);
  if (noticeTimer) clearTimeout(noticeTimer);
});

function currentLang() {
  return i18n.language?.value || i18n.language || "ru";
}

function local(ru, en) {
  return currentLang() === "en" ? en : ru;
}

async function chooseFolder() {
  const folder = await window.electron?.openDirectory();
  if (folder) downloadDir.value = folder;
}

async function fetchInfo() {
  if (!url.value.trim()) return;

  loading.value = true;
  error.value = "";
  videoInfo.value = null;
  downloadedFile.value = "";
  fetchStartedAt.value = Date.now();

  try {
    videoInfo.value = await window.electron.ytdlpInfo(url.value.trim());
  } catch (e) {
    error.value = e.message || t("download.failedInfo");
  } finally {
    loading.value = false;
    fetchStartedAt.value = 0;
  }
}

async function startDownload() {
  if (!videoInfo.value || downloading.value || processing.value) return;

  downloading.value = true;
  downloadedFile.value = "";
  error.value = "";
  activeQueueItemId.value = "";
  progress.value = { percent: 0, size: "", speed: "", eta: "" };
  downloadStartedAt.value = Date.now();

  try {
    const result = await window.electron.ytdlpDownload({
      url: url.value.trim(),
      format: selectedFormat.value,
      outputDir: downloadDir.value || undefined,
    });

    downloadedFile.value = result.filePath;
    progress.value = { percent: 100, size: "", speed: "", eta: "00:00" };
  } catch (e) {
    error.value = e.message || String(e);
  } finally {
    downloading.value = false;
    downloadStartedAt.value = 0;
  }
}

function addToQueue() {
  if (!videoInfo.value) return;

  queue.addItem(url.value.trim(), videoInfo.value, {
    format: selectedFormat.value,
    outputDir: downloadDir.value || null,
  });

  queueNotice.value = local("Видео добавлено в очередь", "Video added to queue");

  if (noticeTimer) clearTimeout(noticeTimer);

  noticeTimer = setTimeout(() => {
    queueNotice.value = "";
  }, 2200);
}

function canStartItem(item) {
  return ["pending", "error"].includes(item.status);
}

async function processAll() {
  if (processing.value || downloading.value || !processableCount.value) return;

  processing.value = true;

  for (const item of [...queue.items]) {
    if (!canStartItem(item)) continue;
    await downloadQueueItem(item, true);
  }

  processing.value = false;
}

async function downloadQueueItem(item, batch = false) {
  if (!item || item.status === "downloading" || downloading.value) return;
  if (!batch && processing.value) return;

  processingItemId.value = item.id;
  activeQueueItemId.value = item.id;

  try {
    const cfg = await window.electron.loadConfig();

    queue.updateItem(item.id, {
      status: "downloading",
      progress: 0,
      speed: "",
      size: "",
      eta: "",
      etaSeconds: null,
      error: null,
      startedAt: Date.now(),
    });

    const result = await window.electron.ytdlpDownload({
      url: item.url,
      format: item.format || selectedFormat.value,
      outputDir: item.outputDir || downloadDir.value || cfg.downloadDir || undefined,
    });

    queue.updateItem(item.id, {
      status: "downloaded",
      filePath: result.filePath,
      progress: 100,
      speed: "",
      size: "",
      eta: "00:00",
      etaSeconds: 0,
    });
  } catch (e) {
    queue.updateItem(item.id, {
      status: "error",
      error: e.message || String(e),
    });
  } finally {
    if (activeQueueItemId.value === item.id) activeQueueItemId.value = "";
    if (processingItemId.value === item.id) processingItemId.value = "";
  }
}

function goUpload(filePath, title) {
  router.push({ path: "/upload", query: { file: filePath, title } });
}

function openFolder(filePath) {
  if (!filePath) return;

  const dir = filePath.replace(/[/\\][^/\\]+$/, "");
  window.electron?.openPath(dir);
}

function statusClass(status) {
  const map = {
    pending: "badge badge-pending",
    downloading: "badge badge-downloading",
    downloaded: "badge badge-downloaded",
    uploading: "badge badge-uploading",
    done: "badge badge-done",
    error: "badge badge-error",
  };

  return map[status] || "badge badge-pending";
}

function statusLabel(status) {
  return t(`queue.${status || "pending"}`);
}

function queueEta(item) {
  if (item.status === "downloaded" || item.status === "done") return formatTime(0);
  if (item.eta) return item.eta;

  const eta = item.etaSeconds ?? estimateRemainingSeconds(item.progress, item.startedAt);

  if (eta === null) return local("считаем...", "calculating...");
  return formatTime(eta);
}

function estimateRemainingSeconds(percent, startedAt) {
  const value = safePercent(percent);

  if (!startedAt || value <= 0 || value >= 100) {
    if (value >= 100) return 0;
    return null;
  }

  const elapsed = Math.max(1, (now.value - startedAt) / 1000);
  const total = elapsed / (value / 100);
  const left = Math.max(0, total - elapsed);

  if (!Number.isFinite(left)) return null;

  return Math.round(left);
}

function safePercent(value) {
  const num = Number.parseFloat(value);

  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function displayPercent(value) {
  return safePercent(value).toFixed(1);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (currentLang() === "en") {
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  }

  if (h) return `${h} ч ${m} мин`;
  if (m) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function formatDuration(s) {
  if (!s) return "";

  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatNum(n) {
  if (!n) return "0";

  const num = Number.parseInt(n, 10);

  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;

  return num.toString();
}
</script>

<style scoped>
.view {
  height: 100%;
  padding: 28px;
  overflow-y: auto;
}

.view-header {
  margin-bottom: 20px;
}

.view-header h1 {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.view-sub {
  color: var(--text2);
  font-size: 13px;
  margin-top: 4px;
}

.content {
  display: grid;
  gap: 16px;
}

.url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: stretch;
}

.url-row button {
  white-space: nowrap;
}

.error-msg {
  color: var(--accent);
  font-size: 12px;
  font-family: var(--font-mono);
  margin-top: 8px;
}

.loader-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  border-color: rgba(255, 214, 10, 0.18);
}

.loader-icon {
  width: 42px;
  height: 42px;
  border: 1px solid rgba(255, 214, 10, 0.25);
  border-radius: 50%;
  position: relative;
}

.loader-icon span {
  position: absolute;
  inset: 7px;
  border: 3px solid rgba(255, 214, 10, 0.16);
  border-top-color: var(--yellow);
  border-radius: 50%;
  animation: rotate 0.8s linear infinite;
}

.loader-icon.small {
  width: 32px;
  height: 32px;
}

.loader-icon.small span {
  inset: 6px;
  border-width: 2px;
}

.loader-info {
  min-width: 0;
}

.loader-title {
  color: var(--text);
  font-weight: 800;
  font-size: 14px;
  margin-bottom: 5px;
}

.loader-text {
  color: var(--text2);
  font-size: 12px;
  line-height: 1.5;
}

.loader-separator {
  color: var(--border2);
  margin: 0 8px;
}

.loader-line {
  height: 4px;
  background: var(--surface2);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 10px;
}

.loader-fill {
  height: 100%;
  background: var(--yellow);
  border-radius: 99px;
  transition: width 0.3s ease;
}

.queue-card {
  padding: 0;
  overflow: hidden;
}

.queue-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.queue-head h2 {
  font-size: 18px;
  font-weight: 800;
}

.queue-head p {
  color: var(--text2);
  font-size: 12px;
  margin-top: 4px;
}

.queue-actions {
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
  align-items: center;
}

.empty {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
  color: var(--text2);
  padding: 30px;
}

.empty-icon {
  font-size: 38px;
  color: var(--border2);
}

.empty h3 {
  font-size: 18px;
  color: var(--text);
}

.empty p {
  font-size: 13px;
  max-width: 340px;
  line-height: 1.6;
}

.queue-list {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.queue-item {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
}

.queue-item:hover {
  border-color: var(--border2);
}

.item-thumb {
  width: 112px;
  height: 64px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface2);
  display: grid;
  place-items: center;
  color: var(--text2);
}

.item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  min-width: 0;
}

.item-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}

.item-title {
  font-weight: 700;
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 4px;
}

.item-url {
  font-size: 11px;
  color: var(--text2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-progress {
  margin-top: 10px;
}

.item-progress .progress-bar {
  margin: 0 0 7px;
}

.progress-meta {
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  gap: 12px;
  font-size: 12px;
  color: var(--text2);
}

.item-error {
  font-size: 11px;
  color: var(--accent);
  font-family: var(--font-mono);
  margin-top: 8px;
  line-height: 1.5;
}

.item-file {
  font-size: 10px;
  color: var(--text2);
  margin-top: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  gap: 8px;
  margin-top: 12px;
}

.video-preview {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.preview-thumb {
  width: 240px;
  height: 135px;
  object-fit: cover;
  border-radius: 4px;
  background: var(--surface2);
}

.preview-right {
  min-width: 0;
}

.preview-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
  line-height: 1.4;
}

.preview-meta {
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  gap: 6px;
  font-size: 12px;
  color: var(--text2);
  margin-bottom: 10px;
}

.dot {
  color: var(--border2);
}

.preview-desc {
  font-size: 12px;
  color: var(--text2);
  line-height: 1.6;
}

.form-row {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.field {
  min-width: 0;
}

.dir-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.quality-hint {
  color: var(--text2);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 12px;
}

.preview-actions {
  display: grid;
  grid-auto-flow: column;
  justify-content: start;
  gap: 10px;
  margin-top: 16px;
}

.notice-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: rgba(0, 245, 160, 0.08);
  border: 1px solid rgba(0, 245, 160, 0.18);
  color: var(--green);
  font-size: 13px;
  font-weight: 700;
}

.progress-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.progress-header .label {
  margin: 0;
}

.progress-card .progress-bar {
  margin: 12px 0;
}

.percent {
  font-size: 12px;
  color: var(--accent);
}

.download-loader {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin: 14px 0;
}

.done-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  border-color: rgba(0, 245, 160, 0.2);
}

.done-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 245, 160, 0.1);
  color: var(--green);
  font-size: 18px;
  display: grid;
  place-items: center;
}

.done-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.done-path {
  font-size: 11px;
  color: var(--text2);
  word-break: break-all;
}

.done-actions {
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
}

.danger {
  color: var(--accent);
}

.spin {
  display: inline-block;
  animation: rotate 0.8s linear infinite;
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1000px) {
  .video-preview,
  .form-row,
  .done-card {
    grid-template-columns: 1fr;
  }

  .preview-thumb {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }
}

@media (max-width: 760px) {
  .view {
    padding: 18px;
  }

  .url-row,
  .queue-head,
  .queue-item,
  .item-top,
  .dir-row,
  .loader-card,
  .download-loader {
    grid-template-columns: 1fr;
  }

  .queue-actions,
  .item-actions,
  .preview-actions,
  .done-actions,
  .progress-meta,
  .preview-meta {
    grid-auto-flow: row;
  }

  .item-thumb {
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
  }
}
</style>
