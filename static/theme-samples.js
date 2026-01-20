/**
 * Theme Samples Page
 * Generate exportable theme swatches for starred themes
 */

// State
let starredThemes = [];
let allThemes = [];
let allFonts = [];

// Color keys for swatches
const SWATCH_COLORS = [
  { key: "bg", label: "BG" },
  { key: "road_motorway", label: "Road 1" },
  { key: "road_primary", label: "Road 2" },
  { key: "water", label: "Water" },
  { key: "parks", label: "Parks" },
  { key: "road_secondary", label: "Road 3" },
];

// DOM Elements
const elements = {
  grid: document.getElementById("theme-samples-grid"),
  emptyState: document.getElementById("empty-state"),
  canvas: document.getElementById("export-canvas"),
  swatchStyle: document.getElementById("swatch-style"),
  cardWidth: document.getElementById("card-width"),
  cardHeight: document.getElementById("card-height"),
  showThemeName: document.getElementById("show-theme-name"),
  showColorLabels: document.getElementById("show-color-labels"),
  nameFont: document.getElementById("name-font"),
  refreshBtn: document.getElementById("refresh-preview"),
  exportAllBtn: document.getElementById("export-all"),
  exportGridBtn: document.getElementById("export-grid"),
};

// Initialize
async function init() {
  await Promise.all([loadThemes(), loadStarredThemes(), loadFonts()]);
  populateFontSelect();
  renderSamples();
  initEventListeners();
}

async function loadThemes() {
  try {
    const response = await fetch("/api/themes");
    allThemes = await response.json();
  } catch (err) {
    console.error("Failed to load themes:", err);
    allThemes = [];
  }
}

async function loadStarredThemes() {
  try {
    const response = await fetch("/api/starred/themes");
    starredThemes = await response.json();
  } catch (err) {
    console.error("Failed to load starred themes:", err);
    starredThemes = [];
  }
}

async function loadFonts() {
  try {
    const response = await fetch("/api/fonts");
    allFonts = await response.json();
  } catch (err) {
    console.error("Failed to load fonts:", err);
    allFonts = [];
  }
}

function populateFontSelect() {
  const select = elements.nameFont;
  allFonts.forEach((font) => {
    const option = document.createElement("option");
    option.value = font;
    option.textContent = font;
    select.appendChild(option);
  });
}

function getStarredThemeData() {
  return starredThemes
    .map((themeId) => allThemes.find((t) => t.id === themeId))
    .filter(Boolean);
}

function renderSamples() {
  const themes = getStarredThemeData();

  if (themes.length === 0) {
    elements.grid.style.display = "none";
    elements.emptyState.style.display = "block";
    return;
  }

  elements.grid.style.display = "grid";
  elements.emptyState.style.display = "none";
  elements.grid.innerHTML = "";

  const config = getConfig();

  themes.forEach((theme) => {
    const card = createThemeCard(theme, config);
    elements.grid.appendChild(card);
  });
}

function getConfig() {
  return {
    style: elements.swatchStyle.value,
    width: parseInt(elements.cardWidth.value) || 400,
    height: parseInt(elements.cardHeight.value) || 200,
    showName: elements.showThemeName.checked,
    showLabels: elements.showColorLabels.checked,
    font: elements.nameFont.value || "Inter",
  };
}

function createThemeCard(theme, config) {
  const card = document.createElement("div");
  card.className = "sample-card theme-sample-card";
  card.dataset.themeId = theme.id;

  const preview = document.createElement("div");
  preview.className = "sample-preview";

  const swatchesContainer = document.createElement("div");
  swatchesContainer.className = "theme-swatches-preview";

  // Create swatches based on style
  const swatches = createSwatches(theme, config);
  swatchesContainer.appendChild(swatches);

  // Add theme name overlay if enabled
  if (config.showName) {
    const nameOverlay = document.createElement("div");
    nameOverlay.className = "theme-name-overlay";
    nameOverlay.style.fontFamily = `"${config.font}", sans-serif`;
    const nameText = document.createElement("h3");
    nameText.textContent = theme.name;
    nameOverlay.appendChild(nameText);
    swatchesContainer.appendChild(nameOverlay);
  }

  preview.appendChild(swatchesContainer);

  const footer = document.createElement("div");
  footer.className = "sample-card-footer";

  const name = document.createElement("span");
  name.className = "sample-name";
  name.textContent = theme.name;

  const actions = document.createElement("div");
  actions.className = "sample-actions";

  const exportBtn = document.createElement("button");
  exportBtn.className = "sample-btn";
  exportBtn.type = "button";
  exportBtn.title = "Export PNG";
  exportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
  exportBtn.addEventListener("click", () => exportSingleTheme(theme));

  const unstarBtn = document.createElement("button");
  unstarBtn.className = "sample-btn";
  unstarBtn.type = "button";
  unstarBtn.title = "Remove from favorites";
  unstarBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
  unstarBtn.style.color = "#f59e0b";
  unstarBtn.addEventListener("click", () => unstarTheme(theme.id));

  actions.appendChild(exportBtn);
  actions.appendChild(unstarBtn);

  footer.appendChild(name);
  footer.appendChild(actions);

  card.appendChild(preview);
  card.appendChild(footer);

  return card;
}

function createSwatches(theme, config) {
  const container = document.createElement("div");

  switch (config.style) {
    case "horizontal":
      container.className = "theme-swatches-bar";
      SWATCH_COLORS.forEach((color) => {
        const swatch = document.createElement("div");
        swatch.className = "swatch";
        swatch.style.backgroundColor = theme.colors[color.key] || "#ccc";
        if (config.showLabels) {
          const label = document.createElement("span");
          label.className = "swatch-label";
          label.textContent = color.label;
          swatch.appendChild(label);
        }
        container.appendChild(swatch);
      });
      break;

    case "vertical":
      container.className = "theme-swatches-bar vertical";
      SWATCH_COLORS.forEach((color) => {
        const swatch = document.createElement("div");
        swatch.className = "swatch";
        swatch.style.backgroundColor = theme.colors[color.key] || "#ccc";
        if (config.showLabels) {
          const label = document.createElement("span");
          label.className = "swatch-label";
          label.textContent = color.label;
          swatch.appendChild(label);
        }
        container.appendChild(swatch);
      });
      break;

    case "grid":
      container.className = "theme-swatches-grid";
      SWATCH_COLORS.forEach((color) => {
        const swatch = document.createElement("div");
        swatch.className = "swatch";
        swatch.style.backgroundColor = theme.colors[color.key] || "#ccc";
        container.appendChild(swatch);
      });
      break;

    case "circle":
      container.className = "theme-swatches-circles";
      SWATCH_COLORS.forEach((color) => {
        const swatch = document.createElement("div");
        swatch.className = "swatch";
        swatch.style.backgroundColor = theme.colors[color.key] || "#ccc";
        swatch.title = config.showLabels ? color.label : "";
        container.appendChild(swatch);
      });
      break;
  }

  return container;
}

async function unstarTheme(themeId) {
  try {
    await fetch(`/api/starred/themes/${encodeURIComponent(themeId)}`, {
      method: "DELETE",
    });
    starredThemes = starredThemes.filter((t) => t !== themeId);
    renderSamples();
  } catch (err) {
    console.error("Failed to unstar theme:", err);
  }
}

async function exportSingleTheme(theme) {
  const config = getConfig();
  const canvas = elements.canvas;
  const ctx = canvas.getContext("2d");

  // Scale for 300 DPI
  const scale = 300 / 72;
  const width = config.width * scale;
  const height = config.height * scale;

  canvas.width = width;
  canvas.height = height;

  // Clear canvas (transparent)
  ctx.clearRect(0, 0, width, height);

  // Calculate swatch area and name area
  const nameHeight = config.showName ? 60 * scale : 0;
  const swatchHeight = height - nameHeight;

  // Draw swatches
  drawSwatches(ctx, theme, config, 0, 0, width, swatchHeight, scale);

  // Draw theme name
  if (config.showName) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(0, swatchHeight, width, nameHeight);

    ctx.font = `bold ${18 * scale}px "${config.font}", sans-serif`;
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(theme.name, width / 2, swatchHeight + nameHeight / 2);
  }

  // Download
  const link = document.createElement("a");
  link.download = `theme-${theme.id}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawSwatches(ctx, theme, config, x, y, width, height, scale) {
  const colors = SWATCH_COLORS.map((c) => theme.colors[c.key] || "#ccc");

  switch (config.style) {
    case "horizontal":
      const hSwatchWidth = width / colors.length;
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(x + i * hSwatchWidth, y, hSwatchWidth, height);
        if (config.showLabels) {
          ctx.font = `${10 * scale}px sans-serif`;
          ctx.fillStyle = getContrastColor(color);
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(SWATCH_COLORS[i].label, x + i * hSwatchWidth + hSwatchWidth / 2, y + height - 5 * scale);
        }
      });
      break;

    case "vertical":
      const vSwatchHeight = height / colors.length;
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, y + i * vSwatchHeight, width, vSwatchHeight);
        if (config.showLabels) {
          ctx.font = `${10 * scale}px sans-serif`;
          ctx.fillStyle = getContrastColor(color);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(SWATCH_COLORS[i].label, x + width / 2, y + i * vSwatchHeight + vSwatchHeight / 2);
        }
      });
      break;

    case "grid":
      const cols = 3;
      const rows = 2;
      const gSwatchWidth = width / cols;
      const gSwatchHeight = height / rows;
      colors.forEach((color, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.fillStyle = color;
        ctx.fillRect(x + col * gSwatchWidth, y + row * gSwatchHeight, gSwatchWidth, gSwatchHeight);
      });
      break;

    case "circle":
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, width, height);
      const circleRadius = Math.min(width / (colors.length * 2.5), height / 3);
      const spacing = width / (colors.length + 1);
      colors.forEach((color, i) => {
        const cx = x + spacing * (i + 1);
        const cy = y + height / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
      });
      break;
  }
}

function getContrastColor(hex) {
  // Remove # if present
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)";
}

async function exportAllThemes() {
  const themes = getStarredThemeData();
  showProgress("Exporting themes...");

  for (let i = 0; i < themes.length; i++) {
    updateProgress(`Exporting ${i + 1} of ${themes.length}...`);
    await exportSingleTheme(themes[i]);
    await new Promise((r) => setTimeout(r, 300));
  }

  hideProgress();
}

async function exportGrid() {
  showProgress("Generating grid...");

  const themes = getStarredThemeData();
  const config = getConfig();
  const canvas = elements.canvas;
  const ctx = canvas.getContext("2d");

  const scale = 300 / 72;
  const cardWidth = config.width * scale;
  const cardHeight = config.height * scale;
  const padding = 20 * scale;
  const cols = Math.min(themes.length, 3);
  const rows = Math.ceil(themes.length / cols);

  canvas.width = cols * (cardWidth + padding) + padding;
  canvas.height = rows * (cardHeight + padding) + padding;

  // Clear canvas (transparent)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw each theme card
  themes.forEach((theme, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = padding + col * (cardWidth + padding);
    const y = padding + row * (cardHeight + padding);

    // Calculate swatch area and name area
    const nameHeight = config.showName ? 50 * scale : 0;
    const swatchHeight = cardHeight - nameHeight;

    // Draw swatches
    drawSwatches(ctx, theme, config, x, y, cardWidth, swatchHeight, scale);

    // Draw theme name
    if (config.showName) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(x, y + swatchHeight, cardWidth, nameHeight);

      ctx.font = `bold ${14 * scale}px "${config.font}", sans-serif`;
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(theme.name, x + cardWidth / 2, y + swatchHeight + nameHeight / 2);
    }
  });

  hideProgress();

  // Download
  const link = document.createElement("a");
  link.download = "theme-samples-grid.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function showProgress(message) {
  let progress = document.querySelector(".export-progress");
  if (!progress) {
    progress = document.createElement("div");
    progress.className = "export-progress";
    progress.innerHTML = `
      <div class="export-spinner"></div>
      <span class="export-progress-text">${message}</span>
    `;
    document.body.appendChild(progress);
  } else {
    progress.classList.remove("hidden");
    progress.querySelector(".export-progress-text").textContent = message;
  }
}

function updateProgress(message) {
  const progress = document.querySelector(".export-progress");
  if (progress) {
    progress.querySelector(".export-progress-text").textContent = message;
  }
}

function hideProgress() {
  const progress = document.querySelector(".export-progress");
  if (progress) {
    progress.classList.add("hidden");
  }
}

function initEventListeners() {
  elements.refreshBtn.addEventListener("click", renderSamples);
  elements.exportAllBtn.addEventListener("click", exportAllThemes);
  elements.exportGridBtn.addEventListener("click", exportGrid);

  // Live preview on config changes
  const configInputs = [
    elements.swatchStyle,
    elements.cardWidth,
    elements.cardHeight,
    elements.showThemeName,
    elements.showColorLabels,
    elements.nameFont,
  ];

  configInputs.forEach((input) => {
    input.addEventListener("input", debounce(renderSamples, 200));
    input.addEventListener("change", renderSamples);
  });
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", init);
