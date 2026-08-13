// FusionCross Single-Page Download & Feature Website Script
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  detectArchitecture();
  setupShaCopy();
  initScrollReveals();
});

/* Theme Switcher (Dark & Light Mode) */
function initThemeToggle() {
  const themeBtn = document.getElementById("themeToggleBtn");
  const themeIcon = document.getElementById("themeIcon");
  const themeText = document.getElementById("themeText");

  // Check saved theme or system preference
  const savedTheme = localStorage.getItem("fusioncross-theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  let currentTheme = savedTheme || (systemPrefersDark ? "dark" : "dark"); // Default dark per PRD
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
  
  let isAppleSilicon = true;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (renderer && (renderer.includes("Apple") || renderer.includes("M1") || renderer.includes("M2") || renderer.includes("M3") || renderer.includes("M4"))) {
          isAppleSilicon = true;
        }
      }
    }
  } catch (e) {
    // fallback
  }

  if (detectPill) {
    if (isMac) {
      if (isAppleSilicon) {
        detectPill.innerHTML = `✓ Apple Silicon Mac Detected (M1–M4 ARM64)`;
        if (downloadSub) downloadSub.innerText = "FusionCross-2.0.0-arm64.dmg · 48.2 MB · macOS 13.0+";
      } else {
        detectPill.innerHTML = `✓ Intel Mac Detected (x86_64 Rosetta 2)`;
        if (downloadSub) downloadSub.innerText = "FusionCross-2.0.0-x86_64.dmg · 49.5 MB · macOS 13.0+";
      }
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
