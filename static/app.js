/**
 * Maptoposter - Full-Screen Map UI
 * Decoupled location selection from poster text
 */

// ===== STATE MANAGEMENT =====
const state = {
  // Map selection (from clicking)
  selectedLat: null,
  selectedLng: null,

  // Suggestions (from reverse geocode)
  suggestedCity: "",
  suggestedCountry: "",

  // Poster text (user-editable, independent from map)
  posterCity: "",
  posterCountry: "",
  posterTagline: "",

  // Settings
  radius: 29000,
  dpi: 300,
  format: "png",
  aspectRatio: "2:3",  // Poster aspect ratio
  collection: null,  // Collection to add poster to
  theme: "feature_based",
  font: "",  // Empty means default (Roboto)
  pin: "none",  // Center pin icon: none, marker, heart, star, home, circle
  pinColor: null,  // Hex color for pin (null = use theme text color)
};

// ===== THEME CATALOG =====
let themeCatalog = {};
let themeList = [];
let themesByCategory = {};
let currentCategory = "all";

// ===== FONT LIST =====
let fontList = [];

// ===== STARRED ITEMS =====
let starredFonts = [];
let starredThemes = [];

// ===== PRESETS =====
let presetList = [];

// ===== COLLECTIONS =====
let collectionList = [];
let activeCollectionFilter = null;

// ===== BATCH QUEUE =====
let queueRefreshInterval = null;

// ===== QUICK VARIATIONS =====
let variationMode = false;
let selectedThemes = [];

// ===== MOCKUPS =====
let mockupList = [];
let selectedPosterForMockup = null;

// Mockup Creator State
let mockupCreatorImage = null;
let mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
let mockupCreatorDrawing = false;
let mockupCreatorStartX = 0;
let mockupCreatorStartY = 0;

// Mockup Preview State
let mockupPreviewTemplate = null;  // { id, poster_rect, ... }
let mockupPreviewPoster = null;    // Poster item
let mockupPreviewTemplateImg = null;  // Loaded Image object for template
let mockupPreviewPosterImg = null;    // Loaded Image object for poster
let mockupPreviewScale = 1.0;
let mockupPreviewOffsetX = 0;
let mockupPreviewOffsetY = 0;
let mockupPreviewDragging = false;
let mockupPreviewDragStartX = 0;
let mockupPreviewDragStartY = 0;

// ===== MAP VARIABLES =====
let leafletMap = null;
let radiusCircle = null;
let aspectRatioRect = null;
let centerMarker = null;
let currentTileLayer = null;

// ===== JOB/PROGRESS =====
let activeSource = null;
let currentJobId = null;
let pulseTimer = null;
let pulseStage = null;
let pulseStart = 0;
let lastKnownPercent = 0;

// ===== GALLERY =====
let galleryItems = [];
let galleryIndex = 0;
let gallerySource = null;
let lastGallerySignature = "";
let lightboxBuiltCount = 0;

// ===== SEARCH =====
let searchTimeout = null;

// ===== DOM ELEMENTS =====
const elements = {
  // Map
  leafletMap: document.getElementById("leaflet-map"),

  // Controls widget
  controlsWidget: document.getElementById("controls-widget"),
  widgetToggle: document.querySelector(".widget-toggle"),

  // Location search
  locationSearch: document.getElementById("location-search"),
  searchBtn: document.getElementById("search-btn"),
  searchResults: document.getElementById("search-results"),

  // Coordinates display
  selectedCoords: document.getElementById("selected-coords"),
  suggestedLocation: document.getElementById("suggested-location"),

  // Poster text
  posterCity: document.getElementById("poster-city"),
  posterCountry: document.getElementById("poster-country"),
  posterTagline: document.getElementById("poster-tagline"),
  syncCity: document.getElementById("sync-city"),
  syncCountry: document.getElementById("sync-country"),
  syncTagline: document.getElementById("sync-tagline"),

  // Sliders
  radiusSlider: document.getElementById("radius-slider"),
  radiusValue: document.getElementById("radius-value"),
  dpiSlider: document.getElementById("dpi-slider"),
  dpiValue: document.getElementById("dpi-value"),

  // Format, Aspect, Preset, Font & Theme
  formatSelect: document.getElementById("format-select"),
  aspectSelect: document.getElementById("aspect-select"),
  presetSelect: document.getElementById("preset-select"),
  savePresetBtn: document.getElementById("save-preset-btn"),
  fontPicker: document.getElementById("font-picker"),
  fontPickerToggle: document.getElementById("font-picker-toggle"),
  fontPickerLabel: document.getElementById("font-picker-label"),
  fontPickerDropdown: document.getElementById("font-picker-dropdown"),
  fontPickerOptions: document.getElementById("font-picker-options"),
  pinSelector: document.getElementById("pin-selector"),
  pinColorSelector: document.getElementById("pin-color-selector"),
  pinColorSwatches: document.getElementById("pin-color-swatches"),
  themeQuickPicker: document.getElementById("theme-quick-picker"),

  // Preview Widget
  previewWidget: document.getElementById("preview-widget"),
  previewContainer: document.getElementById("preview-container"),
  previewClose: document.getElementById("preview-close"),
  previewThemeName: document.getElementById("preview-theme-name"),

  // Header action buttons
  headerFontBtn: document.getElementById("header-font-btn"),
  headerThemeBtn: document.getElementById("header-theme-btn"),
  headerGalleryBtn: document.getElementById("header-gallery-btn"),

  // Theme elements
  themeCategoryTabs: document.getElementById("theme-category-tabs"),
  themeCarousel: document.getElementById("theme-carousel"),
  themeCarouselWrap: document.getElementById("theme-carousel-wrap"),
  themeBrowseBtn: document.getElementById("theme-browse-btn"),
  selectedThemeName: document.getElementById("selected-theme-name"),

  // Generate
  generateBtn: document.getElementById("generate-btn"),
  addQueueBtn: document.getElementById("add-queue-btn"),
  collectionSelect: document.getElementById("collection-select"),
  addCollectionBtn: document.getElementById("add-collection-btn"),
  collectionFilterTabs: document.getElementById("collection-filter-tabs"),

  // Queue
  queueSection: document.getElementById("queue-section"),
  queueList: document.getElementById("queue-list"),
  queueCount: document.getElementById("queue-count"),
  clearQueueBtn: document.getElementById("clear-queue-btn"),

  // Progress
  progressSection: document.getElementById("progress-section"),
  progressMessage: document.getElementById("progress-message"),
  progressPercent: document.getElementById("progress-percent"),
  progressFill: document.getElementById("progress-fill"),
  progressStage: document.getElementById("progress-stage"),
  progressError: document.getElementById("progress-error"),

  // Latest poster
  latestSection: document.getElementById("latest-section"),
  latestLink: document.getElementById("latest-link"),
  latestPosterLink: document.getElementById("latest-poster-link"),
  latestPosterThumb: document.getElementById("latest-poster-thumb"),

  // Status widget (top-right container)
  statusWidget: document.getElementById("status-widget"),

  // Gallery / Collection modal
  openFolderBtn: document.getElementById("open-folder-btn"),
  collectionModal: document.getElementById("collection-modal"),
  collectionModalClose: document.getElementById("collection-modal-close"),
  collectionModalTabs: document.getElementById("collection-modal-tabs"),
  collectionModalGrid: document.getElementById("collection-modal-grid"),
  addCollectionModalBtn: document.getElementById("add-collection-modal-btn"),

  // Map style
  styleWidget: document.getElementById("style-widget"),
  styleToggle: document.getElementById("style-toggle"),
  styleDropdown: document.getElementById("style-dropdown"),

  // Theme drawer
  browseThemesBtn: document.getElementById("browse-themes-btn"),
  variationModeBtn: document.getElementById("variation-mode-btn"),
  themeDrawer: document.getElementById("theme-drawer"),
  themeSearch: document.getElementById("theme-search"),
  themeGridFull: document.getElementById("theme-grid-full"),
  drawerClose: document.getElementById("drawer-close"),

  // Lightbox
  lightbox: document.getElementById("lightbox"),
  lightboxImage: document.getElementById("lightbox-image"),
  lightboxCaption: document.getElementById("lightbox-caption"),
  lightboxStrip: document.getElementById("lightbox-strip"),

  // Mockup
  mockupModal: document.getElementById("mockup-modal"),
  mockupGrid: document.getElementById("mockup-grid"),
  mockupClose: document.getElementById("mockup-close"),
  mockupCreateBtn: document.getElementById("mockup-create-btn"),

  // Mockup Creator
  mockupCreator: document.getElementById("mockup-creator"),
  mockupCreatorClose: document.getElementById("mockup-creator-close"),
  mockupTemplateName: document.getElementById("mockup-template-name"),
  mockupTemplateFile: document.getElementById("mockup-template-file"),
  mockupCreatorCanvas: document.getElementById("mockup-creator-canvas"),
  mockupCanvasPlaceholder: document.getElementById("mockup-canvas-placeholder"),
  mockupSaveBtn: document.getElementById("mockup-save-btn"),
  rectX: document.getElementById("rect-x"),
  rectY: document.getElementById("rect-y"),
  rectW: document.getElementById("rect-w"),
  rectH: document.getElementById("rect-h"),

  // Mockup Preview
  mockupPreview: document.getElementById("mockup-preview"),
  mockupPreviewClose: document.getElementById("mockup-preview-close"),
  mockupPreviewCanvas: document.getElementById("mockup-preview-canvas"),
  mockupScaleSlider: document.getElementById("mockup-scale-slider"),
  mockupScaleValue: document.getElementById("mockup-scale-value"),
  mockupXSlider: document.getElementById("mockup-x-slider"),
  mockupXValue: document.getElementById("mockup-x-value"),
  mockupYSlider: document.getElementById("mockup-y-slider"),
  mockupYValue: document.getElementById("mockup-y-value"),
  mockupPreviewReset: document.getElementById("mockup-preview-reset"),
  mockupPreviewGenerate: document.getElementById("mockup-preview-generate"),
};

// ===== MAP TILE PROVIDERS =====
const TILE_PROVIDERS = {
  "cartodb-voyager": {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  "cartodb-positron": {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  "cartodb-dark": {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  "osm-standard": {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  "osm-hot": {
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://www.hotosm.org/">HOT</a>',
    maxZoom: 19,
  },
  "stamen-toner": {
    url: "https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen</a>',
    maxZoom: 20,
  },
};

// ===== PROGRESS STAGES =====
const stageOrder = ["queued", "geocode", "network", "water", "parks", "render", "save", "done"];
const stageLabels = {
  queued: "Queued",
  geocode: "Geocoding",
  network: "Street Network",
  water: "Water Features",
  parks: "Parks",
  render: "Rendering",
  save: "Saving",
  done: "Complete",
};

// ===== INITIALIZATION =====

async function initApp() {
  initLeafletMap();
  await loadStarred();
  loadThemes();
  loadFonts();
  await loadPresets();
  await loadCollections();
  await loadMockups();
  refreshQueueDisplay();
  startQueueRefresh();
  initEventListeners();
  initPreviewWidget();
}

// ===== STARRED SYSTEM =====

async function loadStarred() {
  try {
    const [fontsRes, themesRes] = await Promise.all([
      fetch("/api/starred/fonts"),
      fetch("/api/starred/themes"),
    ]);
    starredFonts = await fontsRes.json();
    starredThemes = await themesRes.json();
  } catch (err) {
    console.error("Failed to load starred items:", err);
    starredFonts = [];
    starredThemes = [];
  }
}

async function toggleStarFont(fontName, e) {
  e?.stopPropagation();
  const isStarred = starredFonts.includes(fontName);
  try {
    const response = await fetch(`/api/starred/fonts/${encodeURIComponent(fontName)}`, {
      method: isStarred ? "DELETE" : "POST",
    });
    const data = await response.json();
    starredFonts = data.starred || [];
    renderFontSelector(fontList);
  } catch (err) {
    console.error("Failed to toggle star:", err);
  }
}

async function toggleStarTheme(themeId, e) {
  e?.stopPropagation();
  const isStarred = starredThemes.includes(themeId);
  try {
    const response = await fetch(`/api/starred/themes/${encodeURIComponent(themeId)}`, {
      method: isStarred ? "DELETE" : "POST",
    });
    const data = await response.json();
    starredThemes = data.starred || [];
    // Re-render theme UIs
    const themes = themesByCategory[currentCategory] || themeList;
    renderThemeCarousel(themes);
    renderThemeDrawer(themeList);
    initCarouselDrag();
  } catch (err) {
    console.error("Failed to toggle star:", err);
  }
}

// ===== PRESETS =====
async function loadPresets() {
  try {
    const response = await fetch("/api/presets");
    presetList = await response.json();
    renderPresetSelector();
  } catch (err) {
    console.error("Failed to load presets:", err);
    presetList = [];
  }
}

function renderPresetSelector() {
  if (!elements.presetSelect) return;

  // Keep "Custom" option and add presets
  elements.presetSelect.innerHTML = '<option value="">Custom</option>';

  presetList.forEach(preset => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    elements.presetSelect.appendChild(option);
  });
}

function applyPreset(presetId) {
  if (!presetId) return;

  const preset = presetList.find(p => p.id === presetId);
  if (!preset) return;

  // Apply theme
  if (preset.theme) {
    selectTheme(preset.theme);
  }

  // Apply font
  if (preset.font !== undefined) {
    state.font = preset.font;
    selectFont(preset.font);
  }

  // Apply pin
  if (preset.pin) {
    state.pin = preset.pin;
    elements.pinSelector?.querySelectorAll(".pin-option").forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.pin === preset.pin);
    });
    if (preset.pin !== "none" && elements.pinColorSelector) {
      elements.pinColorSelector.style.display = "flex";
      updatePinColorSwatches();
    }
  }

  // Apply pin color
  if (preset.pin_color) {
    state.pinColor = preset.pin_color;
  }

  // Apply format
  if (preset.format) {
    state.format = preset.format;
    if (elements.formatSelect) {
      elements.formatSelect.value = preset.format;
    }
  }

  // Apply aspect ratio
  if (preset.aspect_ratio) {
    state.aspectRatio = preset.aspect_ratio;
    if (elements.aspectSelect) {
      elements.aspectSelect.value = preset.aspect_ratio;
    }
  }

  // Apply DPI
  if (preset.dpi) {
    state.dpi = preset.dpi;
    if (elements.dpiSlider) {
      elements.dpiSlider.value = preset.dpi;
    }
    if (elements.dpiValue) {
      elements.dpiValue.textContent = preset.dpi;
    }
  }

  updatePreview();
}

async function saveCurrentAsPreset() {
  const name = prompt("Enter a name for this preset:");
  if (!name || !name.trim()) return;

  try {
    const response = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        theme: state.theme,
        font: state.font,
        pin: state.pin,
        pin_color: state.pinColor,
        format: state.format,
        dpi: state.dpi,
        aspect_ratio: state.aspectRatio,
      }),
    });

    if (response.ok) {
      await loadPresets();
      // Select the newly created preset
      const preset = await response.json();
      if (elements.presetSelect) {
        elements.presetSelect.value = preset.id;
      }
    } else {
      const err = await response.json();
      alert(err.error || "Failed to save preset");
    }
  } catch (err) {
    console.error("Failed to save preset:", err);
    alert("Failed to save preset");
  }
}

// ===== COLLECTIONS =====
async function loadCollections() {
  try {
    const response = await fetch("/api/collections");
    collectionList = await response.json();
    renderCollectionSelector();
  } catch (err) {
    console.error("Failed to load collections:", err);
    collectionList = [];
  }
}

function renderCollectionSelector() {
  if (!elements.collectionSelect) return;

  elements.collectionSelect.innerHTML = '<option value="">None</option>';

  collectionList.forEach(coll => {
    const option = document.createElement("option");
    option.value = coll.id;
    option.textContent = coll.name;
    elements.collectionSelect.appendChild(option);
  });
}

async function createCollection() {
  const name = prompt("Enter collection name:");
  if (!name || !name.trim()) return;

  try {
    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (response.ok) {
      const newCollection = await response.json();
      collectionList.push(newCollection);
      renderCollectionSelector();
      // Select the new collection
      if (elements.collectionSelect) {
        elements.collectionSelect.value = newCollection.id;
        state.collection = newCollection.id;
      }
    } else {
      const err = await response.json();
      alert(err.error || "Failed to create collection");
    }
  } catch (err) {
    console.error("Failed to create collection:", err);
    alert("Failed to create collection");
  }
}

async function assignPosterToCollection(filename, collectionId) {
  try {
    const response = await fetch(`/api/posters/${encodeURIComponent(filename)}/collection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: collectionId || null }),
    });

    if (response.ok) {
      // Refresh gallery to show updated collection
      loadGallery(true);
    } else {
      const err = await response.json();
      alert(err.error || "Failed to assign collection");
    }
  } catch (err) {
    console.error("Failed to assign collection:", err);
  }
}

async function deletePoster(filename) {
  try {
    const response = await fetch(`/api/posters/${encodeURIComponent(filename)}`, { method: "DELETE" });
    if (response.ok) {
      // Remove from galleryItems
      window.galleryItems = window.galleryItems.filter(item => item.filename !== filename);
      // Re-render tabs to update counts
      renderCollectionModalTabs();
    } else {
      const err = await response.json();
      alert(err.error || "Failed to delete poster");
    }
  } catch (err) {
    console.error("Failed to delete poster:", err);
  }
}

let modalCollectionFilter = null; // Track selected collection in modal
let galleryLoadedForModal = false;

async function openCollectionModal() {
  elements.collectionModal?.classList.add("open");

  // Load gallery data if not already loaded
  if (!galleryLoadedForModal || !window.galleryItems?.length) {
    await loadGallery();
    startGalleryStream();
    galleryLoadedForModal = true;
  }

  modalCollectionFilter = activeCollectionFilter; // Start with current filter
  renderCollectionModalTabs();
  renderCollectionModalGrid();
}

function closeCollectionModal() {
  elements.collectionModal?.classList.remove("open");
}

function renderCollectionModalTabs() {
  if (!elements.collectionModalTabs) return;
  elements.collectionModalTabs.innerHTML = "";

  const fragment = document.createDocumentFragment();

  // "All Posters" tab
  const allTab = document.createElement("button");
  allTab.className = "collection-tab" + (modalCollectionFilter === null ? " active" : "");
  allTab.innerHTML = `All <span class="collection-tab-count">${window.galleryItems?.length || 0}</span>`;
  allTab.addEventListener("click", () => {
    modalCollectionFilter = null;
    renderCollectionModalTabs();
    renderCollectionModalGrid();
  });
  fragment.appendChild(allTab);

  // Collection tabs
  collectionList.forEach(coll => {
    const count = window.galleryItems?.filter(item => item.config?.collection === coll.id).length || 0;
    const tab = document.createElement("button");
    tab.className = "collection-tab" + (modalCollectionFilter === coll.id ? " active" : "");
    tab.innerHTML = `${coll.name} <span class="collection-tab-count">${count}</span>
      <span class="collection-tab-delete" title="Delete collection">×</span>`;
    tab.addEventListener("click", (e) => {
      if (e.target.classList.contains("collection-tab-delete")) {
        e.stopPropagation();
        if (confirm(`Delete collection "${coll.name}"? Posters won't be deleted.`)) {
          deleteCollection(coll.id);
        }
        return;
      }
      modalCollectionFilter = coll.id;
      renderCollectionModalTabs();
      renderCollectionModalGrid();
    });
    fragment.appendChild(tab);
  });

  elements.collectionModalTabs.appendChild(fragment);
}

function renderCollectionModalGrid() {
  if (!elements.collectionModalGrid) return;
  elements.collectionModalGrid.innerHTML = "";

  const items = modalCollectionFilter === null
    ? window.galleryItems || []
    : (window.galleryItems || []).filter(item => item.config?.collection === modalCollectionFilter);

  if (items.length === 0) {
    elements.collectionModalGrid.innerHTML = '<div class="collection-modal-empty">No posters in this collection</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "collection-poster-card";

    // Build collection options
    let collectionOptions = '<option value="">No collection</option>';
    collectionList.forEach(coll => {
      const selected = item.config?.collection === coll.id ? 'selected' : '';
      collectionOptions += `<option value="${coll.id}" ${selected}>${coll.name}</option>`;
    });

    card.innerHTML = `
      <div class="collection-poster-image">
        <img src="${item.thumb_url}?t=${item.mtime}" alt="${item.filename}" loading="lazy">
        <div class="collection-poster-info">
          <span class="collection-poster-city">${item.config?.city || item.filename.split('_')[0]}</span>
          ${item.config?.theme ? `<span class="collection-poster-theme">${item.config.theme}</span>` : ''}
        </div>
      </div>
      <div class="collection-poster-actions">
        <button class="poster-action-btn poster-view-btn" title="View full size">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        </button>
        <a class="poster-action-btn poster-download-btn" href="${item.url}" download="${item.filename}" title="Download">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </a>
        <button class="poster-action-btn poster-mockup-btn" title="Create mockup">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/></svg>
        </button>
        <button class="poster-action-btn poster-delete-btn" title="Delete">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
        <select class="poster-collection-select" title="Assign to collection">
          ${collectionOptions}
        </select>
      </div>
    `;

    // Click on image loads settings
    card.querySelector('.collection-poster-image').addEventListener("click", () => {
      closeCollectionModal();
      if (item.config) {
        loadConfigFromGallery(item.config);
      }
    });

    // View button
    card.querySelector('.poster-view-btn').addEventListener("click", (e) => {
      e.stopPropagation();
      window.open(item.url, "_blank");
    });

    // Download button - handled by href/download attributes
    card.querySelector('.poster-download-btn').addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Mockup button
    card.querySelector('.poster-mockup-btn').addEventListener("click", (e) => {
      e.stopPropagation();
      openMockupModal(item);
    });

    // Delete button
    card.querySelector('.poster-delete-btn').addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${item.filename}"?`)) {
        await deletePoster(item.filename);
        renderCollectionModalGrid();
      }
    });

    // Collection select
    card.querySelector('.poster-collection-select').addEventListener("change", async (e) => {
      e.stopPropagation();
      await assignPosterToCollection(item.filename, e.target.value || null);
      // Update local item config
      if (item.config) {
        item.config.collection = e.target.value || null;
      }
    });

    fragment.appendChild(card);
  });

  elements.collectionModalGrid.appendChild(fragment);
}

async function deleteCollection(collId) {
  try {
    const response = await fetch(`/api/collections/${collId}`, { method: "DELETE" });
    if (response.ok) {
      collectionList = collectionList.filter(c => c.id !== collId);
      if (activeCollectionFilter === collId) {
        activeCollectionFilter = null;
      }
      if (modalCollectionFilter === collId) {
        modalCollectionFilter = null;
      }
      renderCollectionSelector();
      renderCollectionModalTabs();
      renderCollectionModalGrid();
    }
  } catch (err) {
    console.error("Failed to delete collection:", err);
  }
}

function filterGalleryByCollection() {
  // This is now handled by the modal - just update modal if open
  if (elements.collectionModal?.classList.contains("open")) {
    renderCollectionModalTabs();
    renderCollectionModalGrid();
  }
}

// ===== BATCH QUEUE =====
async function addToQueue() {
  // Validate that we have the required data
  if (!state.selectedLat || !state.selectedLng || !state.posterCity || !state.posterCountry) {
    return;
  }

  const payload = {
    city: state.posterCity,
    country: state.posterCountry,
    tagline: state.posterTagline || null,
    lat: state.selectedLat,
    lng: state.selectedLng,
    distance: state.radius,
    theme: state.theme,
    format: state.format,
    aspect_ratio: state.aspectRatio,
    collection: state.collection,
    font: state.font,
    pin: state.pin !== "none" ? state.pin : null,
    pin_color: state.pin !== "none" ? state.pinColor : null,
    dpi: state.dpi,
  };

  try {
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      alert(err.error || "Failed to add to queue");
      return;
    }

    const data = await response.json();
    console.log("Added to queue:", data);

    // Refresh queue display
    refreshQueueDisplay();

    // Show queue section
    if (elements.queueSection) {
      elements.queueSection.style.display = "block";
    }

  } catch (err) {
    console.error("Failed to add to queue:", err);
    alert("Failed to add to queue");
  }
}

async function refreshQueueDisplay() {
  try {
    const response = await fetch("/api/queue");
    const data = await response.json();

    renderQueueList(data);

  } catch (err) {
    console.error("Failed to refresh queue:", err);
  }
}

function renderQueueList(data) {
  if (!elements.queueList) return;

  const { queued, running, queued_count, running_count } = data;

  // Update count
  if (elements.queueCount) {
    const total = queued_count + running_count;
    elements.queueCount.textContent = `${total} job${total !== 1 ? 's' : ''}`;
  }

  // Show/hide queue section
  if (elements.queueSection) {
    elements.queueSection.style.display = (queued_count + running_count) > 0 ? "block" : "none";
  }

  elements.queueList.innerHTML = "";

  // Running jobs first
  running.forEach(job => {
    const item = document.createElement("div");
    item.className = "queue-item running";
    item.innerHTML = `
      <span class="queue-item-status">▶</span>
      <span class="queue-item-city">${job.city}</span>
      <span class="queue-item-theme">${job.theme}</span>
      <span class="queue-item-progress">${job.percent}%</span>
    `;
    elements.queueList.appendChild(item);
  });

  // Queued jobs
  queued.forEach(job => {
    const item = document.createElement("div");
    item.className = "queue-item queued";
    item.innerHTML = `
      <span class="queue-item-position">#${job.position}</span>
      <span class="queue-item-city">${job.city}</span>
      <span class="queue-item-theme">${job.theme}</span>
      <button class="queue-item-remove" data-job-id="${job.id}" title="Remove">×</button>
    `;
    elements.queueList.appendChild(item);
  });

  // Add click handlers for remove buttons
  elements.queueList.querySelectorAll(".queue-item-remove").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const jobId = e.target.dataset.jobId;
      await removeFromQueue(jobId);
    });
  });
}

async function removeFromQueue(jobId) {
  try {
    const response = await fetch(`/api/queue/${jobId}`, { method: "DELETE" });
    if (response.ok) {
      refreshQueueDisplay();
    }
  } catch (err) {
    console.error("Failed to remove from queue:", err);
  }
}

async function clearQueue() {
  if (!confirm("Clear all queued jobs?")) return;

  try {
    const response = await fetch("/api/queue/clear", { method: "POST" });
    if (response.ok) {
      refreshQueueDisplay();
    }
  } catch (err) {
    console.error("Failed to clear queue:", err);
  }
}

function startQueueRefresh() {
  // Refresh queue display every 2 seconds when there are jobs
  if (queueRefreshInterval) return;
  queueRefreshInterval = setInterval(refreshQueueDisplay, 2000);
}

function stopQueueRefresh() {
  if (queueRefreshInterval) {
    clearInterval(queueRefreshInterval);
    queueRefreshInterval = null;
  }
}

// ===== QUICK VARIATIONS =====
function toggleVariationMode() {
  variationMode = !variationMode;
  selectedThemes = variationMode ? [state.theme] : [];

  // Update toggle button appearance
  if (elements.variationModeBtn) {
    elements.variationModeBtn.classList.toggle("active", variationMode);
    elements.variationModeBtn.title = variationMode ? "Exit multi-select" : "Multi-select themes";
  }

  // Re-render theme carousel with checkboxes
  const themes = themesByCategory[currentCategory] || themeList;
  renderThemeCarousel(themes);

  // Update generate button
  updateVariationButton();
}

function toggleThemeSelection(themeId) {
  if (!variationMode) return;

  const index = selectedThemes.indexOf(themeId);
  if (index === -1) {
    selectedThemes.push(themeId);
  } else {
    selectedThemes.splice(index, 1);
  }

  // Update UI
  document.querySelectorAll(".theme-carousel-card").forEach(card => {
    const isSelected = selectedThemes.includes(card.dataset.themeId);
    card.classList.toggle("variation-selected", isSelected);
  });

  updateVariationButton();
}

function updateVariationButton() {
  if (!variationMode) {
    // Reset to normal
    elements.generateBtn.textContent = state.posterCity
      ? `Generate: ${state.posterCity}`
      : "Select location to generate";
    return;
  }

  const count = selectedThemes.length;
  if (count > 0 && state.posterCity) {
    elements.generateBtn.textContent = `Generate ${count} Variation${count !== 1 ? "s" : ""}`;
  } else {
    elements.generateBtn.textContent = "Select themes for variations";
  }
}

async function generateVariations() {
  if (!variationMode || selectedThemes.length === 0) return;

  // Validate
  if (!state.selectedLat || !state.selectedLng || !state.posterCity || !state.posterCountry) {
    return;
  }

  elements.generateBtn.disabled = true;
  elements.generateBtn.textContent = `Generating ${selectedThemes.length} variations...`;

  const payload = {
    themes: selectedThemes,
    city: state.posterCity,
    country: state.posterCountry,
    tagline: state.posterTagline || null,
    lat: state.selectedLat,
    lng: state.selectedLng,
    distance: state.radius,
    format: state.format,
    aspect_ratio: state.aspectRatio,
    collection: state.collection,
    font: state.font,
    pin: state.pin !== "none" ? state.pin : null,
    pin_color: state.pin !== "none" ? state.pinColor : null,
    dpi: state.dpi,
  };

  try {
    const response = await fetch("/api/variations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      alert(err.error || "Failed to create variations");
      elements.generateBtn.disabled = false;
      updateVariationButton();
      return;
    }

    const data = await response.json();
    console.log("Created variations batch:", data);

    // Show queue section
    if (elements.queueSection) {
      elements.queueSection.style.display = "block";
    }

    // Refresh queue display
    refreshQueueDisplay();

    // Exit variation mode
    toggleVariationMode();

    elements.generateBtn.disabled = false;
    updateGenerateButton();

  } catch (err) {
    console.error("Failed to create variations:", err);
    alert("Failed to create variations");
    elements.generateBtn.disabled = false;
    updateVariationButton();
  }
}

// ===== LEAFLET MAP =====

function initLeafletMap() {
  // Default center (London)
  const defaultLat = 51.505;
  const defaultLng = -0.09;
  const defaultZoom = 10;

  leafletMap = L.map("leaflet-map", {
    zoomControl: true,
    attributionControl: true,
  }).setView([defaultLat, defaultLng], defaultZoom);

  // Move zoom control to bottom-left to avoid overlap with style widget
  leafletMap.zoomControl.setPosition("bottomleft");

  // Set initial tile layer
  setTileLayer("cartodb-voyager");

  // Add radius circle (initially hidden until click)
  radiusCircle = L.circle([defaultLat, defaultLng], {
    radius: state.radius,
    color: "#c76b2b",
    fillColor: "#c76b2b",
    fillOpacity: 0.12,
    weight: 2,
    interactive: false,
  });

  // Add aspect ratio rectangle (shows capture area)
  aspectRatioRect = L.rectangle([[0, 0], [0, 0]], {
    color: "#c76b2b",
    fillColor: "transparent",
    fillOpacity: 0,
    weight: 2,
    dashArray: "8, 8",
    interactive: false,
  });

  // Add center marker (initially hidden)
  centerMarker = L.circleMarker([defaultLat, defaultLng], {
    radius: 8,
    color: "#c76b2b",
    fillColor: "#fff",
    fillOpacity: 1,
    weight: 3,
    interactive: false,
  });

  // Map click handler - capture coords, reverse geocode, show suggestion
  leafletMap.on("click", handleMapClick);
}

function setTileLayer(providerId) {
  const provider = TILE_PROVIDERS[providerId];
  if (!provider || !leafletMap) return;

  if (currentTileLayer) {
    leafletMap.removeLayer(currentTileLayer);
  }

  currentTileLayer = L.tileLayer(provider.url, {
    attribution: provider.attribution,
    maxZoom: provider.maxZoom,
  }).addTo(leafletMap);
}

// Normalize longitude to -180 to 180 range (Leaflet can return wrapped values)
function normalizeLng(lng) {
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

async function handleMapClick(e) {
  const { lat, lng } = e.latlng;

  // Update state (normalize longitude for wrapped maps)
  state.selectedLat = lat;
  state.selectedLng = normalizeLng(lng);

  // Show/update circle and marker
  if (!leafletMap.hasLayer(radiusCircle)) {
    radiusCircle.addTo(leafletMap);
    centerMarker.addTo(leafletMap);
  }
  radiusCircle.setLatLng([lat, lng]);
  centerMarker.setLatLng([lat, lng]);

  // Update aspect ratio rectangle
  updateAspectRatioRect();

  // Update coordinates display
  updateCoordsDisplay();

  // Reverse geocode (async) - get suggestion
  await reverseGeocode(lat, lng);

  // Update generate button
  updateGenerateButton();
}

function updateCoordsDisplay() {
  if (state.selectedLat !== null && state.selectedLng !== null) {
    elements.selectedCoords.textContent = `${state.selectedLat.toFixed(4)}, ${state.selectedLng.toFixed(4)}`;
    elements.selectedCoords.classList.add("has-coords");
  } else {
    elements.selectedCoords.textContent = "Click on map";
    elements.selectedCoords.classList.remove("has-coords");
  }
}

async function reverseGeocode(lat, lng) {
  elements.suggestedLocation.textContent = "Looking up...";
  elements.suggestedLocation.classList.add("loading");

  try {
    const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    const data = await response.json();

    if (data.error) {
      state.suggestedCity = "";
      state.suggestedCountry = "";
      elements.suggestedLocation.textContent = "Location not found";
      elements.suggestedLocation.classList.remove("loading");
      return;
    }

    state.suggestedCity = data.city || "";
    state.suggestedCountry = data.country || "";

    if (state.suggestedCity && state.suggestedCountry) {
      elements.suggestedLocation.textContent = `${state.suggestedCity}, ${state.suggestedCountry}`;
    } else if (state.suggestedCity) {
      elements.suggestedLocation.textContent = state.suggestedCity;
    } else if (data.display) {
      elements.suggestedLocation.textContent = data.display.split(",").slice(0, 2).join(",").trim();
    } else {
      elements.suggestedLocation.textContent = "Unknown location";
    }

    elements.suggestedLocation.classList.remove("loading");

    // Enable sync buttons
    updateSyncButtons();
  } catch (err) {
    state.suggestedCity = "";
    state.suggestedCountry = "";
    elements.suggestedLocation.textContent = "Lookup failed";
    elements.suggestedLocation.classList.remove("loading");
  }
}

function updateSyncButtons() {
  // Show sync buttons only when there's a suggestion and the field is empty or different
  elements.syncCity.style.display = state.suggestedCity ? "" : "none";
  elements.syncCountry.style.display = state.suggestedCountry ? "" : "none";
}

// ===== LOCATION SEARCH (pans map, doesn't set poster text) =====

async function searchLocation(query) {
  if (!query || query.length < 2) {
    hideSearchResults();
    return;
  }

  try {
    const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}&limit=5`);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      showSearchResults(data.results);
    } else {
      showSearchResults([]);
    }
  } catch (err) {
    hideSearchResults();
  }
}

function showSearchResults(results) {
  elements.searchResults.innerHTML = "";

  if (!results.length) {
    const noResults = document.createElement("div");
    noResults.className = "search-no-results";
    noResults.textContent = "No locations found";
    elements.searchResults.appendChild(noResults);
    elements.searchResults.classList.add("visible");
    return;
  }

  results.forEach((result) => {
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.innerHTML = `
      <span class="search-result-name">${escapeHtml(result.display.split(",").slice(0, 2).join(","))}</span>
      <span class="search-result-detail">${escapeHtml(result.display.split(",").slice(2, 4).join(","))}</span>
    `;
    item.addEventListener("click", () => {
      // Pan map to this location (DON'T set poster text)
      panToLocation(result.lat, result.lng);
      hideSearchResults();
      elements.locationSearch.value = "";
    });
    elements.searchResults.appendChild(item);
  });

  elements.searchResults.classList.add("visible");
}

function hideSearchResults() {
  elements.searchResults.classList.remove("visible");
  elements.searchResults.innerHTML = "";
}

function panToLocation(lat, lng) {
  if (leafletMap) {
    leafletMap.setView([lat, lng], 12, { animate: true });
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// ===== POSTER TEXT (decoupled from map) =====

function syncCityFromSuggestion() {
  if (state.suggestedCity) {
    state.posterCity = state.suggestedCity;
    elements.posterCity.value = state.suggestedCity;
    updateGenerateButton();
  }
}

function syncCountryFromSuggestion() {
  if (state.suggestedCountry) {
    state.posterCountry = state.suggestedCountry;
    elements.posterCountry.value = state.suggestedCountry;
    updateGenerateButton();
  }
}

function updateGenerateButton() {
  const hasCoords = state.selectedLat !== null && state.selectedLng !== null;
  const hasCity = state.posterCity.trim().length > 0;
  const hasCountry = state.posterCountry.trim().length > 0;
  const canGenerate = hasCoords && hasCity && hasCountry;

  if (canGenerate) {
    elements.generateBtn.disabled = false;
    elements.generateBtn.textContent = `Generate: ${state.posterCity}`;
  } else if (hasCoords && !hasCity) {
    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = "Enter city name";
  } else if (hasCoords && !hasCountry) {
    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = "Enter country";
  } else {
    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = "Select location to generate";
  }

  // Also update queue button
  if (elements.addQueueBtn) {
    elements.addQueueBtn.disabled = !canGenerate;
  }
}

// ===== RADIUS & DPI SLIDERS =====

function updateRadius(value) {
  state.radius = parseInt(value);
  elements.radiusValue.textContent = `${Math.round(state.radius / 1000)} km`;
  if (radiusCircle) {
    radiusCircle.setRadius(state.radius);
  }
  updateAspectRatioRect();
}

function updateDpi(value) {
  state.dpi = parseInt(value);
  elements.dpiValue.textContent = value;
}

function updateAspectRatioRect() {
  if (!aspectRatioRect || !leafletMap || state.selectedLat === null) return;

  const lat = state.selectedLat;
  const lng = state.selectedLng;
  const radius = state.radius;

  // Parse aspect ratio
  let aspectWidth = 2, aspectHeight = 3;
  if (state.aspectRatio === "1:1") {
    aspectWidth = 1; aspectHeight = 1;
  } else if (state.aspectRatio === "2:3") {
    aspectWidth = 2; aspectHeight = 3;
  } else if (state.aspectRatio === "3:4") {
    aspectWidth = 3; aspectHeight = 4;
  } else if (state.aspectRatio === "4:5") {
    aspectWidth = 4; aspectHeight = 5;
  } else if (state.aspectRatio === "A4" || state.aspectRatio === "A3") {
    aspectWidth = 210; aspectHeight = 297; // A4 proportions
  }

  // Calculate rectangle that fits inside the circle with correct aspect ratio
  // The rectangle should be inscribed in the circle
  const aspectRatioValue = aspectWidth / aspectHeight;

  // For a rectangle inscribed in a circle, if we know the radius:
  // width = 2 * r * cos(theta), height = 2 * r * sin(theta)
  // where tan(theta) = height/width = 1/aspectRatioValue
  // So theta = atan(1/aspectRatioValue)
  const theta = Math.atan(1 / aspectRatioValue);
  const halfWidth = radius * Math.cos(theta);
  const halfHeight = radius * Math.sin(theta);

  // Convert meters to degrees (approximate)
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(lat * Math.PI / 180);

  const latOffset = halfHeight / metersPerDegreeLat;
  const lngOffset = halfWidth / metersPerDegreeLng;

  const bounds = [
    [lat - latOffset, lng - lngOffset],
    [lat + latOffset, lng + lngOffset]
  ];

  aspectRatioRect.setBounds(bounds);

  if (!leafletMap.hasLayer(aspectRatioRect)) {
    aspectRatioRect.addTo(leafletMap);
  }
}

// ===== THEMES =====

const CATEGORY_LABELS = {
  all: "All",
  dark: "Dark",
  light: "Light",
  nature: "Nature",
  urban: "Urban",
  vintage: "Vintage",
  vibrant: "Vibrant",
  pastel: "Pastel",
  luxury: "Luxury",
  monochrome: "Mono",
  cultural: "Cultural",
  other: "Other",
};

const CATEGORY_ORDER = ["all", "dark", "light", "nature", "urban", "vintage", "vibrant", "pastel", "luxury", "monochrome", "cultural", "other"];

async function loadThemes() {
  try {
    const response = await fetch("/api/themes");
    const themes = await response.json();

    themeList = themes;
    themeCatalog = themes.reduce((acc, theme) => {
      acc[theme.id] = theme;
      return acc;
    }, {});

    // Group themes by category
    themesByCategory = { all: themes };
    themes.forEach((theme) => {
      const cat = theme.category || "other";
      if (!themesByCategory[cat]) {
        themesByCategory[cat] = [];
      }
      themesByCategory[cat].push(theme);
    });

    renderCategoryTabs();
    renderThemeCarousel(themes);
    renderThemeDrawer(themes);
    initCarouselDrag();

    // Set initial theme name and update preview
    updateSelectedThemeName();
    updatePreview();
  } catch (err) {
    console.error("Failed to load themes:", err);
  }
}

async function loadFonts() {
  try {
    const response = await fetch("/api/fonts");
    const fonts = await response.json();
    fontList = fonts;
    loadFontFaces(fonts);
    renderFontSelector(fonts);
    initFontPicker();
  } catch (err) {
    console.error("Failed to load fonts:", err);
    renderFontSelector([]);
    initFontPicker();
  }
}

function loadFontFaces(fonts) {
  // Create a style element for @font-face rules
  let styleEl = document.getElementById("font-faces-style");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "font-faces-style";
    document.head.appendChild(styleEl);
  }

  // Generate @font-face rules for each font
  const rules = fonts.map((font) => `
    @font-face {
      font-family: "${font}";
      src: url("/fonts/${font}-Regular.ttf") format("truetype");
      font-weight: 400;
      font-display: swap;
    }
  `).join("\n");

  styleEl.textContent = rules;
}

function renderFontSelector(fonts) {
  if (!elements.fontPickerOptions) return;

  elements.fontPickerOptions.innerHTML = "";

  // Default option
  const defaultFont = fonts.length > 0 ? fonts[0] : "Roboto";
  const defaultOpt = createFontOption("", `Default (${defaultFont})`, defaultFont, false);
  elements.fontPickerOptions.appendChild(defaultOpt);

  // Sort fonts: starred first, then alphabetically
  const sortedFonts = [...fonts].sort((a, b) => {
    const aStarred = starredFonts.includes(a);
    const bStarred = starredFonts.includes(b);
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    return a.localeCompare(b);
  });

  // Add each available font with preview and star button
  sortedFonts.forEach((font) => {
    const isStarred = starredFonts.includes(font);
    const opt = createFontOption(font, font, font, isStarred);
    elements.fontPickerOptions.appendChild(opt);
  });

  // Update toggle label
  updateFontPickerLabel();
}

function createFontOption(value, name, previewFont, isStarred = false) {
  const opt = document.createElement("div");
  opt.className = "font-picker-option";
  opt.dataset.value = value;
  if (value === state.font) {
    opt.classList.add("selected");
  }

  const header = document.createElement("div");
  header.className = "font-picker-option-header";

  const nameEl = document.createElement("div");
  nameEl.className = "font-picker-option-name";
  nameEl.textContent = name;

  header.appendChild(nameEl);

  // Add star button (only for non-default options)
  if (value) {
    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = `star-btn ${isStarred ? "starred" : ""}`;
    starBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="${isStarred ? "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" : "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"}"/></svg>`;
    starBtn.title = isStarred ? "Remove from favorites" : "Add to favorites";
    starBtn.addEventListener("click", (e) => toggleStarFont(value, e));
    header.appendChild(starBtn);
  }

  const previewEl = document.createElement("div");
  previewEl.className = "font-picker-option-preview";
  previewEl.style.fontFamily = `"${previewFont}", sans-serif`;
  previewEl.textContent = "The quick brown fox";

  opt.appendChild(header);
  opt.appendChild(previewEl);

  opt.addEventListener("click", (e) => {
    if (e.target.closest(".star-btn")) return;
    selectFont(value);
    closeFontPicker();
  });

  return opt;
}

function selectFont(fontValue) {
  state.font = fontValue;

  // Update selected state
  document.querySelectorAll(".font-picker-option").forEach((opt) => {
    opt.classList.toggle("selected", opt.dataset.value === fontValue);
  });

  updateFontPickerLabel();
  updatePreview();
}

function updateFontPickerLabel() {
  if (!elements.fontPickerLabel) return;

  if (state.font) {
    elements.fontPickerLabel.textContent = state.font;
    elements.fontPickerLabel.style.fontFamily = `"${state.font}", sans-serif`;
  } else {
    const defaultFont = fontList.length > 0 ? fontList[0] : "Roboto";
    elements.fontPickerLabel.textContent = `Default (${defaultFont})`;
    elements.fontPickerLabel.style.fontFamily = `"${defaultFont}", sans-serif`;
  }
}

function initFontPicker() {
  if (!elements.fontPickerToggle) return;

  elements.fontPickerToggle.addEventListener("click", toggleFontPicker);

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (elements.fontPicker && !elements.fontPicker.contains(e.target)) {
      closeFontPicker();
    }
  });
}

function toggleFontPicker() {
  const isOpen = elements.fontPicker?.classList.contains("open");
  if (isOpen) {
    closeFontPicker();
  } else {
    openFontPicker();
  }
}

function openFontPicker() {
  elements.fontPicker?.classList.add("open");
  elements.fontPickerDropdown?.setAttribute("aria-hidden", "false");
}

function closeFontPicker() {
  elements.fontPicker?.classList.remove("open");
  elements.fontPickerDropdown?.setAttribute("aria-hidden", "true");
}

// ============================================================
// PREVIEW WIDGET
// ============================================================

let previewSvgLoaded = false;

async function loadPreviewSvg() {
  if (!elements.previewContainer) return;

  try {
    const response = await fetch("/static/preview-map.svg");
    const svgText = await response.text();
    elements.previewContainer.innerHTML = svgText;
    previewSvgLoaded = true;
    updatePreview();
  } catch (err) {
    console.error("Failed to load preview SVG:", err);
  }
}

function updatePreview() {
  if (!previewSvgLoaded || !elements.previewContainer) return;

  const theme = getSelectedTheme();
  if (!theme) return;

  const svg = elements.previewContainer.querySelector("svg");
  if (!svg) return;

  // Update background
  const bg = svg.querySelector("#preview-bg");
  if (bg) bg.setAttribute("fill", theme.colors.bg || "#FAFAF8");

  // Update water
  const water = svg.querySelector("#preview-water");
  if (water) {
    water.querySelectorAll("path, ellipse, rect, circle").forEach((el) => {
      el.setAttribute("fill", theme.colors.water || "#B8D4E3");
    });
  }

  // Update parks
  const parks = svg.querySelector("#preview-parks");
  if (parks) {
    parks.querySelectorAll("path, ellipse, rect, circle").forEach((el) => {
      el.setAttribute("fill", theme.colors.parks || "#C5DEB8");
    });
  }

  // Update buildings (if theme has building color)
  const buildings = svg.querySelector("#preview-buildings");
  if (buildings) {
    const buildingColor = theme.colors.buildings || theme.colors.bg || "#E8E4DE";
    // Make buildings slightly different from background
    buildings.querySelectorAll("rect").forEach((el) => {
      el.setAttribute("fill", adjustBrightness(buildingColor, -10));
    });
  }

  // Update roads
  const roadMotorway = svg.querySelector("#preview-roads-motorway");
  if (roadMotorway) {
    roadMotorway.querySelectorAll("path").forEach((el) => {
      el.setAttribute("stroke", theme.colors.road_motorway || theme.colors.road_primary || "#1A1A1A");
    });
  }

  const roadPrimary = svg.querySelector("#preview-roads-primary");
  if (roadPrimary) {
    roadPrimary.querySelectorAll("path").forEach((el) => {
      el.setAttribute("stroke", theme.colors.road_primary || "#2A2A2A");
    });
  }

  const roadSecondary = svg.querySelector("#preview-roads-secondary");
  if (roadSecondary) {
    roadSecondary.querySelectorAll("path").forEach((el) => {
      el.setAttribute("stroke", theme.colors.road_secondary || "#4A4A4A");
    });
  }

  const roadTertiary = svg.querySelector("#preview-roads-tertiary");
  if (roadTertiary) {
    roadTertiary.querySelectorAll("path").forEach((el) => {
      el.setAttribute("stroke", theme.colors.road_tertiary || "#6A6A6A");
    });
  }

  // Update border
  const border = svg.querySelector("#preview-border");
  if (border) {
    border.setAttribute("stroke", theme.colors.text || "#1A1A1A");
  }

  // Update text colors and fonts
  const selectedFont = state.font || fontList[0] || "Roboto";
  const textColor = theme.colors.text || "#1A1A1A";

  const cityText = svg.querySelector("#preview-city");
  if (cityText) {
    cityText.setAttribute("fill", textColor);
    cityText.setAttribute("font-family", `"${selectedFont}", sans-serif`);
    // Update city name based on poster text
    cityText.textContent = elements.posterCity?.value?.toUpperCase() || "LONDON";
  }

  const countryText = svg.querySelector("#preview-country");
  if (countryText) {
    countryText.setAttribute("fill", textColor);
    countryText.setAttribute("font-family", `"${selectedFont}", sans-serif`);
    // Update country based on poster text
    countryText.textContent = elements.posterCountry?.value?.toUpperCase() || "UNITED KINGDOM";
  }

  const coordsText = svg.querySelector("#preview-coords");
  if (coordsText) {
    coordsText.setAttribute("fill", adjustBrightness(textColor, 40));
    coordsText.setAttribute("font-family", `"${selectedFont}", sans-serif`);
    // Show tagline if provided, otherwise show coordinates
    if (state.posterTagline) {
      coordsText.textContent = state.posterTagline;
    } else if (state.selectedLat !== null && state.selectedLng !== null) {
      const lat = state.selectedLat;
      const lng = state.selectedLng;
      const latStr = lat >= 0 ? `${lat.toFixed(4)}° N` : `${Math.abs(lat).toFixed(4)}° S`;
      const lngStr = lng >= 0 ? `${lng.toFixed(4)}° E` : `${Math.abs(lng).toFixed(4)}° W`;
      coordsText.textContent = `${latStr} / ${lngStr}`;
    } else {
      coordsText.textContent = "51.5074° N / 0.1278° W";
    }
  }

  // Update theme name in footer
  if (elements.previewThemeName) {
    elements.previewThemeName.textContent = theme.name || theme.id || "Theme";
  }

  // Update center pin icon
  const pinGroup = svg.querySelector("#preview-pin");
  if (pinGroup) {
    // Hide all pins first
    pinGroup.querySelectorAll(".pin-icon").forEach((p) => {
      p.style.display = "none";
    });

    // Show selected pin if not "none"
    if (state.pin && state.pin !== "none") {
      const selectedPin = pinGroup.querySelector(`#pin-${state.pin}`);
      if (selectedPin) {
        selectedPin.style.display = "block";
        // Update pin color to match theme text color
        selectedPin.querySelectorAll("path, circle, rect").forEach((el) => {
          if (el.getAttribute("fill") !== "white") {
            el.setAttribute("fill", textColor);
          }
        });
      }
    }
  }
}

function getSelectedTheme() {
  // Find the currently selected theme from themeList
  if (!themeList || themeList.length === 0) return null;
  return themeList.find((t) => t.id === state.theme) || themeList[0];
}

function updatePinColorSwatches() {
  // Populate pin color swatches from current theme colors
  const theme = getSelectedTheme();
  if (!theme || !elements.pinColorSwatches) return;

  const colors = theme.colors || {};
  // Collect unique colors from theme (excluding bg which is usually white/light)
  const colorSet = new Set();
  const colorOrder = ["text", "roads_primary", "roads_secondary", "roads_tertiary", "water", "parks", "accent"];

  colorOrder.forEach((key) => {
    if (colors[key] && colors[key] !== colors.bg) {
      colorSet.add(colors[key]);
    }
  });

  // Add any remaining colors not in standard order
  Object.values(colors).forEach((c) => {
    if (c && c !== colors.bg) colorSet.add(c);
  });

  const uniqueColors = Array.from(colorSet);
  elements.pinColorSwatches.innerHTML = "";

  uniqueColors.forEach((color, idx) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "pin-color-swatch";
    if (idx === 0 && !state.pinColor) {
      swatch.classList.add("selected");
      state.pinColor = color;
    } else if (state.pinColor === color) {
      swatch.classList.add("selected");
    }
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.addEventListener("click", () => {
      elements.pinColorSwatches.querySelectorAll(".pin-color-swatch").forEach((s) => s.classList.remove("selected"));
      swatch.classList.add("selected");
      state.pinColor = color;
      updatePreview();
    });
    elements.pinColorSwatches.appendChild(swatch);
  });
}

function adjustBrightness(hex, percent) {
  // Adjust hex color brightness
  if (!hex || hex.length < 4) return hex;

  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse RGB
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  // Adjust brightness
  r = Math.max(0, Math.min(255, r + (percent * 255) / 100));
  g = Math.max(0, Math.min(255, g + (percent * 255) / 100));
  b = Math.max(0, Math.min(255, b + (percent * 255) / 100));

  // Convert back to hex
  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g).toString(16).padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`;
}

function initPreviewWidget() {
  // Close button
  elements.previewClose?.addEventListener("click", () => {
    elements.previewWidget?.classList.add("hidden");
  });

  // Update preview when poster text changes
  elements.posterCity?.addEventListener("input", debounce(updatePreview, 150));
  elements.posterCountry?.addEventListener("input", debounce(updatePreview, 150));
  elements.posterTagline?.addEventListener("input", debounce(updatePreview, 150));

  // Initialize drag and resize functionality
  initPreviewDrag();
  initPreviewResize();

  // Load the SVG
  loadPreviewSvg();
}

function initPreviewDrag() {
  const widget = elements.previewWidget;
  const header = widget?.querySelector(".preview-header");
  if (!widget || !header) return;

  let isDragging = false;
  let startX, startY;
  let initialLeft, initialTop;

  function onMouseDown(e) {
    // Don't drag if clicking close button
    if (e.target.closest(".preview-close")) return;

    isDragging = true;
    widget.classList.add("dragging");

    // Get current position
    const rect = widget.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    startX = e.clientX;
    startY = e.clientY;

    // Switch to fixed positioning based on current location
    widget.style.left = `${initialLeft}px`;
    widget.style.top = `${initialTop}px`;
    widget.style.right = "auto";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newLeft = initialLeft + deltaX;
    let newTop = initialTop + deltaY;

    // Constrain to viewport
    const widgetRect = widget.getBoundingClientRect();
    const maxLeft = window.innerWidth - widgetRect.width;
    const maxTop = window.innerHeight - widgetRect.height;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    widget.style.left = `${newLeft}px`;
    widget.style.top = `${newTop}px`;
  }

  function onMouseUp() {
    isDragging = false;
    widget.classList.remove("dragging");

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  header.addEventListener("mousedown", onMouseDown);

  // Touch support for mobile
  header.addEventListener("touchstart", (e) => {
    if (e.target.closest(".preview-close")) return;

    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    onMouseDown(mouseEvent);
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    onMouseMove(mouseEvent);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchend", () => {
    if (isDragging) onMouseUp();
  });
}

function initPreviewResize() {
  const widget = elements.previewWidget;
  const resizeHandle = document.getElementById("preview-resize-handle");
  if (!widget || !resizeHandle) return;

  let isResizing = false;
  let startX, startY;
  let initialWidth, initialHeight;

  const MIN_WIDTH = 150;
  const MAX_WIDTH = 400;
  const MIN_HEIGHT = 200;
  const MAX_HEIGHT = 600;

  function onMouseDown(e) {
    isResizing = true;
    widget.classList.add("resizing");

    startX = e.clientX;
    startY = e.clientY;

    const rect = widget.getBoundingClientRect();
    initialWidth = rect.width;
    initialHeight = rect.height;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newWidth = initialWidth + deltaX;
    let newHeight = initialHeight + deltaY;

    // Constrain to min/max
    newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));
    newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT));

    widget.style.width = `${newWidth}px`;
    widget.style.height = `${newHeight}px`;
  }

  function onMouseUp() {
    isResizing = false;
    widget.classList.remove("resizing");

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  resizeHandle.addEventListener("mousedown", onMouseDown);

  // Touch support
  resizeHandle.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    onMouseDown(mouseEvent);
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!isResizing) return;
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    onMouseMove(mouseEvent);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchend", () => {
    if (isResizing) onMouseUp();
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function renderCategoryTabs() {
  if (!elements.themeCategoryTabs) return;

  elements.themeCategoryTabs.innerHTML = "";

  // Only show categories that have themes
  const availableCategories = CATEGORY_ORDER.filter(
    (cat) => themesByCategory[cat] && themesByCategory[cat].length > 0
  );

  availableCategories.forEach((cat) => {
    const tab = document.createElement("button");
    tab.className = "theme-category-tab";
    tab.type = "button";
    tab.dataset.category = cat;
    tab.textContent = CATEGORY_LABELS[cat] || cat;
    if (cat === currentCategory) {
      tab.classList.add("active");
    }
    tab.addEventListener("click", () => {
      setThemeCategory(cat);
    });
    elements.themeCategoryTabs.appendChild(tab);
  });
}

function setThemeCategory(category) {
  currentCategory = category;

  // Update tab active state and scroll active tab into view
  document.querySelectorAll(".theme-category-tab").forEach((tab) => {
    const isActive = tab.dataset.category === category;
    tab.classList.toggle("active", isActive);
    if (isActive) {
      tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  });

  // Re-render carousel with filtered themes
  const themes = themesByCategory[category] || themeList;
  renderThemeCarousel(themes);
  initCarouselDrag();
}

function renderThemeCarousel(themes) {
  if (!elements.themeCarousel) return;

  elements.themeCarousel.innerHTML = "";

  // Sort themes: starred first, then by name
  const sortedThemes = [...themes].sort((a, b) => {
    const aStarred = starredThemes.includes(a.id);
    const bStarred = starredThemes.includes(b.id);
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    return a.name.localeCompare(b.name);
  });

  sortedThemes.forEach((theme) => {
    const isStarred = starredThemes.includes(theme.id);
    const card = document.createElement("div");
    card.className = "theme-carousel-card";
    card.dataset.themeId = theme.id;
    if (theme.id === state.theme) {
      card.classList.add("selected");
    }

    const swatches = document.createElement("div");
    swatches.className = "theme-swatches";

    ["bg", "road_motorway", "road_primary", "water", "parks", "road_secondary"].forEach((key) => {
      const swatch = document.createElement("span");
      swatch.className = "theme-swatch";
      swatch.style.background = theme.colors?.[key] || "#eee";
      swatches.appendChild(swatch);
    });

    const footer = document.createElement("div");
    footer.className = "theme-card-footer";

    const title = document.createElement("div");
    title.className = "theme-title";
    title.textContent = theme.name;

    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = `star-btn star-btn-sm ${isStarred ? "starred" : ""}`;
    starBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="${isStarred ? "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" : "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"}"/></svg>`;
    starBtn.title = isStarred ? "Remove from favorites" : "Add to favorites";
    starBtn.addEventListener("click", (e) => toggleStarTheme(theme.id, e));

    footer.appendChild(title);
    footer.appendChild(starBtn);

    card.appendChild(swatches);
    card.appendChild(footer);

    card.addEventListener("click", (e) => {
      // Prevent click during drag or on star button
      if (elements.themeCarousel.classList.contains("dragging") || e.target.closest(".star-btn")) {
        e.preventDefault();
        return;
      }
      // In variation mode, toggle selection instead of changing theme
      if (variationMode) {
        toggleThemeSelection(theme.id);
      } else {
        selectTheme(theme.id);
      }
    });

    elements.themeCarousel.appendChild(card);
  });

  updateCarouselScrollIndicators();
}

function initCarouselDrag() {
  const carousel = elements.themeCarousel;
  if (!carousel) return;

  let isDown = false;
  let startX;
  let scrollLeft;
  let hasMoved = false;

  carousel.addEventListener("mousedown", (e) => {
    isDown = true;
    hasMoved = false;
    startX = e.pageX - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
  });

  carousel.addEventListener("mouseleave", () => {
    if (isDown) {
      isDown = false;
      carousel.classList.remove("dragging");
    }
  });

  carousel.addEventListener("mouseup", () => {
    isDown = false;
    setTimeout(() => {
      carousel.classList.remove("dragging");
    }, 50);
  });

  carousel.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5 && !hasMoved) {
      hasMoved = true;
      carousel.classList.add("dragging");
    }
    carousel.scrollLeft = scrollLeft - walk;
    updateCarouselScrollIndicators();
  });

  // Touch support
  carousel.addEventListener("touchstart", (e) => {
    startX = e.touches[0].pageX - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
  }, { passive: true });

  carousel.addEventListener("touchmove", (e) => {
    const x = e.touches[0].pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    carousel.scrollLeft = scrollLeft - walk;
    updateCarouselScrollIndicators();
  }, { passive: true });

  carousel.addEventListener("scroll", () => {
    updateCarouselScrollIndicators();
  });
}

function updateCarouselScrollIndicators() {
  const wrap = elements.themeCarouselWrap;
  const carousel = elements.themeCarousel;
  if (!wrap || !carousel) return;

  const canScrollLeft = carousel.scrollLeft > 10;
  const canScrollRight = carousel.scrollLeft < carousel.scrollWidth - carousel.clientWidth - 10;

  wrap.classList.toggle("can-scroll-left", canScrollLeft);
  wrap.classList.toggle("can-scroll-right", canScrollRight);
}

function renderThemeDrawer(themes) {
  if (!elements.themeGridFull) return;

  elements.themeGridFull.innerHTML = "";

  // Group themes by category for drawer
  const grouped = {};
  themes.forEach((theme) => {
    const cat = theme.category || "other";
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(theme);
  });

  // Render each category group
  CATEGORY_ORDER.filter((cat) => cat !== "all" && grouped[cat]).forEach((cat) => {
    const group = document.createElement("div");
    group.className = "theme-category-group";
    group.dataset.category = cat;

    const titleEl = document.createElement("div");
    titleEl.className = "theme-category-title";
    titleEl.innerHTML = `
      ${CATEGORY_LABELS[cat] || cat}
      <span class="theme-category-count">(${grouped[cat].length})</span>
    `;
    group.appendChild(titleEl);

    const grid = document.createElement("div");
    grid.className = "theme-category-grid";

    grouped[cat].forEach((theme) => {
      const card = createThemeCardForDrawer(theme);
      grid.appendChild(card);
    });

    group.appendChild(grid);
    elements.themeGridFull.appendChild(group);
  });
}

function createThemeCardForDrawer(theme) {
  const isStarred = starredThemes.includes(theme.id);
  const card = document.createElement("div");
  card.className = "theme-card-expanded";
  card.dataset.themeId = theme.id;
  if (theme.id === state.theme) {
    card.classList.add("selected");
  }

  const preview = document.createElement("div");
  preview.className = "theme-card-preview";

  ["bg", "road_motorway", "road_primary", "water", "parks", "road_secondary"].forEach((key) => {
    const swatch = document.createElement("span");
    swatch.style.background = theme.colors?.[key] || "#eee";
    preview.appendChild(swatch);
  });

  const header = document.createElement("div");
  header.className = "theme-card-header";

  const name = document.createElement("div");
  name.className = "theme-card-name";
  name.textContent = theme.name;

  const starBtn = document.createElement("button");
  starBtn.type = "button";
  starBtn.className = `star-btn ${isStarred ? "starred" : ""}`;
  starBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="${isStarred ? "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" : "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"}"/></svg>`;
  starBtn.title = isStarred ? "Remove from favorites" : "Add to favorites";
  starBtn.addEventListener("click", (e) => toggleStarTheme(theme.id, e));

  header.appendChild(name);
  header.appendChild(starBtn);

  const desc = document.createElement("div");
  desc.className = "theme-card-desc";
  desc.textContent = theme.description || "Custom palette";

  card.appendChild(preview);
  card.appendChild(header);
  card.appendChild(desc);

  card.addEventListener("click", (e) => {
    if (e.target.closest(".star-btn")) return;
    selectTheme(theme.id);
    closeThemeDrawer();
  });

  return card;
}

function selectTheme(themeId) {
  state.theme = themeId;

  // Update carousel cards
  document.querySelectorAll(".theme-carousel-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.themeId === themeId);
  });

  // Update drawer cards
  document.querySelectorAll(".theme-card-expanded").forEach((card) => {
    card.classList.toggle("selected", card.dataset.themeId === themeId);
  });

  updateSelectedThemeName();
  updatePreview();

  // Update pin color swatches with new theme colors
  if (state.pin && state.pin !== "none") {
    updatePinColorSwatches();
  }

  // Scroll selected into view in carousel
  const selectedCard = elements.themeCarousel?.querySelector(`.theme-carousel-card[data-theme-id="${themeId}"]`);
  if (selectedCard) {
    selectedCard.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function updateSelectedThemeName() {
  const theme = themeCatalog[state.theme];
  if (theme && elements.selectedThemeName) {
    elements.selectedThemeName.textContent = theme.name;
  }
}

function openThemeDrawer() {
  elements.themeDrawer.classList.add("open");
  elements.themeDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  elements.themeSearch.value = "";
  filterThemes("");
}

function closeThemeDrawer() {
  elements.themeDrawer.classList.remove("open");
  elements.themeDrawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function filterThemes(query) {
  const normalizedQuery = query.toLowerCase().trim();

  // Filter category groups
  const groups = elements.themeGridFull?.querySelectorAll(".theme-category-group");
  groups?.forEach((group) => {
    const cards = group.querySelectorAll(".theme-card-expanded");
    let visibleCount = 0;

    cards.forEach((card) => {
      const name = card.querySelector(".theme-card-name")?.textContent?.toLowerCase() || "";
      const desc = card.querySelector(".theme-card-desc")?.textContent?.toLowerCase() || "";
      const matches = !normalizedQuery || name.includes(normalizedQuery) || desc.includes(normalizedQuery);
      card.style.display = matches ? "" : "none";
      if (matches) visibleCount++;
    });

    // Hide entire group if no matches
    group.style.display = visibleCount > 0 ? "" : "none";
  });
}

// ===== MAP STYLE SELECTOR =====

function toggleStyleDropdown() {
  const isOpen = elements.styleDropdown.classList.contains("open");
  if (isOpen) {
    closeStyleDropdown();
  } else {
    openStyleDropdown();
  }
}

function openStyleDropdown() {
  elements.styleDropdown.classList.add("open");
  elements.styleDropdown.setAttribute("aria-hidden", "false");
}

function closeStyleDropdown() {
  elements.styleDropdown.classList.remove("open");
  elements.styleDropdown.setAttribute("aria-hidden", "true");
}

// ===== WIDGET COLLAPSE =====

function toggleWidget() {
  const isCollapsed = elements.controlsWidget.dataset.collapsed === "true";
  elements.controlsWidget.dataset.collapsed = isCollapsed ? "false" : "true";
}

// ===== GALLERY DATA =====

async function loadGallery(force = false) {
  try {
    const response = await fetch("/api/posters");
    const payload = await response.json();
    applyGalleryPayload(payload, force);
  } catch (err) {
    console.error("Failed to load gallery:", err);
  }
}

function applyGalleryPayload(payload, force = false) {
  const items = payload.items || [];
  const signature = items.map((item) => `${item.filename}:${item.mtime}`).join("|");

  if (!force && signature === lastGallerySignature) {
    return;
  }

  lastGallerySignature = signature;
  galleryItems = items;
  renderGallery(items);

  if (elements.galleryPath) {
    elements.galleryPath.textContent = payload.path || "";
  }
}

function loadConfigFromGallery(config) {
  // Load saved configuration to reuse cached map data

  // Set coordinates (critical for cache matching)
  if (config.lat != null && config.lng != null) {
    state.selectedLat = config.lat;
    state.selectedLng = config.lng;

    // Update map view
    if (leafletMap) {
      leafletMap.setView([config.lat, config.lng], 12);

      // Update circle and marker
      if (!leafletMap.hasLayer(radiusCircle)) {
        radiusCircle.addTo(leafletMap);
        centerMarker.addTo(leafletMap);
      }
      radiusCircle.setLatLng([config.lat, config.lng]);
      centerMarker.setLatLng([config.lat, config.lng]);
    }
  }

  // Set radius (critical for cache matching)
  if (config.distance) {
    state.radius = config.distance;
    if (elements.radiusSlider) {
      elements.radiusSlider.value = config.distance;
    }
    if (elements.radiusValue) {
      elements.radiusValue.textContent = `${(config.distance / 1000).toFixed(1)} km`;
    }
    if (radiusCircle) {
      radiusCircle.setRadius(config.distance);
    }
  }

  // Update aspect ratio rectangle
  updateAspectRatioRect();

  // Set poster text
  if (config.city) {
    state.posterCity = config.city;
    if (elements.posterCity) elements.posterCity.value = config.city;
  }
  if (config.country) {
    state.posterCountry = config.country;
    if (elements.posterCountry) elements.posterCountry.value = config.country;
  }
  if (config.tagline) {
    state.posterTagline = config.tagline;
    if (elements.posterTagline) elements.posterTagline.value = config.tagline;
  }

  // Set theme
  if (config.theme) {
    selectTheme(config.theme);
  }

  // Set font
  if (config.font) {
    state.font = config.font;
    if (elements.fontPickerLabel) {
      elements.fontPickerLabel.textContent = config.font || "Default";
    }
  }

  // Set format
  if (config.format) {
    state.format = config.format;
    if (elements.formatSelect) {
      elements.formatSelect.value = config.format;
    }
  }

  // Set aspect ratio
  if (config.aspect_ratio) {
    state.aspectRatio = config.aspect_ratio;
    if (elements.aspectSelect) {
      elements.aspectSelect.value = config.aspect_ratio;
    }
  }

  // Set DPI
  if (config.dpi) {
    state.dpi = config.dpi;
    if (elements.dpiSlider) {
      elements.dpiSlider.value = config.dpi;
    }
  }

  // Set pin
  if (config.pin) {
    state.pin = config.pin;
    // Update pin selector UI
    elements.pinSelector?.querySelectorAll(".pin-option").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.pin === config.pin);
    });
    // Show color selector if pin is set
    if (elements.pinColorSelector && config.pin !== "none") {
      elements.pinColorSelector.style.display = "flex";
      updatePinColorSwatches();
    }
  }

  // Set pin color
  if (config.pin_color) {
    state.pinColor = config.pin_color;
  }

  // Update coordinates display
  updateCoordsDisplay();

  // Update generate button
  updateGenerateButton();

  // Update preview
  updatePreview();

  // Show confirmation
  console.log("Settings loaded from:", config.city, config.country);
}

function renderGallery(items) {
  // Filter to only show items with thumbnails
  const itemsWithThumbs = items.filter(item => item.has_thumb && item.thumb_url);

  // Store filtered items for modal and lightbox
  window.galleryItems = itemsWithThumbs;

  // If modal is open, refresh it
  if (elements.collectionModal?.classList.contains("open")) {
    renderCollectionModalTabs();
    renderCollectionModalGrid();
  }
}

function startGalleryStream() {
  if (gallerySource) return;
  if (!("EventSource" in window)) return;

  gallerySource = new EventSource("/api/posters/stream");
  gallerySource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      applyGalleryPayload(payload);
    } catch (err) {
      loadGallery(true);
    }
  };
  gallerySource.onerror = () => {
    loadGallery(true);
  };
}

async function openFolder() {
  try {
    await fetch("/api/posters/open", { method: "POST" });
  } catch (err) {
    console.error("Failed to open folder:", err);
  }
}

// ===== LIGHTBOX =====

function openLightbox(index) {
  if (!galleryItems.length) return;

  galleryIndex = Math.max(0, Math.min(index, galleryItems.length - 1));
  const item = galleryItems[galleryIndex];
  const src = `${item.url}?t=${item.mtime}`;

  elements.lightboxImage.src = src;
  elements.lightboxCaption.textContent = item.path || item.filename;

  elements.lightbox.classList.add("open");
  elements.lightbox.setAttribute("aria-hidden", "false");

  buildLightboxStrip();
  setLightboxActive();
  preloadLightboxNeighbors();
}

function closeLightbox() {
  elements.lightbox.classList.remove("open");
  elements.lightbox.setAttribute("aria-hidden", "true");
}

function stepLightbox(direction) {
  if (!galleryItems.length) return;

  galleryIndex += direction;
  if (galleryIndex < 0) galleryIndex = galleryItems.length - 1;
  if (galleryIndex >= galleryItems.length) galleryIndex = 0;

  openLightbox(galleryIndex);
}

function buildLightboxStrip() {
  if (!elements.lightboxStrip) return;
  if (lightboxBuiltCount === galleryItems.length && elements.lightboxStrip.childNodes.length) return;

  elements.lightboxStrip.innerHTML = "";

  galleryItems.forEach((item, index) => {
    const thumb = document.createElement("button");
    thumb.className = "lightbox-thumb";
    thumb.dataset.index = index;

    const img = document.createElement("img");
    img.src = `${item.url}?t=${item.mtime}`;
    img.alt = item.filename;
    img.loading = "lazy";
    thumb.appendChild(img);

    thumb.addEventListener("click", () => openLightbox(index));
    elements.lightboxStrip.appendChild(thumb);
  });

  lightboxBuiltCount = galleryItems.length;
}

function setLightboxActive() {
  if (!elements.lightboxStrip) return;

  elements.lightboxStrip.querySelectorAll(".lightbox-thumb").forEach((thumb) => {
    const isActive = Number(thumb.dataset.index) === galleryIndex;
    thumb.classList.toggle("active", isActive);
  });

  const active = elements.lightboxStrip.querySelector(".lightbox-thumb.active");
  if (active) {
    active.scrollIntoView({ behavior: "instant", inline: "center" });
  }
}

function preloadLightboxNeighbors() {
  if (galleryItems.length < 2) return;

  const prevIndex = (galleryIndex - 1 + galleryItems.length) % galleryItems.length;
  const nextIndex = (galleryIndex + 1) % galleryItems.length;

  [prevIndex, nextIndex].forEach((idx) => {
    const item = galleryItems[idx];
    const img = new Image();
    img.src = `${item.url}?t=${item.mtime}`;
  });
}

// ===== PROGRESS & GENERATION =====

function updateStatusWidgetVisibility() {
  // Show status widget if either progress or latest section is visible
  const progressVisible = elements.progressSection?.style.display !== "none";
  const latestVisible = elements.latestSection?.style.display !== "none";
  if (elements.statusWidget) {
    elements.statusWidget.style.display = (progressVisible || latestVisible) ? "flex" : "none";
  }
}

function showLatestPoster(url) {
  if (!url) return;

  const thumbUrl = `${url}?t=${Date.now()}`;
  elements.latestPosterThumb.src = thumbUrl;
  elements.latestPosterLink.href = url;
  elements.latestLink.href = url;
  elements.latestSection.style.display = "";
  updateStatusWidgetVisibility();
}

const stopPulse = () => {
  if (pulseTimer) {
    clearInterval(pulseTimer);
    pulseTimer = null;
  }
  pulseStage = null;
};

const startPulse = (stage, basePercent) => {
  if (pulseStage === stage) return;
  stopPulse();
  pulseStage = stage;
  pulseStart = Date.now();
  lastKnownPercent = basePercent;

  const caps = { network: 34, water: 47, parks: 59 };

  pulseTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - pulseStart) / 1000);
    const cap = caps[stage] || 0;
    if (cap && lastKnownPercent < cap) {
      lastKnownPercent = Math.min(cap, lastKnownPercent + 0.3);
      elements.progressFill.style.width = `${lastKnownPercent}%`;
      elements.progressPercent.textContent = `${Math.round(lastKnownPercent)}%`;
    }
    elements.progressMessage.textContent = `Still working on ${stage} data (${elapsed}s)`;
  }, 1200);
};

function setProgress({ percent, message, stage, status, output_url, error }) {
  const bounded = Math.max(0, Math.min(100, percent || 0));

  elements.progressFill.style.width = `${bounded}%`;
  elements.progressPercent.textContent = `${Math.round(bounded)}%`;
  elements.progressMessage.textContent = message || "Working...";
  lastKnownPercent = bounded;

  const currentIndex = stageOrder.indexOf(stage || "queued");
  const totalStages = stageOrder.length;
  const stageLabel = stageLabels[stage] || stage || "Queued";

  if (elements.progressStage) {
    if (status === "done") {
      elements.progressStage.textContent = "Complete";
    } else if (currentIndex >= 0) {
      elements.progressStage.textContent = `Stage ${currentIndex + 1} of ${totalStages}: ${stageLabel}`;
    } else {
      elements.progressStage.textContent = "";
    }
  }

  if (status === "running" && ["network", "water", "parks"].includes(stage)) {
    startPulse(stage, bounded);
  } else {
    stopPulse();
  }

  if (status === "done") {
    if (output_url) {
      showLatestPoster(output_url);
    }
    if (galleryLoadedForModal) {
      loadGallery();
    }
    elements.generateBtn.disabled = false;
    elements.generateBtn.textContent = `Generate: ${state.posterCity}`;
  }

  if (status === "error") {
    stopPulse();
    elements.progressError.textContent = error || "Generation failed";
    elements.generateBtn.disabled = false;
    elements.generateBtn.textContent = `Generate: ${state.posterCity}`;
  }
}

function resetProgress() {
  elements.progressFill.style.width = "0%";
  elements.progressPercent.textContent = "0%";
  elements.progressMessage.textContent = "Starting...";
  elements.progressStage.textContent = "";
  elements.progressError.textContent = "";
  stopPulse();
}

function startStream(jobId) {
  if (activeSource) {
    activeSource.close();
  }

  activeSource = new EventSource(`/api/jobs/${jobId}/stream`);

  activeSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setProgress(data);

    if (data.status === "done" || data.status === "error" || data.status === "cancelled") {
      activeSource.close();
    }
  };

  activeSource.onerror = () => {
    activeSource.close();
  };
}

async function generatePoster() {
  if (!state.selectedLat || !state.selectedLng || !state.posterCity || !state.posterCountry) {
    return;
  }

  // Show progress section
  elements.progressSection.style.display = "";
  updateStatusWidgetVisibility();
  resetProgress();

  // Disable button
  elements.generateBtn.disabled = true;
  elements.generateBtn.textContent = "Generating...";

  const payload = {
    city: state.posterCity,
    country: state.posterCountry,
    tagline: state.posterTagline || null,
    lat: state.selectedLat,
    lng: state.selectedLng,
    distance: state.radius,
    theme: state.theme,
    format: state.format,
    aspect_ratio: state.aspectRatio,
    collection: state.collection,
    font: state.font,
    pin: state.pin !== "none" ? state.pin : null,
    pin_color: state.pin !== "none" ? state.pinColor : null,
    dpi: state.dpi,
  };

  try {
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      elements.progressError.textContent = data.error || "Unable to start job.";
      elements.generateBtn.disabled = false;
      elements.generateBtn.textContent = `Generate: ${state.posterCity}`;
      return;
    }

    const data = await response.json();
    currentJobId = data.job_id;
    setProgress({ percent: 2, message: "Job queued", stage: "queued", status: "running" });
    startStream(data.job_id);
  } catch (err) {
    elements.progressError.textContent = "Network error. Please try again.";
    elements.generateBtn.disabled = false;
    elements.generateBtn.textContent = `Generate: ${state.posterCity}`;
  }
}

// ===== EVENT LISTENERS =====

function initEventListeners() {
  // Widget toggle
  elements.widgetToggle?.addEventListener("click", toggleWidget);

  // Location search
  elements.locationSearch?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchLocation(e.target.value), 300);
  });

  elements.locationSearch?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchLocation(e.target.value);
    }
  });

  elements.searchBtn?.addEventListener("click", () => {
    searchLocation(elements.locationSearch.value);
  });

  // Close search results when clicking outside
  document.addEventListener("click", (e) => {
    if (!elements.locationSearch?.contains(e.target) && !elements.searchResults?.contains(e.target)) {
      hideSearchResults();
    }
  });

  // Sync buttons
  elements.syncCity?.addEventListener("click", syncCityFromSuggestion);
  elements.syncCountry?.addEventListener("click", syncCountryFromSuggestion);
  elements.syncTagline?.addEventListener("click", () => {
    state.posterTagline = "";
    elements.posterTagline.value = "";
    updatePreview();
  });

  // Poster text inputs
  elements.posterCity?.addEventListener("input", (e) => {
    state.posterCity = e.target.value;
    updateGenerateButton();
  });

  elements.posterCountry?.addEventListener("input", (e) => {
    state.posterCountry = e.target.value;
    updateGenerateButton();
  });

  elements.posterTagline?.addEventListener("input", (e) => {
    state.posterTagline = e.target.value;
    updatePreview();
  });

  // Sliders
  elements.radiusSlider?.addEventListener("input", (e) => updateRadius(e.target.value));
  elements.dpiSlider?.addEventListener("input", (e) => updateDpi(e.target.value));

  // Format
  elements.formatSelect?.addEventListener("change", (e) => {
    state.format = e.target.value;
  });

  // Aspect ratio
  elements.aspectSelect?.addEventListener("change", (e) => {
    state.aspectRatio = e.target.value;
    updateAspectRatioRect();
    // Reset preset to Custom when manually changing settings
    if (elements.presetSelect) elements.presetSelect.value = "";
  });

  // Presets
  elements.presetSelect?.addEventListener("change", (e) => {
    applyPreset(e.target.value);
  });
  elements.savePresetBtn?.addEventListener("click", saveCurrentAsPreset);

  // Collection
  elements.collectionSelect?.addEventListener("change", (e) => {
    state.collection = e.target.value || null;
  });
  elements.addCollectionBtn?.addEventListener("click", createCollection);

  // Collection modal
  elements.collectionModalClose?.addEventListener("click", closeCollectionModal);
  elements.addCollectionModalBtn?.addEventListener("click", async () => {
    await createCollection();
    renderCollectionModalTabs();
    renderCollectionModalGrid();
  });
  elements.collectionModal?.addEventListener("click", (e) => {
    if (e.target.classList.contains("collection-modal-backdrop")) {
      closeCollectionModal();
    }
  });

  // Queue
  elements.addQueueBtn?.addEventListener("click", addToQueue);
  elements.clearQueueBtn?.addEventListener("click", clearQueue);

  // Pin selector
  elements.pinSelector?.querySelectorAll(".pin-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.pinSelector.querySelectorAll(".pin-option").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.pin = btn.dataset.pin;

      // Show/hide color selector based on pin selection
      if (state.pin && state.pin !== "none") {
        elements.pinColorSelector.style.display = "flex";
        updatePinColorSwatches();
      } else {
        elements.pinColorSelector.style.display = "none";
        state.pinColor = null;
      }

      updatePreview();
    });
  });

  // Font picker is initialized in loadFonts()

  // Header action buttons - open in new tabs
  elements.headerFontBtn?.addEventListener("click", () => {
    window.open("/font-samples", "_blank");
  });
  elements.headerThemeBtn?.addEventListener("click", () => {
    window.open("/theme-samples", "_blank");
  });
  elements.headerGalleryBtn?.addEventListener("click", openCollectionModal);

  // Theme drawer
  elements.browseThemesBtn?.addEventListener("click", openThemeDrawer);
  elements.variationModeBtn?.addEventListener("click", toggleVariationMode);
  elements.drawerClose?.addEventListener("click", closeThemeDrawer);
  elements.themeSearch?.addEventListener("input", (e) => filterThemes(e.target.value));

  // Close theme drawer on backdrop click
  elements.themeDrawer?.addEventListener("click", (e) => {
    if (e.target === elements.themeDrawer) {
      closeThemeDrawer();
    }
  });

  // Map style selector
  elements.styleToggle?.addEventListener("click", toggleStyleDropdown);

  // Close style dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!elements.styleWidget?.contains(e.target)) {
      closeStyleDropdown();
    }
  });

  // Map style radio buttons
  document.querySelectorAll('input[name="map-style"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      setTileLayer(e.target.value);
      closeStyleDropdown();
    });
  });

  // Generate button
  elements.generateBtn?.addEventListener("click", () => {
    if (variationMode && selectedThemes.length > 0) {
      generateVariations();
    } else {
      generatePoster();
    }
  });

  // Open folder button (in collection modal)
  elements.openFolderBtn?.addEventListener("click", openFolder);

  // Lightbox
  elements.lightbox?.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-lightbox-close")) {
      closeLightbox();
    }
    if (e.target.hasAttribute("data-lightbox-prev") || e.target.closest("[data-lightbox-prev]")) {
      stepLightbox(-1);
    }
    if (e.target.hasAttribute("data-lightbox-next") || e.target.closest("[data-lightbox-next]")) {
      stepLightbox(1);
    }
  });

  // Mockup modal
  elements.mockupClose?.addEventListener("click", closeMockupModal);
  elements.mockupModal?.addEventListener("click", (e) => {
    if (e.target === elements.mockupModal) {
      closeMockupModal();
    }
  });
  elements.mockupCreateBtn?.addEventListener("click", openMockupCreator);

  // Mockup creator
  elements.mockupCreatorClose?.addEventListener("click", closeMockupCreator);
  elements.mockupCreator?.addEventListener("click", (e) => {
    if (e.target.classList.contains("mockup-creator-backdrop")) {
      closeMockupCreator();
    }
  });
  elements.mockupTemplateFile?.addEventListener("change", handleMockupFileUpload);
  elements.mockupTemplateName?.addEventListener("input", updateMockupSaveBtn);
  elements.mockupSaveBtn?.addEventListener("click", saveMockupTemplate);

  // Canvas drawing (creator)
  elements.mockupCreatorCanvas?.addEventListener("mousedown", handleMockupCanvasMouseDown);
  elements.mockupCreatorCanvas?.addEventListener("mousemove", handleMockupCanvasMouseMove);
  elements.mockupCreatorCanvas?.addEventListener("mouseup", handleMockupCanvasMouseUp);

  // Mockup preview
  elements.mockupPreviewClose?.addEventListener("click", closeMockupPreview);
  elements.mockupPreview?.addEventListener("click", (e) => {
    if (e.target.classList.contains("mockup-preview-backdrop")) {
      closeMockupPreview();
    }
  });
  elements.mockupScaleSlider?.addEventListener("input", handleMockupPreviewScale);
  elements.mockupXSlider?.addEventListener("input", handleMockupPreviewOffsetX);
  elements.mockupYSlider?.addEventListener("input", handleMockupPreviewOffsetY);
  elements.mockupPreviewReset?.addEventListener("click", resetMockupPreview);
  elements.mockupPreviewGenerate?.addEventListener("click", generateMockupFromPreview);

  // Preview canvas drag
  elements.mockupPreviewCanvas?.addEventListener("mousedown", handlePreviewCanvasMouseDown);
  elements.mockupPreviewCanvas?.addEventListener("mousemove", handlePreviewCanvasMouseMove);
  elements.mockupPreviewCanvas?.addEventListener("mouseup", handlePreviewCanvasMouseUp);
  elements.mockupPreviewCanvas?.addEventListener("mouseleave", handlePreviewCanvasMouseUp);
  elements.mockupCreatorCanvas?.addEventListener("mouseleave", handleMockupCanvasMouseUp);

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    // Escape closes overlays
    if (e.key === "Escape") {
      if (elements.mockupCreator?.classList.contains("open")) {
        closeMockupCreator();
      } else if (elements.mockupModal?.classList.contains("open")) {
        closeMockupModal();
      } else if (elements.collectionModal?.classList.contains("open")) {
        closeCollectionModal();
      } else if (elements.lightbox?.classList.contains("open")) {
        closeLightbox();
      } else if (elements.themeDrawer?.classList.contains("open")) {
        closeThemeDrawer();
      } else if (elements.styleDropdown?.classList.contains("open")) {
        closeStyleDropdown();
      }
    }

    // Lightbox navigation
    if (elements.lightbox?.classList.contains("open")) {
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    }
  });
}

// ===== MOCKUPS =====

async function loadMockups() {
  try {
    const response = await fetch("/api/mockups");
    mockupList = await response.json();
  } catch (err) {
    console.error("Failed to load mockups:", err);
    mockupList = [];
  }
}

function openMockupModal(posterItem) {
  selectedPosterForMockup = posterItem;

  if (!mockupList.length) {
    alert("No mockup templates available. Add templates to the mockups/ folder.");
    return;
  }

  renderMockupGrid();
  elements.mockupModal?.classList.add("open");
}

function closeMockupModal() {
  elements.mockupModal?.classList.remove("open");
  selectedPosterForMockup = null;
}

function renderMockupGrid() {
  if (!elements.mockupGrid) return;
  elements.mockupGrid.innerHTML = "";

  if (!mockupList.length) {
    elements.mockupGrid.innerHTML = '<div class="mockup-placeholder">No mockup templates found. Click "New Template" to create one.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  mockupList.forEach((mockup) => {
    const card = document.createElement("div");
    card.className = "mockup-card";
    card.dataset.mockupId = mockup.id;

    const img = document.createElement("img");
    img.src = mockup.thumbnail;
    img.alt = mockup.name;
    card.appendChild(img);

    const footer = document.createElement("div");
    footer.className = "mockup-card-footer";

    const name = document.createElement("div");
    name.className = "mockup-card-name";
    name.textContent = mockup.name;
    footer.appendChild(name);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "mockup-delete-btn";
    deleteBtn.type = "button";
    deleteBtn.title = "Delete template";
    deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete template "${mockup.name}"?`)) {
        await deleteMockupTemplate(mockup.id);
      }
    });
    footer.appendChild(deleteBtn);

    card.appendChild(footer);

    card.addEventListener("click", () => openMockupPreview(mockup));
    fragment.appendChild(card);
  });

  elements.mockupGrid.appendChild(fragment);
}

async function deleteMockupTemplate(mockupId) {
  try {
    const response = await fetch(`/api/mockups/${mockupId}`, { method: "DELETE" });
    if (response.ok) {
      await loadMockups();
      renderMockupGrid();
    } else {
      const err = await response.json();
      alert(err.error || "Failed to delete template");
    }
  } catch (err) {
    console.error("Failed to delete mockup template:", err);
  }
}

async function generateMockup(mockupId) {
  if (!selectedPosterForMockup) return;

  const card = elements.mockupGrid?.querySelector(`[data-mockup-id="${mockupId}"]`);
  if (card) card.classList.add("loading");

  try {
    const response = await fetch("/api/mockups/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poster: selectedPosterForMockup.filename,
        mockup_id: mockupId,
      }),
    });

    const result = await response.json();

    if (result.ok) {
      closeMockupModal();
      // Refresh gallery to show the new mockup
      loadGallery(true);
      // Open the generated mockup in a new tab
      window.open(result.url, "_blank");
    } else {
      alert(`Mockup generation failed: ${result.error}`);
    }
  } catch (err) {
    console.error("Mockup generation failed:", err);
    alert("Failed to generate mockup. Please try again.");
  } finally {
    if (card) card.classList.remove("loading");
  }
}

// ===== MOCKUP PREVIEW =====

async function openMockupPreview(mockup) {
  if (!selectedPosterForMockup) return;

  mockupPreviewTemplate = mockup;
  mockupPreviewPoster = selectedPosterForMockup;
  mockupPreviewScale = 1.0;
  mockupPreviewOffsetX = 0;
  mockupPreviewOffsetY = 0;

  // Reset sliders
  if (elements.mockupScaleSlider) {
    elements.mockupScaleSlider.value = 1;
    elements.mockupScaleValue.textContent = "100%";
  }
  if (elements.mockupXSlider) {
    elements.mockupXSlider.value = 0;
    elements.mockupXValue.textContent = "0px";
  }
  if (elements.mockupYSlider) {
    elements.mockupYSlider.value = 0;
    elements.mockupYValue.textContent = "0px";
  }

  // Close mockup modal and show preview
  closeMockupModal();
  elements.mockupPreview?.classList.add("open");

  // Load images
  try {
    console.log("Mockup object:", mockup);
    console.log("Poster object:", mockupPreviewPoster);

    const templateUrl = mockup?.thumbnail;
    const posterUrl = mockupPreviewPoster?.url;

    console.log("Template URL:", templateUrl);
    console.log("Poster URL:", posterUrl);

    if (!templateUrl) {
      throw new Error("Mockup template URL is missing");
    }
    if (!posterUrl) {
      throw new Error("Poster URL is missing");
    }

    // Load template image
    let templateImg;
    try {
      templateImg = await loadImage(templateUrl);
      console.log("Template loaded successfully");
    } catch (e) {
      console.error("Failed to load template image:", templateUrl, e);
      throw new Error("Failed to load mockup template image");
    }

    // Load poster image
    let posterImg;
    try {
      posterImg = await loadImage(posterUrl);
      console.log("Poster loaded successfully");
    } catch (e) {
      console.error("Failed to load poster image:", posterUrl, e);
      throw new Error("Failed to load poster image");
    }

    mockupPreviewTemplateImg = templateImg;
    mockupPreviewPosterImg = posterImg;

    renderMockupPreview();
  } catch (err) {
    console.error("Failed to load images for preview:", err);
    alert(err.message || "Failed to load images. Please try again.");
    closeMockupPreview();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => {
      console.error("Failed to load image:", src, e);
      reject(e);
    };
    img.src = src;
  });
}

function closeMockupPreview() {
  elements.mockupPreview?.classList.remove("open");
  mockupPreviewTemplateImg = null;
  mockupPreviewPosterImg = null;
  mockupPreviewTemplate = null;
  mockupPreviewPoster = null;
}

function resetMockupPreview() {
  mockupPreviewScale = 1.0;
  mockupPreviewOffsetX = 0;
  mockupPreviewOffsetY = 0;

  if (elements.mockupScaleSlider) {
    elements.mockupScaleSlider.value = 1;
    elements.mockupScaleValue.textContent = "100%";
  }
  if (elements.mockupXSlider) {
    elements.mockupXSlider.value = 0;
    elements.mockupXValue.textContent = "0px";
  }
  if (elements.mockupYSlider) {
    elements.mockupYSlider.value = 0;
    elements.mockupYValue.textContent = "0px";
  }

  renderMockupPreview();
}

function renderMockupPreview() {
  const canvas = elements.mockupPreviewCanvas;
  if (!canvas || !mockupPreviewTemplateImg || !mockupPreviewPosterImg) return;

  const ctx = canvas.getContext("2d");
  const template = mockupPreviewTemplateImg;
  const poster = mockupPreviewPosterImg;
  const rect = mockupPreviewTemplate?.poster_rect || {};

  // Set canvas size to template size (scaled for display)
  const maxWidth = 900;
  const maxHeight = 700;
  const displayScale = Math.min(maxWidth / template.width, maxHeight / template.height, 1);

  canvas.width = template.width * displayScale;
  canvas.height = template.height * displayScale;
  canvas.dataset.displayScale = displayScale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw template first (background)
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  // Calculate poster dimensions preserving aspect ratio
  const posterAspect = poster.width / poster.height;
  const baseX = (rect.x || 0) * displayScale;
  const baseY = (rect.y || 0) * displayScale;

  let posterWidth, posterHeight;
  if (rect.width && rect.height) {
    posterWidth = rect.width * displayScale;
    posterHeight = rect.height * displayScale;
  } else if (rect.width) {
    posterWidth = rect.width * displayScale;
    posterHeight = posterWidth / posterAspect;
  } else if (rect.height) {
    posterHeight = rect.height * displayScale;
    posterWidth = posterHeight * posterAspect;
  } else {
    posterWidth = poster.width * displayScale * 0.3;
    posterHeight = posterWidth / posterAspect;
  }

  // Apply user scale and offset
  const scaledWidth = posterWidth * mockupPreviewScale;
  const scaledHeight = posterHeight * mockupPreviewScale;
  const finalX = baseX + (mockupPreviewOffsetX * displayScale);
  const finalY = baseY + (mockupPreviewOffsetY * displayScale);

  // Draw poster on top of template
  ctx.drawImage(poster, finalX, finalY, scaledWidth, scaledHeight);
}

function handleMockupPreviewScale(e) {
  mockupPreviewScale = parseFloat(e.target.value);
  if (elements.mockupScaleValue) {
    elements.mockupScaleValue.textContent = Math.round(mockupPreviewScale * 100) + "%";
  }
  renderMockupPreview();
}

function handleMockupPreviewOffsetX(e) {
  mockupPreviewOffsetX = parseInt(e.target.value, 10);
  if (elements.mockupXValue) {
    elements.mockupXValue.textContent = mockupPreviewOffsetX + "px";
  }
  renderMockupPreview();
}

function handleMockupPreviewOffsetY(e) {
  mockupPreviewOffsetY = parseInt(e.target.value, 10);
  if (elements.mockupYValue) {
    elements.mockupYValue.textContent = mockupPreviewOffsetY + "px";
  }
  renderMockupPreview();
}

// Drag to reposition poster
function handlePreviewCanvasMouseDown(e) {
  mockupPreviewDragging = true;
  mockupPreviewDragStartX = e.clientX;
  mockupPreviewDragStartY = e.clientY;
  e.target.style.cursor = "grabbing";
}

function handlePreviewCanvasMouseMove(e) {
  if (!mockupPreviewDragging) return;

  const displayScale = parseFloat(elements.mockupPreviewCanvas?.dataset.displayScale) || 1;
  const dx = (e.clientX - mockupPreviewDragStartX) / displayScale;
  const dy = (e.clientY - mockupPreviewDragStartY) / displayScale;

  mockupPreviewOffsetX += dx;
  mockupPreviewOffsetY += dy;

  // Update sliders
  if (elements.mockupXSlider) {
    elements.mockupXSlider.value = Math.max(-500, Math.min(500, mockupPreviewOffsetX));
    elements.mockupXValue.textContent = Math.round(mockupPreviewOffsetX) + "px";
  }
  if (elements.mockupYSlider) {
    elements.mockupYSlider.value = Math.max(-500, Math.min(500, mockupPreviewOffsetY));
    elements.mockupYValue.textContent = Math.round(mockupPreviewOffsetY) + "px";
  }

  mockupPreviewDragStartX = e.clientX;
  mockupPreviewDragStartY = e.clientY;

  renderMockupPreview();
}

function handlePreviewCanvasMouseUp() {
  mockupPreviewDragging = false;
  if (elements.mockupPreviewCanvas) {
    elements.mockupPreviewCanvas.style.cursor = "grab";
  }
}

async function generateMockupFromPreview() {
  if (!mockupPreviewTemplate || !mockupPreviewPoster) return;

  const btn = elements.mockupPreviewGenerate;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Generating...";
  }

  try {
    const response = await fetch("/api/mockups/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poster: mockupPreviewPoster.filename,
        mockup_id: mockupPreviewTemplate.id,
        scale: mockupPreviewScale,
        offset_x: mockupPreviewOffsetX,
        offset_y: mockupPreviewOffsetY,
      }),
    });

    const result = await response.json();

    if (result.ok) {
      closeMockupPreview();
      loadGallery(true);
      window.open(result.url, "_blank");
    } else {
      alert(`Mockup generation failed: ${result.error}`);
    }
  } catch (err) {
    console.error("Mockup generation failed:", err);
    alert("Failed to generate mockup. Please try again.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Generate Mockup";
    }
  }
}

// ===== MOCKUP TEMPLATE CREATOR =====

function openMockupCreator() {
  closeMockupModal();
  closeCollectionModal();
  resetMockupCreator();
  elements.mockupCreator?.classList.add("open");
}

function closeMockupCreator() {
  elements.mockupCreator?.classList.remove("open");
  resetMockupCreator();
}

function resetMockupCreator() {
  mockupCreatorImage = null;
  mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
  mockupCreatorDrawing = false;

  if (elements.mockupTemplateName) elements.mockupTemplateName.value = "";
  if (elements.mockupTemplateFile) elements.mockupTemplateFile.value = "";
  if (elements.mockupSaveBtn) elements.mockupSaveBtn.disabled = true;

  if (elements.mockupCreatorCanvas) {
    elements.mockupCreatorCanvas.style.display = "none";
    const ctx = elements.mockupCreatorCanvas.getContext("2d");
    ctx.clearRect(0, 0, elements.mockupCreatorCanvas.width, elements.mockupCreatorCanvas.height);
  }
  if (elements.mockupCanvasPlaceholder) {
    elements.mockupCanvasPlaceholder.style.display = "flex";
  }

  updateMockupRectDisplay();
}

function handleMockupFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      mockupCreatorImage = img;
      setupMockupCanvas();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function setupMockupCanvas() {
  if (!mockupCreatorImage || !elements.mockupCreatorCanvas) return;

  const canvas = elements.mockupCreatorCanvas;
  const container = canvas.parentElement;

  // Calculate scale to fit in container while maintaining aspect ratio
  const maxWidth = container.clientWidth - 40;
  const maxHeight = 500;
  const scale = Math.min(maxWidth / mockupCreatorImage.width, maxHeight / mockupCreatorImage.height, 1);

  canvas.width = mockupCreatorImage.width * scale;
  canvas.height = mockupCreatorImage.height * scale;

  // Store scale factor for coordinate conversion
  canvas.dataset.scale = scale;

  // Show canvas, hide placeholder
  canvas.style.display = "block";
  if (elements.mockupCanvasPlaceholder) {
    elements.mockupCanvasPlaceholder.style.display = "none";
  }

  drawMockupCanvas();
  updateMockupSaveBtn();
}

function drawMockupCanvas() {
  if (!mockupCreatorImage || !elements.mockupCreatorCanvas) return;

  const canvas = elements.mockupCreatorCanvas;
  const ctx = canvas.getContext("2d");
  const scale = parseFloat(canvas.dataset.scale) || 1;

  // Clear and draw image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mockupCreatorImage, 0, 0, canvas.width, canvas.height);

  // Draw rectangle overlay
  if (mockupCreatorRect.width > 0 && mockupCreatorRect.height > 0) {
    const x = mockupCreatorRect.x * scale;
    const y = mockupCreatorRect.y * scale;
    const w = mockupCreatorRect.width * scale;
    const h = mockupCreatorRect.height * scale;

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(102, 126, 234, 0.3)";
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = "#667eea";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "#667eea";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Poster Area", x + 8, y + 20);
  }
}

function handleMockupCanvasMouseDown(e) {
  if (!mockupCreatorImage) return;

  const canvas = elements.mockupCreatorCanvas;
  const rect = canvas.getBoundingClientRect();
  const scale = parseFloat(canvas.dataset.scale) || 1;

  mockupCreatorStartX = (e.clientX - rect.left) / scale;
  mockupCreatorStartY = (e.clientY - rect.top) / scale;
  mockupCreatorDrawing = true;

  // Reset rect
  mockupCreatorRect = { x: mockupCreatorStartX, y: mockupCreatorStartY, width: 0, height: 0 };
}

function handleMockupCanvasMouseMove(e) {
  if (!mockupCreatorDrawing || !mockupCreatorImage) return;

  const canvas = elements.mockupCreatorCanvas;
  const rect = canvas.getBoundingClientRect();
  const scale = parseFloat(canvas.dataset.scale) || 1;

  const currentX = (e.clientX - rect.left) / scale;
  const currentY = (e.clientY - rect.top) / scale;

  // Calculate rect (handle negative dimensions)
  const x = Math.min(mockupCreatorStartX, currentX);
  const y = Math.min(mockupCreatorStartY, currentY);
  const w = Math.abs(currentX - mockupCreatorStartX);
  const h = Math.abs(currentY - mockupCreatorStartY);

  mockupCreatorRect = { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };

  drawMockupCanvas();
  updateMockupRectDisplay();
}

function handleMockupCanvasMouseUp() {
  mockupCreatorDrawing = false;
  updateMockupSaveBtn();
}

function updateMockupRectDisplay() {
  if (elements.rectX) elements.rectX.textContent = mockupCreatorRect.x || 0;
  if (elements.rectY) elements.rectY.textContent = mockupCreatorRect.y || 0;
  if (elements.rectW) elements.rectW.textContent = mockupCreatorRect.width || 0;
  if (elements.rectH) elements.rectH.textContent = mockupCreatorRect.height || 0;
}

function updateMockupSaveBtn() {
  if (!elements.mockupSaveBtn) return;

  const hasName = elements.mockupTemplateName?.value.trim();
  const hasImage = mockupCreatorImage !== null;
  const hasRect = mockupCreatorRect.width > 0 && mockupCreatorRect.height > 0;

  elements.mockupSaveBtn.disabled = !(hasName && hasImage && hasRect);
}

async function saveMockupTemplate() {
  const name = elements.mockupTemplateName?.value.trim();
  const file = elements.mockupTemplateFile?.files[0];

  if (!name || !file || mockupCreatorRect.width <= 0) {
    alert("Please provide a name, upload an image, and draw the poster area.");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("image", file);
  formData.append("rect", JSON.stringify({
    poster_rect: mockupCreatorRect,
    output_size: mockupCreatorImage ? [mockupCreatorImage.width, mockupCreatorImage.height] : null,
  }));

  elements.mockupSaveBtn.disabled = true;
  elements.mockupSaveBtn.textContent = "Saving...";

  try {
    const response = await fetch("/api/mockups", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.ok) {
      closeMockupCreator();
      await loadMockups();
      alert(`Template "${name}" created successfully!`);
    } else {
      alert(result.error || "Failed to save template");
    }
  } catch (err) {
    console.error("Failed to save mockup template:", err);
    alert("Failed to save template. Please try again.");
  } finally {
    if (elements.mockupSaveBtn) {
      elements.mockupSaveBtn.disabled = false;
      elements.mockupSaveBtn.textContent = "Save Template";
    }
  }
}

// ===== INITIALIZE =====
document.addEventListener("DOMContentLoaded", initApp);
