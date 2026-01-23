// Theme Editor JavaScript

// ===== STATE =====
const editorState = {
  currentTheme: null,
  originalTheme: null,
  isDirty: false,
  themeList: [],
  filteredThemes: [],
  collections: [],
  collectionItems: {},
  previewSvg: null,
  useRealMap: false,
  draggedColor: null,
  // Undo/Redo history
  history: [],
  historyIndex: -1,
  maxHistory: 50,
  isUndoRedo: false,
};

// Color properties in order
const COLOR_PROPERTIES = [
  { key: 'bg', label: 'Background', group: 'base' },
  { key: 'text', label: 'Text & Frame', group: 'base' },
  { key: 'gradient_color', label: 'Gradient', group: 'base' },
  { key: 'water', label: 'Water', group: 'features' },
  { key: 'parks', label: 'Parks', group: 'features' },
  { key: 'road_motorway', label: 'Motorway', group: 'roads' },
  { key: 'road_primary', label: 'Primary', group: 'roads' },
  { key: 'road_secondary', label: 'Secondary', group: 'roads' },
  { key: 'road_tertiary', label: 'Tertiary', group: 'roads' },
  { key: 'road_residential', label: 'Residential', group: 'roads' },
  { key: 'road_default', label: 'Default', group: 'roads' },
];

// Default theme template
const DEFAULT_THEME = {
  id: null,
  name: '',
  description: '',
  category: 'other',
  bg: '#FFFFFF',
  text: '#000000',
  gradient_color: '#FFFFFF',
  water: '#C0C0C0',
  parks: '#F0F0F0',
  road_motorway: '#0A0A0A',
  road_primary: '#1A1A1A',
  road_secondary: '#2A2A2A',
  road_tertiary: '#3A3A3A',
  road_residential: '#4A4A4A',
  road_default: '#3A3A3A',
};

// ===== DOM ELEMENTS =====
const elements = {
  // Header
  newThemeBtn: document.getElementById('new-theme-btn'),
  saveThemeBtn: document.getElementById('save-theme-btn'),

  // Theme Selector
  themeSearch: document.getElementById('theme-search'),
  categoryFilter: document.getElementById('category-filter'),
  collectionFilter: document.getElementById('collection-filter'),
  themeListContainer: document.getElementById('theme-list-container'),

  // Metadata
  themeName: document.getElementById('theme-name'),
  themeCategory: document.getElementById('theme-category'),
  themeDescription: document.getElementById('theme-description'),
  unsavedIndicator: document.getElementById('unsaved-indicator'),

  // Preview
  previewAspectWrapper: document.getElementById('preview-aspect-wrapper'),
  previewAspectSelect: document.getElementById('preview-aspect-select'),

  // Palette
  paletteBar: document.getElementById('palette-bar'),

  // Color Properties
  colorProperties: document.getElementById('color-properties'),

  // Actions
  saveAsBtn: document.getElementById('save-as-btn'),
  duplicateBtn: document.getElementById('duplicate-btn'),
  deleteBtn: document.getElementById('delete-btn'),

  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),

  // Modals
  confirmModal: document.getElementById('confirm-modal'),
  confirmModalTitle: document.getElementById('confirm-modal-title'),
  confirmModalMessage: document.getElementById('confirm-modal-message'),
  confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
  confirmOkBtn: document.getElementById('confirm-ok-btn'),

  saveAsModal: document.getElementById('save-as-modal'),
  saveAsName: document.getElementById('save-as-name'),
  saveAsCancelBtn: document.getElementById('save-as-cancel-btn'),
  saveAsConfirmBtn: document.getElementById('save-as-confirm-btn'),
};

// ===== INITIALIZATION =====
async function init() {
  await loadPreviewSvg();
  await loadThemes();
  await loadCollections();
  setupEventListeners();
  setupDropTargets();

  // Load first theme or create new
  if (editorState.themeList.length > 0) {
    selectTheme(editorState.themeList[0].id);
  } else {
    createNewTheme();
  }
}

async function loadPreviewSvg() {
  try {
    // Load static SVG with proper layer IDs for real-time recoloring
    const response = await fetch('/static/preview-map-final.svg');
    if (response.ok) {
      const svgText = await response.text();
      elements.previewAspectWrapper.innerHTML = svgText;
      editorState.previewSvg = elements.previewAspectWrapper.querySelector('svg');
      // Remove inline width/height to let CSS control sizing
      if (editorState.previewSvg) {
        editorState.previewSvg.removeAttribute('width');
        editorState.previewSvg.removeAttribute('height');
      }
      editorState.useRealMap = true;
      console.log('Loaded map preview');
    } else {
      // Fallback to simple mockup SVG
      await loadMockupSvg();
    }
  } catch (err) {
    console.error('Failed to load map, falling back to mockup:', err);
    await loadMockupSvg();
  }
}

async function loadMockupSvg() {
  try {
    const response = await fetch('/static/preview-map.svg');
    const svgText = await response.text();
    elements.previewAspectWrapper.innerHTML = svgText;
    editorState.previewSvg = elements.previewAspectWrapper.querySelector('svg');
    editorState.useRealMap = false;
    console.log('Loaded mockup preview');
  } catch (err) {
    console.error('Failed to load mockup SVG:', err);
  }
}

async function loadThemes() {
  try {
    const response = await fetch('/api/themes');
    const themes = await response.json();
    editorState.themeList = themes;
    editorState.filteredThemes = themes;
    renderThemeList();
  } catch (err) {
    console.error('Failed to load themes:', err);
    showToast('Failed to load themes', 'error');
  }
}

async function loadCollections() {
  try {
    const response = await fetch('/api/theme-collections');
    const data = await response.json();
    console.log('Collections API response:', data);
    // API returns {collections: [...], items: {collectionId: [themeIds]}}
    editorState.collections = data.collections || [];
    editorState.collectionItems = data.items || {};
    console.log('Loaded collections:', editorState.collections);
    console.log('Loaded collection items:', editorState.collectionItems);
    renderCollectionFilter();
  } catch (err) {
    console.error('Failed to load collections:', err);
  }
}

function renderCollectionFilter() {
  const select = elements.collectionFilter;
  // Keep the first "All Collections" option
  select.innerHTML = '<option value="">All Collections</option>';

  editorState.collections.forEach(collection => {
    const option = document.createElement('option');
    option.value = collection.id;
    const themeCount = editorState.collectionItems[collection.id]?.length || 0;
    option.textContent = `${collection.name} (${themeCount})`;
    select.appendChild(option);
  });
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Header buttons
  elements.newThemeBtn.addEventListener('click', () => {
    if (editorState.isDirty) {
      confirmUnsavedChanges(() => createNewTheme());
    } else {
      createNewTheme();
    }
  });

  elements.saveThemeBtn.addEventListener('click', saveTheme);

  // Theme search and filter
  elements.themeSearch.addEventListener('input', filterThemes);
  elements.categoryFilter.addEventListener('change', filterThemes);
  elements.collectionFilter.addEventListener('change', filterThemes);

  // Metadata inputs
  elements.themeName.addEventListener('input', () => {
    editorState.currentTheme.name = elements.themeName.value;
    markDirty();
  });

  elements.themeCategory.addEventListener('change', () => {
    editorState.currentTheme.category = elements.themeCategory.value;
    markDirty();
  });

  elements.themeDescription.addEventListener('input', () => {
    editorState.currentTheme.description = elements.themeDescription.value;
    markDirty();
  });

  // Preview aspect ratio
  elements.previewAspectSelect.addEventListener('change', updatePreviewAspect);

  // Color property inputs
  document.querySelectorAll('.color-property-row').forEach(row => {
    const property = row.dataset.property;
    const hexInput = row.querySelector('.color-hex');
    const colorPicker = row.querySelector('.color-picker');

    hexInput.addEventListener('input', () => {
      let value = hexInput.value.trim();
      if (!value.startsWith('#')) value = '#' + value;
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        colorPicker.value = value;
        updateColor(property, value);
      }
    });

    hexInput.addEventListener('blur', () => {
      // Normalize on blur
      let value = hexInput.value.trim();
      if (!value.startsWith('#')) value = '#' + value;
      if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
        hexInput.value = value.toUpperCase();
      } else {
        // Reset to current value
        hexInput.value = editorState.currentTheme[property] || '#000000';
      }
    });

    colorPicker.addEventListener('input', () => {
      const value = colorPicker.value.toUpperCase();
      hexInput.value = value;
      updateColor(property, value);
    });
  });

  // Action buttons
  elements.saveAsBtn.addEventListener('click', openSaveAsModal);
  elements.duplicateBtn.addEventListener('click', duplicateTheme);
  elements.deleteBtn.addEventListener('click', deleteTheme);

  // Confirm modal
  elements.confirmCancelBtn.addEventListener('click', closeConfirmModal);
  elements.confirmModal.querySelector('.confirm-modal-backdrop').addEventListener('click', closeConfirmModal);

  // Save As modal
  elements.saveAsCancelBtn.addEventListener('click', closeSaveAsModal);
  elements.saveAsConfirmBtn.addEventListener('click', saveAsNewTheme);
  elements.saveAsModal.querySelector('.save-as-modal-backdrop').addEventListener('click', closeSaveAsModal);
  elements.saveAsName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveAsNewTheme();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Save: Ctrl+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveTheme();
    }
    // Undo: Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  });

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (editorState.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

// ===== THEME LIST =====
function renderThemeList() {
  const container = elements.themeListContainer;
  container.innerHTML = '';

  if (editorState.filteredThemes.length === 0) {
    container.innerHTML = '<div class="theme-list-empty">No themes found</div>';
    return;
  }

  editorState.filteredThemes.forEach(theme => {
    const item = document.createElement('div');
    item.className = 'theme-list-item';
    if (editorState.currentTheme && theme.id === editorState.currentTheme.id) {
      item.classList.add('selected');
    }
    item.dataset.themeId = theme.id;

    // Color swatches - show all 11 colors in 3x4 grid
    const swatches = document.createElement('div');
    swatches.className = 'theme-list-swatches';
    COLOR_PROPERTIES.forEach(prop => {
      const swatch = document.createElement('div');
      swatch.className = 'theme-list-swatch';
      swatch.style.background = theme.colors?.[prop.key] || theme[prop.key] || '#ccc';
      swatch.title = prop.label;
      swatches.appendChild(swatch);
    });

    // Info
    const info = document.createElement('div');
    info.className = 'theme-list-info';
    info.innerHTML = `
      <div class="theme-list-name">${escapeHtml(theme.name || theme.id)}</div>
      <div class="theme-list-category">${escapeHtml(theme.category || 'other')}</div>
    `;

    item.appendChild(swatches);
    item.appendChild(info);

    item.addEventListener('click', () => {
      if (editorState.isDirty) {
        confirmUnsavedChanges(() => selectTheme(theme.id));
      } else {
        selectTheme(theme.id);
      }
    });

    container.appendChild(item);
  });
}

function filterThemes() {
  const search = elements.themeSearch.value.toLowerCase().trim();
  const category = elements.categoryFilter.value;
  const collectionId = elements.collectionFilter.value;

  // Get themes in selected collection
  let collectionThemeIds = null;
  if (collectionId) {
    collectionThemeIds = editorState.collectionItems[collectionId] || [];
    console.log('Collection filter:', collectionId, 'Theme IDs:', collectionThemeIds);
    console.log('Sample theme IDs from list:', editorState.themeList.slice(0, 3).map(t => t.id));
  }

  editorState.filteredThemes = editorState.themeList.filter(theme => {
    const matchesSearch = !search ||
      (theme.name || theme.id).toLowerCase().includes(search) ||
      (theme.description || '').toLowerCase().includes(search);
    const matchesCategory = !category || theme.category === category;
    const matchesCollection = !collectionThemeIds || collectionThemeIds.includes(theme.id);
    return matchesSearch && matchesCategory && matchesCollection;
  });

  console.log('Filtered themes count:', editorState.filteredThemes.length);
  renderThemeList();
}

// ===== THEME SELECTION & EDITING =====
async function selectTheme(themeId) {
  try {
    const response = await fetch(`/api/themes/${encodeURIComponent(themeId)}`);
    if (!response.ok) throw new Error('Theme not found');

    const theme = await response.json();
    loadThemeIntoEditor(theme);

    // Update list selection
    document.querySelectorAll('.theme-list-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.themeId === themeId);
    });

    // Enable action buttons
    elements.saveAsBtn.disabled = false;
    elements.duplicateBtn.disabled = false;
    elements.deleteBtn.disabled = false;

  } catch (err) {
    console.error('Failed to load theme:', err);
    showToast('Failed to load theme', 'error');
  }
}

function loadThemeIntoEditor(theme) {
  editorState.currentTheme = { ...theme };
  editorState.originalTheme = JSON.stringify(theme);
  editorState.isDirty = false;

  // Clear and initialize history with current state
  clearHistory();
  pushHistory();

  // Update metadata inputs
  elements.themeName.value = theme.name || '';
  elements.themeCategory.value = theme.category || 'other';
  elements.themeDescription.value = theme.description || '';

  // Update color inputs
  COLOR_PROPERTIES.forEach(prop => {
    const row = document.querySelector(`.color-property-row[data-property="${prop.key}"]`);
    if (row) {
      const value = theme[prop.key] || DEFAULT_THEME[prop.key];
      row.querySelector('.color-hex').value = value.toUpperCase();
      row.querySelector('.color-picker').value = value;
    }
  });

  // Update UI
  updatePaletteBar();
  updatePreview();
  updateUnsavedIndicator();
  updateSaveButton();
}

function createNewTheme() {
  const newTheme = {
    ...DEFAULT_THEME,
    id: null,
    name: 'New Theme',
    description: '',
    category: 'other',
  };

  loadThemeIntoEditor(newTheme);

  // Deselect in list
  document.querySelectorAll('.theme-list-item').forEach(item => {
    item.classList.remove('selected');
  });

  // Update buttons
  elements.saveThemeBtn.disabled = false;
  elements.saveAsBtn.disabled = false;
  elements.duplicateBtn.disabled = true;
  elements.deleteBtn.disabled = true;

  // Focus name input
  elements.themeName.focus();
  elements.themeName.select();

  markDirty();
}

// ===== UNDO/REDO =====
function pushHistory() {
  if (editorState.isUndoRedo || !editorState.currentTheme) return;

  // Remove any future states if we're not at the end
  if (editorState.historyIndex < editorState.history.length - 1) {
    editorState.history = editorState.history.slice(0, editorState.historyIndex + 1);
  }

  // Create a snapshot of current theme colors
  const snapshot = {};
  COLOR_PROPERTIES.forEach(prop => {
    snapshot[prop.key] = editorState.currentTheme[prop.key];
  });

  editorState.history.push(snapshot);

  // Limit history size
  if (editorState.history.length > editorState.maxHistory) {
    editorState.history.shift();
  } else {
    editorState.historyIndex++;
  }
}

function undo() {
  if (editorState.historyIndex <= 0) {
    showToast('Nothing to undo');
    return;
  }

  editorState.isUndoRedo = true;
  editorState.historyIndex--;
  applyHistoryState(editorState.history[editorState.historyIndex]);
  editorState.isUndoRedo = false;

  showToast('Undo');
}

function redo() {
  if (editorState.historyIndex >= editorState.history.length - 1) {
    showToast('Nothing to redo');
    return;
  }

  editorState.isUndoRedo = true;
  editorState.historyIndex++;
  applyHistoryState(editorState.history[editorState.historyIndex]);
  editorState.isUndoRedo = false;

  showToast('Redo');
}

function applyHistoryState(snapshot) {
  if (!snapshot || !editorState.currentTheme) return;

  // Apply colors from snapshot
  COLOR_PROPERTIES.forEach(prop => {
    if (snapshot[prop.key]) {
      editorState.currentTheme[prop.key] = snapshot[prop.key];

      // Update UI inputs
      const row = document.querySelector(`.color-property-row[data-property="${prop.key}"]`);
      if (row) {
        row.querySelector('.color-hex').value = snapshot[prop.key].toUpperCase();
        row.querySelector('.color-picker').value = snapshot[prop.key];
      }
    }
  });

  markDirty();
  updatePaletteBar();
  updatePreview();
}

function clearHistory() {
  editorState.history = [];
  editorState.historyIndex = -1;
}

// ===== COLOR HANDLING =====
function updateColor(property, value) {
  if (!editorState.currentTheme) return;

  // Push current state to history before making change
  if (!editorState.isUndoRedo) {
    pushHistory();
  }

  editorState.currentTheme[property] = value;
  markDirty();
  updatePaletteBar();
  updatePreview();
}

function updatePaletteBar() {
  const container = elements.paletteBar;
  container.innerHTML = '';

  if (!editorState.currentTheme) return;

  COLOR_PROPERTIES.forEach(prop => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    const colorValue = editorState.currentTheme[prop.key] || '#ccc';
    swatch.style.background = colorValue;
    swatch.title = `${prop.label}: ${colorValue}`;
    swatch.dataset.property = prop.key;
    swatch.dataset.label = prop.label;
    swatch.dataset.color = colorValue;
    swatch.draggable = true;

    // Drag events
    swatch.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', colorValue);
      e.dataTransfer.setData('application/x-color', colorValue);
      swatch.classList.add('dragging');
      editorState.draggedColor = colorValue;
    });

    swatch.addEventListener('dragend', () => {
      swatch.classList.remove('dragging');
      editorState.draggedColor = null;
    });

    // Click to copy functionality
    swatch.addEventListener('click', () => {
      copyToClipboard(colorValue);
      showToast(`Copied ${prop.label}: ${colorValue}`);

      // Brief visual feedback
      swatch.classList.add('copied');
      setTimeout(() => swatch.classList.remove('copied'), 300);
    });

    container.appendChild(swatch);
  });
}

// Setup drop targets on color property rows
function setupDropTargets() {
  document.querySelectorAll('.color-property-row').forEach(row => {
    const property = row.dataset.property;
    const hexInput = row.querySelector('.color-hex');
    const colorPicker = row.querySelector('.color-picker');

    // Make the entire row a drop target
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      row.classList.add('drag-over');
      hexInput.classList.add('drag-over');
    });

    row.addEventListener('dragleave', (e) => {
      // Only remove if leaving the row entirely
      if (!row.contains(e.relatedTarget)) {
        row.classList.remove('drag-over');
        hexInput.classList.remove('drag-over');
      }
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      hexInput.classList.remove('drag-over');

      const color = e.dataTransfer.getData('application/x-color') ||
                    e.dataTransfer.getData('text/plain') ||
                    editorState.draggedColor;

      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        hexInput.value = color.toUpperCase();
        colorPicker.value = color;
        updateColor(property, color.toUpperCase());
        showToast(`Applied ${color} to ${row.querySelector('.color-label').textContent}`);
      }
    });

    // Also make just the hex input a drop target
    hexInput.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      hexInput.classList.add('drag-over');
    });

    hexInput.addEventListener('dragleave', () => {
      hexInput.classList.remove('drag-over');
    });

    hexInput.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hexInput.classList.remove('drag-over');
      row.classList.remove('drag-over');

      const color = e.dataTransfer.getData('application/x-color') ||
                    e.dataTransfer.getData('text/plain') ||
                    editorState.draggedColor;

      if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
        hexInput.value = color.toUpperCase();
        colorPicker.value = color;
        updateColor(property, color.toUpperCase());
        showToast(`Applied ${color}`);
      }
    });
  });
}

// ===== PREVIEW =====
function updatePreview() {
  if (!editorState.previewSvg || !editorState.currentTheme) return;

  const theme = editorState.currentTheme;
  const svg = editorState.previewSvg;

  if (editorState.useRealMap) {
    // Real map SVG - elements have gid attributes
    updateRealMapPreview(svg, theme);
  } else {
    // Mockup SVG - elements have id attributes
    updateMockupPreview(svg, theme);
  }
}

function updateRealMapPreview(svg, theme) {
  // Helper to set fill on element (handles both attribute and inline style)
  const setFill = (el, color) => {
    el.setAttribute('fill', color);
    el.style.fill = color;
  };

  // Helper to set stroke on element (handles both attribute and inline style)
  const setStroke = (el, color) => {
    el.setAttribute('stroke', color);
    el.style.stroke = color;
  };

  // Background - it's a group containing a rect
  const bg = svg.querySelector('#preview-bg');
  if (bg) {
    bg.querySelectorAll('rect, path').forEach(child => setFill(child, theme.bg));
  }

  // Water - group containing paths
  const water = svg.querySelector('#preview-water');
  if (water) {
    water.querySelectorAll('path, ellipse, rect, circle').forEach(child => {
      setFill(child, theme.water);
    });
  }

  // Parks - group containing paths
  const parks = svg.querySelector('#preview-parks');
  if (parks) {
    parks.querySelectorAll('path, ellipse, rect, circle').forEach(child => {
      setFill(child, theme.parks);
    });
  }

  // Roads - SVG uses "preview-roads-*" (plural)
  // Roads in this SVG are filled polygon shapes, not stroked lines
  // Motorway
  const motorway = svg.querySelector('#preview-roads-motorway');
  if (motorway) {
    motorway.querySelectorAll('path').forEach(child => setFill(child, theme.road_motorway));
  }

  // Primary
  const primary = svg.querySelector('#preview-roads-primary');
  if (primary) {
    primary.querySelectorAll('path').forEach(child => setFill(child, theme.road_primary));
  }

  // Secondary
  const secondary = svg.querySelector('#preview-roads-secondary');
  if (secondary) {
    secondary.querySelectorAll('path').forEach(child => setFill(child, theme.road_secondary));
  }

  // Tertiary
  const tertiary = svg.querySelector('#preview-roads-tertiary');
  if (tertiary) {
    tertiary.querySelectorAll('path').forEach(child => setFill(child, theme.road_tertiary));
  }

  // Residential
  const residential = svg.querySelector('#preview-roads-residential');
  if (residential) {
    residential.querySelectorAll('path').forEach(child => setFill(child, theme.road_residential));
  }

  // Minor/Default roads
  const minor = svg.querySelector('#preview-roads-minor');
  if (minor) {
    minor.querySelectorAll('path').forEach(child => setFill(child, theme.road_default));
  }

  // Update text colors - text groups contain paths (converted text)
  const cityText = svg.querySelector('#preview-city');
  const countryText = svg.querySelector('#preview-country');
  const coordsText = svg.querySelector('#preview-coords');
  if (cityText) cityText.querySelectorAll('path, text, tspan').forEach(el => setFill(el, theme.text));
  if (countryText) countryText.querySelectorAll('path, text, tspan').forEach(el => setFill(el, theme.text));
  if (coordsText) coordsText.querySelectorAll('path, text, tspan').forEach(el => setFill(el, theme.text));

  // Border/frame
  const border = svg.querySelector('#preview-border');
  if (border) {
    border.querySelectorAll('rect, path').forEach(el => setStroke(el, theme.text));
  }
}

function updateMockupPreview(svg, theme) {
  // Background
  const bgRect = svg.querySelector('#preview-bg');
  if (bgRect) bgRect.setAttribute('fill', theme.bg);

  // Water
  const water = svg.querySelector('#preview-water');
  if (water) {
    water.querySelectorAll('path, ellipse, rect, circle').forEach(el => {
      el.setAttribute('fill', theme.water);
    });
  }

  // Parks
  const parks = svg.querySelector('#preview-parks');
  if (parks) {
    parks.querySelectorAll('rect, ellipse, path').forEach(el => {
      el.setAttribute('fill', theme.parks);
    });
  }

  // Roads - Motorway
  const motorway = svg.querySelector('#preview-roads-motorway');
  if (motorway) {
    motorway.setAttribute('stroke', theme.road_motorway);
  }

  // Roads - Primary
  const primary = svg.querySelector('#preview-roads-primary');
  if (primary) {
    primary.setAttribute('stroke', theme.road_primary);
  }

  // Roads - Secondary
  const secondary = svg.querySelector('#preview-roads-secondary');
  if (secondary) {
    secondary.setAttribute('stroke', theme.road_secondary);
  }

  // Roads - Tertiary
  const tertiary = svg.querySelector('#preview-roads-tertiary');
  if (tertiary) {
    tertiary.setAttribute('stroke', theme.road_tertiary);
  }

  // Border frame
  const border = svg.querySelector('#preview-border');
  if (border) border.setAttribute('stroke', theme.text);

  // Text
  const textElements = svg.querySelectorAll('#preview-city, #preview-country');
  textElements.forEach(el => el.setAttribute('fill', theme.text));

  // Pin icons
  const pins = svg.querySelectorAll('.pin-icon path, .pin-icon circle, .pin-icon rect');
  pins.forEach(el => {
    if (el.getAttribute('fill') !== 'white' && el.getAttribute('fill') !== 'none') {
      el.setAttribute('fill', theme.text);
    }
  });
}

function updatePreviewAspect() {
  const aspect = elements.previewAspectSelect.value;
  const wrapper = elements.previewAspectWrapper;
  const svg = editorState.previewSvg;

  if (!svg) return;

  // For the real map SVG, don't modify internals - it has fixed structure
  // Just show the map at its native aspect ratio
  if (editorState.useRealMap) {
    return;
  }

  // Aspect ratio definitions (width:height as decimal ratio) - mockup only
  const aspectRatios = {
    '2:3': 2 / 3,      // Portrait poster
    '3:4': 3 / 4,      // Photo
    '4:5': 4 / 5,      // Frame
    '5:7': 5 / 7,      // Frame
    '11:14': 11 / 14,  // Frame
    '1:1': 1,          // Square
    '16:9': 16 / 9,    // Landscape
    '9:16': 9 / 16,    // Portrait
    'A4': 210 / 297,   // ISO A4
    'A3': 297 / 420,   // ISO A3
  };

  const ratio = aspectRatios[aspect] || 2 / 3;
  const baseWidth = 300;
  const height = Math.round(baseWidth / ratio);

  // Update SVG viewBox to new dimensions
  svg.setAttribute('viewBox', `0 0 ${baseWidth} ${height}`);

  // Calculate text area position (bottom 15% of poster)
  const mapHeight = Math.round(height * 0.78);
  const textY = mapHeight + 25;

  // Update background
  const bgRect = svg.querySelector('#preview-bg');
  if (bgRect) {
    bgRect.setAttribute('height', height);
  }

  // Update map clip path
  const clipRect = svg.querySelector('#map-clip rect');
  if (clipRect) {
    clipRect.setAttribute('height', mapHeight - 30);
  }

  // Update border frame
  const border = svg.querySelector('#preview-border');
  if (border) {
    border.setAttribute('height', mapHeight - 30);
  }

  // Reposition text elements
  const cityText = svg.querySelector('#preview-city');
  const countryText = svg.querySelector('#preview-country');
  const coordsText = svg.querySelector('#preview-coords');

  if (cityText) cityText.setAttribute('y', textY);
  if (countryText) countryText.setAttribute('y', textY + 20);
  if (coordsText) coordsText.setAttribute('y', textY + 37);

  // Reposition pin to center of map area
  const pinGroup = svg.querySelector('#preview-pin');
  if (pinGroup) {
    const mapCenterY = 15 + (mapHeight - 30) / 2;
    pinGroup.setAttribute('transform', `translate(150, ${mapCenterY})`);
  }
}

// ===== SAVE OPERATIONS =====
async function saveTheme() {
  if (!editorState.currentTheme) return;

  const theme = editorState.currentTheme;

  // Validate
  if (!theme.name || !theme.name.trim()) {
    showToast('Theme name is required', 'error');
    elements.themeName.focus();
    return;
  }

  const isNew = !theme.id;
  const themeId = theme.id || generateThemeId(theme.name);

  try {
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? '/api/themes' : `/api/themes/${encodeURIComponent(themeId)}`;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: theme.name.trim(),
        description: theme.description?.trim() || '',
        category: theme.category || 'other',
        bg: theme.bg,
        text: theme.text,
        gradient_color: theme.gradient_color,
        water: theme.water,
        parks: theme.parks,
        road_motorway: theme.road_motorway,
        road_primary: theme.road_primary,
        road_secondary: theme.road_secondary,
        road_tertiary: theme.road_tertiary,
        road_residential: theme.road_residential,
        road_default: theme.road_default,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Save failed');
    }

    const result = await response.json();

    // Update state
    editorState.currentTheme.id = result.id || themeId;
    editorState.originalTheme = JSON.stringify(editorState.currentTheme);
    editorState.isDirty = false;

    // Reload themes list
    await loadThemes();

    // Re-select current theme
    renderThemeList();

    showToast(isNew ? 'Theme created!' : 'Theme saved!', 'success');
    updateUnsavedIndicator();
    updateSaveButton();

    // Enable buttons
    elements.duplicateBtn.disabled = false;
    elements.deleteBtn.disabled = false;

  } catch (err) {
    console.error('Save failed:', err);
    showToast(err.message || 'Failed to save theme', 'error');
  }
}

function openSaveAsModal() {
  elements.saveAsName.value = editorState.currentTheme?.name
    ? `${editorState.currentTheme.name} Copy`
    : 'New Theme';
  elements.saveAsModal.classList.add('open');
  elements.saveAsName.focus();
  elements.saveAsName.select();
}

function closeSaveAsModal() {
  elements.saveAsModal.classList.remove('open');
}

async function saveAsNewTheme() {
  const newName = elements.saveAsName.value.trim();
  if (!newName) {
    showToast('Please enter a theme name', 'error');
    return;
  }

  // Create new theme with current colors
  const newTheme = {
    ...editorState.currentTheme,
    id: null,
    name: newName,
  };

  editorState.currentTheme = newTheme;
  closeSaveAsModal();
  await saveTheme();
}

async function duplicateTheme() {
  if (!editorState.currentTheme?.id) return;

  const newName = `${editorState.currentTheme.name} Copy`;

  try {
    const response = await fetch(`/api/themes/${encodeURIComponent(editorState.currentTheme.id)}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Duplicate failed');
    }

    const result = await response.json();

    // Reload and select new theme
    await loadThemes();
    selectTheme(result.id);

    showToast('Theme duplicated!', 'success');

  } catch (err) {
    console.error('Duplicate failed:', err);
    showToast(err.message || 'Failed to duplicate theme', 'error');
  }
}

// ===== DELETE =====
function deleteTheme() {
  if (!editorState.currentTheme?.id) return;

  elements.confirmModalTitle.textContent = 'Delete Theme';
  elements.confirmModalMessage.textContent =
    `Are you sure you want to delete "${editorState.currentTheme.name}"? This cannot be undone.`;
  elements.confirmOkBtn.textContent = 'Delete';
  elements.confirmOkBtn.onclick = confirmDelete;
  elements.confirmModal.classList.add('open');
}

async function confirmDelete() {
  closeConfirmModal();

  try {
    const response = await fetch(`/api/themes/${encodeURIComponent(editorState.currentTheme.id)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Delete failed');
    }

    showToast('Theme deleted', 'success');

    // Reload themes
    await loadThemes();

    // Select first theme or create new
    if (editorState.themeList.length > 0) {
      selectTheme(editorState.themeList[0].id);
    } else {
      createNewTheme();
    }

  } catch (err) {
    console.error('Delete failed:', err);
    showToast(err.message || 'Failed to delete theme', 'error');
  }
}

function closeConfirmModal() {
  elements.confirmModal.classList.remove('open');
}

// ===== DIRTY STATE =====
function markDirty() {
  editorState.isDirty = true;
  updateUnsavedIndicator();
  updateSaveButton();
}

function updateUnsavedIndicator() {
  elements.unsavedIndicator.classList.toggle('visible', editorState.isDirty);
}

function updateSaveButton() {
  elements.saveThemeBtn.disabled = !editorState.isDirty && editorState.currentTheme?.id;
}

function confirmUnsavedChanges(callback) {
  elements.confirmModalTitle.textContent = 'Unsaved Changes';
  elements.confirmModalMessage.textContent =
    'You have unsaved changes. Discard them and continue?';
  elements.confirmOkBtn.textContent = 'Discard';
  elements.confirmOkBtn.onclick = () => {
    closeConfirmModal();
    editorState.isDirty = false;
    callback();
  };
  elements.confirmModal.classList.add('open');
}

// ===== UTILITIES =====
function generateThemeId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });
}

function showToast(message, type = '') {
  elements.toastMessage.textContent = message;
  elements.toast.className = 'toast visible' + (type ? ` ${type}` : '');

  setTimeout(() => {
    elements.toast.classList.remove('visible');
  }, 3000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', init);
