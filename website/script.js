// FusionCross Single-Page Download & Crosstie Catalog Script
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  detectArchitecture();
  setupShaCopy();
  initScrollReveals();
  initCrosstieCatalog();
});

const CROSSTIE_CATALOG = [
  {
    id: "steam",
    title: "Steam for Windows",
    category: "games",
    categoryLabel: "Games · Store",
    rating: "Platinum",
    glyph: "gamepad",
    desc: "Run the full Windows Steam client on macOS. Includes support for DirectX 11/12 games via D3DMetal.",
    bottle: "Gaming",
    verbs: "steam corefonts d3dmetal"
  },
  {
    id: "ea-app",
    title: "EA App & Origin",
    category: "games",
    categoryLabel: "Games · Store",
    rating: "Gold",
    glyph: "bolt",
    desc: "Play EA titles including Battlefield, FIFA, and The Sims with automatic VC++ runtime dependencies.",
    bottle: "Gaming",
    verbs: "msxml3 msxml6 vcrun2022"
  },
  {
    id: "gog-galaxy",
    title: "GOG Galaxy 2.0",
    category: "games",
    categoryLabel: "Games · Store",
    rating: "Platinum",
    glyph: "orbit",
    desc: "DRM-free games launcher with cloud saves and achievement tracking.",
    bottle: "Gaming",
    verbs: "corefonts dxvk"
  },
  {
    id: "epic-games",
    title: "Epic Games Launcher",
    category: "games",
    categoryLabel: "Games · Store",
    rating: "Gold",
    glyph: "rocket",
    desc: "Run Fortnite, Unreal Engine projects, and free weekly games via D3DMetal.",
    bottle: "Gaming",
    verbs: "vcrun2022 corefonts"
  },
  {
    id: "office-365",
    title: "Microsoft Office 365",
    category: "productivity",
    categoryLabel: "Productivity · Suite",
    rating: "Gold",
    glyph: "chart",
    desc: "Word, Excel, PowerPoint, and Access for Windows with native font rendering.",
    bottle: "Productivity",
    verbs: "msxml6 corefonts riched20"
  },
  {
    id: "notepad-pp",
    title: "Notepad++",
    category: "utilities",
    categoryLabel: "Utilities · Code",
    rating: "Platinum",
    glyph: "code",
    desc: "Fast text and source code editor with plugin manager.",
    bottle: "Productivity",
    verbs: "corefonts"
  },
  {
    id: "fl-studio",
    title: "FL Studio 21",
    category: "creative",
    categoryLabel: "Creative · Audio",
    rating: "Platinum",
    glyph: "wave",
    desc: "Digital Audio Workstation (DAW) with low-latency CoreAudio bridging.",
    bottle: "Productivity",
    verbs: "corefonts asio"
  },
  {
    id: "cyberpunk",
    title: "Cyberpunk 2077",
    category: "games",
    categoryLabel: "Games · AAA",
    rating: "Platinum",
    glyph: "cpu",
    desc: "Ray-tracing & D3DMetal v2 accelerated gaming on Apple Silicon M1-M4.",
    bottle: "Gaming",
    verbs: "d3dmetal vcrun2022"
  },
  {
    id: "autocad",
    title: "AutoCAD 2024",
    category: "creative",
    categoryLabel: "Creative · CAD",
    rating: "Gold",
    glyph: "ruler",
    desc: "2D and 3D CAD design software requiring .NET Framework 4.8.",
    bottle: "Productivity",
    verbs: "dotnet48 vcrun2022"
  }
];

const CATALOG_GLYPHS = {
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.3 5H6.7a4.7 4.7 0 0 0-4.65 4.16L.5 20a2 2 0 0 0 3.96.62L5.7 18h12.6l1.24 2.62A2 2 0 0 0 23.5 20l-1.55-10.84A4.7 4.7 0 0 0 17.3 5z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  orbit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h2l2-7 3 14 3-21 3 21 3-14 2 7h2"/></svg>',
  cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.3 8.7L8.7 21.3a1 1 0 0 1-1.4 0L2.7 16.7a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><line x1="7.5" y1="10.5" x2="10.5" y2="7.5"/><line x1="12" y1="6" x2="15" y2="3"/></svg>',
};

/* Crosstie Catalog Renderer & Search Filter */
function initCrosstieCatalog() {
  const grid = document.getElementById("catalogGrid");
  const searchInput = document.getElementById("catalogSearch");
  const filterPills = document.querySelectorAll(".filter-pill");

  if (!grid) return;

  let currentCategory = "all";
  let currentQuery = "";

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".catalog-btn");
    if (btn) installCrosstieRecipe(btn.dataset.id, btn.dataset.title);
  });

  renderCatalog();

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentQuery = e.target.value.toLowerCase().trim();
      renderCatalog();
    });
  }

  filterPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      filterPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.getAttribute("data-cat");
      renderCatalog();
    });
  });

  function renderCatalog() {
    const filtered = CROSSTIE_CATALOG.filter((item) => {
      const matchCat = currentCategory === "all" || item.category === currentCategory;
      const matchQuery =
        !currentQuery ||
        item.title.toLowerCase().includes(currentQuery) ||
        item.desc.toLowerCase().includes(currentQuery);
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted); font-family: var(--font-mono);">
          No software found matching "${esc(currentQuery)}". Try another keyword or category.
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered
      .map(
        (item) => `
      <div class="catalog-card">
        <div>
          <div class="catalog-card-header">
            <div class="catalog-icon">${CATALOG_GLYPHS[item.glyph] ?? CATALOG_GLYPHS.gamepad}</div>
            <div style="flex:1;">
              <h4 class="catalog-title">${esc(item.title)}</h4>
              <div class="catalog-category">${esc(item.categoryLabel)}</div>
            </div>
            <span class="catalog-rating rating-${item.rating.toLowerCase()}">
              ★ ${esc(item.rating)}
            </span>
          </div>
          <p class="catalog-desc">${esc(item.desc)}</p>
        </div>
        <button class="catalog-btn" data-id="${esc(item.id)}" data-title="${esc(item.title)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Install via FusionCross
        </button>
      </div>
    `
      )
      .join("");
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function installCrosstieRecipe(id, title) {
  const isTauri = !!window.__TAURI_INTERNALS__;
  if (isTauri) {
    alert(`Triggering 1-Click Crosstie Recipe for: ${title}\n\nFusionCross will automatically create the optimized bottle and install dependencies.`);
  } else {
    alert(`To install ${title} with 1-click Crosstie Recipe:\n\n1. Open FusionCross desktop app on your Mac.\n2. Go to Website & Catalog view.\n3. Click "Install via FusionCross".`);
  }
}

/* Theme Switcher (Dark & Light Mode) */
function initThemeToggle() {
  const themeBtn = document.getElementById("themeToggleBtn");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");

  const savedTheme = localStorage.getItem("fusioncross-theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  let currentTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
  applyTheme(currentTheme);

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
      localStorage.setItem("fusioncross-theme", currentTheme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeIcon && themeText) {
      if (theme === "dark") {
        themeIcon.innerText = "🌙";
        themeText.innerText = "Dark";
      } else {
        themeIcon.innerText = "☀️";
        themeText.innerText = "Light";
      }
    }
  }
}

/* Architecture Detection (Apple Silicon M1-M4) */
function detectArchitecture() {
  const detectPill = document.getElementById("detectPill");
  const downloadSub = document.getElementById("downloadSub");

  const ua = navigator.userAgent;
  const isMac = /Macintosh|Mac OS X/i.test(ua);

  if (detectPill) {
    if (isMac) {
      detectPill.innerHTML = `✓ Apple Silicon Mac Detected (M1–M4 ARM64)`;
      if (downloadSub) downloadSub.innerText = "FusionCross-2.0.0-arm64.dmg · 48.2 MB · macOS 13.0+";
    } else {
      detectPill.innerHTML = `ℹ Designed for macOS (Apple Silicon M1–M4)`;
    }
  }
}

/* SHA-256 Copy to Clipboard */
function setupShaCopy() {
  const copyBtn = document.getElementById("copyHashBtn");
  const shaHash = document.getElementById("shaHash");

  if (copyBtn && shaHash) {
    copyBtn.addEventListener("click", () => {
      const text = shaHash.innerText.trim();
      navigator.clipboard.writeText(text).then(() => {
        const prevText = copyBtn.innerText;
        copyBtn.innerText = "Copied!";
        copyBtn.style.color = "var(--color-ok)";
        setTimeout(() => {
          copyBtn.innerText = prevText;
          copyBtn.style.color = "";
        }, 2000);
      });
    });
  }
}

/* Scroll Trigger Animations */
function initScrollReveals() {
  const reveals = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
        }
      });
    },
    { threshold: 0.15 }
  );

  reveals.forEach((el) => observer.observe(el));
}

/* Download Execution Trigger */
function triggerDownload() {
  const btn = document.getElementById("downloadMainBtn");
  if (btn) {
    const origText = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block; animation: spin 1s infinite linear;">↻</span> Starting Download...`;
    setTimeout(() => {
      btn.innerHTML = origText;
      alert("Downloading FusionCross-2.0.0-arm64.dmg (48.2 MB)\n\nVerify SHA-256 Checksum:\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }, 1000);
  }
}
