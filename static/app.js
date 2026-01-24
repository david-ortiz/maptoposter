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
let themePickerViewMode = "collection";  // "category" or "collection"
let currentCollectionFilter = null;      // Collection ID for carousel filtering

// ===== FONT LIST =====
let fontList = [];

// ===== STARRED ITEMS =====
let starredFonts = [];
let starredThemes = [];

// ===== THEME COLLECTIONS =====
let themeCollectionList = [];  // Array of {id, name, color, created_at}
let themeCollectionItems = {}; // Map of collectionId -> [themeIds]
let drawerCollectionFilter = null;  // Current collection filter in theme drawer

// ===== FONT COLLECTIONS =====
let fontCollectionList = [];  // Array of {id, name, color, created_at}
let fontCollectionItems = {}; // Map of collectionId -> [fontNames]
let fontDrawerCollectionFilter = null;  // Current collection filter in font drawer
let currentFontCollectionFilter = null;  // Collection filter for main picker

// ===== MOCKUP COLLECTIONS =====
let mockupCollectionList = [];  // Array of {id, name, color, created_at}
let mockupCollectionItems = {}; // Map of collectionId -> [mockupIds]
let mockupStudioCollectionFilter = null;  // Current collection filter in mockup studio
let mockupModalCollectionFilter = null;   // Current collection filter in mockup modal

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
let libraryItems = [];  // Pre-set visual elements from library folder
let selectedPosterForMockup = null;

// Mockup Creator State
let mockupCreatorImage = null;
let mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
let mockupCreatorClickState = 0;  // 0 = no clicks, 1 = first corner set, 2 = complete
let mockupCreatorCorner1 = { x: 0, y: 0 };
let mockupCreatorCorner2 = { x: 0, y: 0 };
let mockupCreatorZoom = 1.0;  // Zoom level (1.0 = fit to container)
let mockupCreatorSelectedFormat = null;  // Selected format ratio (e.g., "2:3", "A4")
let mockupCreatorFormatScale = 30;  // Scale percentage for placed format
let mockupCreatorFormatDragging = false;  // Whether dragging a placed format
let mockupCreatorDragStart = { x: 0, y: 0 };  // Drag start position
let mockupCreatorDragMoved = false;  // Whether a drag actually moved (to distinguish from click)
let mockupCreatorEditingId = null;  // ID of mockup being edited (null = creating new)
let mockupCreatorFromStudio = false;  // Whether opened from mockup studio (for back navigation)

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
let mockupPreviewZoom = 1.0;  // Zoom level for preview canvas

// Mockup Labels State
let mockupLabels = [];  // Array of { id, text, x, y, font, size, color, shadow }
let mockupLabelIdCounter = 0;
let mockupSelectedLayer = "poster";  // "poster" or label id number or "asset-N"
let mockupLabelDragging = false;
let mockupLabelDragStartX = 0;
let mockupLabelDragStartY = 0;
let mockupDragTarget = null;  // Stores the actual element being dragged (label or asset)

// Mockup Assets State
let mockupAssets = [];  // Array of { id, src, filename, x, y, width, opacity, image }
let mockupAssetIdCounter = 0;
let mockupAssetDragging = false;

// Mockup Guides State
let mockupGuides = [];  // Array of { id, type: 'h'|'v', position: 0-100 }
let mockupGuideIdCounter = 0;
const SNAP_THRESHOLD = 8;  // Pixels to snap within

// Mockup Editor Undo/Redo History
let mockupEditorHistory = [];  // Stack of state snapshots
let mockupEditorRedoStack = [];  // Stack for redo
const MOCKUP_HISTORY_LIMIT = 50;  // Max history entries

// Mockup Studio State
let mockupStudioSelectedTemplate = null;

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

  // Location search (floating)
  locationSearchFloat: document.getElementById("location-search-float-input"),
  searchResultsFloat: document.getElementById("search-results-float"),

  // Recent generations
  recentToggle: document.getElementById("recent-toggle"),
  recentPanel: document.getElementById("recent-generations"),
  recentClose: document.getElementById("recent-close"),
  recentGrid: document.getElementById("recent-grid"),

  // City bookmarks
  bookmarksToggle: document.getElementById("bookmarks-toggle"),
  bookmarksPanel: document.getElementById("city-bookmarks-panel"),
  bookmarksClose: document.getElementById("bookmarks-close"),
  bookmarksSearch: document.getElementById("bookmarks-search"),
  bookmarksContent: document.getElementById("bookmarks-content"),

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
  fontSamplesBtn: document.getElementById("font-samples-btn"),
  themeSamplesBtn: document.getElementById("theme-samples-btn"),
  headerGalleryBtn: document.getElementById("header-gallery-btn"),

  // Theme elements
  themeViewToggle: document.getElementById("theme-view-toggle"),
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
  // Gallery multi-select
  galleryMultiselectBtn: document.getElementById("gallery-multiselect-btn"),
  galleryBulkActions: document.getElementById("gallery-bulk-actions"),
  gallerySelectAllBtn: document.getElementById("gallery-select-all-btn"),
  bulkSelectionCount: document.getElementById("bulk-selection-count"),
  bulkCreateCompositeBtn: document.getElementById("bulk-create-composite-btn"),
  bulkDeleteBtn: document.getElementById("bulk-delete-btn"),
  galleryCancelSelectBtn: document.getElementById("gallery-cancel-select-btn"),

  // Floating elements
  bottomBarFloat: document.getElementById("bottom-bar-float"),
  coordsWidget: document.getElementById("coords-widget"),

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
  lightboxDownload: document.getElementById("lightbox-download"),

  // Mockup
  mockupModal: document.getElementById("mockup-modal"),
  mockupGrid: document.getElementById("mockup-grid"),
  mockupClose: document.getElementById("mockup-close"),
  mockupCreateBtn: document.getElementById("mockup-create-btn"),

  // Mockup Creator
  mockupCreator: document.getElementById("mockup-creator"),
  mockupCreatorClose: document.getElementById("mockup-creator-close"),
  mockupCreatorBack: document.getElementById("mockup-creator-back"),
  mockupTemplateName: document.getElementById("mockup-template-name"),
  mockupTemplateFile: document.getElementById("mockup-template-file"),
  mockupCreatorCanvas: document.getElementById("mockup-creator-canvas"),
  mockupCanvasPlaceholder: document.getElementById("mockup-canvas-placeholder"),
  mockupSaveBtn: document.getElementById("mockup-save-btn"),
  rectX: document.getElementById("rect-x"),
  rectY: document.getElementById("rect-y"),
  rectW: document.getElementById("rect-w"),
  rectH: document.getElementById("rect-h"),
  // Creator zoom controls
  creatorZoomIn: document.getElementById("creator-zoom-in"),
  creatorZoomOut: document.getElementById("creator-zoom-out"),
  creatorZoomFit: document.getElementById("creator-zoom-fit"),
  creatorZoomLevel: document.getElementById("creator-zoom-level"),
  // Format selector
  formatSelectorGrid: document.getElementById("format-selector-grid"),
  formatScaleSlider: document.getElementById("format-scale-slider"),
  formatScaleValue: document.getElementById("format-scale-value"),
  formatScaleUp: document.getElementById("format-scale-up"),
  formatScaleDown: document.getElementById("format-scale-down"),
  formatPlaceBtn: document.getElementById("format-place-btn"),
  formatClearBtn: document.getElementById("format-clear-btn"),

  // Mockup Preview
  mockupPreview: document.getElementById("mockup-preview"),
  mockupPreviewClose: document.getElementById("mockup-preview-close"),
  mockupPreviewBack: document.getElementById("mockup-preview-back"),
  mockupPreviewCanvas: document.getElementById("mockup-preview-canvas"),
  mockupScaleSlider: document.getElementById("mockup-scale-slider"),
  mockupScaleValue: document.getElementById("mockup-scale-value"),
  // Preview zoom controls
  previewZoomIn: document.getElementById("preview-zoom-in"),
  previewZoomOut: document.getElementById("preview-zoom-out"),
  previewZoomFit: document.getElementById("preview-zoom-fit"),
  previewZoomLevel: document.getElementById("preview-zoom-level"),
  mockupXSlider: document.getElementById("mockup-x-slider"),
  mockupXValue: document.getElementById("mockup-x-value"),
  mockupYSlider: document.getElementById("mockup-y-slider"),
  mockupYValue: document.getElementById("mockup-y-value"),
  mockupPreviewReset: document.getElementById("mockup-preview-reset"),
  mockupPreviewGenerate: document.getElementById("mockup-preview-generate"),

  // Mockup Labels
  mockupLabelFont: document.getElementById("mockup-label-font"),
  mockupLabelSize: document.getElementById("mockup-label-size"),
  mockupLabelColor: document.getElementById("mockup-label-color"),
  mockupLabelShadow: document.getElementById("mockup-label-shadow"),
  mockupColorSwatches: document.getElementById("mockup-color-swatches"),
  addThemeLabel: document.getElementById("add-theme-label"),
  addFontLabel: document.getElementById("add-font-label"),
  addAspectLabel: document.getElementById("add-aspect-label"),
  addCustomLabel: document.getElementById("add-custom-label"),
  addAssetLayer: document.getElementById("add-asset-layer"),
  assetFileInput: document.getElementById("asset-file-input"),
  mockupLabelsList: document.getElementById("mockup-labels-list"),
  // Asset controls
  mockupAssetControls: document.getElementById("mockup-asset-controls"),
  assetWidthSlider: document.getElementById("asset-width-slider"),
  assetWidthValue: document.getElementById("asset-width-value"),
  assetOpacitySlider: document.getElementById("asset-opacity-slider"),
  assetOpacityValue: document.getElementById("asset-opacity-value"),

  // Mockup Guides
  addHGuide: document.getElementById("add-h-guide"),
  addVGuide: document.getElementById("add-v-guide"),
  clearGuides: document.getElementById("clear-guides"),
  mockupGuidesList: document.getElementById("mockup-guides-list"),
  mockupSnapEnabled: document.getElementById("mockup-snap-enabled"),

  // Mockup Studio
  mockupStudio: document.getElementById("mockup-studio"),
  mockupStudioClose: document.getElementById("mockup-studio-close"),
  mockupStudioBreadcrumb: document.getElementById("mockup-studio-breadcrumb"),
  mockupStudioTemplates: document.getElementById("mockup-studio-templates"),
  mockupStudioPosters: document.getElementById("mockup-studio-posters"),
  mockupStudioTemplateGrid: document.getElementById("mockup-studio-template-grid"),
  mockupStudioPosterGrid: document.getElementById("mockup-studio-poster-grid"),
  mockupStudioSelectedTemplate: document.getElementById("mockup-studio-selected-template"),
  mockupStudioAddTemplate: document.getElementById("mockup-studio-add-template"),
  mockupStudioBack: document.getElementById("mockup-studio-back"),
  mockupStudioCollectionFilter: document.getElementById("mockup-studio-collection-filter"),
  headerMockupBtn: document.getElementById("header-mockup-btn"),

  // Mockup Output Gallery
  mockupGallery: document.getElementById("mockup-gallery"),
  mockupGalleryClose: document.getElementById("mockup-gallery-close"),
  mockupGalleryGrid: document.getElementById("mockup-gallery-grid"),
  mockupGalleryEmpty: document.getElementById("mockup-gallery-empty"),
  mockupGalleryOpenFolder: document.getElementById("mockup-gallery-open-folder"),
  headerMockupGalleryBtn: document.getElementById("header-mockup-gallery-btn"),
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
  await loadThemeCollections();
  await loadFontCollections();
  await loadMockupCollections();
  loadThemes();
  loadFonts();
  await loadPresets();
  await loadCollections();
  await loadMockups();
  await loadLibrary();
  await loadGallery();
  startGalleryStream();
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

// ===== THEME COLLECTIONS =====
async function loadThemeCollections() {
  try {
    const response = await fetch("/api/theme-collections");
    const data = await response.json();
    themeCollectionList = data.collections || [];
    themeCollectionItems = data.items || {};
  } catch (err) {
    console.error("Failed to load theme collections:", err);
    themeCollectionList = [];
    themeCollectionItems = {};
  }
}

async function loadFontCollections() {
  try {
    const response = await fetch("/api/font-collections");
    const data = await response.json();
    fontCollectionList = data.collections || [];
    fontCollectionItems = data.items || {};
  } catch (err) {
    console.error("Failed to load font collections:", err);
    fontCollectionList = [];
    fontCollectionItems = {};
  }
}

async function loadMockupCollections() {
  try {
    const response = await fetch("/api/mockup-collections");
    const data = await response.json();
    mockupCollectionList = data.collections || [];
    mockupCollectionItems = data.items || {};
  } catch (err) {
    console.error("Failed to load mockup collections:", err);
    mockupCollectionList = [];
    mockupCollectionItems = {};
  }
}

async function createThemeCollection() {
  const name = prompt("Enter collection name:");
  if (!name || !name.trim()) return;

  try {
    const response = await fetch("/api/theme-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (response.ok) {
      const newCollection = await response.json();
      themeCollectionList.push(newCollection);
      themeCollectionItems[newCollection.id] = [];
      renderThemeCollectionTabs();
      renderThemeDrawer(themeList);
    }
  } catch (err) {
    console.error("Failed to create theme collection:", err);
  }
}

async function renameThemeCollection(collId) {
  const coll = themeCollectionList.find(c => c.id === collId);
  if (!coll) return;

  const newName = prompt("Enter new name:", coll.name);
  if (!newName || !newName.trim() || newName.trim() === coll.name) return;

  try {
    const response = await fetch(`/api/theme-collections/${collId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (response.ok) {
      coll.name = newName.trim();
      renderThemeCollectionTabs();
    }
  } catch (err) {
    console.error("Failed to rename theme collection:", err);
  }
}

async function deleteThemeCollection(collId) {
  if (!confirm("Delete this collection? Themes will not be deleted.")) return;

  try {
    const response = await fetch(`/api/theme-collections/${collId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      themeCollectionList = themeCollectionList.filter(c => c.id !== collId);
      delete themeCollectionItems[collId];
      if (drawerCollectionFilter === collId) {
        drawerCollectionFilter = null;
      }
      renderThemeCollectionTabs();
      renderThemeDrawer(themeList);
    }
  } catch (err) {
    console.error("Failed to delete theme collection:", err);
  }
}

async function addThemeToCollection(themeId, collId) {
  try {
    await fetch(`/api/theme-collections/${collId}/themes/${encodeURIComponent(themeId)}`, {
      method: "POST",
    });

    if (!themeCollectionItems[collId]) {
      themeCollectionItems[collId] = [];
    }
    if (!themeCollectionItems[collId].includes(themeId)) {
      themeCollectionItems[collId].push(themeId);
    }
    renderThemeCollectionTabs();
    renderThemeDrawer(themeList);
  } catch (err) {
    console.error("Failed to add theme to collection:", err);
  }
}

async function removeThemeFromCollection(themeId, collId) {
  try {
    await fetch(`/api/theme-collections/${collId}/themes/${encodeURIComponent(themeId)}`, {
      method: "DELETE",
    });

    if (themeCollectionItems[collId]) {
      themeCollectionItems[collId] = themeCollectionItems[collId].filter(id => id !== themeId);
    }
    renderThemeCollectionTabs();
    renderThemeDrawer(themeList);
  } catch (err) {
    console.error("Failed to remove theme from collection:", err);
  }
}

function getThemeCollections(themeId) {
  const collections = [];
  for (const [collId, themes] of Object.entries(themeCollectionItems)) {
    if (themes.includes(themeId)) {
      collections.push(collId);
    }
  }
  return collections;
}

function filterThemesByCollection(collId) {
  drawerCollectionFilter = collId;
  renderThemeCollectionTabs();
  renderThemeDrawer(themeList);
}

// ===== FONT COLLECTIONS =====
async function createFontCollection() {
  const name = prompt("Enter collection name:");
  if (!name || !name.trim()) return;

  try {
    const response = await fetch("/api/font-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (response.ok) {
      const newCollection = await response.json();
      fontCollectionList.push(newCollection);
      fontCollectionItems[newCollection.id] = [];
      renderFontCollectionTabs();
      renderFontDrawer();
      updateFontCollectionFilter();
    }
  } catch (err) {
    console.error("Failed to create font collection:", err);
  }
}

async function renameFontCollection(collId) {
  const coll = fontCollectionList.find(c => c.id === collId);
  if (!coll) return;

  const newName = prompt("Enter new name:", coll.name);
  if (!newName || !newName.trim() || newName.trim() === coll.name) return;

  try {
    const response = await fetch(`/api/font-collections/${collId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (response.ok) {
      coll.name = newName.trim();
      renderFontCollectionTabs();
      updateFontCollectionFilter();
    }
  } catch (err) {
    console.error("Failed to rename font collection:", err);
  }
}

async function deleteFontCollection(collId) {
  if (!confirm("Delete this collection? Fonts will not be deleted.")) return;

  try {
    const response = await fetch(`/api/font-collections/${collId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      fontCollectionList = fontCollectionList.filter(c => c.id !== collId);
      delete fontCollectionItems[collId];
      if (fontDrawerCollectionFilter === collId) {
        fontDrawerCollectionFilter = null;
      }
      if (currentFontCollectionFilter === collId) {
        currentFontCollectionFilter = null;
      }
      renderFontCollectionTabs();
      renderFontDrawer();
      updateFontCollectionFilter();
      renderFontSelector(fontList);
    }
  } catch (err) {
    console.error("Failed to delete font collection:", err);
  }
}

async function addFontToCollection(fontName, collId) {
  try {
    await fetch(`/api/font-collections/${collId}/fonts/${encodeURIComponent(fontName)}`, {
      method: "POST",
    });

    if (!fontCollectionItems[collId]) {
      fontCollectionItems[collId] = [];
    }
    if (!fontCollectionItems[collId].includes(fontName)) {
      fontCollectionItems[collId].push(fontName);
    }
    renderFontCollectionTabs();
    renderFontDrawer();
  } catch (err) {
    console.error("Failed to add font to collection:", err);
  }
}

async function removeFontFromCollection(fontName, collId) {
  try {
    await fetch(`/api/font-collections/${collId}/fonts/${encodeURIComponent(fontName)}`, {
      method: "DELETE",
    });

    if (fontCollectionItems[collId]) {
      fontCollectionItems[collId] = fontCollectionItems[collId].filter(f => f !== fontName);
    }
    renderFontCollectionTabs();
    renderFontDrawer();
  } catch (err) {
    console.error("Failed to remove font from collection:", err);
  }
}

function getFontCollections(fontName) {
  const collections = [];
  for (const [collId, fonts] of Object.entries(fontCollectionItems)) {
    if (fonts.includes(fontName)) {
      collections.push(collId);
    }
  }
  return collections;
}

function filterFontsByCollection(collId) {
  fontDrawerCollectionFilter = collId;
  renderFontCollectionTabs();
  renderFontDrawer();
}

// ===== MOCKUP COLLECTIONS =====
async function createMockupCollection() {
  const name = prompt("Enter collection name:");
  if (!name || !name.trim()) return null;

  try {
    const response = await fetch("/api/mockup-collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (response.ok) {
      const newCollection = await response.json();
      mockupCollectionList.push(newCollection);
      mockupCollectionItems[newCollection.id] = [];
      renderMockupStudioCollectionTabs();
      renderMockupStudioTemplates();
      return newCollection;
    }
  } catch (err) {
    console.error("Failed to create mockup collection:", err);
  }
  return null;
}

async function renameMockupCollection(collId) {
  const coll = mockupCollectionList.find(c => c.id === collId);
  if (!coll) return;

  const newName = prompt("Enter new name:", coll.name);
  if (!newName || !newName.trim() || newName.trim() === coll.name) return;

  try {
    const response = await fetch(`/api/mockup-collections/${collId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (response.ok) {
      coll.name = newName.trim();
      renderMockupStudioCollectionTabs();
    }
  } catch (err) {
    console.error("Failed to rename mockup collection:", err);
  }
}

async function deleteMockupCollection(collId) {
  if (!confirm("Delete this collection? Mockup templates will not be deleted.")) return;

  try {
    const response = await fetch(`/api/mockup-collections/${collId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      mockupCollectionList = mockupCollectionList.filter(c => c.id !== collId);
      delete mockupCollectionItems[collId];
      if (mockupStudioCollectionFilter === collId) {
        mockupStudioCollectionFilter = null;
      }
      renderMockupStudioCollectionTabs();
      renderMockupStudioTemplates();
    }
  } catch (err) {
    console.error("Failed to delete mockup collection:", err);
  }
}

async function addMockupToCollection(mockupId, collId) {
  try {
    await fetch(`/api/mockup-collections/${collId}/mockups/${encodeURIComponent(mockupId)}`, {
      method: "POST",
    });

    if (!mockupCollectionItems[collId]) {
      mockupCollectionItems[collId] = [];
    }
    if (!mockupCollectionItems[collId].includes(mockupId)) {
      mockupCollectionItems[collId].push(mockupId);
    }
    renderMockupStudioCollectionTabs();
    renderMockupStudioTemplates();
  } catch (err) {
    console.error("Failed to add mockup to collection:", err);
  }
}

async function removeMockupFromCollection(mockupId, collId) {
  try {
    await fetch(`/api/mockup-collections/${collId}/mockups/${encodeURIComponent(mockupId)}`, {
      method: "DELETE",
    });

    if (mockupCollectionItems[collId]) {
      mockupCollectionItems[collId] = mockupCollectionItems[collId].filter(id => id !== mockupId);
    }
    renderMockupStudioCollectionTabs();
    renderMockupStudioTemplates();
  } catch (err) {
    console.error("Failed to remove mockup from collection:", err);
  }
}

function getMockupCollections(mockupId) {
  const collections = [];
  for (const [collId, mockups] of Object.entries(mockupCollectionItems)) {
    if (mockups.includes(mockupId)) {
      collections.push(collId);
    }
  }
  return collections;
}

function filterMockupsByCollection(collId) {
  mockupStudioCollectionFilter = collId;
  renderMockupStudioCollectionTabs();
  renderMockupStudioTemplates();
}

function renderThemeCollectionTabs() {
  const container = document.getElementById("theme-collection-tabs");
  if (!container) return;

  container.innerHTML = "";

  // "All" tab
  const allTab = document.createElement("button");
  allTab.type = "button";
  allTab.className = "collection-tab" + (drawerCollectionFilter === null ? " active" : "");
  allTab.innerHTML = `<span>All</span><span class="tab-count">${themeList.length}</span>`;
  allTab.addEventListener("click", () => filterThemesByCollection(null));
  container.appendChild(allTab);

  // "Starred" tab
  const starredTab = document.createElement("button");
  starredTab.type = "button";
  starredTab.className = "collection-tab" + (drawerCollectionFilter === "starred" ? " active" : "");
  starredTab.innerHTML = `<span>Starred</span><span class="tab-count">${starredThemes.length}</span>`;
  starredTab.addEventListener("click", () => filterThemesByCollection("starred"));
  container.appendChild(starredTab);

  // Collection tabs
  themeCollectionList.forEach(coll => {
    const count = (themeCollectionItems[coll.id] || []).length;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "collection-tab" + (drawerCollectionFilter === coll.id ? " active" : "");
    tab.innerHTML = `
      <span>${escapeHtml(coll.name)}</span>
      <span class="tab-count">${count}</span>
      <span class="tab-actions">
        <button type="button" class="tab-action rename" title="Rename">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button type="button" class="tab-action delete" title="Delete">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </span>
    `;
    tab.addEventListener("click", (e) => {
      if (!e.target.closest(".tab-action")) {
        filterThemesByCollection(coll.id);
      }
    });
    tab.querySelector(".rename")?.addEventListener("click", (e) => {
      e.stopPropagation();
      renameThemeCollection(coll.id);
    });
    tab.querySelector(".delete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteThemeCollection(coll.id);
    });
    container.appendChild(tab);
  });

  // "New Collection" button
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "collection-tab new-collection-btn";
  newBtn.innerHTML = `<span>+ New</span>`;
  newBtn.addEventListener("click", createThemeCollection);
  container.appendChild(newBtn);

  // Also update carousel tabs if in collection view mode
  if (themePickerViewMode === "collection") {
    renderCategoryTabs();
    updateThemeCarouselForCurrentFilter();
  }
}

function openThemeCollectionMenu(themeId, buttonElement) {
  // Remove any existing menu
  document.querySelectorAll(".collection-menu").forEach(m => m.remove());

  const menu = document.createElement("div");
  menu.className = "collection-menu";

  // Get which collections this theme is already in
  const themeColls = getThemeCollections(themeId);

  if (themeCollectionList.length === 0) {
    menu.innerHTML = `<div class="collection-menu-empty">No collections yet</div>`;
  } else {
    themeCollectionList.forEach(coll => {
      const isInCollection = themeColls.includes(coll.id);
      const item = document.createElement("label");
      item.className = "collection-menu-item";
      item.innerHTML = `
        <input type="checkbox" ${isInCollection ? "checked" : ""}>
        <span>${escapeHtml(coll.name)}</span>
      `;
      item.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) {
          addThemeToCollection(themeId, coll.id);
        } else {
          removeThemeFromCollection(themeId, coll.id);
        }
      });
      menu.appendChild(item);
    });
  }

  // Add "New Collection" option
  const newItem = document.createElement("button");
  newItem.type = "button";
  newItem.className = "collection-menu-new";
  newItem.textContent = "+ New Collection";
  newItem.addEventListener("click", async () => {
    menu.remove();
    await createThemeCollection();
  });
  menu.appendChild(newItem);

  // Position the menu
  const rect = buttonElement.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.zIndex = "1000";

  document.body.appendChild(menu);

  // Close on click outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && e.target !== buttonElement) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
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
      // Dispatch input event to ensure visual update
      elements.dpiSlider.dispatchEvent(new Event('input', { bubbles: true }));
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
let galleryMultiselectMode = false;
let gallerySelectedItems = new Set(); // Store selected filenames

async function openCollectionModal() {
  elements.collectionModal?.classList.add("open");

  // Hide floating elements that should be behind the modal
  document.getElementById("bottom-bar-float")?.classList.add("hidden-by-modal");
  document.getElementById("coords-widget")?.classList.add("hidden-by-modal");
  document.getElementById("style-widget")?.classList.add("hidden-by-modal");

  // Always load fresh gallery data to ensure we have the latest posters
  await loadGallery(true);

  // Start stream if not already running
  if (!galleryLoadedForModal) {
    startGalleryStream();
    galleryLoadedForModal = true;
  }

  modalCollectionFilter = activeCollectionFilter; // Start with current filter
  renderCollectionModalTabs();
  renderCollectionModalGrid();
}

function closeCollectionModal() {
  elements.collectionModal?.classList.remove("open");

  // Reset multi-select mode
  if (galleryMultiselectMode) {
    galleryMultiselectMode = false;
    gallerySelectedItems.clear();
    elements.galleryMultiselectBtn?.classList.remove("active");
    elements.galleryBulkActions?.classList.remove("visible");
    elements.collectionModal?.classList.remove("multiselect-mode");
  }

  // Show floating elements again
  document.getElementById("bottom-bar-float")?.classList.remove("hidden-by-modal");
  document.getElementById("coords-widget")?.classList.remove("hidden-by-modal");
  document.getElementById("style-widget")?.classList.remove("hidden-by-modal");
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
    tab.innerHTML = `${escapeHtml(coll.name)} <span class="collection-tab-count">${count}</span>
      <span class="collection-tab-actions">
        <span class="collection-tab-rename" title="Rename collection">✎</span>
        <span class="collection-tab-delete" title="Delete collection">×</span>
      </span>`;
    tab.addEventListener("click", (e) => {
      if (e.target.classList.contains("collection-tab-delete")) {
        e.stopPropagation();
        if (confirm(`Delete collection "${coll.name}"? Posters will be unlinked but not deleted.`)) {
          deleteCollection(coll.id);
        }
        return;
      }
      if (e.target.classList.contains("collection-tab-rename")) {
        e.stopPropagation();
        const newName = prompt(`Rename collection "${coll.name}":`, coll.name);
        if (newName && newName.trim() && newName.trim() !== coll.name) {
          renameCollection(coll.id, newName.trim());
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
    card.dataset.filename = item.filename;
    if (galleryMultiselectMode) {
      card.classList.add("multiselect-mode");
      if (gallerySelectedItems.has(item.filename)) {
        card.classList.add("selected");
      }
    }

    // Build collection options
    let collectionOptions = '<option value="">No collection</option>';
    collectionList.forEach(coll => {
      const selected = item.config?.collection === coll.id ? 'selected' : '';
      collectionOptions += `<option value="${coll.id}" ${selected}>${coll.name}</option>`;
    });

    // Format theme name (remove underscores, capitalize)
    const themeRaw = item.config?.theme || "";
    const themeFormatted = themeRaw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const fontName = item.config?.font || "";
    const aspectRatio = item.config?.aspect_ratio || "2:3";
    const format = (item.config?.format || "png").toUpperCase();
    const dpi = item.config?.dpi || 300;

    const isSelected = gallerySelectedItems.has(item.filename);

    card.innerHTML = `
      <div class="collection-poster-checkbox ${galleryMultiselectMode ? 'visible' : ''}">
        <div class="poster-checkbox ${isSelected ? 'checked' : ''}">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
      </div>
      <div class="collection-poster-image">
        <img src="${item.thumb_url}?t=${item.mtime}" alt="${item.filename}" loading="lazy">
        <div class="collection-poster-specs">${escapeHtml(aspectRatio)} · ${format} · ${dpi}</div>
        <div class="collection-poster-info">
          <span class="collection-poster-city">${escapeHtml(item.config?.city || item.filename.split('_')[0])}</span>
          <span class="collection-poster-meta">${themeFormatted ? escapeHtml(themeFormatted) : ''}${themeFormatted && fontName ? ' · ' : ''}${fontName ? escapeHtml(fontName) : ''}</span>
        </div>
      </div>
      <div class="collection-poster-actions ${galleryMultiselectMode ? 'hidden' : ''}">
        <button class="poster-action-btn poster-view-btn" title="Load this poster in editor">
         <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M3 4H21" stroke="#33363F" stroke-width="2" stroke-linecap="round"></path> <path d="M5 4H19V15.8C19 16.9201 19 17.4802 18.782 17.908C18.5903 18.2843 18.2843 18.5903 17.908 18.782C17.4802 19 16.9201 19 15.8 19H8.2C7.07989 19 6.51984 19 6.09202 18.782C5.71569 18.5903 5.40973 18.2843 5.21799 17.908C5 17.4802 5 16.9201 5 15.8V4Z" stroke="#33363F" stroke-width="2" stroke-linecap="round"></path> <path d="M12 15V9" stroke="#33363F" stroke-width="2" stroke-linecap="round"></path> <path d="M9 12L11.8939 9.10607C11.9525 9.04749 12.0475 9.04749 12.1061 9.10607L15 12" stroke="#33363F" stroke-width="2" stroke-linecap="round"></path> </g></svg>
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

    // Click handler depends on mode
    card.addEventListener("click", (e) => {
      if (galleryMultiselectMode) {
        // In multiselect mode, toggle selection
        if (e.target.closest('.poster-action-btn') || e.target.closest('.poster-collection-select')) return;
        toggleGalleryItemSelection(item.filename, card);
      }
    });

    // Click on image loads settings (only in normal mode)
    card.querySelector('.poster-view-btn').addEventListener("click", (e) => {
      if (galleryMultiselectMode) return; // Handled by card click
      closeCollectionModal();
      if (item.config) {
        loadConfigFromGallery(item.config);
      }
    });

    // View button - open in lightbox
    card.querySelector('.collection-poster-image ').addEventListener("click", (e) => {
      e.stopPropagation();
      // Find index in galleryItems array
      const index = (window.galleryItems || []).findIndex(gi => gi.filename === item.filename);
      if (index >= 0) {
        openLightbox(index);
      }
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

// ===== GALLERY MULTI-SELECT =====
function toggleGalleryMultiselect() {
  galleryMultiselectMode = !galleryMultiselectMode;
  gallerySelectedItems.clear();

  // Update UI
  elements.galleryMultiselectBtn?.classList.toggle("active", galleryMultiselectMode);
  elements.galleryBulkActions?.classList.toggle("visible", galleryMultiselectMode);
  elements.collectionModal?.classList.toggle("multiselect-mode", galleryMultiselectMode);

  updateGallerySelectionCount();
  renderCollectionModalGrid();
}

function toggleGalleryItemSelection(filename, card) {
  if (gallerySelectedItems.has(filename)) {
    gallerySelectedItems.delete(filename);
    card.classList.remove("selected");
    card.querySelector(".poster-checkbox")?.classList.remove("checked");
  } else {
    gallerySelectedItems.add(filename);
    card.classList.add("selected");
    card.querySelector(".poster-checkbox")?.classList.add("checked");
  }
  updateGallerySelectionCount();
}

function updateGallerySelectionCount() {
  const count = gallerySelectedItems.size;
  if (elements.bulkSelectionCount) {
    elements.bulkSelectionCount.textContent = `${count} selected`;
  }
  // Enable/disable bulk action buttons based on selection
  if (elements.bulkDeleteBtn) {
    elements.bulkDeleteBtn.disabled = count === 0;
  }
  if (elements.bulkCreateCompositeBtn) {
    elements.bulkCreateCompositeBtn.disabled = count === 0;
  }
  // Update select all button text
  const visibleItems = modalCollectionFilter === null
    ? window.galleryItems || []
    : (window.galleryItems || []).filter(item => item.config?.collection === modalCollectionFilter);
  const allSelected = visibleItems.length > 0 && visibleItems.every(item => gallerySelectedItems.has(item.filename));
  if (elements.gallerySelectAllBtn) {
    elements.gallerySelectAllBtn.textContent = allSelected ? "Deselect All" : "Select All";
  }
}

function selectAllGalleryItems() {
  const visibleItems = modalCollectionFilter === null
    ? window.galleryItems || []
    : (window.galleryItems || []).filter(item => item.config?.collection === modalCollectionFilter);

  const allSelected = visibleItems.every(item => gallerySelectedItems.has(item.filename));

  if (allSelected) {
    // Deselect all
    visibleItems.forEach(item => gallerySelectedItems.delete(item.filename));
  } else {
    // Select all
    visibleItems.forEach(item => gallerySelectedItems.add(item.filename));
  }

  updateGallerySelectionCount();
  renderCollectionModalGrid();
}

async function bulkDeleteSelected() {
  if (gallerySelectedItems.size === 0) return;

  const count = gallerySelectedItems.size;
  if (!confirm(`Delete ${count} poster${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
    return;
  }

  const filenames = Array.from(gallerySelectedItems);
  let deleted = 0;

  for (const filename of filenames) {
    try {
      const response = await fetch(`/api/posters/${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (response.ok) {
        window.galleryItems = window.galleryItems.filter(item => item.filename !== filename);
        deleted++;
      }
    } catch (err) {
      console.error(`Failed to delete ${filename}:`, err);
    }
  }

  gallerySelectedItems.clear();
  updateGallerySelectionCount();
  renderCollectionModalTabs();
  renderCollectionModalGrid();

  if (deleted > 0) {
    console.log(`Deleted ${deleted} poster(s)`);
  }
}

async function createCompositeImage() {
  if (gallerySelectedItems.size === 0) return;

  const filenames = Array.from(gallerySelectedItems);

  // Show loading state
  if (elements.bulkCreateCompositeBtn) {
    elements.bulkCreateCompositeBtn.disabled = true;
    elements.bulkCreateCompositeBtn.innerHTML = `
      <svg class="spinner" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg>
      Creating...
    `;
  }

  try {
    const response = await fetch("/api/composite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filenames })
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `composite_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const err = await response.json();
      alert(err.error || "Failed to create composite image");
    }
  } catch (err) {
    console.error("Failed to create composite:", err);
    alert("Failed to create composite image");
  } finally {
    // Reset button
    if (elements.bulkCreateCompositeBtn) {
      elements.bulkCreateCompositeBtn.disabled = false;
      elements.bulkCreateCompositeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
        </svg>
        Create Composite
      `;
    }
  }
}

function cancelGalleryMultiselect() {
  galleryMultiselectMode = false;
  gallerySelectedItems.clear();

  elements.galleryMultiselectBtn?.classList.remove("active");
  elements.galleryBulkActions?.classList.remove("visible");
  elements.collectionModal?.classList.remove("multiselect-mode");

  updateGallerySelectionCount();
  renderCollectionModalGrid();
}

async function deleteCollection(collId) {
  try {
    const response = await fetch(`/api/collections/${collId}`, { method: "DELETE" });
    if (response.ok) {
      const result = await response.json();
      collectionList = collectionList.filter(c => c.id !== collId);
      if (activeCollectionFilter === collId) {
        activeCollectionFilter = null;
      }
      if (modalCollectionFilter === collId) {
        modalCollectionFilter = null;
      }
      // Reload gallery to reflect unlinked posters
      await loadGallery(true);
      renderCollectionSelector();
      renderCollectionModalTabs();
      renderCollectionModalGrid();
    }
  } catch (err) {
    console.error("Failed to delete collection:", err);
  }
}

async function renameCollection(collId, newName) {
  try {
    const response = await fetch(`/api/collections/${collId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (response.ok) {
      // Update local collection list
      const coll = collectionList.find(c => c.id === collId);
      if (coll) {
        coll.name = newName;
      }
      renderCollectionSelector();
      renderCollectionModalTabs();
    } else {
      const err = await response.json();
      alert(err.error || "Failed to rename collection");
    }
  } catch (err) {
    console.error("Failed to rename collection:", err);
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

  // Re-render theme drawer to show/hide Select All buttons
  renderThemeDrawer(themeList);

  // Update generate button
  updateVariationButton();

  // Update selected themes list in preview widget
  renderSelectedThemesList();
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
  updateThemeSelectionUI();
  updateVariationButton();
}

function updateThemeSelectionUI() {
  // Update carousel cards
  document.querySelectorAll(".theme-carousel-card").forEach(card => {
    const isSelected = selectedThemes.includes(card.dataset.themeId);
    card.classList.toggle("variation-selected", isSelected);
  });
  // Update drawer cards
  document.querySelectorAll(".theme-card-expanded").forEach(card => {
    const isSelected = selectedThemes.includes(card.dataset.themeId);
    card.classList.toggle("variation-selected", isSelected);
  });
  // Update category select all buttons
  updateCategorySelectButtons();
  // Update selected themes list in preview widget
  renderSelectedThemesList();
}

function renderSelectedThemesList() {
  const section = document.getElementById("selected-themes-section");
  const list = document.getElementById("selected-themes-list");
  const count = document.getElementById("selected-themes-count");

  if (!section || !list) return;

  // Only show when in variation mode with selected themes
  if (!variationMode || selectedThemes.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  if (count) count.textContent = selectedThemes.length;

  list.innerHTML = "";

  selectedThemes.forEach(themeId => {
    const theme = themeList.find(t => t.id === themeId);
    if (!theme) return;

    const item = document.createElement("div");
    item.className = "selected-theme-item";
    item.innerHTML = `
      <span class="theme-name">${theme.name}</span>
      <button class="theme-remove" type="button" title="Remove from selection">
        <svg viewBox="0 0 24 24" width="12" height="12">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;

    item.querySelector(".theme-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleThemeSelection(themeId);
    });

    list.appendChild(item);
  });
}

function toggleCategorySelection(category) {
  if (!variationMode) return;

  // Get all theme IDs in this category
  const categoryThemes = themeList.filter(t => (t.category || "other") === category).map(t => t.id);

  // Check if all themes in category are already selected
  const allSelected = categoryThemes.every(id => selectedThemes.includes(id));

  if (allSelected) {
    // Deselect all themes in this category
    selectedThemes = selectedThemes.filter(id => !categoryThemes.includes(id));
  } else {
    // Select all themes in this category (add ones not already selected)
    categoryThemes.forEach(id => {
      if (!selectedThemes.includes(id)) {
        selectedThemes.push(id);
      }
    });
  }

  updateThemeSelectionUI();
  updateVariationButton();
}

function updateCategorySelectButtons() {
  document.querySelectorAll(".category-select-all-btn").forEach(btn => {
    const category = btn.dataset.category;
    const categoryThemes = themeList.filter(t => (t.category || "other") === category).map(t => t.id);
    const allSelected = categoryThemes.length > 0 && categoryThemes.every(id => selectedThemes.includes(id));
    btn.textContent = allSelected ? "Deselect All" : "Select All";
    btn.classList.toggle("all-selected", allSelected);
  });
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
  const dropdown = elements.searchResultsFloat;
  if (!dropdown) return;

  dropdown.innerHTML = "";

  if (!results.length) {
    const noResults = document.createElement("div");
    noResults.className = "search-result";
    noResults.innerHTML = "<span>No locations found</span>";
    dropdown.appendChild(noResults);
    dropdown.classList.add("open");
    return;
  }

  results.forEach((result) => {
    const item = document.createElement("div");
    item.className = "search-result";
    item.innerHTML = `
      <strong>${escapeHtml(result.display.split(",").slice(0, 2).join(","))}</strong>
      <span>${escapeHtml(result.display.split(",").slice(2, 4).join(","))}</span>
    `;
    item.addEventListener("click", () => {
      // Pan map to this location (DON'T set poster text)
      panToLocation(result.lat, result.lng);
      hideSearchResults();
      if (elements.locationSearchFloat) {
        elements.locationSearchFloat.value = "";
      }
    });
    dropdown.appendChild(item);
  });

  dropdown.classList.add("open");
}

function hideSearchResults() {
  if (elements.searchResultsFloat) {
    elements.searchResultsFloat.classList.remove("open");
    elements.searchResultsFloat.innerHTML = "";
  }
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

// ===== RECENT GENERATIONS PANEL =====

function toggleRecentPanel() {
  const panel = elements.recentPanel;
  if (!panel) return;

  const isHidden = panel.getAttribute("aria-hidden") === "true";
  if (isHidden) {
    openRecentPanel();
  } else {
    closeRecentPanel();
  }
}

function openRecentPanel() {
  const panel = elements.recentPanel;
  if (!panel) return;

  // Close bookmarks panel if open
  closeBookmarksPanel();

  panel.setAttribute("aria-hidden", "false");
  renderRecentGenerations();
}

function closeRecentPanel() {
  const panel = elements.recentPanel;
  if (!panel) return;

  panel.setAttribute("aria-hidden", "true");
}

function renderRecentGenerations() {
  const grid = elements.recentGrid;
  if (!grid) return;

  grid.innerHTML = "";

  // Get the first 20 items from galleryItems (already sorted by mtime descending from API)
  const items = (window.galleryItems || []).slice(0, 20);

  if (!items.length) {
    grid.innerHTML = '<div class="recent-empty">No recent generations</div>';
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "recent-item";

    const city = item.config?.city || item.filename.split("_")[0] || "Unknown";
    const themeRaw = item.config?.theme || "unknown";
    // Capitalize theme name (replace underscores, title case)
    const theme = themeRaw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const thumbUrl = item.thumb_url || item.url || `/posters/${item.filename}`;

    // Additional details
    const aspect = item.config?.aspect_ratio || "2:3";
    const dpi = item.config?.dpi || 300;
    const font = item.config?.font || "Default";

    div.innerHTML = `
      <img class="recent-item-thumb" src="${thumbUrl}" alt="${escapeHtml(city)}" loading="lazy">
      <div class="recent-item-info">
        <div class="recent-item-city">${escapeHtml(city)}</div>
        <div class="recent-item-theme">${escapeHtml(theme)}</div>
        <div class="recent-item-details">${escapeHtml(aspect)} · ${dpi} DPI · ${escapeHtml(font)}</div>
      </div>
    `;

    div.addEventListener("click", () => {
      loadConfigFromGalleryItem(item);
      closeRecentPanel();
    });

    grid.appendChild(div);
  });
}

function loadConfigFromGalleryItem(item) {
  if (!item.config) return;

  const config = item.config;

  // Set location
  if (config.lat !== undefined && config.lng !== undefined) {
    state.selectedLat = config.lat;
    state.selectedLng = config.lng;

    if (leafletMap && radiusCircle && centerMarker) {
      // Zoom to level 12 for a good view of the area
      leafletMap.setView([config.lat, config.lng], 12, { animate: true });

      // Add circle and marker to map if not already visible
      if (!leafletMap.hasLayer(radiusCircle)) {
        radiusCircle.addTo(leafletMap);
        centerMarker.addTo(leafletMap);
      }

      radiusCircle.setLatLng([config.lat, config.lng]);
      centerMarker.setLatLng([config.lat, config.lng]);
    }
  }

  // Set radius
  if (config.distance) {
    state.radius = config.distance;
    if (elements.radiusSlider) {
      elements.radiusSlider.value = config.distance;
      elements.radiusSlider.dispatchEvent(new Event("input", { bubbles: true }));
    }
    // Update circle radius
    if (radiusCircle) {
      radiusCircle.setRadius(config.distance);
    }
  }

  // Set poster text
  if (config.city) {
    state.posterCity = config.city;
    if (elements.posterCity) elements.posterCity.value = config.city;
  }
  if (config.country) {
    state.posterCountry = config.country;
    if (elements.posterCountry) elements.posterCountry.value = config.country;
  }
  if (config.tagline !== undefined) {
    state.posterTagline = config.tagline || "";
    if (elements.posterTagline) elements.posterTagline.value = config.tagline || "";
  }

  // Set theme (use selectTheme which updates all UI elements)
  if (config.theme) {
    selectTheme(config.theme);
  }

  // Set format
  if (config.format && elements.formatSelect) {
    state.format = config.format;
    elements.formatSelect.value = config.format;
  }

  // Set DPI
  if (config.dpi) {
    state.dpi = config.dpi;
    if (elements.dpiSlider) {
      elements.dpiSlider.value = config.dpi;
      elements.dpiSlider.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (elements.dpiValue) {
      elements.dpiValue.textContent = config.dpi;
    }
  }

  // Set aspect ratio
  if (config.aspect_ratio && elements.aspectSelect) {
    state.aspectRatio = config.aspect_ratio;
    elements.aspectSelect.value = config.aspect_ratio;
  }

  // Set font
  if (config.font) {
    state.font = config.font;
    updateFontPickerLabel();
  }

  // Set pin
  if (config.pin) {
    state.pin = config.pin;
    elements.pinSelector?.querySelectorAll(".pin-option").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.pin === config.pin);
    });
  }

  // Update UI
  updateGenerateButton();
  updateAspectRatioRect();
  updatePreview();
}

// ===== CITY BOOKMARKS =====

let cityBookmarksData = null;
let bookmarksSearchTerm = "";

async function loadCityBookmarks() {
  try {
    const response = await fetch("/static/data/city-bookmarks.json");
    if (response.ok) {
      cityBookmarksData = await response.json();
      console.log("Loaded city bookmarks:", cityBookmarksData?.continents?.length, "continents");
    }
  } catch (err) {
    console.error("Failed to load city bookmarks:", err);
  }
}

function toggleBookmarksPanel() {
  const panel = elements.bookmarksPanel;
  if (!panel) return;

  const isHidden = panel.getAttribute("aria-hidden") === "true";
  if (isHidden) {
    openBookmarksPanel();
  } else {
    closeBookmarksPanel();
  }
}

function openBookmarksPanel() {
  const panel = elements.bookmarksPanel;
  if (!panel) return;

  // Close recent panel if open
  closeRecentPanel();

  panel.setAttribute("aria-hidden", "false");
  elements.bookmarksToggle?.classList.add("active");

  // Load data if needed and render
  if (!cityBookmarksData) {
    loadCityBookmarks().then(() => renderBookmarks());
  } else {
    renderBookmarks();
  }

  // Focus search input
  setTimeout(() => elements.bookmarksSearch?.focus(), 100);
}

function closeBookmarksPanel() {
  const panel = elements.bookmarksPanel;
  if (!panel) return;

  panel.setAttribute("aria-hidden", "true");
  elements.bookmarksToggle?.classList.remove("active");

  // Clear search
  if (elements.bookmarksSearch) {
    elements.bookmarksSearch.value = "";
  }
  bookmarksSearchTerm = "";
}

function renderBookmarks() {
  const container = elements.bookmarksContent;
  if (!container || !cityBookmarksData) return;

  container.innerHTML = "";

  const searchTerm = bookmarksSearchTerm.toLowerCase().trim();

  if (!cityBookmarksData.continents || cityBookmarksData.continents.length === 0) {
    container.innerHTML = '<div class="bookmarks-empty">No bookmarks available</div>';
    return;
  }

  let totalMatches = 0;

  cityBookmarksData.continents.forEach((continent) => {
    // Filter cities by search term
    let cities = continent.cities;
    if (searchTerm) {
      cities = cities.filter((city) => {
        const cityMatch = city.city.toLowerCase().includes(searchTerm);
        const countryMatch = city.country.toLowerCase().includes(searchTerm);
        const aliasMatch = city.aliases?.some((a) => a.toLowerCase().includes(searchTerm));
        return cityMatch || countryMatch || aliasMatch;
      });
    }

    if (cities.length === 0) return;
    totalMatches += cities.length;

    const continentDiv = document.createElement("div");
    continentDiv.className = "bookmarks-continent";
    // Start expanded if searching, collapsed otherwise
    if (!searchTerm) {
      continentDiv.classList.add("collapsed");
    }

    continentDiv.innerHTML = `
      <div class="bookmarks-continent-header">
        <span class="bookmarks-continent-name">${escapeHtml(continent.name)}</span>
        <span class="bookmarks-continent-count">${cities.length}</span>
        <svg class="bookmarks-continent-toggle" viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
        </svg>
      </div>
      <div class="bookmarks-city-list"></div>
    `;

    const header = continentDiv.querySelector(".bookmarks-continent-header");
    header.addEventListener("click", () => {
      continentDiv.classList.toggle("collapsed");
    });

    const cityList = continentDiv.querySelector(".bookmarks-city-list");
    cities.forEach((city) => {
      const cityDiv = document.createElement("div");
      cityDiv.className = "bookmarks-city";
      if (searchTerm) {
        cityDiv.classList.add("search-match");
      }

      // Highlight matching text
      let displayName = escapeHtml(city.city);
      if (searchTerm) {
        const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi");
        displayName = displayName.replace(regex, '<span class="highlight">$1</span>');
      }

      cityDiv.innerHTML = `
        <div class="bookmarks-city-icon">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div class="bookmarks-city-info">
          <div class="bookmarks-city-name">${displayName}</div>
          <div class="bookmarks-city-country">${escapeHtml(city.country)}</div>
        </div>
      `;

      cityDiv.addEventListener("click", () => {
        selectCityBookmark(city);
      });

      cityList.appendChild(cityDiv);
    });

    container.appendChild(continentDiv);
  });

  if (totalMatches === 0 && searchTerm) {
    container.innerHTML = '<div class="bookmarks-empty">No cities match your search</div>';
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectCityBookmark(city) {
  // Pan map to city coordinates
  if (leafletMap && city.lat !== undefined && city.lng !== undefined) {
    // Update state
    state.selectedLat = city.lat;
    state.selectedLng = city.lng;

    // Update poster text
    state.posterCity = city.city;
    state.posterCountry = city.country;
    state.posterTagline = ""; // Reset tagline to use coordinates

    if (elements.posterCity) elements.posterCity.value = city.city;
    if (elements.posterCountry) elements.posterCountry.value = city.country;
    if (elements.posterTagline) elements.posterTagline.value = "";

    // Also update suggested values
    state.suggestedCity = city.city;
    state.suggestedCountry = city.country;

    // Pan to location
    leafletMap.setView([city.lat, city.lng], 12, { animate: true });

    // Show/update circle and marker
    if (radiusCircle && centerMarker) {
      if (!leafletMap.hasLayer(radiusCircle)) {
        radiusCircle.addTo(leafletMap);
        centerMarker.addTo(leafletMap);
      }
      radiusCircle.setLatLng([city.lat, city.lng]);
      centerMarker.setLatLng([city.lat, city.lng]);
    }

    // Update UI
    updateGenerateButton();
    updateAspectRatioRect();
    updatePreview();
  }

  // Close the panel
  closeBookmarksPanel();
}

function handleBookmarksSearch() {
  bookmarksSearchTerm = elements.bookmarksSearch?.value || "";
  renderBookmarks();
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
  } else if (state.aspectRatio === "5:7") {
    aspectWidth = 5; aspectHeight = 7;
  } else if (state.aspectRatio === "11:14") {
    aspectWidth = 11; aspectHeight = 14;
  } else if (state.aspectRatio === "16:9") {
    aspectWidth = 16; aspectHeight = 9; // Landscape
  } else if (state.aspectRatio === "9:16") {
    aspectWidth = 9; aspectHeight = 16; // Portrait
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
    initFontDrawer();
    populateMockupLabelFonts();
  } catch (err) {
    console.error("Failed to load fonts:", err);
    renderFontSelector([]);
    initFontPicker();
    initFontDrawer();
    populateMockupLabelFonts();
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

  // Filter fonts based on collection filter
  let filteredFonts = [...fonts];
  if (currentFontCollectionFilter === "starred") {
    filteredFonts = fonts.filter(f => starredFonts.includes(f));
  } else if (currentFontCollectionFilter && fontCollectionItems[currentFontCollectionFilter]) {
    filteredFonts = fonts.filter(f => fontCollectionItems[currentFontCollectionFilter].includes(f));
  }

  // Default option
  const defaultFont = fonts.length > 0 ? fonts[0] : "Roboto";
  const defaultOpt = createFontOption("", `Default (${defaultFont})`, defaultFont, false);
  elements.fontPickerOptions.appendChild(defaultOpt);

  // Sort fonts: starred first, then alphabetically
  const sortedFonts = [...filteredFonts].sort((a, b) => {
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
  nameEl.textContent = name.toUpperCase();

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
  previewEl.textContent = "THE QUICK BROWN FOX";

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
// FONT DRAWER
// ============================================================

function openFontDrawer() {
  const drawer = document.getElementById("font-drawer");
  if (drawer) {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    renderFontCollectionTabs();
    renderFontDrawer();
  }
}

function closeFontDrawer() {
  const drawer = document.getElementById("font-drawer");
  if (drawer) {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
  }
}

function renderFontCollectionTabs() {
  const container = document.getElementById("font-collection-tabs");
  if (!container) return;

  container.innerHTML = "";

  // "All" tab
  const allTab = document.createElement("button");
  allTab.type = "button";
  allTab.className = "collection-tab" + (fontDrawerCollectionFilter === null ? " active" : "");
  allTab.innerHTML = `<span>All</span><span class="tab-count">${fontList.length}</span>`;
  allTab.addEventListener("click", () => filterFontsByCollection(null));
  container.appendChild(allTab);

  // "Starred" tab
  const starredTab = document.createElement("button");
  starredTab.type = "button";
  starredTab.className = "collection-tab" + (fontDrawerCollectionFilter === "starred" ? " active" : "");
  starredTab.innerHTML = `<span>Starred</span><span class="tab-count">${starredFonts.length}</span>`;
  starredTab.addEventListener("click", () => filterFontsByCollection("starred"));
  container.appendChild(starredTab);

  // Collection tabs
  fontCollectionList.forEach(coll => {
    const count = (fontCollectionItems[coll.id] || []).length;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "collection-tab" + (fontDrawerCollectionFilter === coll.id ? " active" : "");
    tab.innerHTML = `
      <span>${escapeHtml(coll.name)}</span>
      <span class="tab-count">${count}</span>
      <span class="tab-actions">
        <button type="button" class="tab-action" data-action="rename" title="Rename">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button type="button" class="tab-action" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </span>
    `;

    tab.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "rename") {
        e.stopPropagation();
        renameFontCollection(coll.id);
      } else if (action === "delete") {
        e.stopPropagation();
        deleteFontCollection(coll.id);
      } else {
        filterFontsByCollection(coll.id);
      }
    });

    container.appendChild(tab);
  });

  // "New Collection" button
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "collection-tab new-collection-btn";
  newBtn.innerHTML = `<span>+ New Collection</span>`;
  newBtn.addEventListener("click", createFontCollection);
  container.appendChild(newBtn);
}

function renderFontDrawer() {
  const grid = document.getElementById("font-grid-full");
  if (!grid) return;

  grid.innerHTML = "";

  // Filter fonts based on collection
  let filteredFonts = [...fontList];

  if (fontDrawerCollectionFilter === "starred") {
    filteredFonts = fontList.filter(f => starredFonts.includes(f));
  } else if (fontDrawerCollectionFilter && fontCollectionItems[fontDrawerCollectionFilter]) {
    filteredFonts = fontList.filter(f => fontCollectionItems[fontDrawerCollectionFilter].includes(f));
  }

  // Apply search filter
  const searchInput = document.getElementById("font-search");
  const query = (searchInput?.value || "").toLowerCase().trim();
  if (query) {
    filteredFonts = filteredFonts.filter(f => f.toLowerCase().includes(query));
  }

  if (filteredFonts.length === 0) {
    grid.innerHTML = `<div class="theme-drawer-empty">No fonts found</div>`;
    return;
  }

  // Sort: starred first, then alphabetically
  filteredFonts.sort((a, b) => {
    const aStarred = starredFonts.includes(a);
    const bStarred = starredFonts.includes(b);
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    return a.localeCompare(b);
  });

  filteredFonts.forEach(fontName => {
    const card = createFontCard(fontName);
    grid.appendChild(card);
  });
}

function createFontCard(fontName) {
  const card = document.createElement("div");
  card.className = "font-card-expanded";
  if (state.font === fontName) {
    card.classList.add("selected");
  }

  const isStarred = starredFonts.includes(fontName);
  const hasCollections = getFontCollections(fontName).length > 0;

  card.innerHTML = `
    <div class="font-card-preview" style="font-family: '${fontName}', sans-serif;">
      ${state.posterCity || "LONDON"}
    </div>
    <div class="font-card-header">
      <span class="font-card-name">${escapeHtml(fontName)}</span>
      <div class="font-card-actions">
        <button type="button" class="star-btn ${isStarred ? "starred" : ""}" title="${isStarred ? "Remove from favorites" : "Add to favorites"}">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="${isStarred ? "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" : "M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"}"/></svg>
        </button>
        <button type="button" class="collection-btn ${hasCollections ? "has-collections" : ""}" title="Add to collection">
          <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
        </button>
      </div>
    </div>
  `;

  // Event listeners
  card.addEventListener("click", (e) => {
    if (e.target.closest(".star-btn")) {
      e.stopPropagation();
      toggleStarFont(fontName);
      renderFontDrawer();
      renderFontCollectionTabs();
      return;
    }
    if (e.target.closest(".collection-btn")) {
      e.stopPropagation();
      openFontCollectionMenu(fontName, e.target.closest(".collection-btn"));
      return;
    }
    selectFont(fontName);
    closeFontDrawer();
  });

  return card;
}

function openFontCollectionMenu(fontName, buttonEl) {
  // Close any existing menu
  document.querySelectorAll(".collection-menu").forEach(m => m.remove());

  const menu = document.createElement("div");
  menu.className = "collection-menu";

  const fontCollections = getFontCollections(fontName);

  if (fontCollectionList.length === 0) {
    menu.innerHTML = `
      <div style="padding: 12px; color: var(--ink-soft); font-size: 0.85rem;">
        No collections yet
      </div>
    `;
  } else {
    fontCollectionList.forEach(coll => {
      const isInCollection = fontCollections.includes(coll.id);
      const item = document.createElement("label");
      item.className = "collection-menu-item";
      item.innerHTML = `
        <input type="checkbox" ${isInCollection ? "checked" : ""}>
        <span>${escapeHtml(coll.name)}</span>
      `;

      item.querySelector("input").addEventListener("change", async (e) => {
        if (e.target.checked) {
          await addFontToCollection(fontName, coll.id);
        } else {
          await removeFontFromCollection(fontName, coll.id);
        }
        // Update button state
        const hasCollections = getFontCollections(fontName).length > 0;
        buttonEl.classList.toggle("has-collections", hasCollections);
      });

      menu.appendChild(item);
    });
  }

  // New collection button
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "collection-menu-new";
  newBtn.textContent = "+ New Collection";
  newBtn.addEventListener("click", async () => {
    menu.remove();
    await createFontCollection();
  });
  menu.appendChild(newBtn);

  // Position menu
  const rect = buttonEl.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.zIndex = "1000";

  document.body.appendChild(menu);

  // Close on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && !buttonEl.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

function updateFontCollectionFilter() {
  const select = document.getElementById("font-collection-filter");
  if (!select) return;

  // Save current value
  const currentValue = select.value;

  // Clear and rebuild options
  select.innerHTML = `
    <option value="">All Fonts</option>
    <option value="starred">Starred</option>
  `;

  fontCollectionList.forEach(coll => {
    const option = document.createElement("option");
    option.value = coll.id;
    option.textContent = coll.name;
    select.appendChild(option);
  });

  // Restore value if still valid
  if (currentValue && (currentValue === "starred" || fontCollectionList.some(c => c.id === currentValue))) {
    select.value = currentValue;
  }
}

function initFontDrawer() {
  // Close button
  const closeBtn = document.getElementById("font-drawer-close");
  closeBtn?.addEventListener("click", closeFontDrawer);

  // Browse all button
  const browseBtn = document.getElementById("browse-fonts-btn");
  browseBtn?.addEventListener("click", openFontDrawer);

  // Search input
  const searchInput = document.getElementById("font-search");
  searchInput?.addEventListener("input", () => {
    renderFontDrawer();
  });

  // Collection filter in main panel
  const filterSelect = document.getElementById("font-collection-filter");
  filterSelect?.addEventListener("change", (e) => {
    currentFontCollectionFilter = e.target.value || null;
    renderFontSelector(fontList);
  });

  // Initial filter options
  updateFontCollectionFilter();
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

  if (themePickerViewMode === "collection") {
    renderCollectionTabs();
  } else {
    renderCategoryTabsInner();
  }
}

function renderCategoryTabsInner() {
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

function renderCollectionTabs() {
  // Always add "All" tab first
  const allTab = document.createElement("button");
  allTab.className = "theme-category-tab" + (currentCollectionFilter === null ? " active" : "");
  allTab.type = "button";
  allTab.dataset.collection = "all";
  allTab.textContent = "All";
  allTab.addEventListener("click", () => {
    setCollectionFilter(null);
  });
  elements.themeCategoryTabs.appendChild(allTab);

  // Add collection tabs
  themeCollectionList.forEach(coll => {
    const count = (themeCollectionItems[coll.id] || []).length;
    const tab = document.createElement("button");
    tab.className = "theme-category-tab" + (currentCollectionFilter === coll.id ? " active" : "");
    tab.type = "button";
    tab.dataset.collection = coll.id;
    tab.textContent = `${coll.name} (${count})`;
    tab.addEventListener("click", () => {
      setCollectionFilter(coll.id);
    });
    elements.themeCategoryTabs.appendChild(tab);
  });
}

function setThemePickerViewMode(mode) {
  themePickerViewMode = mode;

  // Reset filters when switching modes
  if (mode === "category") {
    currentCollectionFilter = null;
    currentCategory = "all";
  } else {
    currentCollectionFilter = null;
  }

  // Update toggle button states
  document.querySelectorAll(".view-toggle-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === mode);
  });

  // Re-render tabs and carousel
  renderCategoryTabs();
  updateThemeCarouselForCurrentFilter();
}

function setCollectionFilter(collId) {
  currentCollectionFilter = collId;

  // Update tab active state
  document.querySelectorAll(".theme-category-tab").forEach((tab) => {
    const tabColl = tab.dataset.collection;
    const isActive = (collId === null && tabColl === "all") || tabColl === collId;
    tab.classList.toggle("active", isActive);
    if (isActive) {
      tab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  });

  updateThemeCarouselForCurrentFilter();
}

function updateThemeCarouselForCurrentFilter() {
  let themes;

  if (themePickerViewMode === "collection") {
    if (currentCollectionFilter === null) {
      themes = themeList;
    } else {
      const themeIds = themeCollectionItems[currentCollectionFilter] || [];
      themes = themeList.filter(t => themeIds.includes(t.id));
    }
  } else {
    themes = themesByCategory[currentCategory] || themeList;
  }

  renderThemeCarousel(themes);
  initCarouselDrag();
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

  updateThemeCarouselForCurrentFilter();
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

  // Filter themes based on collection filter
  let filteredThemes = themes;
  if (drawerCollectionFilter === "starred") {
    filteredThemes = themes.filter(t => starredThemes.includes(t.id));
  } else if (drawerCollectionFilter && themeCollectionItems[drawerCollectionFilter]) {
    filteredThemes = themes.filter(t => themeCollectionItems[drawerCollectionFilter].includes(t.id));
  }

  // Group themes by category for drawer
  const grouped = {};
  filteredThemes.forEach((theme) => {
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
    const categoryThemes = grouped[cat].map(t => t.id);
    const allSelected = variationMode && categoryThemes.length > 0 && categoryThemes.every(id => selectedThemes.includes(id));
    titleEl.innerHTML = `
      <span class="theme-category-label">
        ${CATEGORY_LABELS[cat] || cat}
        <span class="theme-category-count">(${grouped[cat].length})</span>
      </span>
      ${variationMode ? `<button class="category-select-all-btn${allSelected ? ' all-selected' : ''}" data-category="${cat}">${allSelected ? 'Deselect All' : 'Select All'}</button>` : ''}
    `;
    // Add click handler for select all button
    const selectAllBtn = titleEl.querySelector(".category-select-all-btn");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleCategorySelection(cat);
      });
    }
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

  // Show empty state if no themes
  if (filteredThemes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "theme-drawer-empty";
    empty.textContent = drawerCollectionFilter === "starred"
      ? "No starred themes yet"
      : "No themes in this collection";
    elements.themeGridFull.appendChild(empty);
  }
}

function createThemeCardForDrawer(theme) {
  const isStarred = starredThemes.includes(theme.id);
  const card = document.createElement("div");
  card.className = "theme-card-expanded";
  card.dataset.themeId = theme.id;
  if (theme.id === state.theme) {
    card.classList.add("selected");
  }
  if (variationMode && selectedThemes.includes(theme.id)) {
    card.classList.add("variation-selected");
  }

  const preview = document.createElement("div");
  preview.className = "theme-card-preview";

  // Show all color values from the theme (skip metadata keys)
  const skipKeys = ["name", "description", "category", "id"];
  const colorKeys = Object.keys(theme.colors || {}).filter(k => !skipKeys.includes(k));
  colorKeys.forEach((key) => {
    const swatch = document.createElement("span");
    swatch.style.background = theme.colors[key];
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

  // Collection button
  const themeColls = getThemeCollections(theme.id);
  const collBtn = document.createElement("button");
  collBtn.type = "button";
  collBtn.className = `collection-btn ${themeColls.length > 0 ? "has-collections" : ""}`;
  collBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
  collBtn.title = "Add to collection";
  collBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openThemeCollectionMenu(theme.id, collBtn);
  });

  header.appendChild(name);
  header.appendChild(starBtn);
  header.appendChild(collBtn);

  const desc = document.createElement("div");
  desc.className = "theme-card-desc";
  desc.textContent = theme.description || "Custom palette";

  card.appendChild(preview);
  card.appendChild(header);
  card.appendChild(desc);

  card.addEventListener("click", (e) => {
    if (e.target.closest(".star-btn") || e.target.closest(".collection-btn")) return;
    if (variationMode) {
      toggleThemeSelection(theme.id);
    } else {
      selectTheme(theme.id);
      closeThemeDrawer();
    }
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
  drawerCollectionFilter = null;  // Reset filter
  renderThemeCollectionTabs();
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

  // Filter to only items with thumbnails (excludes SVG, PDF which don't have thumbs)
  const itemsWithThumbs = items.filter(item => item.has_thumb && item.thumb_url);
  galleryItems = itemsWithThumbs;
  window.galleryItems = itemsWithThumbs; // Make accessible for recent panel and modal
  renderGallery(itemsWithThumbs);

  // Update recent panel if open
  if (elements.recentPanel?.getAttribute("aria-hidden") === "false") {
    renderRecentGenerations();
  }

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
      elements.dpiSlider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (elements.dpiValue) {
      elements.dpiValue.textContent = config.dpi;
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
  // Items are already filtered to those with thumbnails by applyGalleryPayload

  // Reset lightbox strip so it rebuilds with filtered items
  lightboxBuiltCount = 0;

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
  // Use thumbnail for fast loading
  const src = `${item.thumb_url}?t=${item.mtime}`;

  elements.lightboxImage.src = src;

  // Build caption with details like quick load panel
  const city = item.config?.city || item.filename;
  const themeRaw = item.config?.theme || "";
  const theme = themeRaw ? themeRaw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "";
  const aspect = item.config?.aspect_ratio || "2:3";
  const dpi = item.config?.dpi || 300;
  const font = item.config?.font || "";

  const details = [theme, aspect, `${dpi} DPI`, font].filter(Boolean).join(" · ");
  elements.lightboxCaption.innerHTML = `<strong>${escapeHtml(city)}</strong>${details ? `<span class="lightbox-details">${escapeHtml(details)}</span>` : ""}`;

  // Set download link to full-size image
  if (elements.lightboxDownload) {
    elements.lightboxDownload.href = item.url;
    elements.lightboxDownload.download = item.filename;
  }

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
    // Use thumbnail for fast loading
    img.src = `${item.thumb_url}?t=${item.mtime}`;
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
    // Preload thumbnails for speed
    img.src = `${item.thumb_url}?t=${item.mtime}`;
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
  // Floating location search
  elements.locationSearchFloat?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchLocation(e.target.value), 300);
  });

  elements.locationSearchFloat?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchLocation(e.target.value);
    }
  });

  // Close search results when clicking outside
  document.addEventListener("click", (e) => {
    const floatContainer = document.getElementById("bottom-bar-float");
    if (!floatContainer?.contains(e.target)) {
      hideSearchResults();
    }
  });

  // Recent generations panel
  elements.recentToggle?.addEventListener("click", toggleRecentPanel);
  elements.recentClose?.addEventListener("click", closeRecentPanel);

  // City bookmarks panel
  elements.bookmarksToggle?.addEventListener("click", toggleBookmarksPanel);
  elements.bookmarksClose?.addEventListener("click", closeBookmarksPanel);
  elements.bookmarksSearch?.addEventListener("input", handleBookmarksSearch);

  // Preload city bookmarks
  loadCityBookmarks();

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

  // Gallery multi-select
  elements.galleryMultiselectBtn?.addEventListener("click", toggleGalleryMultiselect);
  elements.gallerySelectAllBtn?.addEventListener("click", selectAllGalleryItems);
  elements.bulkDeleteBtn?.addEventListener("click", bulkDeleteSelected);
  elements.bulkCreateCompositeBtn?.addEventListener("click", createCompositeImage);
  elements.galleryCancelSelectBtn?.addEventListener("click", cancelGalleryMultiselect);

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

  // Drawer action buttons - open samples in new tabs
  elements.fontSamplesBtn?.addEventListener("click", () => {
    window.open("/font-samples", "_blank");
  });
  elements.themeSamplesBtn?.addEventListener("click", () => {
    window.open("/theme-samples", "_blank");
  });
  elements.headerGalleryBtn?.addEventListener("click", openCollectionModal);
  elements.headerMockupBtn?.addEventListener("click", openMockupStudio);

  // Mockup Studio
  elements.mockupStudioClose?.addEventListener("click", closeMockupStudio);
  elements.mockupStudio?.querySelector(".mockup-studio-backdrop")?.addEventListener("click", closeMockupStudio);
  elements.mockupStudioAddTemplate?.addEventListener("click", () => {
    closeMockupStudio();
    openMockupCreator(true);
  });
  elements.mockupStudioBack?.addEventListener("click", mockupStudioGoBack);
  elements.mockupStudioCollectionFilter?.addEventListener("change", renderMockupStudioPosters);
  document.getElementById("mockup-studio-aspect-filter")?.addEventListener("change", renderMockupStudioTemplates);

  // Mockup Output Gallery
  elements.headerMockupGalleryBtn?.addEventListener("click", openMockupGallery);
  elements.mockupGalleryClose?.addEventListener("click", closeMockupGallery);
  elements.mockupGallery?.querySelector(".mockup-gallery-backdrop")?.addEventListener("click", closeMockupGallery);
  elements.mockupGalleryOpenFolder?.addEventListener("click", openMockupOutputFolder);

  // Theme drawer
  elements.browseThemesBtn?.addEventListener("click", openThemeDrawer);
  elements.variationModeBtn?.addEventListener("click", toggleVariationMode);
  elements.drawerClose?.addEventListener("click", closeThemeDrawer);
  elements.themeSearch?.addEventListener("input", (e) => filterThemes(e.target.value));

  // Theme view toggle (category/collection)
  elements.themeViewToggle?.addEventListener("click", (e) => {
    const btn = e.target.closest(".view-toggle-btn");
    if (btn && btn.dataset.view) {
      setThemePickerViewMode(btn.dataset.view);
    }
  });

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
    if (e.target.hasAttribute("data-lightbox-close") || e.target.closest("[data-lightbox-close]")) {
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
  document.getElementById("mockup-aspect-filter")?.addEventListener("change", renderMockupGrid);

  // Mockup creator
  elements.mockupCreatorClose?.addEventListener("click", closeMockupCreator);
  elements.mockupCreatorBack?.addEventListener("click", () => {
    closeMockupCreator();
    if (mockupCreatorFromStudio) {
      openMockupStudio();
    }
  });
  elements.mockupCreator?.addEventListener("click", (e) => {
    if (e.target.classList.contains("mockup-creator-backdrop")) {
      closeMockupCreator();
    }
  });
  elements.mockupTemplateFile?.addEventListener("change", handleMockupFileUpload);
  elements.mockupTemplateName?.addEventListener("input", updateMockupSaveBtn);
  elements.mockupSaveBtn?.addEventListener("click", saveMockupTemplate);

  // Canvas drawing (creator) - two-point click selection
  elements.mockupCreatorCanvas?.addEventListener("click", handleMockupCanvasClick);
  elements.mockupCreatorCanvas?.addEventListener("mousemove", handleMockupCanvasMouseMove);
  elements.mockupCreatorCanvas?.addEventListener("wheel", handleCreatorWheel, { passive: false });

  // Creator zoom controls
  elements.creatorZoomIn?.addEventListener("click", zoomCreatorIn);
  elements.creatorZoomOut?.addEventListener("click", zoomCreatorOut);
  elements.creatorZoomFit?.addEventListener("click", zoomCreatorFit);

  // Format selector
  elements.formatSelectorGrid?.addEventListener("click", handleFormatSelect);
  elements.formatScaleSlider?.addEventListener("input", handleFormatScaleChange);
  elements.formatScaleValue?.addEventListener("change", handleFormatScaleInput);
  elements.formatScaleUp?.addEventListener("click", () => adjustFormatScale(2));
  elements.formatScaleDown?.addEventListener("click", () => adjustFormatScale(-2));
  elements.formatPlaceBtn?.addEventListener("click", placeFormatOnCanvas);
  elements.formatClearBtn?.addEventListener("click", clearFormatRect);

  // Canvas drag for placed format
  elements.mockupCreatorCanvas?.addEventListener("mousedown", handleCreatorCanvasMouseDown);
  elements.mockupCreatorCanvas?.addEventListener("mousemove", handleCreatorCanvasMouseMove);
  elements.mockupCreatorCanvas?.addEventListener("mouseup", handleCreatorCanvasMouseUp);
  elements.mockupCreatorCanvas?.addEventListener("mouseleave", handleCreatorCanvasMouseUp);

  // Mockup preview
  elements.mockupPreviewClose?.addEventListener("click", closeMockupPreview);
  elements.mockupPreviewBack?.addEventListener("click", () => {
    closeMockupPreview();
    openMockupStudio();
  });
  elements.mockupPreview?.addEventListener("click", (e) => {
    if (e.target.classList.contains("mockup-preview-backdrop")) {
      closeMockupPreview();
    }
  });
  elements.mockupScaleSlider?.addEventListener("input", handleMockupPreviewScale);
  elements.mockupXSlider?.addEventListener("input", handleMockupPreviewOffsetX);
  elements.mockupYSlider?.addEventListener("input", handleMockupPreviewOffsetY);

  // Nudge buttons for fine adjustment
  document.querySelectorAll(".nudge-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const delta = parseInt(btn.dataset.delta, 10);
      const slider = document.getElementById(targetId);
      if (slider) {
        const newValue = parseInt(slider.value, 10) + delta;
        const min = parseInt(slider.min, 10);
        const max = parseInt(slider.max, 10);
        slider.value = Math.max(min, Math.min(max, newValue));
        slider.dispatchEvent(new Event("input"));
      }
    });
  });

  elements.mockupPreviewReset?.addEventListener("click", resetMockupPreview);
  elements.mockupPreviewGenerate?.addEventListener("click", generateMockupFromPreview);

  // Preview canvas drag
  elements.mockupPreviewCanvas?.addEventListener("mousedown", handlePreviewCanvasMouseDown);
  elements.mockupPreviewCanvas?.addEventListener("mousemove", handlePreviewCanvasMouseMove);
  elements.mockupPreviewCanvas?.addEventListener("mouseup", handlePreviewCanvasMouseUp);
  elements.mockupPreviewCanvas?.addEventListener("mouseleave", handlePreviewCanvasMouseUp);
  elements.mockupPreviewCanvas?.addEventListener("wheel", handlePreviewWheel, { passive: false });

  // Preview zoom controls
  elements.previewZoomIn?.addEventListener("click", zoomPreviewIn);
  elements.previewZoomOut?.addEventListener("click", zoomPreviewOut);
  elements.previewZoomFit?.addEventListener("click", zoomPreviewFit);

  // Mockup label buttons
  elements.addThemeLabel?.addEventListener("click", () => {
    const theme = mockupPreviewPoster?.config?.theme || "Theme";
    const formattedTheme = theme.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    addMockupLabel(formattedTheme, "theme");
  });
  elements.addFontLabel?.addEventListener("click", () => {
    const font = mockupPreviewPoster?.config?.font || "Font";
    addMockupLabel(font, "font");
  });
  elements.addAspectLabel?.addEventListener("click", () => {
    const aspect = mockupPreviewPoster?.config?.aspect_ratio || "2:3";
    addMockupLabel(aspect, "aspect");
  });
  elements.addCustomLabel?.addEventListener("click", () => {
    const text = prompt("Enter custom label text:");
    if (text && text.trim()) {
      addMockupLabel(text.trim(), "custom");
    }
  });

  // Asset upload
  elements.addAssetLayer?.addEventListener("click", () => {
    elements.assetFileInput?.click();
  });
  elements.assetFileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      addMockupAsset(file);
      e.target.value = "";  // Reset for next upload
    }
  });

  // Asset controls
  elements.assetWidthSlider?.addEventListener("input", (e) => {
    const selectedAsset = mockupAssets.find(a => mockupSelectedLayer === "asset-" + a.id);
    if (selectedAsset) {
      selectedAsset.width = parseFloat(e.target.value);
      if (elements.assetWidthValue) {
        elements.assetWidthValue.textContent = `${Math.round(selectedAsset.width)}%`;
      }
      renderMockupPreview();
    }
  });
  elements.assetOpacitySlider?.addEventListener("input", (e) => {
    const selectedAsset = mockupAssets.find(a => mockupSelectedLayer === "asset-" + a.id);
    if (selectedAsset) {
      selectedAsset.opacity = parseFloat(e.target.value);
      if (elements.assetOpacityValue) {
        elements.assetOpacityValue.textContent = `${Math.round(selectedAsset.opacity * 100)}%`;
      }
      renderMockupPreview();
    }
  });

  // Label keyboard delete
  document.addEventListener("keydown", handleLabelKeyDown);

  // Color swatches
  elements.mockupColorSwatches?.addEventListener("click", (e) => {
    const swatch = e.target.closest(".swatch");
    if (swatch && swatch.dataset.color) {
      elements.mockupLabelColor.value = swatch.dataset.color;
      // Highlight selected swatch
      elements.mockupColorSwatches.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
      swatch.classList.add("selected");
      // Update selected label color in real-time
      updateSelectedLabelProperty("color", swatch.dataset.color);
    }
  });

  // Real-time label property updates
  elements.mockupLabelFont?.addEventListener("change", (e) => {
    updateSelectedLabelProperty("font", e.target.value);
  });
  elements.mockupLabelSize?.addEventListener("input", (e) => {
    updateSelectedLabelProperty("size", parseInt(e.target.value, 10));
  });
  elements.mockupLabelColor?.addEventListener("input", (e) => {
    updateSelectedLabelProperty("color", e.target.value);
  });
  elements.mockupLabelShadow?.addEventListener("change", (e) => {
    updateSelectedLabelProperty("shadow", e.target.checked);
  });

  // Guides buttons
  elements.addHGuide?.addEventListener("click", () => addMockupGuide("h"));
  elements.addVGuide?.addEventListener("click", () => addMockupGuide("v"));
  elements.clearGuides?.addEventListener("click", clearMockupGuides);

  // Setup slider keyboard input
  setupSliderKeyboardInput();

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    // Escape closes overlays (check lightbox first since it opens on top of gallery modal)
    if (e.key === "Escape") {
      if (elements.lightbox?.classList.contains("open")) {
        closeLightbox();
      } else if (elements.mockupCreator?.classList.contains("open")) {
        closeMockupCreator();
      } else if (elements.mockupStudio?.classList.contains("open")) {
        closeMockupStudio();
      } else if (elements.mockupPreview?.classList.contains("open")) {
        closeMockupPreview();
      } else if (elements.mockupModal?.classList.contains("open")) {
        closeMockupModal();
      } else if (elements.collectionModal?.classList.contains("open")) {
        closeCollectionModal();
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

async function loadLibrary() {
  try {
    const response = await fetch("/api/library");
    const data = await response.json();
    libraryItems = data.items || [];
  } catch (err) {
    console.error("Failed to load library:", err);
    libraryItems = [];
  }
}

function renderLibraryGrid() {
  const grid = document.getElementById("mockup-library-grid");
  if (!grid) return;

  grid.innerHTML = "";

  if (!libraryItems.length) {
    grid.innerHTML = '<div class="library-empty">Drop images in the library/ folder</div>';
    return;
  }

  libraryItems.forEach(item => {
    const div = document.createElement("div");
    div.className = "library-item";
    div.title = item.name;
    div.innerHTML = `<img src="${item.url}" alt="${item.name}">`;
    div.addEventListener("click", () => addLibraryItemAsAsset(item));
    grid.appendChild(div);
  });
}

async function addLibraryItemAsAsset(item) {
  // Load the image and add it as an asset layer
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    pushMockupEditorHistory();
    const asset = {
      id: ++mockupAssetIdCounter,
      name: item.name,
      image: img,
      x: 50,  // Center position
      y: 50,
      width: 20,  // Default width percentage
      opacity: 1.0,
    };
    mockupAssets.push(asset);
    renderMockupLabelsListUI();
    renderMockupPreview();
    selectMockupLayer("asset-" + asset.id);
  };
  img.onerror = () => {
    console.error("Failed to load library item:", item.url);
  };
  img.src = item.url;
}

function openMockupModal(posterItem) {
  selectedPosterForMockup = posterItem;

  if (!mockupList.length) {
    alert("No mockup templates available. Add templates to the mockups/ folder.");
    return;
  }

  mockupModalCollectionFilter = null; // Reset filter when opening

  // Set aspect ratio filter to match poster's aspect ratio
  const aspectFilter = document.getElementById("mockup-aspect-filter");
  if (aspectFilter) {
    const posterAspect = posterItem?.config?.aspect_ratio || "";
    aspectFilter.value = posterAspect;
  }

  renderMockupModalCollectionTabs();
  renderMockupGrid();
  elements.mockupModal?.classList.add("open");
}

function closeMockupModal() {
  elements.mockupModal?.classList.remove("open");
  selectedPosterForMockup = null;
}

function renderMockupModalCollectionTabs() {
  const container = document.getElementById("mockup-modal-collection-tabs");
  if (!container) return;
  container.innerHTML = "";

  // "All" tab
  const allTab = document.createElement("button");
  allTab.className = "collection-tab" + (mockupModalCollectionFilter === null ? " active" : "");
  allTab.textContent = "All";
  allTab.addEventListener("click", () => {
    mockupModalCollectionFilter = null;
    renderMockupModalCollectionTabs();
    renderMockupGrid();
  });
  container.appendChild(allTab);

  // Collection tabs
  mockupCollectionList.forEach(coll => {
    const tab = document.createElement("button");
    tab.className = "collection-tab" + (mockupModalCollectionFilter === coll.id ? " active" : "");
    tab.textContent = coll.name;
    tab.addEventListener("click", () => {
      mockupModalCollectionFilter = coll.id;
      renderMockupModalCollectionTabs();
      renderMockupGrid();
    });
    container.appendChild(tab);
  });
}

function renderMockupGrid() {
  if (!elements.mockupGrid) return;
  elements.mockupGrid.innerHTML = "";

  // Filter mockups by collection
  let filteredMockups = mockupList;
  if (mockupModalCollectionFilter && mockupCollectionItems[mockupModalCollectionFilter]) {
    filteredMockups = mockupList.filter(m => mockupCollectionItems[mockupModalCollectionFilter].includes(m.id));
  }

  if (!filteredMockups.length) {
    const msg = mockupModalCollectionFilter
      ? "No mockups in this collection."
      : 'No mockup templates found. Click "New Template" to create one.';
    elements.mockupGrid.innerHTML = `<div class="mockup-placeholder">${msg}</div>`;
    return;
  }

  // Get poster aspect ratio for highlighting
  const posterAspect = selectedPosterForMockup?.config?.aspect_ratio || null;

  // Get aspect ratio filter
  const aspectFilter = document.getElementById("mockup-aspect-filter")?.value || "";

  // Apply aspect ratio filter if set
  if (aspectFilter) {
    filteredMockups = filteredMockups.filter(m => m.recommended_aspect === aspectFilter);
  }

  if (!filteredMockups.length) {
    const msg = aspectFilter
      ? `No mockups with ${aspectFilter} aspect ratio.`
      : mockupModalCollectionFilter
        ? "No mockups in this collection."
        : 'No mockup templates found. Click "New Template" to create one.';
    elements.mockupGrid.innerHTML = `<div class="mockup-placeholder">${msg}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  filteredMockups.forEach((mockup) => {
    const card = document.createElement("div");
    card.className = "mockup-card";
    card.dataset.mockupId = mockup.id;

    // Highlight if aspect ratio matches the poster
    if (posterAspect && mockup.recommended_aspect === posterAspect) {
      card.classList.add("aspect-match");
    }

    const img = document.createElement("img");
    img.src = mockup.thumbnail;
    img.alt = mockup.name;
    card.appendChild(img);

    // Add aspect ratio badge if set
    if (mockup.recommended_aspect) {
      const badge = document.createElement("span");
      badge.className = "mockup-aspect-badge";
      badge.textContent = mockup.recommended_aspect;
      card.appendChild(badge);
    }

    const footer = document.createElement("div");
    footer.className = "mockup-card-footer";

    const name = document.createElement("div");
    name.className = "mockup-card-name";
    name.textContent = mockup.name;
    footer.appendChild(name);

    const editBtn = document.createElement("button");
    editBtn.className = "mockup-edit-btn";
    editBtn.type = "button";
    editBtn.title = "Edit template";
    editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMockupCreatorForEdit(mockup);
    });
    footer.appendChild(editBtn);

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

async function openMockupPreview(mockup, poster = null) {
  // Use provided poster or fall back to selectedPosterForMockup
  const posterToUse = poster || selectedPosterForMockup;
  if (!posterToUse) return;

  mockupPreviewTemplate = mockup;
  mockupPreviewPoster = posterToUse;
  mockupPreviewScale = 1.0;
  mockupPreviewOffsetX = 0;
  mockupPreviewOffsetY = 0;
  mockupPreviewZoom = 1.0;

  // Reset drag states
  mockupPreviewDragging = false;
  mockupLabelDragging = false;
  mockupAssetDragging = false;

  // Clear undo/redo history for new session
  clearMockupEditorHistory();

  // Reset sliders
  if (elements.mockupScaleSlider) {
    elements.mockupScaleSlider.value = 1;
    elements.mockupScaleValue.value = "100%";
  }
  if (elements.mockupXSlider) {
    elements.mockupXSlider.value = 0;
    elements.mockupXValue.value = "0px";
  }
  if (elements.mockupYSlider) {
    elements.mockupYSlider.value = 0;
    elements.mockupYValue.value = "0px";
  }

  // Reset zoom display
  updatePreviewZoomDisplay();

  // Load saved guides, labels, and assets from template
  loadMockupGuides(mockup.guides || []);
  loadMockupLabels(mockup.labels || []);
  loadMockupAssets(mockup.assets || []);

  // Close mockup modal and show preview
  closeMockupModal();
  elements.mockupPreview?.classList.add("open");

  // Render library grid
  renderLibraryGrid();

  // Load images
  try {
    console.log("Mockup object:", mockup);
    console.log("Poster object:", mockupPreviewPoster);

    const posterUrl = mockupPreviewPoster?.url;

    if (!posterUrl) {
      throw new Error("Poster URL is missing");
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
    mockupPreviewPosterImg = posterImg;

    // Handle blank canvas vs regular template
    if (mockup.isBlankCanvas) {
      // Create a blank canvas matching the poster's exact dimensions
      const blankCanvas = document.createElement("canvas");
      blankCanvas.width = posterImg.width;
      blankCanvas.height = posterImg.height;
      const ctx = blankCanvas.getContext("2d");
      ctx.fillStyle = mockup.backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, blankCanvas.width, blankCanvas.height);

      // Convert canvas to image
      const blankImg = new Image();
      blankImg.src = blankCanvas.toDataURL("image/png");
      await new Promise(resolve => { blankImg.onload = resolve; });

      mockupPreviewTemplateImg = blankImg;

      // Update the template rect to cover the full canvas with actual pixel dimensions
      mockupPreviewTemplate.poster_rect = { x: 0, y: 0, width: posterImg.width, height: posterImg.height };
      mockupPreviewTemplate.canvasWidth = posterImg.width;
      mockupPreviewTemplate.canvasHeight = posterImg.height;

      console.log("Blank canvas template created with poster dimensions:", posterImg.width, "x", posterImg.height);
    } else {
      // Load regular template image
      const templateUrl = mockup?.thumbnail;
      console.log("Template URL:", templateUrl);

      if (!templateUrl) {
        throw new Error("Mockup template URL is missing");
      }

      let templateImg;
      try {
        templateImg = await loadImage(templateUrl);
        console.log("Template loaded successfully");
      } catch (e) {
        console.error("Failed to load template image:", templateUrl, e);
        throw new Error("Failed to load mockup template image");
      }
      mockupPreviewTemplateImg = templateImg;
    }

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
    elements.mockupScaleValue.value = "100%";
  }
  if (elements.mockupXSlider) {
    elements.mockupXSlider.value = 0;
    elements.mockupXValue.value = "0px";
  }
  if (elements.mockupYSlider) {
    elements.mockupYSlider.value = 0;
    elements.mockupYValue.value = "0px";
  }

  // Clear labels and guides on reset
  clearMockupLabels();
  clearMockupGuides();

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
  const baseScale = Math.min(maxWidth / template.width, maxHeight / template.height, 1);

  // Apply user zoom on top of base scale
  const displayScale = baseScale * mockupPreviewZoom;

  canvas.width = template.width * displayScale;
  canvas.height = template.height * displayScale;
  canvas.dataset.displayScale = displayScale;
  canvas.dataset.baseScale = baseScale;
  canvas.dataset.zoom = mockupPreviewZoom;

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

  // Draw guides
  mockupGuides.forEach(guide => {
    ctx.strokeStyle = "rgba(0, 150, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    if (guide.type === "h") {
      const y = (guide.position / 100) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    } else {
      const x = (guide.position / 100) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  });

  // Draw assets (before labels, so labels appear on top)
  mockupAssets.forEach(asset => {
    if (!asset.image) return;

    const x = (asset.x / 100) * canvas.width;
    const y = (asset.y / 100) * canvas.height;
    const w = (asset.width / 100) * canvas.width;
    const h = (w / asset.image.width) * asset.image.height;

    ctx.globalAlpha = asset.opacity;
    ctx.drawImage(asset.image, x - w/2, y - h/2, w, h);
    ctx.globalAlpha = 1.0;

    // Draw selection indicator
    if (mockupSelectedLayer === "asset-" + asset.id) {
      ctx.strokeStyle = "#00aaff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x - w/2 - 2, y - h/2 - 2, w + 4, h + 4);
      ctx.setLineDash([]);
    }
  });

  // Draw labels
  mockupLabels.forEach(label => {
    const x = (label.x / 100) * canvas.width;
    const y = (label.y / 100) * canvas.height;

    ctx.font = `${label.size}px "${label.font}"`;
    ctx.fillStyle = label.color;
    ctx.textBaseline = "alphabetic";

    // Draw text shadow if enabled for this label
    if (label.shadow) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    ctx.fillText(label.text, x, y);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw selection indicator
    if (mockupSelectedLayer === label.id) {
      const metrics = ctx.measureText(label.text);
      ctx.strokeStyle = "#00aaff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x - 2, y - label.size, metrics.width + 4, label.size + 4);
      ctx.setLineDash([]);
    }
  });
}

function handleMockupPreviewScale(e) {
  mockupPreviewScale = parseFloat(e.target.value);
  if (elements.mockupScaleValue) {
    elements.mockupScaleValue.value = Math.round(mockupPreviewScale * 100) + "%";
  }
  renderMockupPreview();
}

function handleMockupPreviewOffsetX(e) {
  mockupPreviewOffsetX = parseInt(e.target.value, 10);
  if (elements.mockupXValue) {
    elements.mockupXValue.value = mockupPreviewOffsetX + "px";
  }
  renderMockupPreview();
}

function handleMockupPreviewOffsetY(e) {
  mockupPreviewOffsetY = parseInt(e.target.value, 10);
  if (elements.mockupYValue) {
    elements.mockupYValue.value = mockupPreviewOffsetY + "px";
  }
  renderMockupPreview();
}

// Drag to reposition poster or labels
function handlePreviewCanvasMouseDown(e) {
  // First check if clicking on a label/asset (this auto-selects that layer)
  if (handleLabelCanvasMouseDown(e)) {
    return;  // Label/asset handling took over
  }

  // Only allow poster dragging if poster layer is already selected
  // Do NOT auto-select poster layer - only layer tree should change selection
  if (mockupSelectedLayer !== "poster") {
    return;
  }

  // Save state before drag starts
  pushMockupEditorHistory();

  // Handle poster dragging
  mockupPreviewDragging = true;
  mockupPreviewDragStartX = e.clientX;
  mockupPreviewDragStartY = e.clientY;
  e.target.style.cursor = "grabbing";
}

function handlePreviewCanvasMouseMove(e) {
  // First check label dragging
  if (handleLabelCanvasMouseMove(e)) {
    return;
  }

  // Only move poster if poster layer is selected
  if (!mockupPreviewDragging || mockupSelectedLayer !== "poster") return;

  const displayScale = parseFloat(elements.mockupPreviewCanvas?.dataset.displayScale) || 1;
  const dx = (e.clientX - mockupPreviewDragStartX) / displayScale;
  const dy = (e.clientY - mockupPreviewDragStartY) / displayScale;

  mockupPreviewOffsetX += dx;
  mockupPreviewOffsetY += dy;

  // Update sliders
  if (elements.mockupXSlider) {
    elements.mockupXSlider.value = Math.max(-500, Math.min(500, mockupPreviewOffsetX));
    elements.mockupXValue.value = Math.round(mockupPreviewOffsetX) + "px";
  }
  if (elements.mockupYSlider) {
    elements.mockupYSlider.value = Math.max(-500, Math.min(500, mockupPreviewOffsetY));
    elements.mockupYValue.value = Math.round(mockupPreviewOffsetY) + "px";
  }

  mockupPreviewDragStartX = e.clientX;
  mockupPreviewDragStartY = e.clientY;

  renderMockupPreview();
}

function handlePreviewCanvasMouseUp() {
  mockupPreviewDragging = false;
  mockupLabelDragging = false;
  mockupAssetDragging = false;
  mockupDragTarget = null;  // Clear drag target
  if (elements.mockupPreviewCanvas) {
    elements.mockupPreviewCanvas.style.cursor = "grab";
  }
}

// ===== MOCKUP LABELS =====

function addMockupLabel(text, type = "custom") {
  pushMockupEditorHistory();

  const font = elements.mockupLabelFont?.value || "Arial";
  const size = parseInt(elements.mockupLabelSize?.value, 10) || 24;
  const color = elements.mockupLabelColor?.value || "#ffffff";
  const shadow = elements.mockupLabelShadow?.checked !== false;

  const label = {
    id: ++mockupLabelIdCounter,
    text,
    type,
    x: 50,  // Default position (percentage of canvas)
    y: 50,
    font,
    size,
    color,
    shadow,
  };

  mockupLabels.push(label);
  renderMockupLabelsListUI();
  renderMockupPreview();
  selectMockupLayer(label.id);
}

function removeMockupLabel(labelId, skipHistory = false) {
  if (!skipHistory) pushMockupEditorHistory();
  mockupLabels = mockupLabels.filter(l => l.id !== labelId);
  if (mockupSelectedLayer === labelId) {
    mockupSelectedLayer = "poster";
  }
  renderMockupLabelsListUI();
  renderMockupPreview();
}

function selectMockupLayer(layerId) {
  mockupSelectedLayer = layerId;

  // Populate label controls with selected label's properties
  const label = mockupLabels.find(l => l.id === layerId);
  if (label) {
    if (elements.mockupLabelFont) elements.mockupLabelFont.value = label.font || "Arial";
    if (elements.mockupLabelSize) elements.mockupLabelSize.value = label.size || 24;
    if (elements.mockupLabelColor) elements.mockupLabelColor.value = label.color || "#ffffff";
    if (elements.mockupLabelShadow) elements.mockupLabelShadow.checked = label.shadow !== false;
  }

  renderMockupLabelsListUI();
  renderMockupPreview();
}

function updateSelectedLabelProperty(property, value) {
  // Only update if a label layer is selected (labels have numeric IDs)
  if (mockupSelectedLayer === "poster") {
    return;
  }
  if (typeof mockupSelectedLayer === "string" && mockupSelectedLayer.startsWith("asset-")) {
    return;
  }

  const label = mockupLabels.find(l => l.id === mockupSelectedLayer);
  if (label) {
    label[property] = value;
    renderMockupPreview();
  }
}

function clearMockupLabels() {
  mockupLabels = [];
  mockupSelectedLayer = "poster";
  mockupLabelIdCounter = 0;
  renderMockupLabelsListUI();
}

function renderMockupLabelsListUI() {
  const list = elements.mockupLabelsList;
  if (!list) return;

  list.innerHTML = "";

  // Add Poster layer (non-deleteable) at the top
  const posterItem = document.createElement("div");
  posterItem.className = "mockup-layer-item poster-layer" + (mockupSelectedLayer === "poster" ? " selected" : "");
  posterItem.innerHTML = `
    <span class="layer-icon">
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
      </svg>
    </span>
    <span class="layer-text">Poster</span>
    <span class="layer-lock">
      <svg viewBox="0 0 24 24" width="12" height="12">
        <path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
      </svg>
    </span>
  `;
  posterItem.addEventListener("click", () => selectMockupLayer("poster"));
  list.appendChild(posterItem);

  // Add asset layers
  mockupAssets.forEach(asset => {
    const item = document.createElement("div");
    item.className = "mockup-layer-item asset-layer" + (mockupSelectedLayer === "asset-" + asset.id ? " selected" : "");
    item.innerHTML = `
      <span class="layer-icon asset-icon">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      </span>
      <span class="layer-text">${escapeHtml(asset.filename)}</span>
      <button type="button" class="layer-remove" title="Remove">×</button>
    `;
    item.addEventListener("click", (e) => {
      if (!e.target.classList.contains("layer-remove")) {
        selectMockupLayer("asset-" + asset.id);
      }
    });
    item.querySelector(".layer-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      removeMockupAsset(asset.id);
    });
    list.appendChild(item);
  });

  // Add label layers
  mockupLabels.forEach(label => {
    const item = document.createElement("div");
    item.className = "mockup-layer-item label-layer" + (mockupSelectedLayer === label.id ? " selected" : "");
    item.innerHTML = `
      <span class="layer-icon label-icon">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/>
        </svg>
      </span>
      <span class="layer-text" style="color: ${label.color}">${escapeHtml(label.text)}</span>
      <button type="button" class="layer-remove" title="Remove">×</button>
    `;
    item.addEventListener("click", (e) => {
      if (!e.target.classList.contains("layer-remove")) {
        selectMockupLayer(label.id);
      }
    });
    item.querySelector(".layer-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      removeMockupLabel(label.id);
    });
    list.appendChild(item);
  });

  // Update asset controls visibility
  updateAssetControls();
}

function getLabelAtPosition(canvasX, canvasY) {
  const canvas = elements.mockupPreviewCanvas;
  if (!canvas) return null;

  const ctx = canvas.getContext("2d");

  // Check labels in reverse order (top-most first)
  for (let i = mockupLabels.length - 1; i >= 0; i--) {
    const label = mockupLabels[i];
    const x = (label.x / 100) * canvas.width;
    const y = (label.y / 100) * canvas.height;

    ctx.font = `${label.size}px "${label.font}"`;
    const metrics = ctx.measureText(label.text);
    const width = metrics.width;
    const height = label.size;

    // Check if click is within label bounds
    if (canvasX >= x && canvasX <= x + width &&
        canvasY >= y - height && canvasY <= y) {
      return label;
    }
  }
  return null;
}

// ===== MOCKUP ASSET FUNCTIONS =====
function addMockupAsset(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      pushMockupEditorHistory();
      const asset = {
        id: ++mockupAssetIdCounter,
        type: "asset",
        src: e.target.result,
        filename: file.name,
        image: img,
        x: 50,  // Center position (percentage)
        y: 50,
        width: 20,  // Percentage of canvas width
        opacity: 1.0
      };
      mockupAssets.push(asset);
      // Reset drag state to prevent accidental dragging
      mockupAssetDragging = false;
      mockupLabelDragging = false;
      renderMockupLabelsListUI();
      renderMockupPreview();
      selectMockupLayer("asset-" + asset.id);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeMockupAsset(assetId) {
  pushMockupEditorHistory();
  mockupAssets = mockupAssets.filter(a => a.id !== assetId);
  if (mockupSelectedLayer === "asset-" + assetId) {
    mockupSelectedLayer = "poster";
  }
  renderMockupLabelsListUI();
  renderMockupPreview();
}

function getAssetAtPosition(canvasX, canvasY) {
  const canvas = elements.mockupPreviewCanvas;
  if (!canvas) return null;

  // Check assets in reverse order (top-most first)
  for (let i = mockupAssets.length - 1; i >= 0; i--) {
    const asset = mockupAssets[i];
    if (!asset.image) continue;

    const x = (asset.x / 100) * canvas.width;
    const y = (asset.y / 100) * canvas.height;
    const w = (asset.width / 100) * canvas.width;
    const h = (w / asset.image.width) * asset.image.height;

    // Check if click is within asset bounds (centered on position)
    if (canvasX >= x - w/2 && canvasX <= x + w/2 &&
        canvasY >= y - h/2 && canvasY <= y + h/2) {
      return asset;
    }
  }
  return null;
}

function updateAssetControls() {
  const selectedAsset = mockupAssets.find(a => mockupSelectedLayer === "asset-" + a.id);

  if (selectedAsset) {
    if (elements.mockupAssetControls) {
      elements.mockupAssetControls.style.display = "block";
    }
    if (elements.assetWidthSlider) {
      elements.assetWidthSlider.value = selectedAsset.width;
    }
    if (elements.assetWidthValue) {
      elements.assetWidthValue.textContent = `${Math.round(selectedAsset.width)}%`;
    }
    if (elements.assetOpacitySlider) {
      elements.assetOpacitySlider.value = selectedAsset.opacity;
    }
    if (elements.assetOpacityValue) {
      elements.assetOpacityValue.textContent = `${Math.round(selectedAsset.opacity * 100)}%`;
    }
  } else {
    if (elements.mockupAssetControls) {
      elements.mockupAssetControls.style.display = "none";
    }
  }
}

function clearMockupAssets() {
  mockupAssets = [];
  mockupAssetIdCounter = 0;
}

function loadMockupAssets(assetsData) {
  mockupAssets = [];
  mockupAssetIdCounter = 0;
  mockupAssetDragging = false;  // Reset drag state

  if (!assetsData || !assetsData.length) return;

  assetsData.forEach(data => {
    const img = new Image();
    img.onload = () => {
      const asset = {
        id: ++mockupAssetIdCounter,
        type: "asset",
        src: data.src,
        filename: data.filename,
        image: img,
        x: data.x || 50,
        y: data.y || 50,
        width: data.width || 20,
        opacity: data.opacity !== undefined ? data.opacity : 1.0
      };
      mockupAssets.push(asset);
      renderMockupLabelsListUI();
      renderMockupPreview();
    };
    img.src = data.src;
  });
}

function handleLabelCanvasMouseDown(e) {
  const canvas = elements.mockupPreviewCanvas;
  if (!canvas) return false;

  const rect = canvas.getBoundingClientRect();
  // Convert screen coordinates to canvas pixel coordinates (accounting for CSS scaling)
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  // Check assets first (they're drawn first, so labels are on top)
  const asset = getAssetAtPosition(canvasX, canvasY);
  if (asset) {
    e.stopPropagation();
    pushMockupEditorHistory();  // Save state before drag
    selectMockupLayer("asset-" + asset.id);
    mockupAssetDragging = true;
    mockupDragTarget = asset;  // Store the actual asset being dragged
    mockupLabelDragStartX = e.clientX;
    mockupLabelDragStartY = e.clientY;
    canvas.style.cursor = "move";
    return true;
  }

  // Then check labels
  const label = getLabelAtPosition(canvasX, canvasY);
  if (label) {
    e.stopPropagation();
    pushMockupEditorHistory();  // Save state before drag
    selectMockupLayer(label.id);
    mockupLabelDragging = true;
    mockupDragTarget = label;  // Store the actual label being dragged
    mockupLabelDragStartX = e.clientX;
    mockupLabelDragStartY = e.clientY;
    canvas.style.cursor = "move";
    return true;  // Indicate we handled the event
  }

  // Clicked on empty space - clear drag target
  mockupDragTarget = null;
  return false;  // Let poster dragging handle it
}

function handleLabelCanvasMouseMove(e) {
  const canvas = elements.mockupPreviewCanvas;
  if (!canvas) return false;

  // Only drag if we have an explicit drag target (set on mousedown)
  if (!mockupDragTarget) return false;

  // Handle asset dragging - use the actual drag target, not selected layer
  if (mockupAssetDragging && mockupDragTarget.type === undefined) {
    // mockupDragTarget is an asset (assets don't have 'type' property like labels do)
    const asset = mockupDragTarget;

    const dx = e.clientX - mockupLabelDragStartX;
    const dy = e.clientY - mockupLabelDragStartY;

    // Get the CSS display scale for proper movement calculation
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;

    asset.x += (dx * scaleX / canvas.width) * 100;
    asset.y += (dy * scaleX / canvas.height) * 100;

    asset.x = Math.max(0, Math.min(100, asset.x));
    asset.y = Math.max(0, Math.min(100, asset.y));

    mockupLabelDragStartX = e.clientX;
    mockupLabelDragStartY = e.clientY;

    renderMockupPreview();
    return true;
  }

  // Handle label dragging - use the actual drag target
  if (!mockupLabelDragging) return false;

  const label = mockupDragTarget;
  if (!label || label.id === undefined) return false;

  const dx = e.clientX - mockupLabelDragStartX;
  const dy = e.clientY - mockupLabelDragStartY;

  // Get the CSS display scale for proper movement calculation
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;

  // Convert pixel delta to percentage (accounting for scale)
  label.x += (dx * scaleX / canvas.width) * 100;
  label.y += (dy * scaleX / canvas.height) * 100;

  // Clamp to canvas bounds
  label.x = Math.max(0, Math.min(100, label.x));
  label.y = Math.max(0, Math.min(100, label.y));

  // Snap to guides if enabled
  if (elements.mockupSnapEnabled?.checked) {
    const snapThresholdPercent = (SNAP_THRESHOLD / canvas.width) * 100;

    mockupGuides.forEach(guide => {
      if (guide.type === "v") {
        // Snap left edge of label to vertical guide
        if (Math.abs(label.x - guide.position) < snapThresholdPercent) {
          label.x = guide.position;
        }
      } else {
        // Snap baseline of label to horizontal guide
        if (Math.abs(label.y - guide.position) < snapThresholdPercent) {
          label.y = guide.position;
        }
      }
    });
  }

  mockupLabelDragStartX = e.clientX;
  mockupLabelDragStartY = e.clientY;

  renderMockupPreview();
  return true;
}

function handleLabelKeyDown(e) {
  // Only handle keys when mockup preview is open
  if (!elements.mockupPreview?.classList.contains("open")) return;

  // Handle Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      if (e.shiftKey) {
        redoMockupEditor();
      } else {
        undoMockupEditor();
      }
      return;
    }
    if (e.key === "y" || e.key === "Y") {
      e.preventDefault();
      redoMockupEditor();
      return;
    }
  }

  // Handle Delete/Backspace for deleting selected layer
  if (e.key === "Delete" || e.key === "Backspace") {
    // Only delete label/asset layers, not the poster
    if (mockupSelectedLayer && mockupSelectedLayer !== "poster") {
      // Don't delete if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();

      if (typeof mockupSelectedLayer === "string" && mockupSelectedLayer.startsWith("asset-")) {
        const assetId = parseInt(mockupSelectedLayer.replace("asset-", ""), 10);
        removeMockupAsset(assetId);
      } else {
        removeMockupLabel(mockupSelectedLayer);
      }
    }
  }
}

// ===== MOCKUP GUIDES =====

function addMockupGuide(type) {
  pushMockupEditorHistory();
  const guide = {
    id: ++mockupGuideIdCounter,
    type,  // 'h' or 'v'
    position: 50,  // Default to center (percentage)
  };
  mockupGuides.push(guide);
  renderMockupGuidesListUI();
  renderMockupPreview();
}

function removeMockupGuide(guideId) {
  pushMockupEditorHistory();
  mockupGuides = mockupGuides.filter(g => g.id !== guideId);
  renderMockupGuidesListUI();
  renderMockupPreview();
}

function clearMockupGuides() {
  mockupGuides = [];
  mockupGuideIdCounter = 0;
  renderMockupGuidesListUI();
  renderMockupPreview();
}

// ===== MOCKUP EDITOR UNDO/REDO =====

function saveMockupEditorState() {
  // Deep clone labels (without circular refs)
  const labelsCopy = mockupLabels.map(l => ({
    id: l.id,
    text: l.text,
    x: l.x,
    y: l.y,
    font: l.font,
    size: l.size,
    color: l.color,
    shadow: l.shadow
  }));

  // Clone assets (store image src, not object)
  const assetsCopy = mockupAssets.map(a => ({
    id: a.id,
    src: a.src,
    filename: a.filename,
    x: a.x,
    y: a.y,
    width: a.width,
    opacity: a.opacity
  }));

  // Clone guides
  const guidesCopy = mockupGuides.map(g => ({
    id: g.id,
    type: g.type,
    position: g.position
  }));

  return {
    labels: labelsCopy,
    assets: assetsCopy,
    guides: guidesCopy,
    scale: mockupPreviewScale,
    offsetX: mockupPreviewOffsetX,
    offsetY: mockupPreviewOffsetY,
    selectedLayer: mockupSelectedLayer,
    labelIdCounter: mockupLabelIdCounter,
    assetIdCounter: mockupAssetIdCounter,
    guideIdCounter: mockupGuideIdCounter
  };
}

function pushMockupEditorHistory() {
  const state = saveMockupEditorState();
  mockupEditorHistory.push(state);

  // Limit history size
  if (mockupEditorHistory.length > MOCKUP_HISTORY_LIMIT) {
    mockupEditorHistory.shift();
  }

  // Clear redo stack when new action is performed
  mockupEditorRedoStack = [];
}

function restoreMockupEditorState(state) {
  // Restore labels
  mockupLabels = state.labels.map(l => ({ ...l }));
  mockupLabelIdCounter = state.labelIdCounter;

  // Restore assets (need to reload images)
  const oldAssetImages = {};
  mockupAssets.forEach(a => {
    if (a.image) oldAssetImages[a.src] = a.image;
  });

  mockupAssets = state.assets.map(a => {
    const asset = { ...a };
    // Try to reuse existing image object
    if (oldAssetImages[a.src]) {
      asset.image = oldAssetImages[a.src];
    } else {
      // Need to reload image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = a.src;
      img.onload = () => {
        asset.image = img;
        renderMockupPreview();
      };
    }
    return asset;
  });
  mockupAssetIdCounter = state.assetIdCounter;

  // Restore guides
  mockupGuides = state.guides.map(g => ({ ...g }));
  mockupGuideIdCounter = state.guideIdCounter;

  // Restore poster position
  mockupPreviewScale = state.scale;
  mockupPreviewOffsetX = state.offsetX;
  mockupPreviewOffsetY = state.offsetY;
  mockupSelectedLayer = state.selectedLayer;

  // Update UI
  if (elements.mockupScaleSlider) elements.mockupScaleSlider.value = mockupPreviewScale;
  if (elements.mockupScaleValue) elements.mockupScaleValue.value = Math.round(mockupPreviewScale * 100) + "%";
  if (elements.mockupXSlider) elements.mockupXSlider.value = mockupPreviewOffsetX;
  if (elements.mockupXValue) elements.mockupXValue.value = mockupPreviewOffsetX + "px";
  if (elements.mockupYSlider) elements.mockupYSlider.value = mockupPreviewOffsetY;
  if (elements.mockupYValue) elements.mockupYValue.value = mockupPreviewOffsetY + "px";

  renderMockupLabelsListUI();
  renderMockupGuidesListUI();
  renderMockupPreview();
}

function undoMockupEditor() {
  if (mockupEditorHistory.length === 0) return;

  // Save current state for redo
  const currentState = saveMockupEditorState();
  mockupEditorRedoStack.push(currentState);

  // Restore previous state
  const previousState = mockupEditorHistory.pop();
  restoreMockupEditorState(previousState);
}

function redoMockupEditor() {
  if (mockupEditorRedoStack.length === 0) return;

  // Save current state for undo
  const currentState = saveMockupEditorState();
  mockupEditorHistory.push(currentState);

  // Restore redo state
  const redoState = mockupEditorRedoStack.pop();
  restoreMockupEditorState(redoState);
}

function clearMockupEditorHistory() {
  mockupEditorHistory = [];
  mockupEditorRedoStack = [];
}

function loadMockupGuides(guides) {
  mockupGuides = [];
  mockupGuideIdCounter = 0;

  if (Array.isArray(guides)) {
    guides.forEach(g => {
      mockupGuides.push({
        id: ++mockupGuideIdCounter,
        type: g.type || "h",
        position: g.position || 50
      });
    });
  }

  renderMockupGuidesListUI();
}

function loadMockupLabels(labels) {
  mockupLabels = [];
  mockupLabelIdCounter = 0;
  mockupSelectedLayer = "poster";

  if (Array.isArray(labels)) {
    labels.forEach(l => {
      mockupLabels.push({
        id: ++mockupLabelIdCounter,
        text: l.text || "",
        type: l.type || "custom",
        x: l.x ?? 50,
        y: l.y ?? 50,
        font: l.font || "Arial",
        size: l.size || 24,
        color: l.color || "#ffffff",
        shadow: l.shadow !== false,
      });
    });
  }

  renderMockupLabelsListUI();
}

async function saveMockupGuides() {
  await saveMockupTemplateData();
}

async function saveMockupTemplateData() {
  if (!mockupPreviewTemplate?.id) return;

  // Prepare guides data (strip internal ids)
  const guidesData = mockupGuides.map(g => ({
    type: g.type,
    position: g.position
  }));

  // Prepare labels data (strip internal ids)
  const labelsData = mockupLabels.map(l => ({
    text: l.text,
    type: l.type,
    x: l.x,
    y: l.y,
    font: l.font,
    size: l.size,
    color: l.color,
    shadow: l.shadow,
  }));

  // Prepare assets data (strip internal image objects)
  const assetsData = mockupAssets.map(a => ({
    src: a.src,
    filename: a.filename,
    x: a.x,
    y: a.y,
    width: a.width,
    opacity: a.opacity,
  }));

  try {
    await fetch(`/api/mockups/${mockupPreviewTemplate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guides: guidesData, labels: labelsData, assets: assetsData })
    });

    // Update the template in mockupList so it persists in memory too
    const template = mockupList.find(m => m.id === mockupPreviewTemplate.id);
    if (template) {
      template.guides = guidesData;
      template.labels = labelsData;
      template.assets = assetsData;
    }
  } catch (err) {
    console.error("Failed to save mockup template data:", err);
  }
}

function updateGuidePosition(guideId, position) {
  const guide = mockupGuides.find(g => g.id === guideId);
  if (guide) {
    guide.position = Math.max(0, Math.min(100, position));
    renderMockupPreview();
  }
}

function renderMockupGuidesListUI() {
  const list = elements.mockupGuidesList;
  if (!list) return;

  list.innerHTML = "";

  mockupGuides.forEach(guide => {
    const item = document.createElement("div");
    item.className = "mockup-guide-item";
    item.innerHTML = `
      <span class="guide-type">${guide.type === "h" ? "H" : "V"}</span>
      <input type="number" class="guide-position" value="${Math.round(guide.position)}" min="0" max="100" title="Position %">
      <span class="guide-unit">%</span>
      <button type="button" class="guide-remove" title="Remove">×</button>
    `;

    const posInput = item.querySelector(".guide-position");
    posInput.addEventListener("change", (e) => {
      updateGuidePosition(guide.id, parseFloat(e.target.value) || 0);
    });

    item.querySelector(".guide-remove").addEventListener("click", () => {
      removeMockupGuide(guide.id);
    });

    list.appendChild(item);
  });
}

// ===== MOCKUP LABEL FONT SELECTOR =====

function populateMockupLabelFonts() {
  const select = elements.mockupLabelFont;
  if (!select || fontList.length === 0) return;

  select.innerHTML = "";

  // Add system fonts first
  const systemFonts = ["Arial", "Helvetica", "Georgia", "Times New Roman", "Verdana"];
  const optgroupSystem = document.createElement("optgroup");
  optgroupSystem.label = "System Fonts";
  systemFonts.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    opt.style.fontFamily = `"${f}", sans-serif`;
    optgroupSystem.appendChild(opt);
  });
  select.appendChild(optgroupSystem);

  // Add app fonts
  const optgroupApp = document.createElement("optgroup");
  optgroupApp.label = "Poster Fonts";
  fontList.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.textContent = f;
    opt.style.fontFamily = `"${f}", sans-serif`;
    optgroupApp.appendChild(opt);
  });
  select.appendChild(optgroupApp);
}

// ===== SLIDER KEYBOARD INPUT HANDLERS =====

function setupSliderKeyboardInput() {
  // Scale slider
  const scaleInput = elements.mockupScaleValue;
  if (scaleInput) {
    scaleInput.addEventListener("change", (e) => {
      let val = e.target.value.replace("%", "").trim();
      val = parseFloat(val);
      if (!isNaN(val)) {
        val = Math.max(10, Math.min(200, val)) / 100;
        mockupPreviewScale = val;
        elements.mockupScaleSlider.value = val;
        e.target.value = Math.round(val * 100) + "%";
        renderMockupPreview();
      }
    });
    scaleInput.addEventListener("focus", (e) => e.target.select());
  }

  // X offset slider
  const xInput = elements.mockupXValue;
  if (xInput) {
    xInput.addEventListener("change", (e) => {
      let val = e.target.value.replace("px", "").trim();
      val = parseInt(val, 10);
      if (!isNaN(val)) {
        val = Math.max(-500, Math.min(500, val));
        mockupPreviewOffsetX = val;
        elements.mockupXSlider.value = val;
        e.target.value = val + "px";
        renderMockupPreview();
      }
    });
    xInput.addEventListener("focus", (e) => e.target.select());
  }

  // Y offset slider
  const yInput = elements.mockupYValue;
  if (yInput) {
    yInput.addEventListener("change", (e) => {
      let val = e.target.value.replace("px", "").trim();
      val = parseInt(val, 10);
      if (!isNaN(val)) {
        val = Math.max(-500, Math.min(500, val));
        mockupPreviewOffsetY = val;
        elements.mockupYSlider.value = val;
        e.target.value = val + "px";
        renderMockupPreview();
      }
    });
    yInput.addEventListener("focus", (e) => e.target.select());
  }
}

function renderMockupFullResolution() {
  // Create an offscreen canvas at full template resolution
  const template = mockupPreviewTemplateImg;
  const poster = mockupPreviewPosterImg;
  if (!template || !poster) return null;

  const canvas = document.createElement("canvas");
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext("2d");

  const rect = mockupPreviewTemplate?.poster_rect || {};

  // Draw template first (background)
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  // Calculate poster dimensions preserving aspect ratio (no display scaling)
  const posterAspect = poster.width / poster.height;
  const baseX = rect.x || 0;
  const baseY = rect.y || 0;

  let posterWidth, posterHeight;
  if (rect.width && rect.height) {
    posterWidth = rect.width;
    posterHeight = rect.height;
  } else if (rect.width) {
    posterWidth = rect.width;
    posterHeight = posterWidth / posterAspect;
  } else if (rect.height) {
    posterHeight = rect.height;
    posterWidth = posterHeight * posterAspect;
  } else {
    posterWidth = poster.width * 0.3;
    posterHeight = posterWidth / posterAspect;
  }

  // Apply user scale and offset
  const scaledWidth = posterWidth * mockupPreviewScale;
  const scaledHeight = posterHeight * mockupPreviewScale;
  const finalX = baseX + mockupPreviewOffsetX;
  const finalY = baseY + mockupPreviewOffsetY;

  // Draw poster on top of template
  ctx.drawImage(poster, finalX, finalY, scaledWidth, scaledHeight);

  // Draw assets at full resolution (before labels, so labels appear on top)
  mockupAssets.forEach(asset => {
    if (!asset.image) return;

    const x = (asset.x / 100) * canvas.width;
    const y = (asset.y / 100) * canvas.height;
    const w = (asset.width / 100) * canvas.width;
    const h = (w / asset.image.width) * asset.image.height;

    ctx.globalAlpha = asset.opacity;
    ctx.drawImage(asset.image, x - w/2, y - h/2, w, h);
    ctx.globalAlpha = 1.0;
  });

  // Draw labels at full resolution (scale font sizes proportionally)
  const displayScale = parseFloat(elements.mockupPreviewCanvas?.dataset.displayScale) || 1;
  const fontScale = 1 / displayScale;  // Scale up fonts for full resolution

  mockupLabels.forEach(label => {
    const x = (label.x / 100) * canvas.width;
    const y = (label.y / 100) * canvas.height;

    const scaledFontSize = Math.round(label.size * fontScale);
    ctx.font = `${scaledFontSize}px "${label.font}"`;
    ctx.fillStyle = label.color;
    ctx.textBaseline = "alphabetic";

    // Draw text shadow if enabled
    if (label.shadow) {
      const shadowOffset = Math.max(2, scaledFontSize / 12);
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 4 * fontScale;
      ctx.shadowOffsetX = shadowOffset;
      ctx.shadowOffsetY = shadowOffset;
    }

    ctx.fillText(label.text, x, y);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });

  return canvas;
}

async function generateMockupFromPreview() {
  if (!mockupPreviewTemplate || !mockupPreviewPoster) return;

  const btn = elements.mockupPreviewGenerate;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving...";
  }

  // Save guides to template first
  await saveMockupGuides();

  if (btn) {
    btn.textContent = "Rendering...";
  }

  try {
    // Render mockup at full resolution on canvas
    const canvas = renderMockupFullResolution();
    if (!canvas) {
      throw new Error("Failed to render mockup");
    }

    if (btn) {
      btn.textContent = "Uploading...";
    }

    // Convert canvas to blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("Failed to create blob")), "image/png", 1.0);
    });

    // Create form data with the image
    const formData = new FormData();
    formData.append("image", blob, "mockup.png");
    formData.append("poster", mockupPreviewPoster.filename);
    formData.append("mockup_id", mockupPreviewTemplate.id);

    const response = await fetch("/api/mockups/save", {
      method: "POST",
      body: formData,
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
      btn.textContent = "Generate";
    }
  }
}

// ===== MOCKUP TEMPLATE CREATOR =====

function openMockupCreator(fromStudio = false) {
  closeMockupModal();
  closeCollectionModal();
  resetMockupCreator();

  // Track where we came from
  mockupCreatorFromStudio = fromStudio;

  // Set create mode UI
  const titleEl = document.getElementById("mockup-creator-title");
  if (titleEl) titleEl.textContent = "Create Mockup Template";
  const uploadField = document.getElementById("mockup-upload-field");
  if (uploadField) uploadField.style.display = "";

  // Show/hide back button
  if (elements.mockupCreatorBack) {
    elements.mockupCreatorBack.style.display = fromStudio ? "" : "none";
  }

  elements.mockupCreator?.classList.add("open");
}

function openMockupCreatorForEdit(mockup, fromStudio = false) {
  closeMockupModal();
  closeCollectionModal();
  resetMockupCreator();

  // Track where we came from
  mockupCreatorFromStudio = fromStudio;

  // Set editing mode
  mockupCreatorEditingId = mockup.id;

  // Set edit mode UI
  const titleEl = document.getElementById("mockup-creator-title");
  if (titleEl) titleEl.textContent = "Edit Mockup Template";
  const uploadField = document.getElementById("mockup-upload-field");
  if (uploadField) uploadField.style.display = "none";

  // Show/hide back button
  if (elements.mockupCreatorBack) {
    elements.mockupCreatorBack.style.display = fromStudio ? "" : "none";
  }

  // Populate name field
  if (elements.mockupTemplateName) {
    elements.mockupTemplateName.value = mockup.name || mockup.id;
  }

  // Set recommended aspect if exists
  if (mockup.recommended_aspect) {
    mockupCreatorSelectedFormat = mockup.recommended_aspect;
    elements.formatSelectorGrid?.querySelectorAll(".format-btn").forEach(btn => {
      if (btn.dataset.ratio === mockup.recommended_aspect) {
        btn.classList.add("active");
      }
    });
  }

  // Load the mockup image
  const imgUrl = mockup.thumbnail || `/mockups/${mockup.id}.png`;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    mockupCreatorImage = img;

    // Set the rect from mockup data
    const rect = mockup.poster_rect || {};
    if (rect.x !== undefined && rect.y !== undefined) {
      mockupCreatorRect = {
        x: rect.x || 0,
        y: rect.y || 0,
        width: rect.width || 0,
        height: rect.height || 0
      };
      mockupCreatorClickState = 2; // Mark as complete
      mockupCreatorCorner1 = { x: mockupCreatorRect.x, y: mockupCreatorRect.y };
      mockupCreatorCorner2 = {
        x: mockupCreatorRect.x + mockupCreatorRect.width,
        y: mockupCreatorRect.y + mockupCreatorRect.height
      };
    }

    setupMockupCanvas();
    updateMockupRectDisplay();
    updateMockupSaveBtn();
  };
  img.onerror = () => {
    // Try jpg fallback
    img.src = `/mockups/${mockup.id}.jpg`;
  };
  img.src = imgUrl;

  elements.mockupCreator?.classList.add("open");
}

function closeMockupCreator() {
  elements.mockupCreator?.classList.remove("open");
  resetMockupCreator();
}

function resetMockupCreator() {
  mockupCreatorImage = null;
  mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
  mockupCreatorClickState = 0;
  mockupCreatorCorner1 = { x: 0, y: 0 };
  mockupCreatorCorner2 = { x: 0, y: 0 };
  mockupCreatorSelectedFormat = null;
  mockupCreatorFormatDragging = false;
  mockupCreatorEditingId = null;

  // Reset format selector UI
  elements.formatSelectorGrid?.querySelectorAll(".format-btn").forEach(b => b.classList.remove("active"));
  if (elements.formatScaleSlider) elements.formatScaleSlider.value = 30;
  if (elements.formatScaleValue) elements.formatScaleValue.value = "30%";
  mockupCreatorFormatScale = 30;
  updateFormatPlaceBtn();

  if (elements.mockupTemplateName) elements.mockupTemplateName.value = "";
  if (elements.mockupTemplateFile) elements.mockupTemplateFile.value = "";
  if (elements.mockupSaveBtn) elements.mockupSaveBtn.disabled = true;

  // Populate collection dropdown
  const collectionSelect = document.getElementById("mockup-template-collection");
  if (collectionSelect) {
    collectionSelect.innerHTML = '<option value="">None</option>';
    mockupCollectionList.forEach(coll => {
      const option = document.createElement("option");
      option.value = coll.id;
      option.textContent = coll.name;
      collectionSelect.appendChild(option);
    });
  }

  if (elements.mockupCreatorCanvas) {
    elements.mockupCreatorCanvas.style.display = "none";
    elements.mockupCreatorCanvas.parentElement?.classList.remove("visible");
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
  loadMockupImageFile(file);
}

function loadMockupImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

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

function handleCreatorDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const wrap = e.currentTarget;
  wrap.classList.add("drag-over");
}

function handleCreatorDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const wrap = e.currentTarget;
  wrap.classList.remove("drag-over");
}

function handleCreatorDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const wrap = e.currentTarget;
  wrap.classList.remove("drag-over");

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    loadMockupImageFile(files[0]);
  }
}

function setupMockupCanvas() {
  if (!mockupCreatorImage || !elements.mockupCreatorCanvas) return;

  const canvas = elements.mockupCreatorCanvas;

  // Reset click state and zoom for new image
  mockupCreatorClickState = 0;
  mockupCreatorCorner1 = { x: 0, y: 0 };
  mockupCreatorCorner2 = { x: 0, y: 0 };
  mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
  mockupCreatorZoom = 1.0;

  // Update canvas size with zoom
  updateCreatorCanvasSize();
  updateCreatorZoomDisplay();

  // Show canvas, hide placeholder
  canvas.style.display = "block";
  canvas.parentElement?.classList.add("visible");
  if (elements.mockupCanvasPlaceholder) {
    elements.mockupCanvasPlaceholder.style.display = "none";
  }

  drawMockupCanvas();
  centerCreatorScroll();
  updateMockupSaveBtn();
  updateFormatPlaceBtn();
}

function drawMockupCanvas() {
  if (!mockupCreatorImage || !elements.mockupCreatorCanvas) return;

  const canvas = elements.mockupCreatorCanvas;
  const ctx = canvas.getContext("2d");
  const baseScale = parseFloat(canvas.dataset.baseScale) || 1;
  const zoom = parseFloat(canvas.dataset.zoom) || 1;
  const scale = baseScale * zoom;  // Full scale from image to canvas

  // Clear and draw image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mockupCreatorImage, 0, 0, canvas.width, canvas.height);

  // Draw rectangle overlay (rect coordinates are in original image pixels)
  if (mockupCreatorRect.width > 0 && mockupCreatorRect.height > 0) {
    const x = mockupCreatorRect.x * scale;
    const y = mockupCreatorRect.y * scale;
    const w = mockupCreatorRect.width * scale;
    const h = mockupCreatorRect.height * scale;

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(255, 0, 82, 0.3)";
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = "#ff0052";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "#ff0052";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Poster Area", x + 8, y + 20);
  }

  // Draw first corner indicator when in state 1 (waiting for second corner)
  if (mockupCreatorClickState === 1) {
    const cx = mockupCreatorCorner1.x * scale;  // corner1 is in image coordinates
    const cy = mockupCreatorCorner1.y * scale;

    // Draw crosshair at first corner
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();

    // Draw circle at corner
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
    ctx.fill();
  }

  // Draw instruction text
  ctx.font = "13px system-ui, sans-serif";
  const padding = 10;
  let instructionText = "";

  if (mockupCreatorClickState === 0) {
    instructionText = "Click to set first corner";
  } else if (mockupCreatorClickState === 1) {
    instructionText = "Click to set second corner";
  } else if (mockupCreatorClickState === 2) {
    instructionText = "Click to start over";
  }

  if (instructionText) {
    const textWidth = ctx.measureText(instructionText).width;
    // Background pill
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(padding, canvas.height - 32, textWidth + 16, 24, 4);
    ctx.fill();
    // Text
    ctx.fillStyle = "#ffffff";
    ctx.fillText(instructionText, padding + 8, canvas.height - 15);
  }
}

function handleMockupCanvasClick(e) {
  if (!mockupCreatorImage) return;

  // Skip if we just finished dragging a rect (don't trigger new draw)
  if (mockupCreatorDragMoved) {
    mockupCreatorDragMoved = false;
    return;
  }

  const canvas = elements.mockupCreatorCanvas;
  const rect = canvas.getBoundingClientRect();
  const baseScale = parseFloat(canvas.dataset.baseScale) || 1;

  // Convert screen coordinates to image coordinates
  // The canvas displays the image at (baseScale * zoom) scale
  // We need to convert click position to original image coordinates
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  // Convert from canvas coordinates to original image coordinates
  const x = Math.round(canvasX / baseScale / mockupCreatorZoom);
  const y = Math.round(canvasY / baseScale / mockupCreatorZoom);

  if (mockupCreatorClickState === 0) {
    // First click - set first corner
    mockupCreatorCorner1 = { x, y };
    mockupCreatorClickState = 1;
    mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
    drawMockupCanvas();
    updateMockupRectDisplay();
  } else if (mockupCreatorClickState === 1) {
    // Second click - set second corner and finalize rectangle
    mockupCreatorCorner2 = { x, y };
    mockupCreatorClickState = 2;

    // Calculate rect from two corners (handle any corner ordering)
    const minX = Math.min(mockupCreatorCorner1.x, mockupCreatorCorner2.x);
    const minY = Math.min(mockupCreatorCorner1.y, mockupCreatorCorner2.y);
    const maxX = Math.max(mockupCreatorCorner1.x, mockupCreatorCorner2.x);
    const maxY = Math.max(mockupCreatorCorner1.y, mockupCreatorCorner2.y);

    mockupCreatorRect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    drawMockupCanvas();
    updateMockupRectDisplay();
    updateMockupSaveBtn();
  } else {
    // Third click - reset and start over with this as first corner
    mockupCreatorCorner1 = { x, y };
    mockupCreatorCorner2 = { x: 0, y: 0 };
    mockupCreatorClickState = 1;
    mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
    drawMockupCanvas();
    updateMockupRectDisplay();
    updateMockupSaveBtn();
  }
}

function handleMockupCanvasMouseMove(e) {
  // Only show preview when first corner is set
  if (mockupCreatorClickState !== 1 || !mockupCreatorImage) return;

  const canvas = elements.mockupCreatorCanvas;
  const rect = canvas.getBoundingClientRect();
  const baseScale = parseFloat(canvas.dataset.baseScale) || 1;

  // Convert screen coordinates to image coordinates
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const currentX = Math.round(canvasX / baseScale / mockupCreatorZoom);
  const currentY = Math.round(canvasY / baseScale / mockupCreatorZoom);

  // Calculate preview rect from corner1 to current position
  const minX = Math.min(mockupCreatorCorner1.x, currentX);
  const minY = Math.min(mockupCreatorCorner1.y, currentY);
  const maxX = Math.max(mockupCreatorCorner1.x, currentX);
  const maxY = Math.max(mockupCreatorCorner1.y, currentY);

  mockupCreatorRect = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };

  drawMockupCanvas();
  updateMockupRectDisplay();
}

function resetMockupCreatorRect() {
  mockupCreatorClickState = 0;
  mockupCreatorCorner1 = { x: 0, y: 0 };
  mockupCreatorCorner2 = { x: 0, y: 0 };
  mockupCreatorRect = { x: 0, y: 0, width: 0, height: 0 };
  drawMockupCanvas();
  updateMockupRectDisplay();
  updateMockupSaveBtn();
}

// ===== FORMAT SELECTOR FUNCTIONS =====

// Get aspect ratio as decimal from format string
function getFormatRatio(format) {
  const ratios = {
    "2:3": 2/3,
    "3:4": 3/4,
    "4:5": 4/5,
    "5:7": 5/7,
    "1:1": 1,
    "3:2": 3/2,
    "16:9": 16/9,
    "9:16": 9/16,
    "A4": 210/297,  // ~0.707
    "A3": 297/420,  // ~0.707
    "11:14": 11/14
  };
  return ratios[format] || 1;
}

function handleFormatSelect(e) {
  const btn = e.target.closest(".format-btn");
  if (!btn) return;

  const ratio = btn.dataset.ratio;

  // Toggle selection
  if (mockupCreatorSelectedFormat === ratio) {
    mockupCreatorSelectedFormat = null;
    btn.classList.remove("active");
  } else {
    // Deselect all
    elements.formatSelectorGrid.querySelectorAll(".format-btn").forEach(b => b.classList.remove("active"));
    // Select this one
    btn.classList.add("active");
    mockupCreatorSelectedFormat = ratio;
  }

  // Enable/disable place button
  updateFormatPlaceBtn();
}

function handleFormatScaleChange(e) {
  mockupCreatorFormatScale = parseFloat(e.target.value);
  if (elements.formatScaleValue) {
    elements.formatScaleValue.value = mockupCreatorFormatScale + "%";
  }

  // If we have a placed rect with this format, update its size
  if (mockupCreatorRect.width > 0 && mockupCreatorRect.height > 0 && mockupCreatorSelectedFormat) {
    updatePlacedFormatSize();
  }
}

function handleFormatScaleInput(e) {
  // Parse value, stripping % sign if present
  let val = e.target.value.replace(/%/g, "").trim();
  let numVal = parseFloat(val);

  if (isNaN(numVal)) return;

  // Clamp to valid range
  numVal = Math.max(5, Math.min(100, numVal));
  mockupCreatorFormatScale = numVal;

  // Update slider (rounds to integer for the slider)
  if (elements.formatScaleSlider) {
    elements.formatScaleSlider.value = Math.round(numVal);
  }

  // Update display with proper formatting
  e.target.value = numVal + "%";

  // If we have a placed rect with this format, update its size
  if (mockupCreatorRect.width > 0 && mockupCreatorRect.height > 0 && mockupCreatorSelectedFormat) {
    updatePlacedFormatSize();
  }
}

function adjustFormatScale(delta) {
  const newScale = Math.max(5, Math.min(100, mockupCreatorFormatScale + delta));
  if (newScale !== mockupCreatorFormatScale) {
    mockupCreatorFormatScale = newScale;
    if (elements.formatScaleSlider) {
      elements.formatScaleSlider.value = Math.round(newScale);
    }
    if (elements.formatScaleValue) {
      elements.formatScaleValue.value = newScale + "%";
    }
    // If we have a placed rect, update its size
    if (mockupCreatorRect.width > 0 && mockupCreatorRect.height > 0 && mockupCreatorSelectedFormat) {
      updatePlacedFormatSize();
    }
  }
}

function updateFormatPlaceBtn() {
  if (elements.formatPlaceBtn) {
    elements.formatPlaceBtn.disabled = !mockupCreatorSelectedFormat || !mockupCreatorImage;
  }
}

function placeFormatOnCanvas() {
  if (!mockupCreatorSelectedFormat || !mockupCreatorImage) return;

  const ratio = getFormatRatio(mockupCreatorSelectedFormat);
  const imgW = mockupCreatorImage.width;
  const imgH = mockupCreatorImage.height;

  // Calculate rect size based on scale percentage
  const scale = mockupCreatorFormatScale / 100;
  let rectW, rectH;

  if (ratio <= 1) {
    // Portrait or square - base on image height
    rectH = imgH * scale;
    rectW = rectH * ratio;
  } else {
    // Landscape - base on image width
    rectW = imgW * scale;
    rectH = rectW / ratio;
  }

  // Center on canvas
  const rectX = (imgW - rectW) / 2;
  const rectY = (imgH - rectH) / 2;

  // Reset click state since we're placing programmatically
  mockupCreatorClickState = 2;  // Mark as complete
  mockupCreatorCorner1 = { x: rectX, y: rectY };
  mockupCreatorCorner2 = { x: rectX + rectW, y: rectY + rectH };

  mockupCreatorRect = {
    x: Math.round(rectX),
    y: Math.round(rectY),
    width: Math.round(rectW),
    height: Math.round(rectH)
  };

  drawMockupCanvas();
  updateMockupRectDisplay();
  updateMockupSaveBtn();
}

function updatePlacedFormatSize() {
  if (!mockupCreatorSelectedFormat || !mockupCreatorImage) return;

  const ratio = getFormatRatio(mockupCreatorSelectedFormat);
  const imgW = mockupCreatorImage.width;
  const imgH = mockupCreatorImage.height;

  // Calculate new size based on scale
  const scale = mockupCreatorFormatScale / 100;
  let rectW, rectH;

  if (ratio <= 1) {
    rectH = imgH * scale;
    rectW = rectH * ratio;
  } else {
    rectW = imgW * scale;
    rectH = rectW / ratio;
  }

  // Keep top-left corner fixed
  const rectX = mockupCreatorRect.x;
  const rectY = mockupCreatorRect.y;

  // Ensure rect doesn't exceed image bounds
  const clampedW = Math.min(rectW, mockupCreatorImage.width - rectX);
  const clampedH = Math.min(rectH, mockupCreatorImage.height - rectY);

  mockupCreatorRect = {
    x: Math.round(rectX),
    y: Math.round(rectY),
    width: Math.round(clampedW),
    height: Math.round(clampedH)
  };

  // Update corners
  mockupCreatorCorner1 = { x: mockupCreatorRect.x, y: mockupCreatorRect.y };
  mockupCreatorCorner2 = { x: mockupCreatorRect.x + mockupCreatorRect.width, y: mockupCreatorRect.y + mockupCreatorRect.height };

  drawMockupCanvas();
  updateMockupRectDisplay();
  updateMockupSaveBtn();
}

function clearFormatRect() {
  // Clear the rect
  resetMockupCreatorRect();

  // Deselect format
  mockupCreatorSelectedFormat = null;
  elements.formatSelectorGrid?.querySelectorAll(".format-btn").forEach(b => b.classList.remove("active"));
  updateFormatPlaceBtn();
}

// Canvas mouse handlers for dragging placed format
function handleCreatorCanvasMouseDown(e) {
  if (!mockupCreatorImage || mockupCreatorRect.width <= 0) return;

  const canvas = elements.mockupCreatorCanvas;
  const rect = canvas.getBoundingClientRect();
  const baseScale = parseFloat(canvas.dataset.baseScale) || 1;

  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const imgX = canvasX / baseScale / mockupCreatorZoom;
  const imgY = canvasY / baseScale / mockupCreatorZoom;

  // Check if click is inside the placed rect
  if (imgX >= mockupCreatorRect.x && imgX <= mockupCreatorRect.x + mockupCreatorRect.width &&
      imgY >= mockupCreatorRect.y && imgY <= mockupCreatorRect.y + mockupCreatorRect.height) {
    mockupCreatorFormatDragging = true;
    mockupCreatorDragMoved = false;  // Track if actually dragged
    mockupCreatorDragStart = { x: imgX - mockupCreatorRect.x, y: imgY - mockupCreatorRect.y };
    canvas.style.cursor = "move";
    e.preventDefault();
  }
}

function handleCreatorCanvasMouseMove(e) {
  if (!mockupCreatorFormatDragging || !mockupCreatorImage) return;

  mockupCreatorDragMoved = true;  // Mark that we actually moved

  const canvas = elements.mockupCreatorCanvas;
  const rect = canvas.getBoundingClientRect();
  const baseScale = parseFloat(canvas.dataset.baseScale) || 1;

  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const imgX = canvasX / baseScale / mockupCreatorZoom;
  const imgY = canvasY / baseScale / mockupCreatorZoom;

  // Calculate new position
  let newX = imgX - mockupCreatorDragStart.x;
  let newY = imgY - mockupCreatorDragStart.y;

  // Clamp to image bounds
  newX = Math.max(0, Math.min(mockupCreatorImage.width - mockupCreatorRect.width, newX));
  newY = Math.max(0, Math.min(mockupCreatorImage.height - mockupCreatorRect.height, newY));

  mockupCreatorRect.x = Math.round(newX);
  mockupCreatorRect.y = Math.round(newY);

  // Update corners
  mockupCreatorCorner1 = { x: mockupCreatorRect.x, y: mockupCreatorRect.y };
  mockupCreatorCorner2 = { x: mockupCreatorRect.x + mockupCreatorRect.width, y: mockupCreatorRect.y + mockupCreatorRect.height };

  drawMockupCanvas();
  updateMockupRectDisplay();
}

function handleCreatorCanvasMouseUp() {
  if (mockupCreatorFormatDragging) {
    mockupCreatorFormatDragging = false;
    if (elements.mockupCreatorCanvas) {
      elements.mockupCreatorCanvas.style.cursor = "crosshair";
    }
  }
}

// ===== MOCKUP CREATOR ZOOM FUNCTIONS =====
function setCreatorZoom(newZoom) {
  const minZoom = 0.1;
  const maxZoom = 10.0;
  mockupCreatorZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
  updateCreatorCanvasSize();
  drawMockupCanvas();
  updateCreatorZoomDisplay();
}

function zoomCreatorIn() {
  setCreatorZoom(mockupCreatorZoom * 1.25);
}

function zoomCreatorOut() {
  setCreatorZoom(mockupCreatorZoom / 1.25);
}

function zoomCreatorFit() {
  mockupCreatorZoom = 1.0;
  updateCreatorCanvasSize();
  drawMockupCanvas();
  updateCreatorZoomDisplay();
  centerCreatorScroll();
}

function updateCreatorZoomDisplay() {
  if (elements.creatorZoomLevel) {
    elements.creatorZoomLevel.textContent = `${Math.round(mockupCreatorZoom * 100)}%`;
  }
}

function centerCreatorScroll() {
  const canvas = elements.mockupCreatorCanvas;
  if (!canvas) return;

  const container = canvas.closest('.mockup-creator-canvas-wrap');
  if (!container) return;

  // Wait for layout to update
  requestAnimationFrame(() => {
    // Center the scroll position - canvas is centered via CSS when smaller than container
    // When larger, we want to scroll to center
    const scrollWidth = container.scrollWidth;
    const scrollHeight = container.scrollHeight;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (scrollWidth > containerWidth) {
      container.scrollLeft = (scrollWidth - containerWidth) / 2;
    }
    if (scrollHeight > containerHeight) {
      container.scrollTop = (scrollHeight - containerHeight) / 2;
    }
  });
}

function updateCreatorCanvasSize() {
  if (!mockupCreatorImage || !elements.mockupCreatorCanvas) return;

  const canvas = elements.mockupCreatorCanvas;
  const container = canvas.closest('.mockup-creator-canvas-wrap');

  // Calculate base scale to fit in container at zoom 1.0
  const maxWidth = container.clientWidth - 40;
  const maxHeight = 500;
  const baseScale = Math.min(maxWidth / mockupCreatorImage.width, maxHeight / mockupCreatorImage.height, 1);

  // Apply user zoom on top of base scale - allow canvas to grow beyond container
  const effectiveScale = baseScale * mockupCreatorZoom;

  // Set canvas dimensions (can exceed container size when zoomed)
  canvas.width = mockupCreatorImage.width * effectiveScale;
  canvas.height = mockupCreatorImage.height * effectiveScale;

  // Store scales for coordinate conversion
  // Note: we divide by effectiveScale to get image coordinates from canvas coordinates
  canvas.dataset.baseScale = baseScale;
  canvas.dataset.zoom = mockupCreatorZoom;
  canvas.dataset.scale = effectiveScale;
}

function handleCreatorWheel(e) {
  e.preventDefault();

  const canvas = elements.mockupCreatorCanvas;
  if (!canvas || !mockupCreatorImage) return;

  const container = canvas.closest('.mockup-creator-canvas-wrap');
  const scrollContent = canvas.closest('.canvas-scroll-content');
  if (!container || !scrollContent) {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCreatorZoom(mockupCreatorZoom * delta);
    return;
  }

  // Get current scale
  const currentScale = parseFloat(canvas.dataset.scale) || 1;

  // Get mouse position relative to canvas (in canvas pixels)
  const canvasRect = canvas.getBoundingClientRect();
  const mouseXInCanvas = e.clientX - canvasRect.left;
  const mouseYInCanvas = e.clientY - canvasRect.top;

  // Convert to image coordinates (the point we want to keep under cursor)
  const imageX = mouseXInCanvas / currentScale;
  const imageY = mouseYInCanvas / currentScale;

  // Store cursor position relative to container viewport
  const containerRect = container.getBoundingClientRect();
  const cursorInContainerX = e.clientX - containerRect.left;
  const cursorInContainerY = e.clientY - containerRect.top;

  // Apply zoom
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const oldZoom = mockupCreatorZoom;
  setCreatorZoom(mockupCreatorZoom * delta);

  // If zoom didn't change (hit limits), do nothing
  if (mockupCreatorZoom === oldZoom) return;

  // Wait for layout to update, then adjust scroll
  requestAnimationFrame(() => {
    const newScale = parseFloat(canvas.dataset.scale) || 1;

    // Calculate where the image point is now in canvas pixels
    const newCanvasX = imageX * newScale;
    const newCanvasY = imageY * newScale;

    // The scroll content has 20px padding, canvas is at padding offset
    const padding = 20;

    // Where the image point is in scroll content coordinates
    const pointInScrollX = padding + newCanvasX;
    const pointInScrollY = padding + newCanvasY;

    // Adjust scroll so that point stays under cursor
    container.scrollLeft = pointInScrollX - cursorInContainerX;
    container.scrollTop = pointInScrollY - cursorInContainerY;
  });
}

// ===== MOCKUP PREVIEW ZOOM FUNCTIONS =====
function setPreviewZoom(newZoom) {
  const minZoom = 0.25;
  const maxZoom = 4.0;
  mockupPreviewZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
  renderMockupPreview();
  updatePreviewZoomDisplay();
}

function zoomPreviewIn() {
  setPreviewZoom(mockupPreviewZoom * 1.25);
}

function zoomPreviewOut() {
  setPreviewZoom(mockupPreviewZoom / 1.25);
}

function zoomPreviewFit() {
  mockupPreviewZoom = 1.0;
  renderMockupPreview();
  updatePreviewZoomDisplay();
}

function updatePreviewZoomDisplay() {
  if (elements.previewZoomLevel) {
    elements.previewZoomLevel.textContent = `${Math.round(mockupPreviewZoom * 100)}%`;
  }
}

function handlePreviewWheel(e) {
  e.preventDefault();

  const canvas = elements.mockupPreviewCanvas;
  if (!canvas) return;

  const container = canvas.closest('.mockup-preview-canvas-wrap');
  if (!container) {
    // Fallback to simple zoom if no container found
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setPreviewZoom(mockupPreviewZoom * delta);
    return;
  }

  // Get mouse position relative to container
  const containerRect = container.getBoundingClientRect();
  const mouseX = e.clientX - containerRect.left + container.scrollLeft;
  const mouseY = e.clientY - containerRect.top + container.scrollTop;

  // Get canvas position within container (centered with text-align: center)
  const canvasRect = canvas.getBoundingClientRect();
  const canvasOffsetX = canvasRect.left - containerRect.left + container.scrollLeft;
  const canvasOffsetY = canvasRect.top - containerRect.top + container.scrollTop;

  // Mouse position relative to canvas content
  const canvasMouseX = mouseX - canvasOffsetX;
  const canvasMouseY = mouseY - canvasOffsetY;

  // Calculate the point in content space (0-1 normalized)
  const contentX = canvasMouseX / canvas.width;
  const contentY = canvasMouseY / canvas.height;

  // Apply zoom
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const oldZoom = mockupPreviewZoom;
  setPreviewZoom(mockupPreviewZoom * delta);

  // If zoom didn't change (hit limits), do nothing
  if (mockupPreviewZoom === oldZoom) return;

  // Calculate new canvas size (after renderMockupPreview in setPreviewZoom)
  const newWidth = canvas.width;
  const newHeight = canvas.height;

  // Calculate where the same content point is now
  const newCanvasMouseX = contentX * newWidth;
  const newCanvasMouseY = contentY * newHeight;

  // Get new canvas position (may have changed due to centering)
  const newCanvasRect = canvas.getBoundingClientRect();
  const newCanvasOffsetX = newCanvasRect.left - containerRect.left + container.scrollLeft;
  const newCanvasOffsetY = newCanvasRect.top - containerRect.top + container.scrollTop;

  // Calculate where that point is now in container coordinates
  const newPointX = newCanvasOffsetX + newCanvasMouseX;
  const newPointY = newCanvasOffsetY + newCanvasMouseY;

  // Adjust scroll so the point stays under the cursor
  const cursorInContainerX = e.clientX - containerRect.left;
  const cursorInContainerY = e.clientY - containerRect.top;

  container.scrollLeft = newPointX - cursorInContainerX;
  container.scrollTop = newPointY - cursorInContainerY;
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
  const collectionId = document.getElementById("mockup-template-collection")?.value || "";
  const isEditing = mockupCreatorEditingId !== null;

  // For new templates, require file. For editing, file is optional.
  if (!name || mockupCreatorRect.width <= 0) {
    alert("Please provide a name and draw the poster area.");
    return;
  }
  if (!isEditing && !file) {
    alert("Please upload an image.");
    return;
  }

  elements.mockupSaveBtn.disabled = true;
  elements.mockupSaveBtn.textContent = "Saving...";

  try {
    let response;

    if (isEditing) {
      // Update existing mockup template
      const updateData = {
        name: name,
        poster_rect: mockupCreatorRect,
        output_size: mockupCreatorImage ? [mockupCreatorImage.width, mockupCreatorImage.height] : null,
        recommended_aspect: mockupCreatorSelectedFormat || null,
      };

      response = await fetch(`/api/mockups/${mockupCreatorEditingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
    } else {
      // Create new mockup template
      const formData = new FormData();
      formData.append("name", name);
      formData.append("image", file);
      formData.append("rect", JSON.stringify({
        poster_rect: mockupCreatorRect,
        output_size: mockupCreatorImage ? [mockupCreatorImage.width, mockupCreatorImage.height] : null,
        recommended_aspect: mockupCreatorSelectedFormat || null,
      }));

      response = await fetch("/api/mockups", {
        method: "POST",
        body: formData,
      });
    }

    const result = await response.json();

    if (result.ok) {
      // Add to collection if one was selected (for new templates)
      if (!isEditing && collectionId && result.id) {
        await addMockupToCollection(result.id, collectionId);
      }

      closeMockupCreator();
      await loadMockups();
      // Re-open mockup studio to show the updated/new template
      openMockupStudio();
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

// ===== MOCKUP STUDIO =====

function openMockupStudio() {
  mockupStudioSelectedTemplate = null;

  // Hide floating elements
  document.getElementById("bottom-bar-float")?.classList.add("hidden-by-modal");
  document.getElementById("coords-widget")?.classList.add("hidden-by-modal");
  document.getElementById("style-widget")?.classList.add("hidden-by-modal");

  // Render collection tabs and template grid
  renderMockupStudioCollectionTabs();
  renderMockupStudioTemplates();

  // Show templates step, hide posters step
  elements.mockupStudioTemplates?.classList.remove("hidden");
  elements.mockupStudioPosters?.classList.add("hidden");

  // Clear breadcrumb
  if (elements.mockupStudioBreadcrumb) {
    elements.mockupStudioBreadcrumb.textContent = "";
  }

  elements.mockupStudio?.classList.add("open");
}

function closeMockupStudio() {
  elements.mockupStudio?.classList.remove("open");
  mockupStudioSelectedTemplate = null;

  // Show floating elements
  document.getElementById("bottom-bar-float")?.classList.remove("hidden-by-modal");
  document.getElementById("coords-widget")?.classList.remove("hidden-by-modal");
  document.getElementById("style-widget")?.classList.remove("hidden-by-modal");
}

function renderMockupStudioCollectionTabs() {
  const container = document.getElementById("mockup-studio-collection-tabs");
  if (!container) return;

  container.innerHTML = "";

  // "All" tab
  const allTab = document.createElement("button");
  allTab.type = "button";
  allTab.className = "collection-tab" + (mockupStudioCollectionFilter === null ? " active" : "");
  allTab.innerHTML = `<span>All</span><span class="tab-count">${mockupList.length}</span>`;
  allTab.addEventListener("click", () => filterMockupsByCollection(null));
  container.appendChild(allTab);

  // Collection tabs
  mockupCollectionList.forEach(coll => {
    const count = (mockupCollectionItems[coll.id] || []).length;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "collection-tab" + (mockupStudioCollectionFilter === coll.id ? " active" : "");
    tab.innerHTML = `
      <span>${escapeHtml(coll.name)}</span>
      <span class="tab-count">${count}</span>
      <span class="tab-actions">
        <button type="button" class="tab-action" data-action="rename" title="Rename">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button type="button" class="tab-action" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </span>
    `;

    tab.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "rename") {
        e.stopPropagation();
        renameMockupCollection(coll.id);
      } else if (action === "delete") {
        e.stopPropagation();
        deleteMockupCollection(coll.id);
      } else {
        filterMockupsByCollection(coll.id);
      }
    });

    container.appendChild(tab);
  });

  // "New Collection" button
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "collection-tab new-collection-btn";
  newBtn.innerHTML = `<span>+ New Collection</span>`;
  newBtn.addEventListener("click", createMockupCollection);
  container.appendChild(newBtn);
}

function renderMockupStudioTemplates() {
  const grid = elements.mockupStudioTemplateGrid;
  if (!grid) return;

  grid.innerHTML = "";

  // Filter mockups by collection
  let filteredMockups = [...mockupList];
  if (mockupStudioCollectionFilter && mockupCollectionItems[mockupStudioCollectionFilter]) {
    filteredMockups = mockupList.filter(m => mockupCollectionItems[mockupStudioCollectionFilter].includes(m.id));
  }

  // Filter by aspect ratio
  const aspectFilter = document.getElementById("mockup-studio-aspect-filter")?.value || "";
  if (aspectFilter) {
    filteredMockups = filteredMockups.filter(m => m.recommended_aspect === aspectFilter);
  }

  // Add "Blank Canvas" option at the start (only when no collection filter)
  if (!mockupStudioCollectionFilter && !aspectFilter) {
    const blankCard = document.createElement("div");
    blankCard.className = "mockup-studio-card mockup-studio-card-blank";
    blankCard.innerHTML = `
      <div class="mockup-studio-card-image blank-canvas-preview">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path fill="currentColor" d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"/>
        </svg>
      </div>
      <div class="mockup-studio-card-info">
        <span class="mockup-studio-card-name">Blank Canvas</span>
      </div>
    `;
    blankCard.addEventListener("click", () => {
      selectBlankCanvasTemplate();
    });
    grid.appendChild(blankCard);
  }

  if (!filteredMockups.length && (mockupStudioCollectionFilter || aspectFilter)) {
    grid.innerHTML += `<div class="mockup-studio-empty">No mockup templates match the current filters.</div>`;
    return;
  }

  filteredMockups.forEach(mockup => {
    const card = document.createElement("div");
    card.className = "mockup-studio-card";
    const hasCollections = getMockupCollections(mockup.id).length > 0;

    const aspectBadge = mockup.recommended_aspect
      ? `<span class="mockup-aspect-badge">${escapeHtml(mockup.recommended_aspect)}</span>`
      : '';
    card.innerHTML = `
      <div class="mockup-studio-card-image">
        <img src="${mockup.thumbnail}" alt="${escapeHtml(mockup.name)}" loading="lazy">
        ${aspectBadge}
      </div>
      <div class="mockup-studio-card-info">
        <span class="mockup-studio-card-name">${escapeHtml(mockup.name)}</span>
        <div class="mockup-studio-card-actions">
          <button type="button" class="collection-btn ${hasCollections ? "has-collections" : ""}" title="Add to collection">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
          </button>
          <button type="button" class="mockup-studio-card-edit" title="Edit template">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
        </div>
      </div>
      <button type="button" class="mockup-studio-card-delete" title="Delete template">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".mockup-studio-card-delete")) {
        e.stopPropagation();
        deleteMockupStudioTemplate(mockup);
        return;
      }
      if (e.target.closest(".mockup-studio-card-edit")) {
        e.stopPropagation();
        closeMockupStudio();
        openMockupCreatorForEdit(mockup, true);
        return;
      }
      if (e.target.closest(".collection-btn")) {
        e.stopPropagation();
        openMockupCollectionMenu(mockup.id, e.target.closest(".collection-btn"));
        return;
      }
      selectMockupStudioTemplate(mockup);
    });

    grid.appendChild(card);
  });
}

function openMockupCollectionMenu(mockupId, buttonEl) {
  // Close any existing menu
  document.querySelectorAll(".collection-menu").forEach(m => m.remove());

  const menu = document.createElement("div");
  menu.className = "collection-menu";

  const mockupCollections = getMockupCollections(mockupId);

  if (mockupCollectionList.length === 0) {
    menu.innerHTML = `
      <div style="padding: 12px; color: var(--ink-soft); font-size: 0.85rem;">
        No collections yet
      </div>
    `;
  } else {
    mockupCollectionList.forEach(coll => {
      const isInCollection = mockupCollections.includes(coll.id);
      const item = document.createElement("label");
      item.className = "collection-menu-item";
      item.innerHTML = `
        <input type="checkbox" ${isInCollection ? "checked" : ""}>
        <span>${escapeHtml(coll.name)}</span>
      `;

      item.querySelector("input").addEventListener("change", async (e) => {
        if (e.target.checked) {
          await addMockupToCollection(mockupId, coll.id);
        } else {
          await removeMockupFromCollection(mockupId, coll.id);
        }
        // Update button state
        const hasCollections = getMockupCollections(mockupId).length > 0;
        buttonEl.classList.toggle("has-collections", hasCollections);
      });

      menu.appendChild(item);
    });
  }

  // New collection button
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "collection-menu-new";
  newBtn.textContent = "+ New Collection";
  newBtn.addEventListener("click", async () => {
    menu.remove();
    const newColl = await createMockupCollection();
    if (newColl) {
      await addMockupToCollection(mockupId, newColl.id);
    }
  });
  menu.appendChild(newBtn);

  // Position menu
  const rect = buttonEl.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.zIndex = "1000";

  document.body.appendChild(menu);

  // Close on outside click
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && !buttonEl.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

async function deleteMockupStudioTemplate(mockup) {
  if (!confirm(`Delete template "${mockup.name}"? This cannot be undone.`)) return;

  try {
    const response = await fetch(`/api/mockups/${mockup.id}`, { method: "DELETE" });
    const result = await response.json();

    if (result.ok) {
      await loadMockups();
      renderMockupStudioTemplates();
    } else {
      alert(result.error || "Failed to delete template");
    }
  } catch (err) {
    console.error("Failed to delete template:", err);
    alert("Failed to delete template");
  }
}

function selectMockupStudioTemplate(mockup) {
  mockupStudioSelectedTemplate = mockup;

  // Update breadcrumb
  if (elements.mockupStudioBreadcrumb) {
    elements.mockupStudioBreadcrumb.textContent = `/ ${mockup.name}`;
  }

  // Show selected template preview
  if (elements.mockupStudioSelectedTemplate) {
    elements.mockupStudioSelectedTemplate.innerHTML = `
      <div class="mockup-studio-selected-preview">
        <img src="${mockup.thumbnail}" alt="${escapeHtml(mockup.name)}">
        <span>${escapeHtml(mockup.name)}</span>
      </div>
    `;
  }

  // Populate collection filter
  populateMockupStudioCollectionFilter();

  // Render posters
  renderMockupStudioPosters();

  // Switch views
  elements.mockupStudioTemplates?.classList.add("hidden");
  elements.mockupStudioPosters?.classList.remove("hidden");
}

function mockupStudioGoBack() {
  mockupStudioSelectedTemplate = null;

  // Clear breadcrumb
  if (elements.mockupStudioBreadcrumb) {
    elements.mockupStudioBreadcrumb.textContent = "";
  }

  // Switch views
  elements.mockupStudioTemplates?.classList.remove("hidden");
  elements.mockupStudioPosters?.classList.add("hidden");
}

function selectBlankCanvasTemplate() {
  // Create a virtual blank canvas mockup template
  const blankMockup = {
    id: "__blank_canvas__",
    name: "Blank Canvas",
    isBlankCanvas: true,
    poster_rect: { x: 0, y: 0, width: 100, height: 100 },  // Full canvas
    canvasWidth: 1080,  // Default dimensions
    canvasHeight: 1080,
    backgroundColor: "#ffffff"
  };

  mockupStudioSelectedTemplate = blankMockup;

  // Update breadcrumb
  if (elements.mockupStudioBreadcrumb) {
    elements.mockupStudioBreadcrumb.textContent = "/ Blank Canvas";
  }

  // Show selected template preview
  if (elements.mockupStudioSelectedTemplate) {
    elements.mockupStudioSelectedTemplate.innerHTML = `
      <div class="mockup-studio-selected-preview blank-canvas-selected">
        <div class="blank-canvas-icon">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="currentColor" d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          </svg>
        </div>
        <span>Blank Canvas</span>
      </div>
    `;
  }

  // Populate collection filter
  populateMockupStudioCollectionFilter();

  // Render posters
  renderMockupStudioPosters();

  // Switch views
  elements.mockupStudioTemplates?.classList.add("hidden");
  elements.mockupStudioPosters?.classList.remove("hidden");
}

function populateMockupStudioCollectionFilter() {
  const select = elements.mockupStudioCollectionFilter;
  if (!select) return;

  select.innerHTML = '<option value="">All Posters</option>';

  collectionList.forEach(coll => {
    const opt = document.createElement("option");
    opt.value = coll.id;
    opt.textContent = coll.name;
    select.appendChild(opt);
  });
}

function renderMockupStudioPosters() {
  const grid = elements.mockupStudioPosterGrid;
  if (!grid) return;

  grid.innerHTML = "";

  const collectionFilter = elements.mockupStudioCollectionFilter?.value || "";

  // Filter gallery items to only include images with thumbnails
  let posters = (window.galleryItems || []).filter(item =>
    item.has_thumb && item.thumb_url && !item.filename.includes("_mockup_")
  );

  // Apply collection filter
  if (collectionFilter) {
    posters = posters.filter(item => item.config?.collection === collectionFilter);
  }

  if (!posters.length) {
    grid.innerHTML = '<div class="mockup-studio-empty">No posters available. Generate some posters first!</div>';
    return;
  }

  posters.forEach(poster => {
    const card = document.createElement("div");
    card.className = "mockup-studio-poster-card";

    const city = poster.config?.city || poster.filename.split("_")[0];
    const theme = poster.config?.theme || "";
    const themeFormatted = theme.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const aspectRatio = poster.config?.aspect_ratio || "2:3";
    const dpi = poster.config?.dpi || 300;
    const format = (poster.config?.format || "png").toUpperCase();
    // Use thumbnail if available, otherwise fall back to full image
    const imgSrc = poster.thumb_url || poster.url;

    card.innerHTML = `
      <div class="mockup-studio-poster-image">
        <img src="${imgSrc}?t=${poster.mtime}" alt="${escapeHtml(poster.filename)}" loading="lazy">
        <div class="mockup-studio-poster-specs">${escapeHtml(aspectRatio)} · ${dpi} DPI</div>
      </div>
      <div class="mockup-studio-poster-info">
        <span class="mockup-studio-poster-city">${escapeHtml(city)}</span>
        <span class="mockup-studio-poster-theme">${escapeHtml(themeFormatted)}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      selectMockupStudioPoster(poster);
    });

    grid.appendChild(card);
  });
}

function selectMockupStudioPoster(poster) {
  if (!mockupStudioSelectedTemplate) return;

  // Save template reference before closing (closeMockupStudio clears it)
  const template = mockupStudioSelectedTemplate;

  // Close the studio and open the preview with the selected template and poster
  closeMockupStudio();
  openMockupPreview(template, poster);
}

// ===== MOCKUP OUTPUT GALLERY =====

let mockupOutputList = [];

async function openMockupGallery() {
  // Hide floating elements
  document.getElementById("bottom-bar-float")?.classList.add("hidden-by-modal");
  document.getElementById("coords-widget")?.classList.add("hidden-by-modal");
  document.getElementById("style-widget")?.classList.add("hidden-by-modal");

  elements.mockupGallery?.classList.add("open");
  await loadMockupOutputs();
  renderMockupGallery();
}

function closeMockupGallery() {
  elements.mockupGallery?.classList.remove("open");

  // Show floating elements
  document.getElementById("bottom-bar-float")?.classList.remove("hidden-by-modal");
  document.getElementById("coords-widget")?.classList.remove("hidden-by-modal");
  document.getElementById("style-widget")?.classList.remove("hidden-by-modal");
}

async function loadMockupOutputs() {
  try {
    const response = await fetch("/api/mockup_output");
    const data = await response.json();
    mockupOutputList = data.items || [];
  } catch (err) {
    console.error("Failed to load mockup outputs:", err);
    mockupOutputList = [];
  }
}

function renderMockupGallery() {
  const grid = elements.mockupGalleryGrid;
  const empty = elements.mockupGalleryEmpty;
  if (!grid) return;

  grid.innerHTML = "";

  if (!mockupOutputList.length) {
    grid.style.display = "none";
    if (empty) empty.style.display = "block";
    return;
  }

  grid.style.display = "grid";
  if (empty) empty.style.display = "none";

  mockupOutputList.forEach(item => {
    const card = document.createElement("div");
    card.className = "mockup-gallery-item";

    const date = new Date(item.mtime * 1000);
    const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    // Truncate filename for display
    const displayName = item.filename.length > 25
      ? item.filename.substring(0, 22) + "..."
      : item.filename;

    card.innerHTML = `
      <div class="mockup-gallery-item-image">
        <img src="${item.url}?t=${item.mtime}" alt="${escapeHtml(item.filename)}" loading="lazy">
      </div>
      <div class="mockup-gallery-item-info">
        <span class="mockup-gallery-item-name" title="${escapeHtml(item.filename)}">${escapeHtml(displayName)}</span>
        <span class="mockup-gallery-item-date">${dateStr}</span>
      </div>
      <div class="mockup-gallery-item-actions">
        <button type="button" class="mockup-gallery-item-btn edit" title="Edit / Crop">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/>
          </svg>
        </button>
        <button type="button" class="mockup-gallery-item-btn download" title="Download">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </button>
        <button type="button" class="mockup-gallery-item-btn delete" title="Delete">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </button>
      </div>
    `;

    // Edit button
    card.querySelector(".edit").addEventListener("click", (e) => {
      e.stopPropagation();
      openMockupImageEditor(item);
    });

    // Click image to open in new tab
    card.querySelector(".mockup-gallery-item-image").addEventListener("click", () => {
      window.open(item.url, "_blank");
    });

    // Download button
    card.querySelector(".download").addEventListener("click", (e) => {
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = item.url;
      link.download = item.filename;
      link.click();
    });

    // Delete button
    card.querySelector(".delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${item.filename}"?`)) return;

      try {
        const response = await fetch(`/api/mockup_output/${item.filename}`, { method: "DELETE" });
        const result = await response.json();
        if (result.ok) {
          await loadMockupOutputs();
          renderMockupGallery();
        } else {
          alert(result.error || "Failed to delete");
        }
      } catch (err) {
        console.error("Failed to delete mockup:", err);
        alert("Failed to delete mockup");
      }
    });

    grid.appendChild(card);
  });
}

async function openMockupOutputFolder() {
  try {
    await fetch("/api/mockup_output/open", { method: "POST" });
  } catch (err) {
    console.error("Failed to open folder:", err);
  }
}

// ===== MOCKUP IMAGE EDITOR =====
let mockupEditorImage = null;  // The source image
let mockupEditorItem = null;   // The mockup item being edited
let mockupEditorZoom = 100;    // Zoom percentage
let mockupEditorOffsetX = 0;   // Pan offset X
let mockupEditorOffsetY = 0;   // Pan offset Y
let mockupEditorCropW = 1080;  // Crop width
let mockupEditorCropH = 1080;  // Crop height
let mockupEditorDragging = false;
let mockupEditorDragStartX = 0;
let mockupEditorDragStartY = 0;
let mockupEditorSizeLinked = true;
let mockupEditorOriginalRatio = 1;

function openMockupImageEditor(item) {
  mockupEditorItem = item;
  mockupEditorZoom = 100;
  mockupEditorOffsetX = 0;
  mockupEditorOffsetY = 0;
  mockupEditorCropW = 1080;
  mockupEditorCropH = 1080;

  const editor = document.getElementById("mockup-image-editor");
  editor?.classList.add("open");

  // Load the image
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    mockupEditorImage = img;
    mockupEditorOriginalRatio = img.width / img.height;

    // Set crop size to image dimensions if smaller than defaults
    if (img.width < mockupEditorCropW) mockupEditorCropW = img.width;
    if (img.height < mockupEditorCropH) mockupEditorCropH = img.height;

    document.getElementById("editor-crop-width").value = mockupEditorCropW;
    document.getElementById("editor-crop-height").value = mockupEditorCropH;

    renderMockupImageEditor();
  };
  img.onerror = () => {
    alert("Failed to load image");
    closeMockupImageEditor();
  };
  img.src = item.url;

  // Set up event listeners
  setupMockupEditorListeners();
}

function closeMockupImageEditor() {
  const editor = document.getElementById("mockup-image-editor");
  editor?.classList.remove("open");
  mockupEditorImage = null;
  mockupEditorItem = null;
}

function setupMockupEditorListeners() {
  const wrap = document.getElementById("editor-canvas-wrap");

  // Drag to pan
  wrap?.addEventListener("mousedown", handleEditorMouseDown);
  document.addEventListener("mousemove", handleEditorMouseMove);
  document.addEventListener("mouseup", handleEditorMouseUp);

  // Zoom slider
  const zoomSlider = document.getElementById("editor-zoom-slider");
  zoomSlider?.addEventListener("input", (e) => {
    mockupEditorZoom = parseInt(e.target.value, 10);
    document.getElementById("editor-zoom-value").textContent = mockupEditorZoom + "%";
    renderMockupImageEditor();
  });

  // Zoom buttons
  document.getElementById("editor-zoom-in")?.addEventListener("click", () => {
    mockupEditorZoom = Math.min(200, mockupEditorZoom + 10);
    document.getElementById("editor-zoom-slider").value = mockupEditorZoom;
    document.getElementById("editor-zoom-value").textContent = mockupEditorZoom + "%";
    renderMockupImageEditor();
  });

  document.getElementById("editor-zoom-out")?.addEventListener("click", () => {
    mockupEditorZoom = Math.max(10, mockupEditorZoom - 10);
    document.getElementById("editor-zoom-slider").value = mockupEditorZoom;
    document.getElementById("editor-zoom-value").textContent = mockupEditorZoom + "%";
    renderMockupImageEditor();
  });

  // Size inputs
  const widthInput = document.getElementById("editor-crop-width");
  const heightInput = document.getElementById("editor-crop-height");

  widthInput?.addEventListener("change", (e) => {
    mockupEditorCropW = Math.max(100, Math.min(4000, parseInt(e.target.value, 10) || 1080));
    e.target.value = mockupEditorCropW;
    if (mockupEditorSizeLinked) {
      mockupEditorCropH = Math.round(mockupEditorCropW / mockupEditorOriginalRatio);
      heightInput.value = mockupEditorCropH;
    }
    renderMockupImageEditor();
  });

  heightInput?.addEventListener("change", (e) => {
    mockupEditorCropH = Math.max(100, Math.min(4000, parseInt(e.target.value, 10) || 1080));
    e.target.value = mockupEditorCropH;
    if (mockupEditorSizeLinked) {
      mockupEditorCropW = Math.round(mockupEditorCropH * mockupEditorOriginalRatio);
      widthInput.value = mockupEditorCropW;
    }
    renderMockupImageEditor();
  });

  // Size link toggle
  document.getElementById("editor-size-link")?.addEventListener("click", (e) => {
    mockupEditorSizeLinked = !mockupEditorSizeLinked;
    e.currentTarget.classList.toggle("unlinked", !mockupEditorSizeLinked);
  });

  // Preset buttons
  document.querySelectorAll(".editor-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      mockupEditorCropW = parseInt(btn.dataset.w, 10);
      mockupEditorCropH = parseInt(btn.dataset.h, 10);
      document.getElementById("editor-crop-width").value = mockupEditorCropW;
      document.getElementById("editor-crop-height").value = mockupEditorCropH;
      mockupEditorSizeLinked = false;
      document.getElementById("editor-size-link")?.classList.add("unlinked");
      renderMockupImageEditor();
    });
  });

  // Close button
  document.getElementById("mockup-image-editor-close")?.addEventListener("click", closeMockupImageEditor);

  // Backdrop click
  document.querySelector(".mockup-image-editor-backdrop")?.addEventListener("click", closeMockupImageEditor);

  // Save button
  document.getElementById("editor-save-btn")?.addEventListener("click", saveCroppedMockup);

  // Mouse wheel zoom
  wrap?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5;
    mockupEditorZoom = Math.max(10, Math.min(200, mockupEditorZoom + delta));
    document.getElementById("editor-zoom-slider").value = mockupEditorZoom;
    document.getElementById("editor-zoom-value").textContent = mockupEditorZoom + "%";
    renderMockupImageEditor();
  }, { passive: false });
}

function handleEditorMouseDown(e) {
  if (e.target.id !== "mockup-image-editor-canvas" && !e.target.closest("#editor-canvas-wrap")) return;
  mockupEditorDragging = true;
  mockupEditorDragStartX = e.clientX - mockupEditorOffsetX;
  mockupEditorDragStartY = e.clientY - mockupEditorOffsetY;
  e.target.style.cursor = "grabbing";
}

function handleEditorMouseMove(e) {
  if (!mockupEditorDragging) return;
  mockupEditorOffsetX = e.clientX - mockupEditorDragStartX;
  mockupEditorOffsetY = e.clientY - mockupEditorDragStartY;
  renderMockupImageEditor();
}

function handleEditorMouseUp() {
  mockupEditorDragging = false;
  const wrap = document.getElementById("editor-canvas-wrap");
  if (wrap) wrap.style.cursor = "grab";
}

function renderMockupImageEditor() {
  const canvas = document.getElementById("mockup-image-editor-canvas");
  if (!canvas || !mockupEditorImage) return;

  const ctx = canvas.getContext("2d");

  // Set canvas to crop size for preview
  const displayScale = Math.min(1, 500 / Math.max(mockupEditorCropW, mockupEditorCropH));
  canvas.width = mockupEditorCropW * displayScale;
  canvas.height = mockupEditorCropH * displayScale;

  // Clear canvas
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate scaled image dimensions
  const scale = mockupEditorZoom / 100;
  const imgW = mockupEditorImage.width * scale * displayScale;
  const imgH = mockupEditorImage.height * scale * displayScale;

  // Center image with offset
  const centerX = canvas.width / 2 + mockupEditorOffsetX * displayScale;
  const centerY = canvas.height / 2 + mockupEditorOffsetY * displayScale;

  // Draw image
  ctx.drawImage(
    mockupEditorImage,
    centerX - imgW / 2,
    centerY - imgH / 2,
    imgW,
    imgH
  );

  // Draw crop boundary
  ctx.strokeStyle = "rgba(102, 126, 234, 0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.setLineDash([]);
}

async function saveCroppedMockup() {
  if (!mockupEditorImage) return;

  // Create output canvas at full resolution
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = mockupEditorCropW;
  outputCanvas.height = mockupEditorCropH;
  const ctx = outputCanvas.getContext("2d");

  // Clear with white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

  // Calculate image position at full resolution
  const scale = mockupEditorZoom / 100;
  const imgW = mockupEditorImage.width * scale;
  const imgH = mockupEditorImage.height * scale;
  const centerX = outputCanvas.width / 2 + mockupEditorOffsetX;
  const centerY = outputCanvas.height / 2 + mockupEditorOffsetY;

  // Draw image
  ctx.drawImage(
    mockupEditorImage,
    centerX - imgW / 2,
    centerY - imgH / 2,
    imgW,
    imgH
  );

  // Convert to blob and upload
  outputCanvas.toBlob(async (blob) => {
    if (!blob) {
      alert("Failed to create image");
      return;
    }

    const formData = new FormData();
    formData.append("image", blob, "edited_mockup.png");

    try {
      const response = await fetch("/api/mockup_output/save_edited", {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (result.ok) {
        alert("Mockup saved successfully!");
        closeMockupImageEditor();
        await loadMockupOutputs();
        renderMockupGallery();
      } else {
        alert(result.error || "Failed to save mockup");
      }
    } catch (err) {
      console.error("Failed to save edited mockup:", err);
      alert("Failed to save mockup");
    }
  }, "image/png");
}

// ===== INITIALIZE =====
document.addEventListener("DOMContentLoaded", initApp);
