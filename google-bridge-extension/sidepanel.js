const $ = (selector) => document.querySelector(selector);

const elements = {
  statusBadge: $("#statusBadge"),
  jsonFile: $("#jsonFile"),
  jsonText: $("#jsonText"),
  dropZone: $("#dropZone"),
  parseButton: $("#parseButton"),
  clearButton: $("#clearButton"),
  editImportButton: $("#editImportButton"),
  importMessage: $("#importMessage"),
  importSection: $("#importSection"),
  chaptersSection: $("#chaptersSection"),
  filtersSection: $("#filtersSection"),
  runSection: $("#runSection"),
  executionEmpty: $("#executionEmpty"),
  chapterList: $("#chapterList"),
  chapterSummary: $("#chapterSummary"),
  collectionHeading: $("#collectionHeading"),
  batchRow: $("#batchRow"),
  bulkCount: $("#bulkCount"),
  applyBulkButton: $("#applyBulkButton"),
  sizeFilter: $("#sizeFilter"),
  typeFilter: $("#typeFilter"),
  layoutFilter: $("#layoutFilter"),
  urlFilterMode: $("#urlFilterMode"),
  urlFilterText: $("#urlFilterText"),
  urlTextLabel: $("#urlTextLabel"),
  sortFilter: $("#sortFilter"),
  candidateMultiplier: $("#candidateMultiplier"),
  customSizeFields: $("#customSizeFields"),
  minWidth: $("#minWidth"),
  minHeight: $("#minHeight"),
  deduplicate: $("#deduplicate"),
  ignoreTextHeavy: $("#ignoreTextHeavy"),
  safeSearch: $("#safeSearch"),
  resetFiltersButton: $("#resetFiltersButton"),
  startButton: $("#startButton"),
  pauseButton: $("#pauseButton"),
  captchaRetryButton: $("#captchaRetryButton"),
  cancelButton: $("#cancelButton"),
  progressBar: $("#progressBar"),
  overallCount: $("#overallCount"),
  currentTask: $("#currentTask"),
  scanVisualizer: $("#scanVisualizer"),
  foundCount: $("#foundCount"),
  selectedCount: $("#selectedCount"),
  selectionGoal: $("#selectionGoal"),
  activeFilters: $("#activeFilters"),
  liveGallery: $("#liveGallery"),
  scanOverlay: $("#scanOverlay"),
  scanOverlayText: $("#scanOverlayText"),
  scanOverlayDetail: $("#scanOverlayDetail"),
  scanProgressBar: $("#scanProgressBar"),
  runLog: $("#runLog"),
  downloadSection: $("#downloadSection"),
  downloadSummary: $("#downloadSummary"),
  downloadButton: $("#downloadButton"),
  downloadFailuresButton: $("#downloadFailuresButton")
};

elements.tabButtons = [...document.querySelectorAll(".tab-button")];
elements.tabPanels = [...document.querySelectorAll(".tab-panel")];

function switchTab(tabName) {
  elements.tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tabName));
}

const app = {
  chapters: [],
  inputMode: "chapters",
  inputSignature: "",
  runSignature: "",
  running: false,
  paused: false,
  cancelled: false,
  awaitingCaptcha: false,
  manualCaptchaContinue: false,
  searchTabId: null,
  totalRequested: 0,
  totalCollected: 0,
  rejected: 0,
  incompleteChapters: [],
  failedItems: [],
  seenUrls: new Set(),
  seenHashes: new Set(),
  activeControllers: new Set(),
  searchesSinceCooldown: 0,
  hasStartedSearch: false,
  previewUrls: [],
  previewCards: new Map()
};

const DB_NAME = "chapter-image-collector";
const DB_VERSION = 1;
const IMAGE_STORE = "images";
const FETCH_TIMEOUT_MS = 12000;
const DECODE_TIMEOUT_MS = 8000;
const TEXT_DETECTION_TIMEOUT_MS = 6000;
const SEARCH_DELAY_MIN_MS = 2000;
const SEARCH_DELAY_MAX_MS = 5000;
const SEARCHES_PER_COOLDOWN = 50;
const SEARCH_COOLDOWN_MS = 2 * 60 * 1000;

function withTimeout(promise, timeoutMs, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

async function waitInterruptibly(durationMs, label) {
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    await waitWhilePaused();
    const remainingMs = Math.max(0, deadline - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    elements.currentTask.textContent = `${label} · ${remainingSeconds} s`;
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000, remainingMs)));
  }
  if (app.cancelled) throw new Error("Operación cancelada.");
}

async function applySearchPacing() {
  if (app.searchesSinceCooldown >= SEARCHES_PER_COOLDOWN) {
    log("Pausa preventiva: 2 minutos después de 50 búsquedas para reducir CAPTCHA.");
    await waitInterruptibly(SEARCH_COOLDOWN_MS, "Pausa preventiva antes de continuar");
    app.searchesSinceCooldown = 0;
    app.hasStartedSearch = true;
    log("Pausa preventiva terminada; reanudando búsquedas.", "success");
    return;
  }

  if (app.hasStartedSearch) {
    const delay = SEARCH_DELAY_MIN_MS + Math.random() * (SEARCH_DELAY_MAX_MS - SEARCH_DELAY_MIN_MS);
    await waitInterruptibly(delay, "Esperando antes de la siguiente búsqueda");
  }
  app.hasStartedSearch = true;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        const store = db.createObjectStore(IMAGE_STORE, { keyPath: "id" });
        store.createIndex("chapterIndex", "chapterIndex");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearStoredImages() {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.objectStore(IMAGE_STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function clearStoredImagesFromChapter(firstChapterIndex) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const request = tx.objectStore(IMAGE_STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (Number(cursor.value.chapterIndex) >= firstChapterIndex) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function storeImage(record) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.objectStore(IMAGE_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getStoredImages() {
  const db = await openDatabase();
  const records = await new Promise((resolve, reject) => {
    const request = db.transaction(IMAGE_STORE, "readonly").objectStore(IMAGE_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return records.sort((a, b) => a.chapterIndex - b.chapterIndex || a.chapterSequence - b.chapterSequence);
}

function setStatus(text, kind = "idle") {
  elements.statusBadge.textContent = text;
  elements.statusBadge.className = `badge ${kind}`;
}

function showMessage(text, error = false) {
  elements.importMessage.textContent = text;
  elements.importMessage.className = `message${error ? " error" : ""}`;
}

function log(text, kind = "") {
  const line = document.createElement("div");
  line.textContent = `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}  ${text}`;
  if (kind) line.className = `log-${kind}`;
  elements.runLog.append(line);
  elements.runLog.scrollTop = elements.runLog.scrollHeight;
}

function clearPreviewGallery() {
  for (const url of app.previewUrls) URL.revokeObjectURL(url);
  app.previewUrls = [];
  app.previewCards.clear();
  elements.liveGallery.replaceChildren();
}

function setScanOverlay(visible, title = "Scanning page…", detail = "", percent = 8) {
  elements.scanOverlay.classList.toggle("hidden", !visible);
  elements.scanOverlayText.textContent = title;
  elements.scanOverlayDetail.textContent = detail;
  elements.scanProgressBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
}

function renderActiveFilters(settings) {
  const values = [
    `Size: ${settings.size === "any" ? "Any" : settings.size}`,
    `Type: ${settings.type === "any" ? "Any" : settings.type.toUpperCase()}`,
    `Layout: ${settings.layout === "any" ? "Any" : settings.layout}`,
    `URL: ${settings.urlMode === "any" ? "Any" : settings.urlMode}`,
    `Sort: ${settings.sort === "pixels" ? "Pixel size" : settings.sort}`,
    `Text: ${settings.ignoreTextHeavy ? "Avoid dense" : "Any"}`
  ];
  elements.activeFilters.replaceChildren(...values.map((value) => {
    const chip = document.createElement("span");
    chip.className = "filter-chip";
    chip.textContent = value;
    return chip;
  }));
}

function beginVisualScan(chapter, term, quota, settings) {
  clearPreviewGallery();
  elements.scanVisualizer.classList.remove("hidden");
  elements.foundCount.textContent = "0";
  elements.selectedCount.textContent = "0";
  elements.selectionGoal.textContent = String(quota);
  renderActiveFilters(settings);
  setScanOverlay(true, "Scanning page…", `${chapter.chapter} · ${term}`, 6);
}

function itemLabel(chapter) {
  return app.inputMode === "searchTerms" ? `ID ${chapter.outputId}` : chapter.chapter;
}

function downloadButtonLabel() {
  return app.inputMode === "searchTerms" ? "Descargar ZIP por IDs" : "Descargar ZIP por capítulos";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function addPreviewCard(image) {
  if (app.previewCards.has(image.url)) return;
  const objectUrl = URL.createObjectURL(image.blob);
  app.previewUrls.push(objectUrl);
  const card = document.createElement("article");
  card.className = "image-card";
  card.innerHTML = `
    <span class="select-mark">✓</span>
    <div class="image-tags"><span class="image-tag">${escapeHtml(image.type)}</span><span class="image-tag">${image.width}×${image.height}</span></div>
    <img src="${objectUrl}" alt="" loading="lazy">
    <div class="image-meta"><span title="${escapeHtml(image.url)}">${escapeHtml(new URL(image.url).hostname)}</span><span>${formatBytes(image.byteSize)}</span></div>
  `;
  app.previewCards.set(image.url, card);
  elements.liveGallery.append(card);
}

function renderSortedGallery(images) {
  clearPreviewGallery();
  images.forEach(addPreviewCard);
}

async function markPreviewSelected(image, selected, goal) {
  const card = app.previewCards.get(image.url);
  if (card) {
    card.classList.add("selected");
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  elements.selectedCount.textContent = String(selected);
  elements.selectionGoal.textContent = String(goal);
  await new Promise((resolve) => setTimeout(resolve, 90));
}

chrome.runtime.onMessage.addListener((message) => {
  if (!app.running || message?.type !== "GOOGLE_SCAN_PROGRESS") return;
  if (Number.isFinite(message.found)) elements.foundCount.textContent = String(message.found);
  if (message.phase === "start") {
    setScanOverlay(true, "Scanning page…", "Reading Google Images", 6);
  } else if (message.phase === "discover") {
    const percent = 8 + Math.min(52, ((message.current || 1) / Math.max(1, message.total || 32)) * 52);
    setScanOverlay(true, `Analyzing ${message.found || 0} images`, "Loading and scanning visible results", percent);
  } else if (message.phase === "preview") {
    const percent = 60 + ((message.current || 0) / Math.max(1, message.total || 1)) * 25;
    setScanOverlay(true, "Opening full-size previews", `${message.current || 0} of ${message.total || 0}`, percent);
  } else if (message.phase === "done") {
    setScanOverlay(true, `Found ${message.found || 0} candidates`, "Preparing validation", 88);
  }
});

function sanitizeName(value, fallback = "untitled") {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return (cleaned || fallback).slice(0, 120);
}

function slugify(value) {
  return sanitizeName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55) || "image";
}

function validateChapters(parsed) {
  return parsed.map((item, index) => {
    if (!item || typeof item.chapter !== "string" || !item.chapter.trim()) {
      throw new Error(`El capítulo ${index + 1} no tiene un nombre válido.`);
    }
    if (!Array.isArray(item.searchTerm) || !item.searchTerm.length || item.searchTerm.some((term) => typeof term !== "string" || !term.trim())) {
      throw new Error(`“${item.chapter}” necesita una lista searchTerm válida.`);
    }
    return {
      chapter: item.chapter.trim(),
      startText: typeof item.startText === "string" ? item.startText : "",
      endText: typeof item.endText === "string" ? item.endText : "",
      searchTerm: item.searchTerm.map((term) => term.trim()),
      imageCount: Number.isInteger(item.imageCount) && item.imageCount > 0 ? item.imageCount : null
    };
  });
}

function validateSearchTerms(parsed) {
  const ids = new Set();
  return parsed.map((item, index) => {
    const validIdType = typeof item?.id === "string" || typeof item?.id === "number";
    const id = validIdType ? String(item.id).trim() : "";
    if (!id) throw new Error(`El término ${index + 1} no tiene un id válido.`);
    if (/[\\/:*?"<>|\u0000-\u001f]/.test(id)) throw new Error(`El id “${id}” contiene caracteres no permitidos para un archivo.`);
    if (ids.has(id)) throw new Error(`El id “${id}” está repetido.`);
    if (typeof item.searchTerm !== "string" || !item.searchTerm.trim()) {
      throw new Error(`El elemento con id “${id}” necesita un searchTerm válido.`);
    }
    ids.add(id);
    return {
      chapter: `ID ${id}`,
      outputId: id,
      sourceId: item.id,
      sourceText: typeof item.text === "string" ? item.text : "",
      startText: "",
      endText: "",
      searchTerm: [item.searchTerm.trim()],
      imageCount: 1
    };
  });
}

function parseInputData(parsed) {
  if (!Array.isArray(parsed) || !parsed.length) throw new Error("El JSON debe ser un arreglo con al menos un elemento.");
  const chapterShape = parsed.every((item) => item && typeof item.chapter === "string" && Array.isArray(item.searchTerm));
  const searchTermShape = parsed.every((item) => item && (typeof item.id === "string" || typeof item.id === "number") && typeof item.searchTerm === "string");
  if (chapterShape) return { mode: "chapters", items: validateChapters(parsed) };
  if (searchTermShape) return { mode: "searchTerms", items: validateSearchTerms(parsed) };
  throw new Error("Formato no reconocido. Usa chapter + searchTerm[] para capítulos, o id + searchTerm para términos de búsqueda.");
}

function renderChapters() {
  elements.chapterList.replaceChildren();
  app.chapters.forEach((chapter, index) => {
    const row = document.createElement("div");
    row.className = "chapter-row";
    if (app.inputMode === "searchTerms") {
      const term = chapter.searchTerm[0];
      row.innerHTML = `
        <span class="chapter-index">${String(index + 1).padStart(2, "0")}</span>
        <div><div class="chapter-title" title="ID ${escapeHtml(chapter.outputId)}">ID ${escapeHtml(chapter.outputId)}</div><div class="chapter-meta" title="${escapeHtml(term)}">${escapeHtml(term)}</div></div>
        <span class="fixed-count">1 imagen</span>
      `;
    } else {
      row.innerHTML = `
        <span class="chapter-index">${String(index + 1).padStart(2, "0")}</span>
        <div><div class="chapter-title" title="${escapeHtml(chapter.chapter)}">${escapeHtml(chapter.chapter)}</div><div class="chapter-meta">${chapter.searchTerm.length} términos</div></div>
        <input class="chapter-count" data-index="${index}" type="number" min="1" step="1" value="${chapter.imageCount || ""}" placeholder="Total" aria-label="Imágenes para ${escapeHtml(chapter.chapter)}">
      `;
    }
    elements.chapterList.append(row);
  });

  const terms = app.chapters.reduce((sum, chapter) => sum + chapter.searchTerm.length, 0);
  const searchTermMode = app.inputMode === "searchTerms";
  elements.collectionHeading.textContent = searchTermMode ? "Términos de búsqueda" : "Imágenes por capítulo";
  elements.chapterSummary.textContent = searchTermMode
    ? `${terms} términos · 1 imagen fija por término`
    : `${app.chapters.length} capítulos · ${terms} términos`;
  elements.batchRow.classList.toggle("hidden", searchTermMode);
  elements.downloadButton.textContent = downloadButtonLabel();
  elements.importSection.classList.add("hidden");
  elements.chaptersSection.classList.remove("hidden");
  elements.runSection.classList.remove("hidden");
  elements.executionEmpty.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

async function parseJsonText(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const parsed = JSON.parse(cleanText);
  const normalized = parseInputData(parsed);
  app.inputMode = normalized.mode;
  app.chapters = normalized.items;
  app.inputSignature = await sha256(new TextEncoder().encode(cleanText));
  renderChapters();
  const description = app.inputMode === "searchTerms"
    ? `${app.chapters.length} términos cargados; cada uno generará una imagen.`
    : `${app.chapters.length} capítulos cargados.`;
  showMessage(`JSON válido: ${description}`);
  await chrome.storage.local.set({ importedJson: text });
}

function syncCountsFromUi() {
  if (app.inputMode === "searchTerms") return;
  const inputs = [...document.querySelectorAll(".chapter-count")];
  for (const input of inputs) {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 1) {
      input.focus();
      throw new Error(`Define una cantidad válida para el capítulo ${Number(input.dataset.index) + 1}.`);
    }
    app.chapters[Number(input.dataset.index)].imageCount = value;
  }
}

function getSettings() {
  const sizePreset = elements.sizeFilter.value;
  const thresholds = {
    any: [1, 1],
    small: [400, 400],
    medium: [800, 800],
    large: [1600, 1600],
    xlarge: [2560, 2560],
    custom: [Math.max(1, Number(elements.minWidth.value) || 1), Math.max(1, Number(elements.minHeight.value) || 1)]
  };
  const [minWidth, minHeight] = thresholds[sizePreset];
  return {
    size: sizePreset,
    minWidth,
    minHeight,
    type: elements.typeFilter.value,
    layout: elements.layoutFilter.value,
    urlMode: elements.urlFilterMode.value,
    urlText: elements.urlFilterText.value.trim().toLowerCase(),
    sort: elements.sortFilter.value,
    candidateMultiplier: Number(elements.candidateMultiplier.value),
    deduplicate: elements.deduplicate.checked,
    ignoreTextHeavy: elements.ignoreTextHeavy.checked,
    safeSearch: elements.safeSearch.checked
  };
}

function resetFilters() {
  elements.sizeFilter.value = "any";
  elements.typeFilter.value = "any";
  elements.layoutFilter.value = "any";
  elements.urlFilterMode.value = "any";
  elements.urlFilterText.value = "";
  elements.sortFilter.value = "pixels";
  elements.ignoreTextHeavy.checked = false;
  elements.customSizeFields.classList.add("hidden");
  elements.urlTextLabel.classList.add("hidden");
}

function distribute(total, termCount) {
  const base = Math.floor(total / termCount);
  const remainder = total % termCount;
  return Array.from({ length: termCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function updateProgress() {
  const percent = app.totalRequested ? Math.min(100, (app.totalCollected / app.totalRequested) * 100) : 0;
  elements.progressBar.style.width = `${percent}%`;
  elements.overallCount.textContent = `${app.totalCollected} / ${app.totalRequested}`;
}

async function waitWhilePaused() {
  while (app.paused && !app.cancelled) await new Promise((resolve) => setTimeout(resolve, 250));
  if (app.cancelled) throw new Error("Operación cancelada.");
}

async function ensureSearchTab() {
  if (app.searchTabId) {
    try {
      await chrome.tabs.get(app.searchTabId);
      return app.searchTabId;
    } catch (_) {
      app.searchTabId = null;
    }
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id && isGoogleImagesUrl(activeTab.url)) {
    app.searchTabId = activeTab.id;
    log("Usando la pestaña activa de Google Imágenes.", "success");
    return activeTab.id;
  }

  const tab = await chrome.tabs.create({ url: "https://www.google.com/imghp", active: false });
  app.searchTabId = tab.id;
  log("No había una pestaña activa de Google Imágenes; se abrió una pestaña de trabajo.");
  return tab.id;
}

function isGoogleImagesUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const googleHost = url.hostname === "google.com" || url.hostname === "www.google.com";
    return googleHost && (url.pathname === "/imghp" || (url.pathname === "/search" && (url.searchParams.get("tbm") === "isch" || url.searchParams.get("udm") === "2")));
  } catch (_) {
    return false;
  }
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Google tardó demasiado en cargar.")), timeoutMs);
    const listener = (updatedId, info) => {
      if (updatedId === tabId && info.status === "complete") finish();
    };
    const finish = (error) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      error ? reject(error) : resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch(() => {});
  });
}

async function sendScanMessage(tabId, candidateGoal) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "COLLECT_GOOGLE_IMAGES", candidateGoal });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError || new Error("No se pudo conectar con el escáner de Google.");
}

async function checkCaptchaState(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status !== "complete") return { captcha: true, ready: false };
    return await chrome.tabs.sendMessage(tabId, { type: "CHECK_GOOGLE_CAPTCHA" });
  } catch (_) {
    return { captcha: true, ready: false };
  }
}

async function waitForCaptchaResolution(tabId, term, searchUrl) {
  app.awaitingCaptcha = true;
  app.manualCaptchaContinue = false;
  app.paused = false;
  elements.pauseButton.classList.add("hidden");
  elements.pauseButton.textContent = "Pausar";
  elements.captchaRetryButton.disabled = false;
  elements.captchaRetryButton.textContent = "No veo CAPTCHA · Reintentar";
  elements.captchaRetryButton.classList.remove("hidden");
  setStatus("Verificación", "paused");
  elements.currentTask.textContent = `Google indicó una posible verificación para “${term}”. Si no ves ningún CAPTCHA, pulsa Reintentar.`;
  setScanOverlay(true, "Verification may be required", "Complete it in Google or use Retry", 100);
  log("Google solicitó verificación humana. Operación en espera; no se perderá el progreso.", "error");
  await chrome.tabs.update(tabId, { active: true });

  while (!app.cancelled) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (app.manualCaptchaContinue) {
      app.manualCaptchaContinue = false;
      log("Reintento manual solicitado. Volviendo a cargar la búsqueda actual.");
      const currentTab = await chrome.tabs.get(tabId);
      if (currentTab.url === searchUrl) {
        await chrome.tabs.reload(tabId);
        await chrome.tabs.update(tabId, { active: true });
      } else {
        await chrome.tabs.update(tabId, { url: searchUrl, active: true });
      }
      await waitForTabComplete(tabId);
      app.awaitingCaptcha = false;
      elements.captchaRetryButton.classList.add("hidden");
      elements.pauseButton.classList.remove("hidden");
      setStatus("Ejecutando", "running");
      setScanOverlay(true, "Retrying scan…", `Continuing “${term}”`, 8);
      log("Búsqueda recargada. Reanudando el mismo término.", "success");
      return;
    }
    const state = await checkCaptchaState(tabId);
    if (!state?.captcha && state?.ready) {
      app.awaitingCaptcha = false;
      elements.captchaRetryButton.classList.add("hidden");
      elements.pauseButton.classList.remove("hidden");
      setStatus("Ejecutando", "running");
      setScanOverlay(true, "Resuming scan…", `Continuing “${term}”`, 8);
      log("Verificación completada. Reanudando el mismo término automáticamente.", "success");
      return;
    }
  }

  app.awaitingCaptcha = false;
  elements.captchaRetryButton.classList.add("hidden");
  throw new Error("Operación cancelada.");
}

async function collectCandidates(term, quota, settings, pass = 1) {
  const tabId = await ensureSearchTab();
  await applySearchPacing();
  app.searchesSinceCooldown++;
  const query = encodeURIComponent(term);
  const safe = settings.safeSearch ? "active" : "off";
  const url = `https://www.google.com/search?tbm=isch&udm=2&safe=${safe}&q=${query}`;
  await chrome.tabs.update(tabId, { url });
  await waitForTabComplete(tabId);
  await waitWhilePaused();
  const retryMultiplier = pass > 1 ? 2 : 1;
  const candidateGoal = app.inputMode === "searchTerms"
    ? 10
    : Math.max(20 * retryMultiplier, quota * settings.candidateMultiplier * retryMultiplier);
  let result = await sendScanMessage(tabId, candidateGoal);
  while (result?.captcha) {
    await waitForCaptchaResolution(tabId, term, url);
    result = await sendScanMessage(tabId, candidateGoal);
  }
  if (result?.error) throw new Error(result.error);
  return Array.isArray(result?.candidates) ? result.candidates : [];
}

function mimeToType(mime, url) {
  const normalized = (mime || "").split(";")[0].toLowerCase();
  const byMime = {
    "image/jpeg": "jpeg",
    "image/jpg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif"
  };
  if (byMime[normalized]) return byMime[normalized];
  const match = String(url).match(/\.([a-z0-9]{2,5})(?:$|[?#])/i);
  const extension = match?.[1]?.toLowerCase();
  return extension === "jpg" ? "jpeg" : extension || "unknown";
}

async function dimensionsFromBlob(blob) {
  try {
    const bitmap = await withTimeout(createImageBitmap(blob), DECODE_TIMEOUT_MS, "timeout de decodificación");
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch (_) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => {
          image.src = "";
          reject(new Error("timeout de decodificación"));
        }, DECODE_TIMEOUT_MS);
        image.onload = () => {
          clearTimeout(timer);
          resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => {
          clearTimeout(timer);
          reject(new Error("No se pudo decodificar la imagen."));
        };
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function sha256(buffer) {
  const digest = await withTimeout(crypto.subtle.digest("SHA-256", buffer), DECODE_TIMEOUT_MS, "timeout de hash");
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function visualTextHeuristic(bitmap) {
  const maxSide = 480;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = typeof OffscreenCanvas === "function"
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);

  for (let index = 0; index < mask.length; index++) {
    const offset = index * 4;
    const luminance = (54 * pixels[offset] + 183 * pixels[offset + 1] + 19 * pixels[offset + 2]) >> 8;
    if (luminance < 125 && pixels[offset + 3] > 90) mask[index] = 1;
  }

  const visited = new Uint8Array(mask.length);
  const rowBands = new Map();
  let glyphLikeComponents = 0;
  const stack = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    visited[start] = 1;
    stack.push(start);
    let area = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (stack.length) {
      const point = stack.pop();
      const y = Math.floor(point / width);
      const x = point - y * width;
      area++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [];
      if (x > 0) neighbors.push(point - 1);
      if (x + 1 < width) neighbors.push(point + 1);
      if (y > 0) neighbors.push(point - width);
      if (y + 1 < height) neighbors.push(point + width);
      for (const neighbor of neighbors) {
        if (visited[neighbor] || !mask[neighbor]) continue;
        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const fill = area / (componentWidth * componentHeight);
    const glyphLike = area >= 2 && area <= 180
      && componentWidth <= 30 && componentHeight >= 2 && componentHeight <= 20
      && fill >= 0.08 && fill <= 0.95
      && componentWidth / componentHeight <= 4.5;
    if (!glyphLike) continue;

    glyphLikeComponents++;
    const band = Math.floor(((minY + maxY) / 2) / 8);
    rowBands.set(band, (rowBands.get(band) || 0) + 1);
  }

  const populatedBands = [...rowBands.values()].filter((count) => count >= 4).length;
  return {
    method: "visual-heuristic",
    blocks: populatedBands,
    glyphs: glyphLikeComponents,
    heavy: glyphLikeComponents >= 160 || (glyphLikeComponents >= 120 && populatedBands >= 12)
  };
}

async function analyzeTextDensity(blob) {
  let bitmap;
  try {
    bitmap = await withTimeout(createImageBitmap(blob), DECODE_TIMEOUT_MS, "timeout de análisis visual");
    if (typeof globalThis.TextDetector === "function") {
      try {
        const detected = await withTimeout(
          new globalThis.TextDetector().detect(bitmap),
          TEXT_DETECTION_TIMEOUT_MS,
          "timeout de detección de texto"
        );
        const blocks = detected.filter((item) => String(item.rawValue || "").trim().length >= 2);
        const imageArea = Math.max(1, bitmap.width * bitmap.height);
        const textArea = blocks.reduce((sum, item) => {
          const box = item.boundingBox;
          return sum + Math.max(0, Number(box?.width) || 0) * Math.max(0, Number(box?.height) || 0);
        }, 0);
        const coverage = textArea / imageArea;
        return {
          method: "text-detector",
          blocks: blocks.length,
          coverage,
          heavy: blocks.length >= 8 || (blocks.length >= 5 && coverage >= 0.08)
        };
      } catch (_) {
        // Fall back to a local visual estimate when native text detection is unavailable.
      }
    }
    return visualTextHeuristic(bitmap);
  } catch (_) {
    return { method: "unavailable", blocks: 0, heavy: false };
  } finally {
    bitmap?.close?.();
  }
}

function filterRejection(info, settings) {
  if (info.width < settings.minWidth || info.height < settings.minHeight) return "menor que Size";
  if (settings.type !== "any" && info.type !== settings.type) return "Type no coincide";
  const ratio = info.width / info.height;
  if (settings.layout === "landscape" && ratio <= 1.05) return "Layout no coincide";
  if (settings.layout === "portrait" && ratio >= 0.95) return "Layout no coincide";
  if (settings.layout === "square" && (ratio < 0.9 || ratio > 1.1)) return "Layout no coincide";
  if (settings.urlMode === "include" && settings.urlText && !info.url.toLowerCase().includes(settings.urlText)) return "URL no coincide";
  if (settings.urlMode === "exclude" && settings.urlText && info.url.toLowerCase().includes(settings.urlText)) return "URL excluida";
  return null;
}

function reject(stats, reason) {
  stats.set(reason, (stats.get(reason) || 0) + 1);
  return null;
}

async function inspectCandidate(candidate, settings, stats) {
  if (!candidate?.url) return reject(stats, "URL inválida");
  if (app.seenUrls.has(candidate.url)) return reject(stats, "URL repetida");
  app.seenUrls.add(candidate.url);
  const controller = new AbortController();
  app.activeControllers.add(controller);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  let response;
  let blob;
  try {
    response = await fetch(candidate.url, { credentials: "include", redirect: "follow", signal: controller.signal });
    if (!response.ok) return reject(stats, `HTTP ${response.status}`);
    blob = await response.blob();
  } catch (_) {
    if (timedOut) return reject(stats, "timeout de descarga");
    if (app.cancelled) return reject(stats, "operación cancelada");
    return reject(stats, "red/CORS");
  } finally {
    clearTimeout(timer);
    app.activeControllers.delete(controller);
  }
  try {
    if (!blob.size) return reject(stats, "archivo vacío");
    if (blob.size > 40 * 1024 * 1024) return reject(stats, "archivo > 40 MB");
    const type = mimeToType(blob.type || response.headers.get("content-type"), candidate.url);
    if (!["jpeg", "png", "webp", "gif", "svg", "avif"].includes(type)) return reject(stats, "no es imagen");
    let dimensions;
    try {
      dimensions = await dimensionsFromBlob(blob);
    } catch (error) {
      return reject(stats, /timeout/i.test(error.message) ? "timeout de decodificación" : "no se pudo decodificar");
    }
    const { width, height } = dimensions;
    const info = { ...candidate, blob, type, width, height, byteSize: blob.size, pixelSize: width * height };
    const filterReason = filterRejection(info, settings);
    if (filterReason) return reject(stats, filterReason);
    if (settings.ignoreTextHeavy) {
      const textAnalysis = await analyzeTextDensity(blob);
      if (textAnalysis.heavy) return reject(stats, "demasiado texto/infografía");
      info.textAnalysis = textAnalysis;
    }
    if (settings.deduplicate) {
      const hash = await sha256(await withTimeout(blob.arrayBuffer(), DECODE_TIMEOUT_MS, "timeout de lectura"));
      if (app.seenHashes.has(hash)) return reject(stats, "contenido repetido");
      info.hash = hash;
    }
    return info;
  } catch (error) {
    const message = String(error?.message || error || "");
    return reject(stats, /timeout/i.test(message) ? message : "error al procesar");
  }
}

function rejectionSummary(stats) {
  return [...stats.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(" · ");
}

async function mapWithConcurrency(items, limit, mapper, shouldStop = () => false) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length && !shouldStop()) {
      const index = next++;
      await waitWhilePaused();
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function sortImages(images, sort) {
  const sorted = [...images];
  if (sort === "pixels") sorted.sort((a, b) => b.pixelSize - a.pixelSize || b.byteSize - a.byteSize);
  if (sort === "fileSize") sorted.sort((a, b) => b.byteSize - a.byteSize || b.pixelSize - a.pixelSize);
  if (sort === "position") sorted.sort((a, b) => a.position - b.position);
  if (sort === "url") sorted.sort((a, b) => a.url.localeCompare(b.url));
  return sorted;
}

async function saveSelected(images, chapter, chapterIndex, term, chapterStartSequence, quota) {
  const selected = images.slice(0, quota);
  for (let index = 0; index < selected.length; index++) {
    await waitWhilePaused();
    const image = selected[index];
    await markPreviewSelected(image, index + 1, quota);
    if (image.hash) app.seenHashes.add(image.hash);
    const sequence = chapterStartSequence + index + 1;
    const extension = image.type === "jpeg" ? "jpg" : image.type;
    const folder = `${String(chapterIndex + 1).padStart(2, "0")} - ${sanitizeName(chapter.chapter)}`;
    const filename = `${String(sequence).padStart(3, "0")}_${slugify(term)}_${image.width}x${image.height}.${extension}`;
    const outputPath = app.inputMode === "searchTerms"
      ? `${sanitizeName(chapter.outputId, String(chapterIndex + 1))}.${extension}`
      : `${folder}/${filename}`;
    await storeImage({
      id: `${chapterIndex}:${sequence}`,
      chapterIndex,
      chapterSequence: sequence,
      chapter: chapter.chapter,
      term,
      path: outputPath,
      sourceUrl: image.url,
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
      type: image.type,
      hash: image.hash || "",
      blob: image.blob
    });
    app.totalCollected++;
    updateProgress();
  }
  return selected.length;
}

async function processSearch(chapter, chapterIndex, term, quota, chapterCollected, settings, pass) {
  if (quota <= 0) return { saved: 0, reason: "sin cuota asignada" };
  const label = itemLabel(chapter);
  elements.currentTask.textContent = `${chapterIndex + 1}/${app.chapters.length} · ${label}\n“${term}”`;
  beginVisualScan(chapter, term, quota, settings);
  log(`${label} · “${term}” · objetivo ${quota}${pass > 1 ? " · reintento" : ""}`);
  const candidates = await collectCandidates(term, quota, settings, pass);
  elements.foundCount.textContent = String(candidates.length);
  log(`${candidates.length} candidatos encontrados; validando…`);
  const rejectionStats = new Map();
  let validationCount = 0;
  let usableCount = 0;
  const stopAfterQuota = app.inputMode === "searchTerms";
  const inspected = await mapWithConcurrency(candidates, 4, async (candidate) => {
    const image = await inspectCandidate(candidate, settings, rejectionStats);
    validationCount++;
    if (image) {
      usableCount++;
      addPreviewCard(image);
    }
    setScanOverlay(true, `Validating ${validationCount} of ${candidates.length}`, `${elements.liveGallery.children.length} usable images`, 88 + (validationCount / Math.max(1, candidates.length)) * 10);
    return image;
  }, () => stopAfterQuota && usableCount >= quota);
  const batchHashes = new Set();
  const unique = inspected.filter((image) => {
    if (!image) return false;
    if (!settings.deduplicate || !image.hash) return true;
    if (app.seenHashes.has(image.hash) || batchHashes.has(image.hash)) {
      reject(rejectionStats, "contenido repetido");
      return false;
    }
    batchHashes.add(image.hash);
    return true;
  });
  const valid = sortImages(unique, settings.sort);
  renderSortedGallery(valid);
  setScanOverlay(false);
  const saved = await saveSelected(valid, chapter, chapterIndex, term, chapterCollected, quota);
  app.rejected += Math.max(0, validationCount - valid.length);
  const rejectedText = rejectionSummary(rejectionStats);
  if (rejectedText) log(`Rechazos: ${rejectedText}.`);
  log(`${saved}/${quota} imágenes guardadas para el término.`, saved === quota ? "success" : "error");
  return {
    saved,
    reason: rejectedText || (candidates.length ? "ningún candidato superó la validación" : "Google no devolvió candidatos")
  };
}

async function processChapter(chapter, chapterIndex, settings) {
  const label = itemLabel(chapter);
  const quotas = distribute(chapter.imageCount, chapter.searchTerm.length);
  let chapterCollected = 0;
  const attemptReasons = [];

  for (let index = 0; index < chapter.searchTerm.length; index++) {
    await waitWhilePaused();
    const quota = quotas[index];
    const result = await processSearch(chapter, chapterIndex, chapter.searchTerm[index], quota, chapterCollected, settings, 1);
    chapterCollected += result.saved;
    if (result.saved < quota) attemptReasons.push(result.reason);
  }

  let missing = chapter.imageCount - chapterCollected;
  if (missing > 0) {
    log(`${label}: faltan ${missing}; iniciando segunda ronda automática.`);
    const retryQuotas = distribute(missing, chapter.searchTerm.length);
    for (let index = 0; index < chapter.searchTerm.length; index++) {
      if (retryQuotas[index] <= 0) continue;
      await waitWhilePaused();
      const result = await processSearch(chapter, chapterIndex, chapter.searchTerm[index], retryQuotas[index], chapterCollected, settings, 2);
      chapterCollected += result.saved;
      if (result.saved < retryQuotas[index]) attemptReasons.push(result.reason);
    }
  }

  if (chapterCollected < chapter.imageCount) {
    app.incompleteChapters.push({ chapter: label, requested: chapter.imageCount, collected: chapterCollected });
    const reason = [...new Set(attemptReasons.filter(Boolean))].join(" | ") || "No se encontró una imagen válida";
    if (app.inputMode === "searchTerms") {
      app.failedItems.push({
        id: chapter.sourceId,
        text: chapter.sourceText,
        searchTerm: chapter.searchTerm[0],
        requested: 1,
        collected: chapterCollected,
        reason
      });
    } else {
      app.failedItems.push({
        chapter: chapter.chapter,
        searchTerms: chapter.searchTerm,
        requested: chapter.imageCount,
        collected: chapterCollected,
        missing: chapter.imageCount - chapterCollected,
        reason
      });
    }
    log(`${label}: resultado incompleto (${chapterCollected}/${chapter.imageCount}).`, "error");
  } else {
    log(`${label}: resultado completado.`, "success");
  }
}

function recordsMatchCurrentInput(records) {
  return records.every((record) => {
    const item = app.chapters[Number(record.chapterIndex)];
    return item && record.chapter === item.chapter;
  });
}

function inferLegacyResumeIndex(records) {
  if (!records.length) return 0;
  if (app.inputMode === "searchTerms") {
    return Math.min(app.chapters.length, Math.max(...records.map((record) => Number(record.chapterIndex))) + 1);
  }
  const counts = new Map();
  records.forEach((record) => counts.set(Number(record.chapterIndex), (counts.get(Number(record.chapterIndex)) || 0) + 1));
  for (let index = 0; index < app.chapters.length; index++) {
    if ((counts.get(index) || 0) < app.chapters[index].imageCount) return index;
  }
  return app.chapters.length;
}

function recoveredFailures(records, nextIndex) {
  if (app.inputMode !== "searchTerms") return [];
  const storedIndexes = new Set(records.map((record) => Number(record.chapterIndex)));
  const failures = [];
  for (let index = 0; index < nextIndex; index++) {
    if (storedIndexes.has(index)) continue;
    const item = app.chapters[index];
    failures.push({
      id: item.sourceId,
      text: item.sourceText,
      searchTerm: item.searchTerm[0],
      requested: 1,
      collected: 0,
      reason: "No se recuperó una imagen de la ejecución anterior"
    });
  }
  return failures;
}

function checkpoint(nextIndex) {
  return {
    inputSignature: app.runSignature,
    inputMode: app.inputMode,
    nextIndex,
    failedItems: app.failedItems,
    searchesSinceCooldown: app.searchesSinceCooldown,
    updatedAt: new Date().toISOString()
  };
}

async function prepareRunState() {
  const stored = await chrome.storage.local.get(["jobState"]);
  let records = await getStoredImages();
  const savedState = stored.jobState;
  const stateMatches = savedState?.inputSignature === app.runSignature
    && savedState?.inputMode === app.inputMode
    && Number.isInteger(savedState?.nextIndex)
    && savedState.nextIndex >= 0
    && savedState.nextIndex <= app.chapters.length;
  const legacyMatches = !savedState
    && records.length > 0
    && records.length < app.totalRequested
    && recordsMatchCurrentInput(records);

  let startIndex = 0;
  let resumed = false;
  if (stateMatches) {
    startIndex = savedState.nextIndex;
    app.failedItems = Array.isArray(savedState.failedItems) ? savedState.failedItems : [];
    app.searchesSinceCooldown = Number.isInteger(savedState.searchesSinceCooldown)
      ? Math.max(0, Math.min(SEARCHES_PER_COOLDOWN, savedState.searchesSinceCooldown))
      : 0;
    resumed = startIndex > 0 || records.length > 0 || app.failedItems.length > 0;
  } else if (legacyMatches) {
    startIndex = inferLegacyResumeIndex(records);
    app.failedItems = recoveredFailures(records, startIndex);
    app.searchesSinceCooldown = 0;
    resumed = startIndex > 0;
  } else {
    app.searchesSinceCooldown = 0;
  }

  if (resumed) {
    if (startIndex < app.chapters.length) await clearStoredImagesFromChapter(startIndex);
    records = await getStoredImages();
    app.totalCollected = records.length;
    records.forEach((record) => {
      if (record.sourceUrl) app.seenUrls.add(record.sourceUrl);
      if (record.hash) app.seenHashes.add(record.hash);
    });
  } else {
    await clearStoredImages();
    app.totalCollected = 0;
    app.failedItems = [];
  }

  await chrome.storage.local.set({ jobState: checkpoint(startIndex) });
  app.hasStartedSearch = resumed && app.searchesSinceCooldown > 0;
  return { startIndex, resumed };
}

async function runJob() {
  try {
    syncCountsFromUi();
    const settings = getSettings();
    app.runSignature = await sha256(new TextEncoder().encode(JSON.stringify({
      input: app.inputSignature,
      counts: app.chapters.map((chapter) => chapter.imageCount)
    })));
    if (settings.urlMode !== "any" && !settings.urlText) throw new Error("Escribe el texto que debe filtrar la URL.");

    const granted = await chrome.permissions.request({ origins: ["http://*/*", "https://*/*"] });
    if (!granted) throw new Error("Se necesita permiso para validar y guardar imágenes desde sus sitios de origen.");

    app.running = true;
    app.paused = false;
    app.cancelled = false;
    app.awaitingCaptcha = false;
    app.manualCaptchaContinue = false;
    app.totalRequested = app.chapters.reduce((sum, chapter) => sum + chapter.imageCount, 0);
    app.rejected = 0;
    app.incompleteChapters = [];
    app.seenUrls.clear();
    app.seenHashes.clear();
    app.activeControllers.clear();
    await chrome.storage.local.set({ chapters: app.chapters, inputMode: app.inputMode, settings });
    const { startIndex, resumed } = await prepareRunState();

    elements.runLog.replaceChildren();
    elements.downloadSection.classList.add("hidden");
    elements.downloadButton.disabled = false;
    elements.downloadButton.textContent = downloadButtonLabel();
    elements.downloadFailuresButton.disabled = false;
    elements.startButton.classList.add("hidden");
    elements.pauseButton.classList.remove("hidden");
    elements.captchaRetryButton.classList.add("hidden");
    elements.cancelButton.classList.remove("hidden");
    setStatus("Ejecutando", "running");
    updateProgress();
    const unit = app.inputMode === "searchTerms" ? "términos" : "capítulos";
    if (resumed) {
      const nextLabel = startIndex < app.chapters.length ? itemLabel(app.chapters[startIndex]) : "finalización";
      log(`Operación recuperada: ${app.totalCollected}/${app.totalRequested} imágenes guardadas. Continuando desde ${nextLabel}.`, "success");
      if (app.failedItems.length) log(`${app.failedItems.length} fallos anteriores fueron recuperados para el reporte final.`);
    } else {
      log(`Operación iniciada: ${app.chapters.length} ${unit}, ${app.totalRequested} imágenes.`);
    }

    for (let index = startIndex; index < app.chapters.length; index++) {
      await processChapter(app.chapters[index], index, settings);
      await chrome.storage.local.set({ jobState: checkpoint(index + 1) });
    }

    app.running = false;
    app.awaitingCaptcha = false;
    app.manualCaptchaContinue = false;
    await chrome.storage.local.remove(["jobState"]);
    elements.pauseButton.classList.add("hidden");
    elements.captchaRetryButton.classList.add("hidden");
    elements.cancelButton.classList.add("hidden");
    elements.currentTask.textContent = "Todas las búsquedas han terminado.";
    setStatus("Terminado", "done");
    const incompleteText = app.failedItems.length
      ? ` ${app.failedItems.length} resultados quedaron incompletos y están incluidos en el JSON de fallos.`
      : " Todos los resultados alcanzaron su objetivo.";
    elements.downloadSummary.textContent = `${app.totalCollected} imágenes listas.${incompleteText}`;
    elements.downloadFailuresButton.textContent = `Descargar JSON de fallos (${app.failedItems.length})`;
    elements.downloadSection.classList.remove("hidden");
    elements.downloadSection.scrollIntoView({ behavior: "smooth" });
    log("Recolección finalizada. El ZIP está listo.", "success");
  } catch (error) {
    app.running = false;
    app.awaitingCaptcha = false;
    app.manualCaptchaContinue = false;
    elements.pauseButton.classList.add("hidden");
    elements.captchaRetryButton.classList.add("hidden");
    elements.cancelButton.classList.add("hidden");
    elements.startButton.classList.remove("hidden");
    setStatus(app.cancelled ? "Cancelado" : "Detenido", "paused");
    elements.currentTask.textContent = error.message;
    log(error.message, "error");
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function zipHeader(size, writer) {
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  writer({
    u16(offset, value) { view.setUint16(offset, value, true); },
    u32(offset, value) { view.setUint32(offset, value >>> 0, true); }
  });
  return new Uint8Array(buffer);
}

async function createZip(records) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  let centralSize = 0;
  const stamp = zipDateTime();

  for (const record of records) {
    const data = new Uint8Array(await record.blob.arrayBuffer());
    const name = encoder.encode(record.path);
    const crc = crc32(data);
    const local = zipHeader(30, (h) => {
      h.u32(0, 0x04034b50); h.u16(4, 20); h.u16(6, 0x0800); h.u16(8, 0);
      h.u16(10, stamp.time); h.u16(12, stamp.date); h.u32(14, crc);
      h.u32(18, data.length); h.u32(22, data.length); h.u16(26, name.length); h.u16(28, 0);
    });
    localParts.push(local, name, record.blob);

    const central = zipHeader(46, (h) => {
      h.u32(0, 0x02014b50); h.u16(4, 20); h.u16(6, 20); h.u16(8, 0x0800); h.u16(10, 0);
      h.u16(12, stamp.time); h.u16(14, stamp.date); h.u32(16, crc);
      h.u32(20, data.length); h.u32(24, data.length); h.u16(28, name.length); h.u16(30, 0);
      h.u16(32, 0); h.u16(34, 0); h.u16(36, 0); h.u32(38, 0); h.u32(42, offset);
    });
    centralParts.push(central, name);
    centralSize += central.length + name.length;
    offset += local.length + name.length + data.length;
  }

  if (records.length > 65535 || offset + centralSize > 0xffffffff) throw new Error("El ZIP supera el límite de 4 GB de esta versión.");
  const end = zipHeader(22, (h) => {
    h.u32(0, 0x06054b50); h.u16(4, 0); h.u16(6, 0); h.u16(8, records.length);
    h.u16(10, records.length); h.u32(12, centralSize); h.u32(16, offset); h.u16(20, 0);
  });
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function buildFailureReport() {
  return {
    generatedAt: new Date().toISOString(),
    inputMode: app.inputMode,
    totalItems: app.chapters.length,
    failedCount: app.failedItems.length,
    failures: app.failedItems
  };
}

function failureReportBlob() {
  return new Blob([JSON.stringify(buildFailureReport(), null, 2)], { type: "application/json" });
}

async function downloadFailuresJson() {
  const url = URL.createObjectURL(failureReportBlob());
  try {
    await chrome.downloads.download({ url, filename: "failed-items.json", saveAs: true });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }
}

async function downloadZip() {
  elements.downloadButton.disabled = true;
  elements.downloadButton.textContent = "Construyendo ZIP…";
  try {
    const records = await getStoredImages();
    if (!records.length && !app.failedItems.length) throw new Error("No hay resultados guardados.");
    const zipRecords = [
      ...records,
      { path: "failed-items.json", blob: failureReportBlob() }
    ];
    const zip = await createZip(zipRecords);
    const url = URL.createObjectURL(zip);
    const prefix = app.inputMode === "searchTerms" ? "search-term-images" : "chapter-images";
    await chrome.downloads.download({ url, filename: `${prefix}-${new Date().toISOString().slice(0, 10)}.zip`, saveAs: true });
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    elements.downloadButton.textContent = "ZIP enviado a Descargas";
  } catch (error) {
    elements.downloadButton.disabled = false;
    elements.downloadButton.textContent = downloadButtonLabel();
    log(error.message, "error");
  }
}

elements.parseButton.addEventListener("click", () => {
  parseJsonText(elements.jsonText.value).catch((error) => showMessage(error.message, true));
});

elements.jsonFile.addEventListener("change", async () => {
  const file = elements.jsonFile.files[0];
  if (!file) return;
  elements.jsonText.value = await file.text();
  showMessage(`Archivo “${file.name}” cargado. Pulsa Guardar JSON para continuar.`);
});

for (const eventName of ["dragenter", "dragover"]) {
  elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.add("dragover"); });
}
for (const eventName of ["dragleave", "drop"]) {
  elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.remove("dragover"); });
}
elements.dropZone.addEventListener("drop", async (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  elements.jsonText.value = await file.text();
  showMessage(`Archivo “${file.name}” cargado. Pulsa Guardar JSON para continuar.`);
});

elements.editImportButton.addEventListener("click", () => {
  if (app.running) return;
  elements.chaptersSection.classList.add("hidden");
  elements.importSection.classList.remove("hidden");
  showMessage("Edita o reemplaza el JSON y vuelve a guardarlo.");
});

elements.clearButton.addEventListener("click", async () => {
  if (app.running) return;
  app.chapters = [];
  app.inputMode = "chapters";
  app.inputSignature = "";
  app.runSignature = "";
  app.failedItems = [];
  app.searchesSinceCooldown = 0;
  app.hasStartedSearch = false;
  elements.jsonText.value = "";
  elements.jsonFile.value = "";
  elements.chapterList.replaceChildren();
  elements.importSection.classList.remove("hidden");
  elements.chaptersSection.classList.add("hidden");
  elements.runSection.classList.add("hidden");
  elements.executionEmpty.classList.remove("hidden");
  elements.downloadSection.classList.add("hidden");
  showMessage("");
  await clearStoredImages();
  await chrome.storage.local.remove(["importedJson", "chapters", "inputMode", "settings", "jobState"]);
});

elements.applyBulkButton.addEventListener("click", () => {
  const value = Number(elements.bulkCount.value);
  if (!Number.isInteger(value) || value < 1) return;
  document.querySelectorAll(".chapter-count").forEach((input) => { input.value = value; });
});

elements.sizeFilter.addEventListener("change", () => {
  elements.customSizeFields.classList.toggle("hidden", elements.sizeFilter.value !== "custom");
});
elements.urlFilterMode.addEventListener("change", () => {
  elements.urlTextLabel.classList.toggle("hidden", elements.urlFilterMode.value === "any");
});
elements.resetFiltersButton.addEventListener("click", resetFilters);
elements.startButton.addEventListener("click", runJob);
elements.pauseButton.addEventListener("click", () => {
  app.paused = !app.paused;
  elements.pauseButton.textContent = app.paused ? "Continuar" : "Pausar";
  setStatus(app.paused ? "Pausado" : "Ejecutando", app.paused ? "paused" : "running");
});
elements.captchaRetryButton.addEventListener("click", () => {
  if (!app.awaitingCaptcha) return;
  app.manualCaptchaContinue = true;
  elements.captchaRetryButton.disabled = true;
  elements.captchaRetryButton.textContent = "Reintentando…";
});
elements.cancelButton.addEventListener("click", () => {
  app.cancelled = true;
  app.paused = false;
  app.activeControllers.forEach((controller) => controller.abort());
});
elements.downloadButton.addEventListener("click", downloadZip);
elements.downloadFailuresButton.addEventListener("click", downloadFailuresJson);

elements.tabButtons.forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
document.querySelectorAll("[data-go-tab]").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.goTab));
});

(async function restore() {
  resetFilters();
  const saved = await chrome.storage.local.get(["importedJson"]);
  if (saved.importedJson) {
    elements.jsonText.value = saved.importedJson;
    try { await parseJsonText(saved.importedJson); } catch (_) {}
  }
})();
