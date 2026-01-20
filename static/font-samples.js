/**
 * Font Samples Page
 * Generate exportable font charts for starred fonts
 */

// State
let starredFonts = [];
let allFonts = [];
let fontFacesLoaded = false;

// DOM Elements
const elements = {
  grid: document.getElementById("font-samples-grid"),
  emptyState: document.getElementById("empty-state"),
  canvas: document.getElementById("export-canvas"),
  sampleText: document.getElementById("sample-text"),
  fontSize: document.getElementById("font-size"),
  textColor: document.getElementById("text-color"),
  secondaryText: document.getElementById("secondary-text"),
  secondarySize: document.getElementById("secondary-size"),
  tertiaryText: document.getElementById("tertiary-text"),
  tertiarySize: document.getElementById("tertiary-size"),
  showFontName: document.getElementById("show-font-name"),
  refreshBtn: document.getElementById("refresh-preview"),
  exportAllBtn: document.getElementById("export-all"),
  exportGridBtn: document.getElementById("export-grid"),
};

// Initialize
async function init() {
  await Promise.all([loadFonts(), loadStarredFonts()]);
  loadFontFaces();
  renderSamples();
  initEventListeners();
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

async function loadStarredFonts() {
  try {
    const response = await fetch("/api/starred/fonts");
    starredFonts = await response.json();
  } catch (err) {
    console.error("Failed to load starred fonts:", err);
    starredFonts = [];
  }
}

function loadFontFaces() {
  let styleEl = document.getElementById("font-faces-style");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "font-faces-style";
    document.head.appendChild(styleEl);
  }

  const rules = allFonts.map((font) => `
    @font-face {
      font-family: "${font}";
      src: url("/fonts/${font}-Regular.ttf") format("truetype");
      font-weight: 400;
      font-display: swap;
    }
  `).join("\n");

  styleEl.textContent = rules;
  fontFacesLoaded = true;
}

function renderSamples() {
  if (starredFonts.length === 0) {
    elements.grid.style.display = "none";
    elements.emptyState.style.display = "block";
    return;
  }

  elements.grid.style.display = "grid";
  elements.emptyState.style.display = "none";
  elements.grid.innerHTML = "";

  const config = getConfig();

  starredFonts.forEach((fontName) => {
    const card = createFontCard(fontName, config);
    elements.grid.appendChild(card);
  });
}

function getConfig() {
  return {
    text: elements.sampleText.value || "LONDON",
    fontSize: parseInt(elements.fontSize.value) || 72,
    color: elements.textColor.value || "#1a1a1a",
    secondaryText: elements.secondaryText.value || "",
    secondarySize: parseInt(elements.secondarySize.value) || 24,
    tertiaryText: elements.tertiaryText.value || "",
    tertiarySize: parseInt(elements.tertiarySize.value) || 18,
    showFontName: elements.showFontName.checked,
  };
}

function createFontCard(fontName, config) {
  const card = document.createElement("div");
  card.className = "sample-card font-sample-card";
  card.dataset.font = fontName;

  const preview = document.createElement("div");
  preview.className = "sample-preview";

  const content = document.createElement("div");
  content.className = "sample-preview-content";

  const primaryText = document.createElement("p");
  primaryText.className = "sample-primary-text";
  primaryText.style.fontFamily = `"${fontName}", sans-serif`;
  primaryText.style.fontSize = `${config.fontSize}px`;
  primaryText.style.color = config.color;
  primaryText.textContent = config.text;
  content.appendChild(primaryText);

  if (config.secondaryText) {
    const secondaryText = document.createElement("p");
    secondaryText.className = "sample-secondary-text";
    secondaryText.style.fontFamily = `"${fontName}", sans-serif`;
    secondaryText.style.fontSize = `${config.secondarySize}px`;
    secondaryText.style.color = config.color;
    secondaryText.textContent = config.secondaryText;
    content.appendChild(secondaryText);
  }

  if (config.tertiaryText) {
    const tertiaryText = document.createElement("p");
    tertiaryText.className = "sample-tertiary-text";
    tertiaryText.style.fontFamily = `"${fontName}", sans-serif`;
    tertiaryText.style.fontSize = `${config.tertiarySize}px`;
    tertiaryText.style.color = config.color;
    tertiaryText.style.opacity = "0.7";
    tertiaryText.textContent = config.tertiaryText;
    content.appendChild(tertiaryText);
  }

  if (config.showFontName) {
    const fontLabel = document.createElement("div");
    fontLabel.className = "sample-font-label";
    fontLabel.textContent = fontName;
    content.appendChild(fontLabel);
  }

  preview.appendChild(content);

  const footer = document.createElement("div");
  footer.className = "sample-card-footer";

  const name = document.createElement("span");
  name.className = "sample-name";
  name.textContent = fontName;

  const actions = document.createElement("div");
  actions.className = "sample-actions";

  const exportBtn = document.createElement("button");
  exportBtn.className = "sample-btn";
  exportBtn.type = "button";
  exportBtn.title = "Export PNG";
  exportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;
  exportBtn.addEventListener("click", () => exportSingleFont(fontName));

  const unstarBtn = document.createElement("button");
  unstarBtn.className = "sample-btn";
  unstarBtn.type = "button";
  unstarBtn.title = "Remove from favorites";
  unstarBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
  unstarBtn.style.color = "#f59e0b";
  unstarBtn.addEventListener("click", () => unstarFont(fontName));

  actions.appendChild(exportBtn);
  actions.appendChild(unstarBtn);

  footer.appendChild(name);
  footer.appendChild(actions);

  card.appendChild(preview);
  card.appendChild(footer);

  return card;
}

async function unstarFont(fontName) {
  try {
    await fetch(`/api/starred/fonts/${encodeURIComponent(fontName)}`, {
      method: "DELETE",
    });
    starredFonts = starredFonts.filter((f) => f !== fontName);
    renderSamples();
  } catch (err) {
    console.error("Failed to unstar font:", err);
  }
}

async function exportSingleFont(fontName) {
  const config = getConfig();
  const canvas = elements.canvas;
  const ctx = canvas.getContext("2d");

  // Wait for font to load
  await document.fonts.load(`${config.fontSize}px "${fontName}"`);
  if (config.secondaryText) {
    await document.fonts.load(`${config.secondarySize}px "${fontName}"`);
  }
  if (config.tertiaryText) {
    await document.fonts.load(`${config.tertiarySize}px "${fontName}"`);
  }

  // Calculate dimensions at 300 DPI (scale factor of ~4.17 from 72 DPI)
  const scale = 300 / 72;
  const padding = 40 * scale;

  // Measure text
  ctx.font = `${config.fontSize * scale}px "${fontName}"`;
  const primaryMetrics = ctx.measureText(config.text);
  const primaryWidth = primaryMetrics.width;
  const primaryHeight = config.fontSize * scale * 1.2;

  let secondaryWidth = 0;
  let secondaryHeight = 0;
  if (config.secondaryText) {
    ctx.font = `${config.secondarySize * scale}px "${fontName}"`;
    const secondaryMetrics = ctx.measureText(config.secondaryText);
    secondaryWidth = secondaryMetrics.width;
    secondaryHeight = config.secondarySize * scale * 1.5;
  }

  let tertiaryWidth = 0;
  let tertiaryHeight = 0;
  if (config.tertiaryText) {
    ctx.font = `${config.tertiarySize * scale}px "${fontName}"`;
    const tertiaryMetrics = ctx.measureText(config.tertiaryText);
    tertiaryWidth = tertiaryMetrics.width;
    tertiaryHeight = config.tertiarySize * scale * 1.5;
  }

  let labelHeight = 0;
  if (config.showFontName) {
    labelHeight = 14 * scale * 2;
  }

  const contentWidth = Math.max(primaryWidth, secondaryWidth, tertiaryWidth);
  const contentHeight = primaryHeight + secondaryHeight + tertiaryHeight + labelHeight;

  canvas.width = contentWidth + padding * 2;
  canvas.height = contentHeight + padding * 2;

  // Clear canvas (transparent)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw primary text
  ctx.font = `${config.fontSize * scale}px "${fontName}"`;
  ctx.fillStyle = config.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(config.text, canvas.width / 2, padding);

  // Draw secondary text
  if (config.secondaryText) {
    ctx.font = `${config.secondarySize * scale}px "${fontName}"`;
    ctx.fillText(config.secondaryText, canvas.width / 2, padding + primaryHeight);
  }

  // Draw tertiary text (tagline)
  if (config.tertiaryText) {
    ctx.font = `${config.tertiarySize * scale}px "${fontName}"`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(config.tertiaryText, canvas.width / 2, padding + primaryHeight + secondaryHeight);
    ctx.globalAlpha = 1.0;
  }

  // Draw font name label
  if (config.showFontName) {
    ctx.font = `${12 * scale}px "Inter", sans-serif`;
    ctx.fillStyle = "#666666";
    ctx.fillText(fontName.toUpperCase(), canvas.width / 2, padding + primaryHeight + secondaryHeight + tertiaryHeight + 10 * scale);
  }

  // Download
  const link = document.createElement("a");
  link.download = `font-sample-${fontName.toLowerCase().replace(/\s+/g, "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function exportAllFonts() {
  showProgress("Exporting fonts...");

  for (let i = 0; i < starredFonts.length; i++) {
    updateProgress(`Exporting ${i + 1} of ${starredFonts.length}...`);
    await exportSingleFont(starredFonts[i]);
    await new Promise((r) => setTimeout(r, 300)); // Small delay between downloads
  }

  hideProgress();
}

async function exportGrid() {
  showProgress("Generating grid...");

  const config = getConfig();
  const canvas = elements.canvas;
  const ctx = canvas.getContext("2d");

  // Wait for all fonts to load
  for (const fontName of starredFonts) {
    await document.fonts.load(`${config.fontSize}px "${fontName}"`);
  }

  const scale = 300 / 72;
  const cardWidth = 500 * scale;
  const cardHeight = 200 * scale;
  const padding = 20 * scale;
  const cols = Math.min(starredFonts.length, 3);
  const rows = Math.ceil(starredFonts.length / cols);

  canvas.width = cols * cardWidth + padding * 2;
  canvas.height = rows * cardHeight + padding * 2;

  // Clear canvas (transparent)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw each font card
  starredFonts.forEach((fontName, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = padding + col * cardWidth;
    const y = padding + row * cardHeight;

    // Draw card background (white with slight transparency for visual separation)
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(x, y, cardWidth - padding, cardHeight - padding);

    // Calculate vertical offset based on number of text lines
    const hasSecondary = !!config.secondaryText;
    const hasTertiary = !!config.tertiaryText;
    const lineCount = 1 + (hasSecondary ? 1 : 0) + (hasTertiary ? 1 : 0);
    const centerY = y + (cardHeight - padding) / 2;
    const lineSpacing = 25 * scale;
    const startY = centerY - ((lineCount - 1) * lineSpacing) / 2;

    // Draw primary text
    ctx.font = `${config.fontSize * scale * 0.6}px "${fontName}"`;
    ctx.fillStyle = config.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(config.text, x + (cardWidth - padding) / 2, startY);

    // Draw secondary text
    if (config.secondaryText) {
      ctx.font = `${config.secondarySize * scale * 0.6}px "${fontName}"`;
      ctx.fillText(config.secondaryText, x + (cardWidth - padding) / 2, startY + lineSpacing);
    }

    // Draw tertiary text (tagline)
    if (config.tertiaryText) {
      ctx.font = `${config.tertiarySize * scale * 0.6}px "${fontName}"`;
      ctx.globalAlpha = 0.7;
      const tertiaryY = startY + (hasSecondary ? 2 : 1) * lineSpacing;
      ctx.fillText(config.tertiaryText, x + (cardWidth - padding) / 2, tertiaryY);
      ctx.globalAlpha = 1.0;
    }

    // Draw font name
    if (config.showFontName) {
      ctx.font = `${10 * scale}px "Inter", sans-serif`;
      ctx.fillStyle = "#666666";
      ctx.fillText(fontName, x + (cardWidth - padding) / 2, y + cardHeight - padding - 15 * scale);
    }
  });

  hideProgress();

  // Download
  const link = document.createElement("a");
  link.download = "font-samples-grid.png";
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
  elements.exportAllBtn.addEventListener("click", exportAllFonts);
  elements.exportGridBtn.addEventListener("click", exportGrid);

  // Live preview on config changes
  const configInputs = [
    elements.sampleText,
    elements.fontSize,
    elements.textColor,
    elements.secondaryText,
    elements.secondarySize,
    elements.tertiaryText,
    elements.tertiarySize,
    elements.showFontName,
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
