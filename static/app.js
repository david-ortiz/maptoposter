const themeGrid = document.getElementById("theme-grid");
const form = document.getElementById("poster-form");
const formError = document.getElementById("form-error");
const distanceInput = document.getElementById("distance-input");
const distanceRange = document.getElementById("distance-range");
const dpiInput = document.getElementById("dpi-input");
const dpiRange = document.getElementById("dpi-range");
const progressFill = document.getElementById("progress-fill");
const progressPercent = document.getElementById("progress-percent");
const progressMessage = document.getElementById("progress-message");
const progressStage = document.getElementById("progress-stage");
const cityInput = document.getElementById("city");
const countryInput = document.getElementById("country");
const cityList = document.getElementById("city-list");
const countryList = document.getElementById("country-list");
const galleryGrid = document.getElementById("gallery-grid");
const openGallery = document.getElementById("open-gallery");
const themePrev = document.getElementById("theme-prev");
const themeNext = document.getElementById("theme-next");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxStrip = document.getElementById("lightbox-strip");
const examplesToggle = document.getElementById("examples-toggle");
const examplesList = document.getElementById("examples-list");
const galleryPath = document.getElementById("gallery-path");

const stageOrder = [
  "queued",
  "geocode",
  "network",
  "water",
  "parks",
  "render",
  "save",
  "done",
];

let activeSource = null;
let cityCatalog = [];
let countries = [];
let pulseTimer = null;
let pulseStage = null;
let pulseStart = 0;
let lastKnownPercent = 0;
let currentJobId = null;
let galleryItems = [];
let galleryIndex = 0;
let themeCatalog = {};
let lightboxBuiltCount = 0;
let lastGallerySignature = "";
let gallerySource = null;

const updateDistance = (value) => {
  distanceInput.value = value;
  distanceRange.value = value;
};

distanceInput.addEventListener("input", (event) => {
  updateDistance(event.target.value);
});

distanceRange.addEventListener("input", (event) => {
  updateDistance(event.target.value);
});

const updateDpi = (value) => {
  dpiInput.value = value;
  dpiRange.value = value;
};

dpiInput.addEventListener("input", (event) => {
  updateDpi(event.target.value);
});

dpiRange.addEventListener("input", (event) => {
  updateDpi(event.target.value);
});

const normalize = (value) =>
  (value || "")
    .toString()
    .toLowerCase()
    .replace(/\./g, "")
    .trim();

const highlightMatch = (label, query) => {
  const index = normalize(label).indexOf(normalize(query));
  if (index === -1 || !query) {
    return label;
  }
  const start = label.slice(0, index);
  const match = label.slice(index, index + query.length);
  const end = label.slice(index + query.length);
  return `${start}<strong>${match}</strong>${end}`;
};

const clearAutocomplete = (list) => {
  list.innerHTML = "";
  list.classList.remove("visible");
};

const showAutocomplete = (list, items) => {
  list.innerHTML = "";
  if (!items.length) {
    list.classList.remove("visible");
    return;
  }
  items.forEach((item) => list.appendChild(item));
  list.classList.add("visible");
};

const renderCitySuggestions = (query) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    clearAutocomplete(cityList);
    return;
  }
  const matches = cityCatalog.filter((entry) =>
    entry.searchKeys.some((key) => key.startsWith(normalizedQuery))
  );
  const items = matches.slice(0, 6).map((entry) => {
    const element = document.createElement("div");
    element.className = "autocomplete-item";
    element.innerHTML = `${highlightMatch(
      entry.city,
      query
    )} <span>— ${entry.country}</span>`;
    element.addEventListener("click", () => {
      cityInput.value = entry.city;
      countryInput.value = entry.country;
      clearAutocomplete(cityList);
      clearAutocomplete(countryList);
    });
    return element;
  });
  showAutocomplete(cityList, items);
};

const renderCountrySuggestions = (query) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    clearAutocomplete(countryList);
    return;
  }
  const matches = countries.filter((country) =>
    normalize(country).startsWith(normalizedQuery)
  );
  const items = matches.slice(0, 6).map((country) => {
    const element = document.createElement("div");
    element.className = "autocomplete-item";
    element.innerHTML = highlightMatch(country, query);
    element.addEventListener("click", () => {
      countryInput.value = country;
      clearAutocomplete(countryList);
    });
    return element;
  });
  showAutocomplete(countryList, items);
};

const maybeAutofillCountry = () => {
  const query = normalize(cityInput.value);
  if (!query) {
    return;
  }
  const match = cityCatalog.find((entry) =>
    entry.searchKeys.some((key) => key === query)
  );
  if (match) {
    cityInput.value = match.city;
    if (!countryInput.value) {
      countryInput.value = match.country;
    }
  }
};

cityInput.addEventListener("input", (event) => {
  renderCitySuggestions(event.target.value);
  maybeAutofillCountry();
});

countryInput.addEventListener("input", (event) => {
  renderCountrySuggestions(event.target.value);
});

document.addEventListener("click", (event) => {
  if (!cityInput.contains(event.target) && !cityList.contains(event.target)) {
    clearAutocomplete(cityList);
  }
  if (
    !countryInput.contains(event.target) &&
    !countryList.contains(event.target)
  ) {
    clearAutocomplete(countryList);
  }
});

const stopPulse = () => {
  if (pulseTimer) {
    clearInterval(pulseTimer);
    pulseTimer = null;
  }
  pulseStage = null;
};

const startPulse = (stage, basePercent) => {
  if (pulseStage === stage) {
    return;
  }
  stopPulse();
  pulseStage = stage;
  pulseStart = Date.now();
  lastKnownPercent = basePercent;
  const caps = {
    network: 34,
    water: 47,
    parks: 59,
  };
  pulseTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - pulseStart) / 1000);
    const cap = caps[stage] || 0;
    if (cap && lastKnownPercent < cap) {
      lastKnownPercent = Math.min(cap, lastKnownPercent + 0.3);
      progressFill.style.width = `${lastKnownPercent}%`;
      progressPercent.textContent = `${Math.round(lastKnownPercent)}%`;
    }
    progressMessage.textContent = `Still working on ${stage} data (${elapsed}s)`;
  }, 1200);
};

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

const setProgress = ({ percent, message, stage, status }) => {
  const bounded = Math.max(0, Math.min(100, percent || 0));
  progressFill.style.width = `${bounded}%`;
  progressPercent.textContent = `${Math.round(bounded)}%`;
  progressMessage.textContent = message || "Working...";
  lastKnownPercent = bounded;

  const currentIndex = stageOrder.indexOf(stage || "queued");
  const totalStages = stageOrder.length;
  const stageLabel = stageLabels[stage] || stage || "Queued";
  if (progressStage) {
    if (status === "done") {
      progressStage.textContent = "Complete";
    } else if (currentIndex >= 0) {
      progressStage.textContent = `Stage ${currentIndex + 1} of ${totalStages}: ${stageLabel}`;
    } else {
      progressStage.textContent = "";
    }
  }

  if (status === "running" && ["network", "water", "parks"].includes(stage)) {
    startPulse(stage, bounded);
  } else {
    stopPulse();
  }

  if (status === "done") {
    loadGallery();
  }
  if (status === "error" || status === "cancelled") {
    stopPulse();
  }
};

const resetResult = () => {
  progressFill.style.width = "0%";
  progressPercent.textContent = "0%";
  progressMessage.textContent = "Ready to generate a map.";
  if (progressStage) {
    progressStage.textContent = "";
  }
  stopPulse();
};

const renderThemes = (themes) => {
  themeGrid.innerHTML = "";
  themeCatalog = themes.reduce((acc, theme) => {
    acc[theme.id] = theme;
    return acc;
  }, {});
  themes.forEach((theme) => {
    const card = document.createElement("label");
    card.className = "theme-card";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "theme";
    input.value = theme.id;

    if (theme.id === "feature_based") {
      input.checked = true;
      card.classList.add("selected");
    }

    input.addEventListener("change", () => {
      document
        .querySelectorAll(".theme-card")
        .forEach((item) => item.classList.remove("selected"));
      card.classList.add("selected");
    });

    const title = document.createElement("div");
    title.className = "theme-title";
    title.textContent = theme.name;

    const description = document.createElement("div");
    description.className = "theme-description";
    description.textContent = theme.description || "Custom palette.";

    const swatches = document.createElement("div");
    swatches.className = "theme-swatches";

    ["bg", "water", "road_primary", "road_secondary"].forEach((key) => {
      const swatch = document.createElement("span");
      swatch.className = "theme-swatch";
      swatch.style.background = theme.colors[key] || "#eee";
      swatches.appendChild(swatch);
    });

    card.appendChild(input);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(swatches);
    themeGrid.appendChild(card);
  });
};

const selectTheme = (themeId) => {
  const input = document.querySelector(`input[name="theme"][value="${themeId}"]`);
  if (!input) {
    return;
  }
  input.checked = true;
  document
    .querySelectorAll(".theme-card")
    .forEach((item) => item.classList.remove("selected"));
  input.closest(".theme-card").classList.add("selected");
};

const applyThemeStyle = (button, themeId) => {
  const theme = themeCatalog[themeId];
  if (!theme) {
    return;
  }
  const bg = theme.colors?.bg || "#ffffff";
  const accent = theme.colors?.road_primary || theme.colors?.road_secondary || "#333333";
  const text = theme.colors?.text || "#111111";
  button.style.background = `linear-gradient(135deg, ${bg}, ${accent})`;
  button.style.borderColor = accent;
  button.style.color = text;
};

const resolveCityCountry = (label) => {
  const overrides = {
    Manhattan: { city: "New York", country: "USA" },
    "Venice Winding Canals": { city: "Venice", country: "Italy" },
    "Amsterdam Concentric Canals": { city: "Amsterdam", country: "Netherlands" },
    "Dubai Palm-Shaped Coastline": { city: "Dubai", country: "UAE" },
    "Paris Radial Boulevards": { city: "Paris", country: "France" },
    "Moscow Ring-Road Layout": { city: "Moscow", country: "Russia" },
    "Tokyo Dense Organic Streets": { city: "Tokyo", country: "Japan" },
    "Marrakech Medina Maze": { city: "Marrakech", country: "Morocco" },
    "Rome Ancient Street Layout": { city: "Rome", country: "Italy" },
    "San Francisco Coastal Grid": { city: "San Francisco", country: "USA" },
    "Sydney Harbor Curves": { city: "Sydney", country: "Australia" },
    "Mumbai Coastal Peninsula": { city: "Mumbai", country: "India" },
    "London Thames River Curves": { city: "London", country: "UK" },
    "Budapest Danube Split City": { city: "Budapest", country: "Hungary" },
    Barcelona: { city: "Barcelona", country: "Spain" },
  };
  if (overrides[label]) {
    return overrides[label];
  }
  const normalizedLabel = normalize(label);
  let bestMatch = null;
  let bestLength = 0;
  cityCatalog.forEach((entry) => {
    const cityName = normalize(entry.city);
    if (normalizedLabel.startsWith(cityName) && cityName.length > bestLength) {
      bestMatch = entry;
      bestLength = cityName.length;
    }
  });
  if (bestMatch) {
    return { city: bestMatch.city, country: bestMatch.country };
  }
  return { city: "", country: "" };
};

const renderExamples = async () => {
  if (!examplesList || !cityCatalog.length || !Object.keys(themeCatalog).length) {
    return;
  }
  if (examplesList.dataset.loaded === "true") {
    return;
  }
  const response = await fetch("/api/examples");
  const text = await response.text();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  examplesList.innerHTML = "";
  lines.forEach((line) => {
    const [label, theme, distance] = line.split(",").map((part) => part.trim());
    if (!label || !theme || !distance) {
      return;
    }
    const { city, country } = resolveCityCountry(label);
    const button = document.createElement("button");
    button.className = "example-item";
    button.type = "button";
    button.textContent = label;
    button.dataset.city = city;
    button.dataset.country = country;
    button.dataset.theme = theme;
    button.dataset.distance = distance;
    applyThemeStyle(button, theme);
    button.addEventListener("click", () => {
      cityInput.value = button.dataset.city || "";
      countryInput.value = button.dataset.country || "";
      updateDistance(button.dataset.distance || "");
      selectTheme(button.dataset.theme);
      examplesList.classList.remove("open");
      examplesList.setAttribute("aria-hidden", "true");
    });
    examplesList.appendChild(button);
  });
  examplesList.dataset.loaded = "true";
};

const loadThemes = async () => {
  const response = await fetch("/api/themes");
  const themes = await response.json();
  renderThemes(themes);
  renderExamples();
};

const scrollThemes = (direction) => {
  const amount = themeGrid.clientWidth * 0.8;
  themeGrid.scrollBy({ left: direction * amount, behavior: "smooth" });
};

const loadCities = async () => {
  const response = await fetch("/static/data/cities.json");
  cityCatalog = await response.json();
  cityCatalog = cityCatalog.map((entry) => ({
    ...entry,
    searchKeys: [
      normalize(entry.city),
      ...(entry.aliases || []).map((alias) => normalize(alias)),
    ],
  }));
  countries = Array.from(
    new Set(cityCatalog.map((entry) => entry.country))
  ).sort();
  renderExamples();
};

const renderGallery = (items) => {
  galleryItems = items;
  galleryGrid.innerHTML = "";
  if (!items.length) {
    galleryGrid.innerHTML = "<div>No posters yet. Generate one!</div>";
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const card = document.createElement("button");
    card.className = "gallery-item";
    card.type = "button";
    const image = document.createElement("img");
    image.dataset.src = `${item.url}?t=${item.mtime}`;
    image.alt = item.filename;
    image.loading = "lazy";
    image.decoding = "async";
    card.appendChild(image);
    const deleteButton = document.createElement("button");
    deleteButton.className = "gallery-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "✕";
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!confirm(`Delete ${item.filename}?`)) {
        return;
      }
      await fetch(`/api/posters/${encodeURIComponent(item.filename)}`, {
        method: "DELETE",
      });
      loadGallery(true);
    });
    card.appendChild(deleteButton);
    card.addEventListener("click", () => {
      openLightbox(index);
    });
    fragment.appendChild(card);
  });
  galleryGrid.appendChild(fragment);
  hydrateGalleryImages();
};

const hydrateGalleryImages = () => {
  const images = Array.from(galleryGrid.querySelectorAll("img[data-src]"));
  if (!images.length) {
    return;
  }
  const inView = (img) => {
    if (img.dataset.src) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            inView(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "200px" }
    );
    images.forEach((img) => observer.observe(img));
  } else {
    images.forEach(inView);
  }
};

const loadGallery = async (force = false) => {
  const response = await fetch("/api/posters");
  const payload = await response.json();
  applyGalleryPayload(payload, force);
};

const applyGalleryPayload = (payload, force = false) => {
  const items = payload.items || [];
  const signature = items.map((item) => `${item.filename}:${item.mtime}`).join("|");
  if (!force && signature === lastGallerySignature) {
    return;
  }
  lastGallerySignature = signature;
  renderGallery(items);
  if (galleryPath) {
    galleryPath.textContent = payload.path || "";
  }
};

const openLightbox = (index) => {
  if (!galleryItems.length) {
    return;
  }
  galleryIndex = Math.max(0, Math.min(index, galleryItems.length - 1));
  const item = galleryItems[galleryIndex];
  const src = `${item.url}?t=${item.mtime}`;
  if (lightboxImage.src !== src) {
    lightboxImage.src = src;
  }
  if (lightboxImage.parentElement) {
    lightboxImage.parentElement.scrollTop = 0;
  }
  lightboxImage.decoding = "async";
  lightboxImage.loading = "eager";
  lightboxImage.style.visibility = "hidden";
  lightboxImage.onload = () => {
    lightboxImage.style.visibility = "visible";
  };
  lightboxCaption.textContent = item.path || item.filename;
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  buildLightboxStrip();
  setLightboxActive();
  preloadLightboxNeighbors();
};

const closeLightbox = () => {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
};

const stepLightbox = (direction) => {
  if (!galleryItems.length) {
    return;
  }
  galleryIndex += direction;
  if (galleryIndex < 0) {
    galleryIndex = galleryItems.length - 1;
  }
  if (galleryIndex >= galleryItems.length) {
    galleryIndex = 0;
  }
  openLightbox(galleryIndex);
};

const buildLightboxStrip = () => {
  if (!lightboxStrip) {
    return;
  }
  if (lightboxBuiltCount === galleryItems.length && lightboxStrip.childNodes.length) {
    return;
  }
  lightboxStrip.innerHTML = "";
  galleryItems.forEach((item, index) => {
    const thumb = document.createElement("button");
    thumb.className = "lightbox-thumb";
    thumb.dataset.index = index;
    const img = document.createElement("img");
    img.src = `${item.url}?t=${item.mtime}`;
    img.alt = item.filename;
    img.loading = "lazy";
    img.decoding = "async";
    thumb.appendChild(img);
    thumb.addEventListener("click", () => {
      openLightbox(index);
    });
    lightboxStrip.appendChild(thumb);
  });
  lightboxBuiltCount = galleryItems.length;
};

const setLightboxActive = () => {
  if (!lightboxStrip) {
    return;
  }
  lightboxStrip.querySelectorAll(".lightbox-thumb").forEach((thumb) => {
    const isActive = Number(thumb.dataset.index) === galleryIndex;
    thumb.classList.toggle("active", isActive);
  });
  const active = lightboxStrip.querySelector(".lightbox-thumb.active");
  if (active) {
    active.scrollIntoView({ behavior: "instant", inline: "center" });
  }
};

const preloadLightboxNeighbors = () => {
  if (galleryItems.length < 2) {
    return;
  }
  const prevIndex = (galleryIndex - 1 + galleryItems.length) % galleryItems.length;
  const nextIndex = (galleryIndex + 1) % galleryItems.length;
  [prevIndex, nextIndex].forEach((idx) => {
    const item = galleryItems[idx];
    const img = new Image();
    img.src = `${item.url}?t=${item.mtime}`;
  });
};

const startStream = (jobId) => {
  if (activeSource) {
    activeSource.close();
  }
  activeSource = new EventSource(`/api/jobs/${jobId}/stream`);
  activeSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setProgress(data);
    if (data.status === "done" || data.status === "error" || data.status === "cancelled") {
      if (data.status === "error") {
        formError.textContent = data.error || "Something went wrong.";
      }
      activeSource.close();
    }
  };
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";
  resetResult();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.distance = Number(payload.distance || distanceInput.value || 29000);
  payload.dpi = Number(payload.dpi || dpiInput.value || 300);

  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    formError.textContent = data.error || "Unable to start job.";
    return;
  }

  const data = await response.json();
  currentJobId = data.job_id;
  setProgress({ percent: 2, message: "Job queued", stage: "queued" });
  startStream(data.job_id);
});

resetResult();
loadThemes();
loadCities();
loadGallery(true);

if ("EventSource" in window) {
  gallerySource = new EventSource("/api/posters/stream");
  gallerySource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      applyGalleryPayload(payload);
    } catch (error) {
      loadGallery(true);
    }
  };
  gallerySource.onerror = () => {
    loadGallery(true);
  };
}

if (openGallery) {
  openGallery.addEventListener("click", async () => {
    try {
      await fetch("/api/posters/open", { method: "POST" });
    } catch (error) {
      formError.textContent = "Unable to open the posters folder.";
    }
  });
}

if (examplesToggle && examplesList) {
  examplesToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    renderExamples();
    examplesList.classList.toggle("open");
    examplesList.setAttribute(
      "aria-hidden",
      examplesList.classList.contains("open") ? "false" : "true"
    );
  });
  examplesList.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  document.addEventListener("click", () => {
    if (examplesList.classList.contains("open")) {
      examplesList.classList.remove("open");
      examplesList.setAttribute("aria-hidden", "true");
    }
  });
}

if (lightbox) {
  lightbox.addEventListener("click", (event) => {
    if (event.target.dataset.lightboxClose) {
      closeLightbox();
    }
    if (event.target.dataset.lightboxPrev) {
      stepLightbox(-1);
    }
    if (event.target.dataset.lightboxNext) {
      stepLightbox(1);
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (!lightbox || !lightbox.classList.contains("open")) {
    return;
  }
  if (event.key === "Escape") {
    closeLightbox();
  } else if (event.key === "ArrowLeft") {
    stepLightbox(-1);
  } else if (event.key === "ArrowRight") {
    stepLightbox(1);
  }
});

if (themePrev) {
  themePrev.addEventListener("click", () => {
    scrollThemes(-1);
  });
}

if (themeNext) {
  themeNext.addEventListener("click", () => {
    scrollThemes(1);
  });
}
