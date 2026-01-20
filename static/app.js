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

  // Settings
  radius: 29000,
  dpi: 300,
  format: "png",
  theme: "feature_based",
  font: "",  // Empty means default (Roboto)
};

// ===== THEME CATALOG =====
let themeCatalog = {};
let themeList = [];
let themesByCategory = {};
let currentCategory = "all";

// ===== FONT LIST =====
let fontList = [];

// ===== MAP VARIABLES =====
let leafletMap = null;
let radiusCircle = null;
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
let galleryLoaded = false;
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
  syncCity: document.getElementById("sync-city"),
  syncCountry: document.getElementById("sync-country"),

  // Sliders
  radiusSlider: document.getElementById("radius-slider"),
  radiusValue: document.getElementById("radius-value"),
  dpiSlider: document.getElementById("dpi-slider"),
  dpiValue: document.getElementById("dpi-value"),

  // Format, Font & Theme
  formatSelect: document.getElementById("format-select"),
  fontPicker: document.getElementById("font-picker"),
  fontPickerToggle: document.getElementById("font-picker-toggle"),
  fontPickerLabel: document.getElementById("font-picker-label"),
  fontPickerDropdown: document.getElementById("font-picker-dropdown"),
  fontPickerOptions: document.getElementById("font-picker-options"),
  themeQuickPicker: document.getElementById("theme-quick-picker"),
  themeCategoryTabs: document.getElementById("theme-category-tabs"),
  themeCarousel: document.getElementById("theme-carousel"),
  themeCarouselWrap: document.getElementById("theme-carousel-wrap"),
  themeBrowseBtn: document.getElementById("theme-browse-btn"),
  selectedThemeName: document.getElementById("selected-theme-name"),

  // Generate
  generateBtn: document.getElementById("generate-btn"),

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

  // Gallery
  galleryToggle: document.getElementById("gallery-toggle"),
  galleryOverlay: document.getElementById("gallery-overlay"),
  galleryClose: document.getElementById("gallery-close"),
  galleryGrid: document.getElementById("gallery-grid"),
  galleryPath: document.getElementById("gallery-path"),
  openFolderBtn: document.getElementById("open-folder-btn"),

  // Map style
  styleWidget: document.getElementById("style-widget"),
  styleToggle: document.getElementById("style-toggle"),
  styleDropdown: document.getElementById("style-dropdown"),

  // Theme drawer
  themeDrawer: document.getElementById("theme-drawer"),
  themeSearch: document.getElementById("theme-search"),
  themeGridFull: document.getElementById("theme-grid-full"),
  drawerClose: document.getElementById("drawer-close"),

  // Lightbox
  lightbox: document.getElementById("lightbox"),
  lightboxImage: document.getElementById("lightbox-image"),
  lightboxCaption: document.getElementById("lightbox-caption"),
  lightboxStrip: document.getElementById("lightbox-strip"),
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

function initApp() {
  initLeafletMap();
  loadThemes();
  loadFonts();
  initEventListeners();
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

async function handleMapClick(e) {
  const { lat, lng } = e.latlng;

  // Update state
  state.selectedLat = lat;
  state.selectedLng = lng;

  // Show/update circle and marker
  if (!leafletMap.hasLayer(radiusCircle)) {
    radiusCircle.addTo(leafletMap);
    centerMarker.addTo(leafletMap);
  }
  radiusCircle.setLatLng([lat, lng]);
  centerMarker.setLatLng([lat, lng]);

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

  if (hasCoords && hasCity && hasCountry) {
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
}

// ===== RADIUS & DPI SLIDERS =====

function updateRadius(value) {
  state.radius = parseInt(value);
  elements.radiusValue.textContent = `${Math.round(state.radius / 1000)} km`;
  if (radiusCircle) {
    radiusCircle.setRadius(state.radius);
  }
}

function updateDpi(value) {
  state.dpi = parseInt(value);
  elements.dpiValue.textContent = value;
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

    // Set initial theme name
    updateSelectedThemeName();
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
  const defaultOpt = createFontOption("", `Default (${defaultFont})`, defaultFont);
  elements.fontPickerOptions.appendChild(defaultOpt);

  // Add each available font with preview
  fonts.forEach((font) => {
    const opt = createFontOption(font, font, font);
    elements.fontPickerOptions.appendChild(opt);
  });

  // Update toggle label
  updateFontPickerLabel();
}

function createFontOption(value, name, previewFont) {
  const opt = document.createElement("div");
  opt.className = "font-picker-option";
  opt.dataset.value = value;
  if (value === state.font) {
    opt.classList.add("selected");
  }

  const nameEl = document.createElement("div");
  nameEl.className = "font-picker-option-name";
  nameEl.textContent = name;

  const previewEl = document.createElement("div");
  previewEl.className = "font-picker-option-preview";
  previewEl.style.fontFamily = `"${previewFont}", sans-serif`;
  previewEl.textContent = "The quick brown fox";

  opt.appendChild(nameEl);
  opt.appendChild(previewEl);

  opt.addEventListener("click", () => {
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

  themes.forEach((theme) => {
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

    const title = document.createElement("div");
    title.className = "theme-title";
    title.textContent = theme.name;

    card.appendChild(swatches);
    card.appendChild(title);

    card.addEventListener("click", (e) => {
      // Prevent click during drag
      if (elements.themeCarousel.classList.contains("dragging")) {
        e.preventDefault();
        return;
      }
      selectTheme(theme.id);
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

  const name = document.createElement("div");
  name.className = "theme-card-name";
  name.textContent = theme.name;

  const desc = document.createElement("div");
  desc.className = "theme-card-desc";
  desc.textContent = theme.description || "Custom palette";

  card.appendChild(preview);
  card.appendChild(name);
  card.appendChild(desc);

  card.addEventListener("click", () => {
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

// ===== GALLERY =====

function openGallery() {
  elements.galleryOverlay.classList.add("open");
  elements.galleryOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  if (!galleryLoaded) {
    loadGallery();
    startGalleryStream();
    galleryLoaded = true;
  }
}

function closeGallery() {
  elements.galleryOverlay.classList.remove("open");
  elements.galleryOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

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

function renderGallery(items) {
  elements.galleryGrid.innerHTML = "";

  if (!items.length) {
    elements.galleryGrid.innerHTML = '<div class="gallery-placeholder">No posters yet. Generate one!</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const card = document.createElement("button");
    card.className = "gallery-item";
    card.type = "button";

    const img = document.createElement("img");
    img.dataset.src = `${item.url}?t=${item.mtime}`;
    img.alt = item.filename;
    img.loading = "lazy";
    card.appendChild(img);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "gallery-delete";
    deleteBtn.type = "button";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete ${item.filename}?`)) {
        await fetch(`/api/posters/${encodeURIComponent(item.filename)}`, { method: "DELETE" });
        loadGallery(true);
      }
    });
    card.appendChild(deleteBtn);

    card.addEventListener("click", () => openLightbox(index));
    fragment.appendChild(card);
  });

  elements.galleryGrid.appendChild(fragment);
  hydrateGalleryImages();
}

function hydrateGalleryImages() {
  const images = elements.galleryGrid.querySelectorAll("img[data-src]");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            delete img.dataset.src;
            observer.unobserve(img);
          }
        });
      },
      { rootMargin: "100px" }
    );

    images.forEach((img) => observer.observe(img));
  } else {
    images.forEach((img) => {
      img.src = img.dataset.src;
      delete img.dataset.src;
    });
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
    if (galleryLoaded) {
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
    lat: state.selectedLat,
    lng: state.selectedLng,
    distance: state.radius,
    theme: state.theme,
    format: state.format,
    font: state.font,
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

  // Poster text inputs
  elements.posterCity?.addEventListener("input", (e) => {
    state.posterCity = e.target.value;
    updateGenerateButton();
  });

  elements.posterCountry?.addEventListener("input", (e) => {
    state.posterCountry = e.target.value;
    updateGenerateButton();
  });

  // Sliders
  elements.radiusSlider?.addEventListener("input", (e) => updateRadius(e.target.value));
  elements.dpiSlider?.addEventListener("input", (e) => updateDpi(e.target.value));

  // Format
  elements.formatSelect?.addEventListener("change", (e) => {
    state.format = e.target.value;
  });

  // Font picker is initialized in loadFonts()

  // Theme drawer
  elements.themeBrowseBtn?.addEventListener("click", openThemeDrawer);
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
  elements.generateBtn?.addEventListener("click", generatePoster);

  // Gallery
  elements.galleryToggle?.addEventListener("click", openGallery);
  elements.galleryClose?.addEventListener("click", closeGallery);
  elements.openFolderBtn?.addEventListener("click", openFolder);

  // Close gallery on backdrop click
  elements.galleryOverlay?.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-close-gallery")) {
      closeGallery();
    }
  });

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

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    // Escape closes overlays
    if (e.key === "Escape") {
      if (elements.lightbox?.classList.contains("open")) {
        closeLightbox();
      } else if (elements.themeDrawer?.classList.contains("open")) {
        closeThemeDrawer();
      } else if (elements.galleryOverlay?.classList.contains("open")) {
        closeGallery();
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

// ===== INITIALIZE =====
document.addEventListener("DOMContentLoaded", initApp);
