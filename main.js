import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// =============================================================
// PATTERNS — each preset defines the tower's motion behavior
// =============================================================
// The slab geometry is fixed (SLAB object below) — all patterns share
// the same 32 thin slabs. Patterns only vary rotation/wave/helix.
// Switch between them with ← → arrow keys.
//
// What each rotation property controls:
//   rotation.baseSpeed     — how fast the whole tower spins (radians per second)
//   rotation.waveAmplitude — how far each slab twists from its neighbors
//   rotation.waveLength    — how many slabs fit in one full wave cycle
//   rotation.waveSpeed     — how fast the wave ripples up/down the tower
//   helixOffset            — adds a fixed angular offset per slab,
//                            creating a spiral staircase shape
//   cameraDistance          — how far the camera sits from the tower center

// All patterns share the original slab geometry — 32 thin slabs in a
// square column. Only the rotation/wave/helix behavior changes between
// patterns, so the tower always looks like your reference video.
const SLAB = {
  count:  32,
  height: 0.11,
  width:  1.2,
  depth:  1.2,
  gap:    0.002,
};

const PATTERNS = {

  // DRIFT — the original. Gentle wave ripples up the stack while the
  // whole tower slowly rotates. Matches the reference video.
  drift: {
    rotation: {
      baseSpeed: 0.08,
      waveAmplitude: 0.48,
      waveLength: 22,
      waveSpeed: 1.0,
    },
    helixOffset: 0,
    cameraDistance: 2.3,
  },

  // SURGE — faster rotation, tighter wave. Feels like the tower is
  // being buffeted by a current. More energetic than drift.
  surge: {
    rotation: {
      baseSpeed: 0.14,
      waveAmplitude: 0.7,
      waveLength: 10,
      waveSpeed: 2.0,
    },
    helixOffset: 0,
    cameraDistance: 2.3,
  },

  // HELIX — each slab is offset ~11° from the one below, creating a
  // spiral staircase shape. No wave so the spiral reads clearly.
  helix: {
    rotation: {
      baseSpeed: 0.04,
      waveAmplitude: 0,
      waveLength: 32,
      waveSpeed: 0,
    },
    helixOffset: Math.PI / 16,
    cameraDistance: 2.3,
  },

  // SHEAR — very long, slow wave with high amplitude. Only a few slabs
  // twist at a time, creating a shearing/folding effect mid-tower.
  shear: {
    rotation: {
      baseSpeed: 0.05,
      waveAmplitude: 1.2,
      waveLength: 40,
      waveSpeed: 0.5,
    },
    helixOffset: 0,
    cameraDistance: 2.3,
  },

  // PULSE — short wavelength, fast speed, low amplitude. Each slab
  // twitches rapidly, creating a vibrating/buzzing texture.
  pulse: {
    rotation: {
      baseSpeed: 0.06,
      waveAmplitude: 0.25,
      waveLength: 4,
      waveSpeed: 3.0,
    },
    helixOffset: 0,
    cameraDistance: 2.3,
  },
};

// Order in which arrow keys cycle through patterns
const PATTERN_ORDER = ['drift', 'surge', 'helix', 'shear', 'pulse'];
let currentPatternIndex = 0;

// =============================================================
// STATIC CONFIG (things that don't change between patterns)
// =============================================================
const CONFIG = {
  camera: {
    fov: 45,
    parallaxX: 0.75,
    parallaxY: 0.95,
    headSmoothing: 8,
    headSensitivity: 1.55,
    zoomTargetSmoothing: 12,
    zoomSmoothing: 8,
    zoomDeadband: 0.015,
    defaultZoom: 1,
    zoomTravel: 0.92,
    zoomInTravel: 1.12,
    desktopZoomOutTravel: 1.22,
    desktopBreakpoint: 641,
    maxPixelRatio: 1.75,
  },
  tracking: {
    cameraWidth: 424,
    cameraHeight: 318,
    cameraFrameRate: 24,
    faceFps: 12,
    handFps: 5,
    statusFps: 8,
    presenceGraceMs: 650,
    handNumHands: 1,
  },
  headRotation: {
    horizontalInfluence: 3.8,
    verticalInfluence: 0.75,
  },
  requireNASA: true,
  video: {
    preferredWidth: 1920,
    minWidth: 720,
  },
  image: {
    preferredWidth: 2400,
    minWidth: 1400,
    maxAnisotropy: 8,
  },
  localMedia: {
    manifestUrl: './local-media/videos/manifest.json',
    numericProbeMax: 80,
  },
  upload: {
    maxVideos: 15,
    processingDelayMs: 1200,
  },
  nasa: {
    // Images sourced exclusively from Hubble Space Telescope and James Webb Space Telescope
    queries: [
      'hubble space telescope nebula',
      'hubble deep field',
      'hubble pillars of creation',
      'hubble carina nebula',
      'hubble eagle nebula',
      'hubble butterfly nebula',
      'hubble galaxy',
      'hubble helix nebula',
      'james webb space telescope galaxy',
      'james webb nebula infrared',
      'webb telescope deep field',
      'webb telescope star forming region',
      'james webb carina nebula',
      'james webb pillars of creation',
    ],
    imageItemsPerQuery: 6,
    // Video searches are kept object/visualization-focused to avoid NASA
    // title cards, broadcasts, interviews, logos, and people.
    videoQueries: [
      'hubble nebula visualization',
      'hubble galaxy flyby',
      'hubble deep field animation',
      'hubble star cluster visualization',
      'webb nebula visualization',
      'webb galaxy visualization',
      'james webb deep field visualization',
      'cosmic nebula animation',
    ],
    videoItemsPerQuery: 1,
  },
  swap: {
    minDelayMs: 900,
    maxDelayMs: 2600,
    videoWeight: 0.96,
    localVideoBias: 0.96,
    uploadedVideoBias: 0.78,
    uploadedInitialRepeats: 8,
    uploadedReuseLimit: 7,
    localInitialRepeats: 4,
    localInitialMaxVideos: 32,
    localActiveVideoLimit: 32,
    localReuseLimit: 3,
    localPanelSpanChance: 0.72,
    localPanelSpanCount: 4,
    uploadedPanelSpanChance: 0.62,
    uploadedPanelSpanCount: 4,
    videoPanelSpanChance: 0.08,
  },
};

let maxTextureAnisotropy = 1;

function matchRuntimeMedia(query) {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches;
}

function getRuntimeDeviceInfo() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = String(nav.userAgent || '');
  const platform = String(nav.platform || '');
  const maxTouchPoints = Number(nav.maxTouchPoints) || 0;
  const isTouchMac = platform === 'MacIntel' && maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || isTouchMac;
  const isSafari = /safari/i.test(ua) &&
    !/(chrome|crios|fxios|edgios|opr|android)/i.test(ua);
  const coarsePointer = matchRuntimeMedia('(pointer: coarse)');
  const smallViewport = matchRuntimeMedia('(max-width: 700px)');

  return {
    isIOS,
    isSafari,
    coarsePointer,
    smallViewport,
    constrained: isIOS || (isSafari && (coarsePointer || smallViewport)) ||
      (coarsePointer && smallViewport),
  };
}

function createRuntimeProfile(device) {
  if (!device.constrained) {
    return {
      constrained: false,
      antialias: true,
      renderFps: 0,
      videoPreload: 'auto',
      imageTextureLimit: Infinity,
      imageConcurrency: 10,
      localVideoLimit: Infinity,
      nasaVideoLimit: Infinity,
      preferSmallerImages: false,
    };
  }

  return {
    constrained: true,
    antialias: false,
    renderFps: 30,
    videoPreload: 'metadata',
    imageTextureLimit: 48,
    imageConcurrency: 4,
    localVideoLimit: 40,
    nasaVideoLimit: 0,
    preferSmallerImages: true,
    slabCount: 24,
    maxPixelRatio: 1.15,
    maxAnisotropy: 2,
    uploadMaxVideos: 8,
    tracking: {
      cameraWidth: 320,
      cameraHeight: 240,
      cameraFrameRate: 15,
      faceFps: 8,
      handFps: 3,
      statusFps: 4,
    },
    swap: {
      minDelayMs: 1300,
      maxDelayMs: 3000,
      videoWeight: 0.94,
      localInitialMaxVideos: 18,
      localActiveVideoLimit: 12,
      localInitialRepeats: 3,
      localReuseLimit: 2,
      localPanelSpanChance: 0.68,
      localPanelSpanCount: 3,
      uploadedVideoBias: 0.9,
      uploadedPanelSpanChance: 0.58,
      uploadedPanelSpanCount: 3,
    },
  };
}

function applyRuntimeProfile(profile) {
  if (!profile.constrained) return;

  SLAB.count = profile.slabCount;
  CONFIG.camera.maxPixelRatio = profile.maxPixelRatio;
  CONFIG.image.maxAnisotropy = profile.maxAnisotropy;
  CONFIG.upload.maxVideos = profile.uploadMaxVideos;
  Object.assign(CONFIG.tracking, profile.tracking);
  Object.assign(CONFIG.swap, profile.swap);
}

const RUNTIME_DEVICE = getRuntimeDeviceInfo();
const RUNTIME_PROFILE = createRuntimeProfile(RUNTIME_DEVICE);
applyRuntimeProfile(RUNTIME_PROFILE);

// =============================================================
// LOADER + FATAL UI
// =============================================================
const loaderEl  = document.getElementById('loader');
const loaderLog = document.getElementById('loader-log');
const fatalEl   = document.getElementById('fatal');

function loaderShow() { loaderEl.classList.add('show'); }
function loaderHide() { loaderEl.classList.remove('show'); }
function formatLoaderMessage(msg) {
  return String(msg)
    .trimStart()
    .replace('fetching NASA images (fast) + videos (background)...', 'fetching NASA images + videos...')
    .replace('STScI APIs unavailable — falling back to NASA Images API...', 'using NASA Images API fallback...')
    .replace(/: no items for ".*"$/, ': no items');
}

function loaderLine(msg) {
  const t = new Date().toISOString().slice(11, 19);
  const row = document.createElement('div');
  row.className = 'loader-log-line';

  const time = document.createElement('span');
  time.className = 'loader-log-time';
  time.textContent = `[${t}]`;

  const message = document.createElement('span');
  message.className = 'loader-log-message';
  message.textContent = formatLoaderMessage(msg);

  row.append(time, message);
  loaderLog.append(row);
  console.log(`[loader] ${msg}`);
}
function fatal(title, details) {
  loaderHide();
  fatalEl.innerHTML = `<h2>${title}</h2><div>${details}</div>`;
  fatalEl.classList.add('show');
}

// =============================================================
// FAVICON
// =============================================================
let faviconFlashTimer = null;
let faviconFlashOn = false;

const FAVICON_VERSION = 'green-20260507';
const FAVICON_ON = `favicon-on.svg?v=${FAVICON_VERSION}`;
const FAVICON_DIM = `favicon-dim.svg?v=${FAVICON_VERSION}`;

function getFaviconLinks() {
  let links = Array.from(document.querySelectorAll('link[rel~="icon"]'))
    .filter((link) => !link.rel.split(/\s+/).includes('mask-icon'));
  if (links.length > 0) return links;

  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.append(link);
  links = [link];
  return links;
}

function ensureMaskIconLink() {
  let link = document.querySelector('link[rel~="mask-icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'mask-icon';
    document.head.append(link);
  }
  link.href = `favicon-mask.svg?v=${FAVICON_VERSION}`;
  link.setAttribute('color', '#39ff14');
}

function setFavicon(href) {
  getFaviconLinks().forEach((link) => {
    link.type = 'image/svg+xml';
    link.href = href;
  });
  ensureMaskIconLink();
}

function clearFaviconFlashTimer() {
  if (!faviconFlashTimer) return;
  window.clearInterval(faviconFlashTimer);
  faviconFlashTimer = null;
}

function updateCameraFavicon() {
  if (document.visibilityState !== 'visible') {
    clearFaviconFlashTimer();
    setFavicon(FAVICON_ON);
    return;
  }

  if (faviconFlashTimer) return;
  faviconFlashOn = true;
  setFavicon(FAVICON_ON);
  faviconFlashTimer = window.setInterval(() => {
    faviconFlashOn = !faviconFlashOn;
    setFavicon(faviconFlashOn ? FAVICON_ON : FAVICON_DIM);
  }, 650);
}

function startCameraFaviconFlash() {
  updateCameraFavicon();
}

function stopCameraFaviconFlash() {
  updateCameraFavicon();
}

function freezeFaviconPulse() {
  clearFaviconFlashTimer();
  setFavicon(FAVICON_ON);
}

startCameraFaviconFlash();
window.addEventListener('visibilitychange', updateCameraFavicon);
window.addEventListener('focus', updateCameraFavicon);
window.addEventListener('pagehide', freezeFaviconPulse);

// =============================================================
// STATUS HUD
// =============================================================
const addAssetsButton = document.getElementById('add-assets-button');
const assetsStatusEl = document.getElementById('assets-status');
const trackingStatusEl = document.getElementById('tracking-status');
const handStatusEl = document.getElementById('hand-status');
const patternLabelEl = document.getElementById('pattern-label');
const assetModalEl = document.getElementById('asset-modal');
const assetDialogEl = document.getElementById('asset-dialog');
const assetModalClose = document.getElementById('asset-modal-close');
const assetFileInput = document.getElementById('asset-file-input');
const assetSelectButton = document.getElementById('asset-select-button');
const assetShowButton = document.getElementById('asset-show-button');
const assetUploadStatusEl = document.getElementById('asset-upload-status');
const assetFileListEl = document.getElementById('asset-file-list');

const status = {
  assets: 0, total: 0,
  localVideos: 0,
  uploads: 0,
  tracking: 'off',
  hand: 'hand: 0/5',
  error: '',
  render() {
    const hasLocalVideos = this.localVideos > 0;
    assetsStatusEl.textContent = hasLocalVideos
      ? this.uploads > 0
        ? `local ${this.localVideos} + ${this.uploads}`
        : `local ${this.localVideos}`
      : `uploads ${this.uploads}/${CONFIG.upload.maxVideos}`;
    document.body.classList.toggle(
      'assets-prompt',
      this.localVideos === 0 && this.uploads === 0
    );
    trackingStatusEl.textContent = `tracking ${this.tracking}`;
    handStatusEl.textContent = this.hand || 'hand: 0/5';
  },
};
status.render();

// =============================================================
// EXPERIENCE MANUAL
// =============================================================
const manualButton = document.getElementById('manual-link');
const manualOverlayEl = document.getElementById('manual-overlay');
const manualHighlightEl = document.getElementById('manual-highlight');
const manualPanelEl = document.getElementById('manual-panel');
const manualKickerEl = document.getElementById('manual-kicker');
const manualTitleEl = document.getElementById('manual-title');
const manualCopyEl = document.getElementById('manual-copy');
const manualStepCountEl = document.getElementById('manual-step-count');
const manualBackButton = document.getElementById('manual-back');
const manualSkipButton = document.getElementById('manual-skip');
const manualNextButton = document.getElementById('manual-next');

const MANUAL_STEPS = [
  {
    target: '#add-assets-button',
    highlightPadding: 0,
    highlightStyle: 'shadow-only',
    targetOutline: true,
    panelPlacement: 'above',
    panelAlign: 'right',
    panelClearance: 24,
    uploadSkippable: true,
    kicker: 'add video',
    title: 'Start with your videos',
    copy: 'Click add assets if you want to upload MP4 files. Next continues the manual. Skip closes it.',
  },
  {
    target: '#asset-select-button',
    highlightPadding: 0,
    uploadSkippable: true,
    kicker: 'choose file',
    title: 'Select an MP4',
    copy: 'Click the highlighted select MP4 button and choose one or more short videos from your computer.',
    keepAssetModalOpen: true,
  },
  {
    target: '#asset-show-button',
    highlightPadding: 0,
    highlightStyle: 'shadow-only',
    targetOutline: true,
    panelPlacement: 'above',
    panelAlign: 'right',
    panelClearance: 108,
    uploadSkippable: true,
    kicker: 'reveal',
    title: 'Show them on the tower',
    copy: 'Click the highlighted show on tower button. The files process for a moment, then enter the moving slabs.',
    keepAssetModalOpen: true,
  },
  {
    targets: ['#hint', '#pattern-label'],
    highlightStyle: 'shadow-only',
    targetOutline: true,
    panelPlacement: 'above',
    panelAlign: 'left',
    panelClearance: 20,
    kicker: 'movement',
    title: 'Move the tower',
    copy: 'Move your head for parallax. Open or pinch your hand to change how close the tower feels.',
  },
  {
    targets: ['#tracking-status', '#hand-status'],
    highlightStyle: 'shadow-only',
    targetOutline: true,
    kicker: 'sensing',
    panelPlacement: 'below',
    panelClearance: 80,
    title: 'Watch the tracking',
    copy: 'These indicators show whether the camera and hand tracking are reading your body.',
  },
  {
    target: '#about-link',
    kicker: 'context',
    highlightStyle: 'shadow-only',
    targetOutline: true,
    panelPlacement: 'below',
    panelAlign: 'right',
    panelClearance: 12,
    title: 'Read the project text',
    copy: 'About opens the concept statement. Coming back returns directly to the live tower.',
  },
];

const FIRST_NON_UPLOAD_MANUAL_STEP = 3;

let manualActive = false;
let manualStepIndex = 0;
let manualAutoShown = false;

function clampManualPosition(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureAssetModalOpenForManual() {
  if (!assetModalEl || assetModalEl.classList.contains('open')) return;
  addAssetsButton?.click();
}

function closeAssetModalForManual() {
  if (!assetModalEl?.classList.contains('open')) return;
  assetModalClose?.click();
}

function getManualFallbackBox() {
  return {
    left: window.innerWidth / 2 - 96,
    top: window.innerHeight / 2 - 36,
    width: 192,
    height: 72,
    right: window.innerWidth / 2 + 96,
    bottom: window.innerHeight / 2 + 36,
  };
}

function getManualTargetRects(step) {
  const selectors = step.targets || (step.target ? [step.target] : []);
  return selectors
    .map((selector) => document.querySelector(selector)?.getBoundingClientRect())
    .filter((rect) => rect && rect.width > 0 && rect.height > 0);
}

function getManualTargetElements(step) {
  const selectors = step.targets || (step.target ? [step.target] : []);
  return selectors
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);
}

function clearManualTargetOutlines() {
  document.querySelectorAll('.manual-target-outline').forEach((element) => {
    element.classList.remove('manual-target-outline');
  });
}

function updateManualTargetOutlines(step) {
  clearManualTargetOutlines();
  if (!step.targetOutline) return;

  getManualTargetElements(step).forEach((element) => {
    element.classList.add('manual-target-outline');
  });
}

function mergeManualRects(rects) {
  if (rects.length === 0) return getManualFallbackBox();

  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
  };
}

function getManualHighlightElements(count) {
  const highlights = [
    manualHighlightEl,
    ...manualOverlayEl.querySelectorAll('.manual-highlight-extra'),
  ].filter(Boolean);

  while (highlights.length < count) {
    const highlight = document.createElement('div');
    highlight.className = 'manual-highlight-box manual-highlight-extra';
    highlight.setAttribute('aria-hidden', 'true');
    manualOverlayEl.insertBefore(highlight, manualPanelEl);
    highlights.push(highlight);
  }

  highlights.forEach((highlight, index) => {
    highlight.classList.toggle('is-hidden', index >= count);
  });

  return highlights.slice(0, count);
}

function resetManualHighlightClasses(highlight) {
  highlight.className = 'manual-highlight-box';
  if (highlight !== manualHighlightEl) highlight.classList.add('manual-highlight-extra');
}

function positionManualHighlight(highlight, box, pad = 0, style = 'default') {
  const left = Math.max(8, box.left - pad);
  const top = Math.max(8, box.top - pad);
  const width = Math.min(window.innerWidth - left - 8, box.width + pad * 2);
  const height = Math.min(window.innerHeight - top - 8, box.height + pad * 2);

  resetManualHighlightClasses(highlight);
  if (style === 'shadow-only') highlight.classList.add('is-shadow-only');
  if (style === 'ring-only') highlight.classList.add('is-ring-only');

  highlight.style.left = `${Math.round(left)}px`;
  highlight.style.top = `${Math.round(top)}px`;
  highlight.style.width = `${Math.round(width)}px`;
  highlight.style.height = `${Math.round(height)}px`;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function getManualAlignedLeft(box, panelRect, align = 'left') {
  if (align === 'right') return box.right - panelRect.width;
  if (align === 'center') return box.left + box.width / 2 - panelRect.width / 2;
  return box.left;
}

function getManualAlignedTop(box, panelRect, align = 'top') {
  if (align === 'bottom') return box.bottom - panelRect.height;
  if (align === 'center') return box.top + box.height / 2 - panelRect.height / 2;
  return box.top;
}

function getForcedManualPanelPosition(step, box, panelRect, clearance, margin, maxLeft, maxTop) {
  if (!step.panelPlacement || step.panelPlacement === 'auto') return null;

  let left = box.left;
  let top = box.top;

  if (step.panelPlacement === 'above' || step.panelPlacement === 'below') {
    left = getManualAlignedLeft(box, panelRect, step.panelAlign);
    top = step.panelPlacement === 'above'
      ? box.top - panelRect.height - clearance
      : box.bottom + clearance;
  }

  if (step.panelPlacement === 'left' || step.panelPlacement === 'right') {
    left = step.panelPlacement === 'left'
      ? box.left - panelRect.width - clearance
      : box.right + clearance;
    top = getManualAlignedTop(box, panelRect, step.panelAlign);
  }

  return {
    left: clampManualPosition(left, margin, maxLeft),
    top: clampManualPosition(top, margin, maxTop),
  };
}

function updateManualLayout() {
  if (!manualActive || !manualPanelEl || !manualHighlightEl) return;

  const step = MANUAL_STEPS[manualStepIndex];
  const pad = step.highlightPadding ?? 8;
  const targetRects = getManualTargetRects(step);
  const box = mergeManualRects(targetRects);
  const shouldOutlineSeparately =
    !step.targetOutline && (step.targets || []).length > 1 && targetRects.length > 1;
  let highlightBox;

  if (shouldOutlineSeparately) {
    const highlights = getManualHighlightElements(targetRects.length + 1);
    highlightBox = positionManualHighlight(highlights[0], box, pad, 'shadow-only');
    targetRects.forEach((rect, index) => {
      positionManualHighlight(highlights[index + 1], rect, pad, 'ring-only');
    });
  } else {
    const [highlight] = getManualHighlightElements(1);
    highlightBox = positionManualHighlight(highlight, box, pad, step.highlightStyle);
  }

  const panelRect = manualPanelEl.getBoundingClientRect();
  const margin = 16;
  const clearance = step.panelClearance ?? (manualStepIndex < 3 ? 72 : margin);
  const maxPanelLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
  const maxPanelTop = Math.max(margin, window.innerHeight - panelRect.height - margin);
  const forcedPosition = getForcedManualPanelPosition(
    step,
    box,
    panelRect,
    clearance,
    margin,
    maxPanelLeft,
    maxPanelTop
  );

  if (forcedPosition) {
    manualPanelEl.style.left = `${Math.round(forcedPosition.left)}px`;
    manualPanelEl.style.top = `${Math.round(forcedPosition.top)}px`;
    return;
  }

  const candidatePositions = [
    { left: box.left, top: box.top - panelRect.height - clearance },
    { left: box.left, top: box.bottom + clearance },
    { left: box.left - panelRect.width - clearance, top: box.top },
    { left: box.right + clearance, top: box.top },
    { left: margin, top: margin },
  ].map((position) => ({
    left: clampManualPosition(position.left, margin, maxPanelLeft),
    top: clampManualPosition(position.top, margin, maxPanelTop),
  }));

  const intersectsHighlight = (position) => {
    const panelBox = {
      left: position.left,
      top: position.top,
      right: position.left + panelRect.width,
      bottom: position.top + panelRect.height,
    };
    return !(
      panelBox.right + clearance <= highlightBox.left ||
      panelBox.left - clearance >= highlightBox.right ||
      panelBox.bottom + clearance <= highlightBox.top ||
      panelBox.top - clearance >= highlightBox.bottom
    );
  };
  const panelPosition =
    candidatePositions.find((position) => !intersectsHighlight(position)) ||
    candidatePositions[0];

  manualPanelEl.style.left = `${Math.round(panelPosition.left)}px`;
  manualPanelEl.style.top = `${Math.round(panelPosition.top)}px`;
}

function scheduleManualLayoutUpdates() {
  window.requestAnimationFrame(() => {
    updateManualLayout();
    window.requestAnimationFrame(updateManualLayout);
  });
  window.setTimeout(updateManualLayout, 240);
}

function renderManualStep() {
  if (!manualActive) return;

  const step = MANUAL_STEPS[manualStepIndex];
  if (step.keepAssetModalOpen) {
    ensureAssetModalOpenForManual();
  } else if (manualStepIndex > 2) {
    closeAssetModalForManual();
  }
  updateManualTargetOutlines(step);

  const isFirstStep = manualStepIndex === 0;
  const isFinalStep = manualStepIndex === MANUAL_STEPS.length - 1;

  manualKickerEl.textContent = step.kicker;
  manualTitleEl.textContent = step.title;
  manualCopyEl.textContent = step.copy;
  manualStepCountEl.textContent = `step ${manualStepIndex + 1} of ${MANUAL_STEPS.length}`;
  manualBackButton.hidden = isFirstStep;
  manualBackButton.disabled = isFirstStep;
  manualSkipButton.hidden = isFinalStep;
  manualSkipButton.textContent = 'skip';
  manualNextButton.hidden = false;
  manualNextButton.textContent = isFinalStep ? 'done' : 'next';

  scheduleManualLayoutUpdates();
}

function setManualStep(index) {
  manualStepIndex = clampManualPosition(index, 0, MANUAL_STEPS.length - 1);
  renderManualStep();
}

function advanceManualStep() {
  if (manualStepIndex === 0) {
    ensureAssetModalOpenForManual();
  }

  if (manualStepIndex >= MANUAL_STEPS.length - 1) {
    hideExperienceManual();
    return;
  }

  setManualStep(manualStepIndex + 1);
}

function backManualStep() {
  if (manualStepIndex <= 0) return;
  setManualStep(manualStepIndex - 1);
}

function skipManualUploads() {
  closeAssetModalForManual();
  setManualStep(FIRST_NON_UPLOAD_MANUAL_STEP);
}

function skipManualStep() {
  if (manualStepIndex === 0) {
    hideExperienceManual();
    return;
  }

  const step = MANUAL_STEPS[manualStepIndex];
  if (manualStepIndex < FIRST_NON_UPLOAD_MANUAL_STEP && step.uploadSkippable) {
    skipManualUploads();
    return;
  }
  hideExperienceManual();
}

function showExperienceManual({ force = false } = {}) {
  if (!manualOverlayEl) return;
  if (!force && manualAutoShown) return;

  manualAutoShown = true;
  manualActive = true;
  manualStepIndex = 0;
  manualOverlayEl.classList.add('open');
  manualOverlayEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('manual-open');
  renderManualStep();
}

function hideExperienceManual() {
  if (!manualOverlayEl) return;
  manualActive = false;
  clearManualTargetOutlines();
  manualOverlayEl.classList.remove('open');
  manualOverlayEl.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('manual-open');
}

function handleManualAssetFilesChanged(acceptedCount) {
  if (!manualActive || acceptedCount <= 0) return;
  if (manualStepIndex <= 1) {
    setManualStep(2);
    return;
  }
  renderManualStep();
}

function handleManualUploadsShown() {
  if (!manualActive) return;
  setManualStep(3);
}

manualButton?.addEventListener('click', () => showExperienceManual({ force: true }));
manualBackButton?.addEventListener('click', backManualStep);
manualSkipButton?.addEventListener('click', skipManualStep);
manualNextButton?.addEventListener('click', advanceManualStep);
window.addEventListener('resize', updateManualLayout);
window.addEventListener('keydown', (e) => {
  if (!manualActive) return;
  if (e.key === 'Escape') hideExperienceManual();
  if (e.key === 'ArrowRight') advanceManualStep();
});

function setupAssetUploads({
  allVideoPool,
  uploadedVideoPool,
  getMaterials,
  getSlabAspect,
}) {
  if (
    !addAssetsButton ||
    !assetModalEl ||
    !assetDialogEl ||
    !assetFileInput ||
    !assetSelectButton ||
    !assetShowButton
  ) {
    return;
  }

  const uploads = [];
  let assetMessage = '';
  let isProcessingUploads = false;

  addAssetsButton.disabled = false;

  function updateUploadUI(message = assetMessage) {
    assetMessage = message;
    status.uploads = uploads.length;
    status.render();

    const remaining = Math.max(0, CONFIG.upload.maxVideos - uploads.length);
    const pendingCount = uploads.filter(({ texture }) => !texture).length;
    if (assetSelectButton) assetSelectButton.disabled = remaining === 0 || isProcessingUploads;
    assetShowButton.disabled = pendingCount === 0 || isProcessingUploads;
    assetShowButton.textContent = isProcessingUploads ? 'processing' : 'show on tower';

    if (assetUploadStatusEl) {
      assetUploadStatusEl.textContent =
        `${uploads.length}/${CONFIG.upload.maxVideos} mp4` +
        (message ? ` / ${message}` : '');
      assetUploadStatusEl.classList.toggle('processed', message === 'processed');
      assetUploadStatusEl.classList.toggle('processing', message === 'processing');
    }

    if (assetFileListEl) {
      assetFileListEl.replaceChildren(
        ...uploads.map(({ name }) => {
          const item = document.createElement('div');
          item.className = 'asset-file-name';
          item.textContent = name;
          return item;
        })
      );
    }
  }

  function openAssetModal() {
    assetModalEl.classList.add('open');
    assetModalEl.setAttribute('aria-hidden', 'false');
    addAssetsButton.setAttribute('aria-expanded', 'true');
    updateUploadUI();
    assetSelectButton.focus({ preventScroll: true });
  }

  function closeAssetModal() {
    assetModalEl.classList.remove('open');
    assetModalEl.setAttribute('aria-hidden', 'true');
    addAssetsButton.setAttribute('aria-expanded', 'false');
  }

  function toggleAssetModal() {
    if (assetModalEl.classList.contains('open')) {
      closeAssetModal();
      return;
    }
    openAssetModal();
  }

  function handleAssetFiles(fileList) {
    if (isProcessingUploads) return 0;

    const files = Array.from(fileList || []);
    const mp4Files = files.filter(isMP4Upload);
    const remaining = CONFIG.upload.maxVideos - uploads.length;

    if (remaining <= 0) {
      updateUploadUI(`limit ${CONFIG.upload.maxVideos}`);
      return 0;
    }

    const accepted = mp4Files.slice(0, remaining);
    if (accepted.length === 0) {
      updateUploadUI(files.length > 0 ? 'mp4 only' : '');
      return 0;
    }

    accepted.forEach((file) => {
      uploads.push({ name: file.name, file, objectUrl: null, texture: null });
    });

    const skipped = files.length - accepted.length;
    updateUploadUI(skipped > 0 ? `${skipped} skipped` : '');
    return accepted.length;
  }

  function showUploadsOnTower() {
    const pendingUploads = uploads.filter(({ texture }) => !texture);
    if (pendingUploads.length === 0 || isProcessingUploads) return false;

    isProcessingUploads = true;
    updateUploadUI('processing');

    window.setTimeout(() => {
      const slabAspect = getSlabAspect();
      const textures = pendingUploads.map((upload) => {
        const objectUrl = URL.createObjectURL(upload.file);
        const texture = createVideoTexture(objectUrl, slabAspect, upload.name, 'upload');
        texture.userData = {
          ...(texture.userData || {}),
          source: 'upload',
          objectUrl,
          label: upload.name,
        };
        uploadedVideoPool.push(texture);
        allVideoPool.push(texture);
        upload.objectUrl = objectUrl;
        upload.texture = texture;
        return texture;
      });

      revealVideoTextures(textures, getMaterials(), slabAspect, CONFIG.swap.uploadedInitialRepeats);
      isProcessingUploads = false;
      updateUploadUI('processed');
    }, CONFIG.upload.processingDelayMs);
    return true;
  }

  addAssetsButton.addEventListener('click', () => {
    const wasOpen = assetModalEl.classList.contains('open');
    toggleAssetModal();
    if (manualActive && manualStepIndex === 0 && !wasOpen) {
      setManualStep(1);
    }
  });
  assetModalClose?.addEventListener('click', closeAssetModal);
  assetSelectButton.addEventListener('click', () => assetFileInput.click());
  assetShowButton.addEventListener('click', () => {
    if (showUploadsOnTower()) handleManualUploadsShown();
  });
  assetFileInput.addEventListener('change', () => {
    const acceptedCount = handleAssetFiles(assetFileInput.files);
    assetFileInput.value = '';
    handleManualAssetFilesChanged(acceptedCount);
  });

  document.addEventListener('pointerdown', (e) => {
    if (!assetModalEl.classList.contains('open')) return;
    if (assetDialogEl.contains(e.target) || addAssetsButton.contains(e.target)) return;
    closeAssetModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && assetModalEl.classList.contains('open')) {
      closeAssetModal();
    }
  });

  updateUploadUI();
}

function isMP4Upload(file) {
  return file?.type === 'video/mp4' || /\.mp4$/i.test(file?.name || '');
}

function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function limitMediaEntries(items, limit) {
  if (!Number.isFinite(limit) || items.length <= limit) return items;
  return shuffleArray(items.slice()).slice(0, limit);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (items.length === 0) return [];

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
}

function getPanelSide(material, fallbackIndex = 0) {
  return material?.userData?.panelSide ?? (fallbackIndex % 4);
}

function revealVideoTextures(textures, materials, slabAspect, repeats) {
  if (!textures.length || !materials?.length) return;

  const sideQueues = [[], [], [], []];
  materials.forEach((material, index) => {
    sideQueues[getPanelSide(material, index)].push(material);
  });
  sideQueues.forEach((queue) => shuffleArray(queue));

  const repeatCount = Math.min(4, Math.max(1, repeats || 1));
  textures.forEach((texture, idx) => {
    cropTextureToAspect(texture, slabAspect);
    const sideOrder = shuffleArray([0, 1, 2, 3]);
    for (let repeat = 0; repeat < repeatCount; repeat++) {
      const side = sideOrder[repeat % sideOrder.length];
      const target = sideQueues[side].pop();
      if (!target) continue;
      setPanelTexture(target, texture);
    }
  });
}

function sampleVideoTextures(textures, maxCount = textures.length) {
  if (!textures.length || textures.length <= maxCount) return textures;

  const sample = shuffleArray(textures.slice());
  return sample.slice(0, maxCount);
}

function showPatternLabel() {
  if (patternLabelEl.textContent !== 'open hand') {
    patternLabelEl.textContent = 'open hand';
  }
}

function updateZoomInstruction(zoomValue) {
  const label = zoomValue > 0.35 ? 'open hand' : 'pinch hand';
  if (patternLabelEl.textContent !== label) {
    patternLabelEl.textContent = label;
  }
}

// =============================================================
// ENTRY
// =============================================================
const overlay  = document.getElementById('overlay');
const startBtn = document.getElementById('start');
const aboutLink = document.getElementById('about-link');
const RETURN_TO_TOWER_KEY = 'videoTower.returnToLive';

function setReturnToTowerFlag() {
  try {
    window.sessionStorage.setItem(RETURN_TO_TOWER_KEY, '1');
  } catch (e) {
    // Storage can be unavailable in some privacy modes; the #tower hash still works.
  }
}

function readReturnToTowerFlag() {
  try {
    return window.sessionStorage.getItem(RETURN_TO_TOWER_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function clearReturnToTowerFlag() {
  try {
    window.sessionStorage.removeItem(RETURN_TO_TOWER_KEY);
  } catch (e) {
    // Ignore storage failures; the flag is only a navigation hint.
  }
}

const isReturningFromAbout = readReturnToTowerFlag();
const shouldAutoStartTower = window.location.hash === '#tower' || isReturningFromAbout;
if (isReturningFromAbout) clearReturnToTowerFlag();
let started = false;

function startExperience() {
  if (started) return;
  started = true;
  overlay.classList.add('hidden');
  run().catch((e) => {
    console.error(e);
    status.error = (e && e.message) || String(e);
    status.tracking = 'off';
    status.render();
  });
}

startBtn.addEventListener('click', startExperience);

aboutLink?.addEventListener('click', () => {
  setReturnToTowerFlag();
  if (!started || window.location.hash === '#tower') return;
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}#tower`
  );
});

if (shouldAutoStartTower) {
  startExperience();
}

// =============================================================
// MAIN
// =============================================================
async function run() {
  const canvas   = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: RUNTIME_PROFILE.antialias,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.camera.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping      = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  maxTextureAnisotropy = Math.min(
    CONFIG.image.maxAnisotropy,
    renderer.capabilities.getMaxAnisotropy?.() || 1
  );

  const scene = new THREE.Scene();
  scene.fog  = new THREE.Fog(0x000000, 6, 14);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 100
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(3, 2, 4);
  scene.add(rim);

  // ---------- load NASA images ----------
  status.render();
  loaderShow();
  loaderLine(
    RUNTIME_PROFILE.constrained
      ? 'fetching NASA images (mobile profile)...'
      : 'fetching NASA images (fast) + videos (background)...'
  );

  let images;
  try {
    images = await loadNASAImages();
    if (images.length === 0) throw new Error('no NASA images resolved');
    loaderLine(`✓ ${images.length} images ready, building tower`);
    loaderHide();
  } catch (e) {
    console.error('NASA load failed:', e);
    if (CONFIG.requireNASA) {
      fatal('NASA load failed',
        `${e.message}\n\nOpen DevTools → Network tab, refresh, and look for ` +
        `requests to images-api.nasa.gov.\nIf blocked, try incognito with extensions disabled.`);
      throw e;
    }
    throw e;
  }

  // Videos load in background
  const videoPool = [];
  const localVideoPool = [];
  const uploadedVideoPool = [];
  loadLocalVideos().then((videos) => {
    videos.forEach((v) => {
      localVideoPool.push(v);
      videoPool.push(v);
    });
    status.localVideos = videos.length;
    status.render();
    console.log(`[local] ${videos.length} local videos now in rotation`);
    revealVideoTextures(
      sampleVideoTextures(videos, CONFIG.swap.localInitialMaxVideos),
      allMaterials,
      SLAB.width / SLAB.height,
      CONFIG.swap.localInitialRepeats
    );
  }).catch((e) => {
    console.warn('Local video pool failed (non-fatal):', e);
  });
  if (RUNTIME_PROFILE.nasaVideoLimit > 0) {
    loadNASAVideos().then((videos) => {
      videos.forEach((v) => videoPool.push(v));
      console.log(`[NASA] ${videos.length} videos now in rotation`);
    }).catch((e) => {
      console.warn('NASA video pool failed (non-fatal):', e);
    });
  } else {
    console.log('[NASA] background video loading skipped for mobile performance');
  }

  // ---------- tower container ----------
  const tower = new THREE.Group();
  scene.add(tower);

  // These are mutable — they get replaced each time the pattern changes.
  let slabs = [];
  let allMaterials = [];
  let activePattern = null;   // reference to the current PATTERNS entry
  let swapGeneration = 0;     // incremented on rebuild to stop old swap timers

  setupAssetUploads({
    allVideoPool: videoPool,
    uploadedVideoPool,
    getMaterials: () => allMaterials,
    getSlabAspect: () => SLAB.width / SLAB.height,
  });

  // ---------- build / rebuild the tower from a pattern ----------
  function buildFromPattern(patternName) {
    const pat = PATTERNS[patternName];
    activePattern = pat;

    swapGeneration++;

    slabs.forEach((slab) => {
      slab.children.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      tower.remove(slab);
    });
    slabs        = [];
    allMaterials = [];

    const slabAspect = SLAB.width / SLAB.height;
    images.forEach((tex) => cropTextureToAspect(tex, slabAspect));

    const halfCount   = SLAB.count / 2;
    const faceGeom    = new THREE.PlaneGeometry(1, 1);
    const totalPanels = SLAB.count * 4;

    for (let i = 0; i < SLAB.count; i++) {
      const slab = new THREE.Group();
      slab.position.y = (i - halfCount + 0.5) * (SLAB.height + SLAB.gap);

      const faceDefs = [
        { rotY: 0,            w: SLAB.width, d: SLAB.depth / 2 },
        { rotY: Math.PI / 2,  w: SLAB.depth, d: SLAB.width / 2 },
        { rotY: Math.PI,      w: SLAB.width, d: SLAB.depth / 2 },
        { rotY: -Math.PI / 2, w: SLAB.depth, d: SLAB.width / 2 },
      ];

      faceDefs.forEach((f, fIdx) => {
        const poolIdx = (i * 3 + fIdx * 5) % images.length;
        const mat = new THREE.MeshBasicMaterial({ map: images[poolIdx], side: THREE.DoubleSide });
        mat.userData.panelSide = fIdx;
        const mesh = new THREE.Mesh(faceGeom, mat);
        mesh.scale.set(f.w, SLAB.height, 1);
        mesh.position.set(Math.sin(f.rotY) * f.d, 0, Math.cos(f.rotY) * f.d);
        mesh.rotation.y = f.rotY;
        slab.add(mesh);
        allMaterials.push(mat);
      });

      tower.add(slab);
      slabs.push(slab);
    }

    status.total  = totalPanels;
    status.assets = totalPanels;
    status.render();

    // Start the swap loop for this generation of materials
    startSwapping(
      allMaterials,
      images,
      { all: videoPool, local: localVideoPool, uploaded: uploadedVideoPool },
      slabAspect
    );
    revealVideoTextures(
      sampleVideoTextures(localVideoPool, CONFIG.swap.localInitialMaxVideos),
      allMaterials,
      slabAspect,
      CONFIG.swap.localInitialRepeats
    );
    revealVideoTextures(
      uploadedVideoPool.slice(0, CONFIG.upload.maxVideos),
      allMaterials,
      slabAspect,
      CONFIG.swap.uploadedInitialRepeats
    );

    // Set camera distance and scale tower to fit viewport
    camera.position.set(0, 0, pat.cameraDistance);
    camera.lookAt(0, 0, 0);
    fitTowerToViewport();

    // Update the HUD label
    showPatternLabel(patternName);

    console.log(`[pattern] switched to "${patternName}"`);
  }

  // ---------- viewport fit (scale tower, not move camera) ----------
  function fitTowerToViewport() {
    if (!activePattern) return;
    const aspect = window.innerWidth / window.innerHeight;
    const maxExtent = Math.sqrt(SLAB.width ** 2 + SLAB.depth ** 2);
    const vFov = CONFIG.camera.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fitDistance = (maxExtent / 2) / Math.tan(hFov / 2) * 1.15;
    const scale = Math.min(1, activePattern.cameraDistance / fitDistance);
    tower.scale.setScalar(scale);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.camera.maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    fitTowerToViewport();
  });

  // ---------- pattern switching (← → arrow keys) ----------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      currentPatternIndex = (currentPatternIndex + 1) % PATTERN_ORDER.length;
      buildFromPattern(PATTERN_ORDER[currentPatternIndex]);
    } else if (e.key === 'ArrowLeft') {
      currentPatternIndex =
        (currentPatternIndex - 1 + PATTERN_ORDER.length) % PATTERN_ORDER.length;
      buildFromPattern(PATTERN_ORDER[currentPatternIndex]);
    }
  });

  // ---------- build initial pattern ----------
  buildFromPattern(PATTERN_ORDER[currentPatternIndex]);
  document.body.classList.add('experience-live');
  if (!isReturningFromAbout && !RUNTIME_PROFILE.constrained) {
    showExperienceManual({ force: true });
  }

  // ---------- input (head tracking + hand zoom) ----------
  function getZoomTravel(zoomValue) {
    if (
      zoomValue > 0 &&
      window.innerWidth >= CONFIG.camera.desktopBreakpoint
    ) {
      return CONFIG.camera.desktopZoomOutTravel;
    }
    if (zoomValue < 0) {
      return CONFIG.camera.zoomInTravel;
    }
    return CONFIG.camera.zoomTravel;
  }

  const input = { x: 0, y: 0, targetX: 0, targetY: 0,
                  zoom: CONFIG.camera.defaultZoom,
                  targetZoom: CONFIG.camera.defaultZoom,
                  rawTargetZoom: CONFIG.camera.defaultZoom };
  // zoom: -1=close, 0=neutral, 1=far
  camera.position.z = activePattern.cameraDistance + getZoomTravel(input.zoom);
  camera.lookAt(0, 0, 0);
  updateZoomInstruction(input.zoom);
  initHeadTracking(input).catch((e) => {
    console.warn('Head tracking failed:', e);
    stopCameraFaviconFlash();
    status.tracking = 'off';
    status.error = e.message || 'camera unavailable';
    status.render();
  });

  // ---------- animation loop ----------
  const clock = new THREE.Clock();
  const renderFrameIntervalMs = RUNTIME_PROFILE.renderFps > 0
    ? 1000 / RUNTIME_PROFILE.renderFps
    : 0;
  let lastRenderFrameMs = -Infinity;

  function animate(now = 0) {
    requestAnimationFrame(animate);
    if (renderFrameIntervalMs && now - lastRenderFrameMs < renderFrameIntervalMs) {
      return;
    }
    lastRenderFrameMs = now;

    const dt  = Math.min(clock.getDelta(), 0.05);
    const t   = clock.elapsedTime;
    const pat = activePattern;
    const rot = pat.rotation;

    // Smooth head and zoom inputs
    input.x = THREE.MathUtils.damp(
      input.x,
      input.targetX,
      CONFIG.camera.headSmoothing,
      dt
    );
    input.y = THREE.MathUtils.damp(
      input.y,
      input.targetY,
      CONFIG.camera.headSmoothing,
      dt
    );
    input.targetZoom = THREE.MathUtils.damp(
      input.targetZoom,
      input.rawTargetZoom,
      CONFIG.camera.zoomTargetSmoothing,
      dt
    );
    input.zoom = THREE.MathUtils.damp(
      input.zoom,
      input.targetZoom,
      CONFIG.camera.zoomSmoothing,
      dt
    );

    // Camera Z: neutral = pattern distance, zoom in/out by zoomTravel.
    const baseZ   = pat.cameraDistance;
    const zoomZ   = baseZ + input.zoom * getZoomTravel(input.zoom);
    updateZoomInstruction(input.zoom);
    camera.position.x = input.x * CONFIG.camera.parallaxX;
    camera.position.y = input.y * CONFIG.camera.parallaxY;
    camera.position.z = zoomZ;
    camera.lookAt(0, 0, 0);

    tower.rotation.x = input.y * CONFIG.headRotation.verticalInfluence;

    const headDriven = input.x * CONFIG.headRotation.horizontalInfluence;
    const baseRot    = rot.baseSpeed * t + headDriven;
    const k = (Math.PI * 2) / rot.waveLength;

    for (let i = 0; i < slabs.length; i++) {
      const wave  = rot.waveAmplitude * Math.sin(k * i - rot.waveSpeed * t);
      const helix = pat.helixOffset * i;
      slabs[i].rotation.y = baseRot + wave + helix;
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

// =============================================================
// TEXTURE CROPPING
// =============================================================
// Instead of stretching an image to fill a slab (which would distort
// it), this function figures out the right crop so the image fills the
// slab's aspect ratio by cutting off the top/bottom or left/right.
//
// How it works:
// - The slab might be 4:1 (wide and short) while the image is 4:3.
// - We calculate how much of the image height to show so the visible
//   portion matches the slab's proportions.
// - `tex.repeat` controls how much of the image is used (1 = all, 0.5 = half)
// - `tex.offset` shifts which portion is shown (centered)

function cropTextureToAspect(tex, slabAspect) {
  const img = tex.image;
  if (!img) return;

  // HTMLVideoElement stores decoded dimensions in videoWidth/videoHeight.
  // HTMLImageElement uses naturalWidth/naturalHeight (or width/height).
  const w = img.videoWidth  || img.naturalWidth  || img.width  || 0;
  const h = img.videoHeight || img.naturalHeight || img.height || 0;
  if (!w || !h) return;

  const imageAspect = w / h;

  // Object-fit: cover — crop whichever axis overflows so the content
  // fills the slab panel with no stretching and no black bars.
  const cropY = Math.min(1, imageAspect / slabAspect);
  const cropX = Math.min(1, slabAspect / imageAspect);

  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(cropX, cropY);
  tex.offset.set((1 - cropX) / 2, (1 - cropY) / 2);
  tex.needsUpdate = true;
}

// =============================================================
// HUBBLE + WEBB IMAGE & VIDEO LOADING
// =============================================================
// Primary sources: HubbleSite API (hubblesite.org/api/v3) and
// WebbTelescope API (webbtelescope.org/api/v3) — both managed
// by the Space Telescope Science Institute (STScI).
//
// The STScI listing endpoints return {id, name, thumbnail_url, ...}
// for every published image/video. Thumbnail URLs are usable directly.
// Video detail calls (per-item) return {video_files[]} with MP4 URLs.
//
// Falls back to the NASA Images API if the STScI APIs are unreachable.
// =============================================================

// ---------- helper: load one image URL → Three.js Texture ----------
function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload  = () => {
      const t = new THREE.Texture(img);
      applyTextureQuality(t, { isVideo: false });
      t.needsUpdate = true;
      resolve(t);
    };
    img.onerror = () => reject(new Error(`img failed: ${url}`));
    img.src = url;
  });
}

// ---------- helper: normalise protocol-relative URLs ----------
function fixUrl(raw) {
  if (!raw) return null;
  return raw.startsWith('//') ? 'https:' + raw : raw;
}

function promoteScienceImageUrl(raw) {
  const url = fixUrl(raw);
  if (!url) return null;
  if (RUNTIME_PROFILE.preferSmallerImages) return url;
  return url.replace(/\?t=tn\d+/i, '');
}

function applyTextureQuality(texture, { isVideo = false } = {}) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxTextureAnisotropy;

  if (isVideo) {
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  texture.generateMipmaps = !RUNTIME_PROFILE.constrained;
  texture.minFilter = RUNTIME_PROFILE.constrained
    ? THREE.LinearFilter
    : THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function scoreImageUrlQuality(url = '') {
  const normalized = url.toLowerCase();
  let score = 0;
  if (/4096|3840|3200|3000|2880|2560|2400|2048/.test(normalized)) score += 80;
  if (/1600|1536|1440|1400|1280/.test(normalized)) score += 40;
  if (/orig|original|full|fullres|max|large/.test(normalized)) score += 35;
  if (/thumb|thumbnail|preview|small|medium|tile/.test(normalized)) score -= 120;
  return score;
}

function pickPreferredImageAsset(files, fallbackUrl = null) {
  if (RUNTIME_PROFILE.preferSmallerImages && fallbackUrl) {
    return fallbackUrl.replace(/^http:\/\//, 'https://');
  }

  const candidates = (files || [])
    .filter((file) => /\.(?:jpg|jpeg|png|webp)(?:$|\?)/i.test(file))
    .map((file) => ({
      url: file.replace(/^http:\/\//, 'https://'),
      score: scoreImageUrlQuality(file),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.url || fallbackUrl;
}

function scoreVideoUrlQuality(url = '') {
  const normalized = url.toLowerCase();
  let score = 0;
  if (/2160|1440|1080|4k|uhd|fhd|fullhd/.test(normalized)) score += 50;
  if (/720|hd/.test(normalized)) score += 25;
  if (/orig|original|master|large|source/.test(normalized)) score += 20;
  if (/preview|small|mobile|thumb|poster|caption|subtit|transcript/.test(normalized)) score -= 100;
  return score;
}

function pickPreferredVideoFile(files) {
  const candidates = (files || [])
    .filter((file) => {
      const url = fixUrl(file.file_url || file.url || file.href || file);
      const format = String(file.format || '');
      return url && (/mp4/i.test(format) || /\.mp4(?:$|\?)/i.test(url));
    })
    .map((file) => {
      const url = fixUrl(file.file_url || file.url || file.href || file);
      const width = Number(file.width) || 0;
      const widthScore = width
        ? (width >= CONFIG.video.minWidth ? Math.min(width, CONFIG.video.preferredWidth) : -200)
        : 0;
      const codecScore = /h\.?264/i.test(String(file.format || '')) ? 25 : 0;
      return {
        url,
        width,
        score: widthScore + codecScore + scoreVideoUrlQuality(url),
      };
    })
    .sort((a, b) => b.score - a.score || b.width - a.width);

  return candidates[0] || null;
}

function pickPreferredManifestVideo(files) {
  const candidates = (files || [])
    .filter((file) => /\.mp4(?:$|\?)/i.test(file))
    .map((file) => ({
      url: file.replace(/^http:\/\//, 'https://'),
      score: scoreVideoUrlQuality(file),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0] || null;
}

function normalizeVideoKey(url = '', title = '') {
  const titleKey = title
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (titleKey) return titleKey;

  return String(url)
    .toLowerCase()
    .replace(/[?#].*$/, '')
    .replace(/\/(?:orig|original|large|medium|small|preview|mobile|720p|1080p|2160p)[^/]*$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isCleanNASAVideoCandidate({ title = '', url = '' } = {}) {
  const text = `${title} ${url}`.toLowerCase();
  const visualTerms =
    /\b(nebula|galaxy|galaxies|deep field|star|stellar|cluster|supernova|cosmic|universe|infrared|ultraviolet|visualization|visualisation|flyby|fly-by|flythrough|fly-through|animation|simulation|webb|jwst|hubble)\b/;
  const blockedTerms =
    /\b(people|person|human|face|portrait|headshot|astronaut|crew|team|host|presenter|interview|talk|lecture|briefing|conference|webcast|broadcast|livestream|live stream|episode|hubblecast|podcast|news|media|promo|trailer|intro|outro|credits|slate|logo|caption|subtitle|transcript|administrator|scientist|engineer|ceremony|anniversary|rollout|launch|rocket|mission control|bars)\b|title[\s_-]*card|nasa[\s_-]*logo|lower[\s_-]*third|text[\s_-]*overlay|behind[\s_-]*the[\s_-]*scenes|b[\s_-]*roll|test[\s_-]*pattern|color[\s_-]*bars/;

  return visualTerms.test(text) && !blockedTerms.test(text);
}

function normalizeLocalVideoEntries(manifest) {
  const items = Array.isArray(manifest) ? manifest : manifest?.videos || [];
  return items.map((item) => {
    if (typeof item === 'string') {
      return { file: item, label: item };
    }

    if (item && typeof item === 'object') {
      const file = item.file || item.src || item.path || '';
      if (!file) return null;
      return {
        file,
        label: item.label || item.title || file,
      };
    }

    return null;
  }).filter(Boolean);
}

function isSupportedLocalVideoFile(file) {
  return /\.(mp4|webm|mov|m4v|ogv)$/i.test(file || '');
}

async function discoverLocalVideoEntries(manifestUrl) {
  const directoryUrl = new URL('./', new URL(manifestUrl, window.location.href));

  try {
    const directoryRes = await fetch(`${directoryUrl}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!directoryRes.ok) return [];

    const listing = await directoryRes.text();
    const doc = new DOMParser().parseFromString(listing, 'text/html');
    const seen = new Set();

    return Array.from(doc.querySelectorAll('a[href]'))
      .map((link) => link.getAttribute('href') || '')
      .map((href) => {
        try {
          return new URL(href, directoryUrl);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((url) =>
        url.origin === directoryUrl.origin &&
        url.pathname.startsWith(directoryUrl.pathname)
      )
      .map((url) => decodeURIComponent(url.pathname.split('/').pop() || ''))
      .filter((file) => isSupportedLocalVideoFile(file))
      .filter((file) => {
        const key = file.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((file) => ({ file, label: file }));
  } catch (e) {
    console.warn('[local] auto-discovery failed:', e.message);
    return [];
  }
}

async function localVideoExists(url) {
  const cacheBustedUrl = `${url}?t=${Date.now()}`;

  try {
    const headRes = await fetch(cacheBustedUrl, {
      method: 'HEAD',
      cache: 'no-store',
    });
    if (headRes.ok) return true;
    if (headRes.status !== 405) return false;
  } catch {
    // Some local servers do not support HEAD. Fall through to a tiny GET.
  }

  try {
    const getRes = await fetch(cacheBustedUrl, {
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' },
    });
    return getRes.ok;
  } catch {
    return false;
  }
}

async function selectLocalVideoEntries(entries) {
  const limit = RUNTIME_PROFILE.localVideoLimit;
  if (!Number.isFinite(limit) || entries.length <= limit) return entries;

  const stride = entries.length / limit;
  const selected = Array.from({ length: limit }, (_, idx) => {
    const entryIndex = Math.min(entries.length - 1, Math.floor(idx * stride));
    return entries[entryIndex];
  });

  console.log(`[local] using ${selected.length}/${entries.length} manifest videos for mobile Safari`);
  return selected;
}

async function probeNumberedLocalVideoEntries(manifestUrl) {
  const directoryUrl = new URL('./', new URL(manifestUrl, window.location.href));
  const candidates = Array.from(
    { length: CONFIG.localMedia.numericProbeMax },
    (_, idx) => [`${idx + 1}.mp4`, `${idx + 1}.MP4`]
  ).flat();

  const results = await Promise.all(candidates.map(async (file) => {
    const url = new URL(file, directoryUrl).toString();
    return await localVideoExists(url) ? { file, label: file } : null;
  }));

  return results.filter(Boolean);
}

function createVideoTexture(url, slabAspect, label = 'video', source = 'video') {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.preload = RUNTIME_PROFILE.videoPreload;
  video.src = url;

  const texture = new THREE.VideoTexture(video);
  texture.userData = {
    ...(texture.userData || {}),
    isVideo: true,
    source,
    label,
    contentKey: normalizeVideoKey(url, label),
  };
  applyTextureQuality(texture, { isVideo: true });

  video.addEventListener('loadedmetadata', () => {
    cropTextureToAspect(texture, slabAspect);
    if (Number.isFinite(video.duration) && video.duration > 1) {
      texture.userData.initialSeekTime = Math.random() * Math.max(0, video.duration - 1);
      if (
        !RUNTIME_PROFILE.constrained ||
        (activeVideoTextureCounts.get(getVideoTextureKey(texture)) || 0) > 0
      ) {
        seekVideoTextureOnFirstPlay(texture);
      }
    }
  }, { once: true });

  video.addEventListener('canplay', () => {
    if (
      (activeVideoTextureCounts.get(getVideoTextureKey(texture)) || 0) > 0 &&
      shouldPlayRuntimeVideos()
    ) {
      playVideoElement(video);
    }
  }, { once: true });

  video.addEventListener('loadeddata', () => {
    console.log(`[video] ready: ${label}`);
  }, { once: true });

  video.addEventListener('error', () => {
    console.warn(`[video] failed: ${label}`);
  }, { once: true });

  return texture;
}

// ---------- images ----------

async function loadNASAImages() {
  const allUrls = [];   // { url, title }

  // --- HubbleSite: Hubble images ---
  try {
    loaderLine('fetching Hubble image list...');
    const res  = await fetch('https://hubblesite.org/api/v3/images/all?page=1&per_page=100');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const list = await res.json();
    for (const item of list) {
      const url = promoteScienceImageUrl(item.thumbnail_url);
      if (url) allUrls.push({ url, title: item.name || 'hubble' });
    }
    loaderLine(`  ✓ Hubble: ${list.length} images`);
  } catch (e) {
    loaderLine(`  ✗ Hubble API: ${e.message}`);
  }

  // --- WebbTelescope: JWST images ---
  try {
    loaderLine('fetching Webb image list...');
    const res  = await fetch('https://webbtelescope.org/api/v3/images/all?page=1&per_page=60');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const list = await res.json();
    for (const item of list) {
      const url = promoteScienceImageUrl(item.thumbnail_url);
      if (url) allUrls.push({ url, title: item.name || 'webb' });
    }
    loaderLine(`  ✓ Webb: ${list.length} images`);
  } catch (e) {
    loaderLine(`  ✗ Webb API: ${e.message}`);
  }

  // Fallback: NASA Images API with object-specific queries that only
  // return astronomical imagery (named objects, not events or facilities)
  if (allUrls.length < 10) {
    loaderLine('STScI APIs unavailable — falling back to NASA Images API...');
    const fallbackQ = [
      'orion nebula hubble', 'carina nebula hubble', 'pillars of creation hubble',
      'helix nebula hubble', 'butterfly nebula hubble', 'eagle nebula hubble',
      'andromeda galaxy hubble', 'hubble ultra deep field',
      'james webb deep field galaxy', 'james webb carina nebula',
      'james webb pillars of creation', 'james webb cartwheel galaxy',
    ];
    const parts = await Promise.all(fallbackQ.map((q) => searchImages(q, 6)));
    parts.flat().forEach((item) => allUrls.push(item));
  }

  if (allUrls.length === 0) throw new Error('no images resolved from any source');

  // Deduplicate
  const seen   = new Set();
  const unique = allUrls.filter(({ url }) => { if (seen.has(url)) return false; seen.add(url); return true; });
  const selected = limitMediaEntries(unique, RUNTIME_PROFILE.imageTextureLimit);
  if (selected.length < unique.length) {
    loaderLine(`using ${selected.length}/${unique.length} image textures for mobile Safari`);
  }
  loaderLine(`loading ${selected.length} image textures...`);

  let loadedCount = 0;
  const textures = await mapWithConcurrency(selected, RUNTIME_PROFILE.imageConcurrency, ({ url, title }, idx) =>
    loadImageTexture(url)
      .then((tex) => {
        loadedCount++;
        if (loadedCount % 10 === 0) loaderLine(`  loaded ${loadedCount}/${selected.length}`);
        return tex;
      })
      .catch(() => { console.warn(`[HST] img ${idx} failed: ${title}`); return null; })
  );

  return textures.filter(Boolean);
}

// ---------- videos ----------

async function loadLocalVideos() {
  const slabAspect = SLAB.width / SLAB.height;
  const manifestUrl = CONFIG.localMedia.manifestUrl;
  let manifestEntries = [];
  const manifestBase = new URL(manifestUrl, window.location.href);

  try {
    const manifestRes = await fetch(`${manifestUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      manifestEntries = normalizeLocalVideoEntries(manifest);
    } else if (manifestRes.status !== 404) {
      throw new Error(`manifest ${manifestRes.status}`);
    }
  } catch (e) {
    console.warn('[local] manifest load failed:', e.message);
  }

  let entries = manifestEntries;
  if (entries.length === 0) {
    const [discoveredEntries, probedEntries] = await Promise.all([
      discoverLocalVideoEntries(manifestUrl),
      probeNumberedLocalVideoEntries(manifestUrl),
    ]);
    const entryMap = new Map();
    probedEntries.forEach((entry) => entryMap.set(entry.file.toLowerCase(), entry));
    discoveredEntries.forEach((entry) => entryMap.set(entry.file.toLowerCase(), entry));
    entries = Array.from(entryMap.values());
  }
  if (entries.length === 0) return [];

  const selectedEntries = await selectLocalVideoEntries(entries);

  return selectedEntries.map(({ file, label }) => {
    const url = new URL(file, manifestBase).toString();
    return createVideoTexture(url, slabAspect, label, 'local');
  });
}

async function loadNASAVideos() {
  return loadNASAVideosFallback();
}

// NASA Images API videos, filtered to astronomy visuals rather than people/text.
async function loadNASAVideosFallback() {
  const queries = CONFIG.nasa.videoQueries;
  const parts = await Promise.all(
    queries.map((q) => resolveVideoUrls(q, CONFIG.nasa.videoItemsPerQuery))
  );
  const seen    = new Set();
  const unique  = parts.flat().filter(({ url, title }) => {
    const key = normalizeVideoKey(url, title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const slabAspect = SLAB.width / SLAB.height;
  const selected = limitMediaEntries(unique, RUNTIME_PROFILE.nasaVideoLimit);

  return selected.map(({ url, title }) => createVideoTexture(url, slabAspect, title || url, 'nasa'));
}

async function resolveVideoUrls(query, count) {
  try {
    const searchUrl =
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=video`;
    const searchRes  = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
    const searchData = await searchRes.json();

    const items = searchData?.collection?.items || [];
    if (items.length === 0) return [];

    const results = [];
    for (let i = 0; i < Math.min(items.length, count * 8); i++) {
      if (results.length >= count) break;
      const item  = items[i];
      const title = item?.data?.[0]?.title || query;
      const manifestUrl = (item.href || '').replace(/^http:\/\//, 'https://');
      if (!isCleanNASAVideoCandidate({ title, url: manifestUrl })) continue;
      if (!manifestUrl) continue;
      try {
        const manifestRes = await fetch(manifestUrl);
        if (!manifestRes.ok) continue;
        const files = await manifestRes.json();
        const mp4 = pickPreferredManifestVideo(files);
        if (mp4?.url && isCleanNASAVideoCandidate({ title, url: mp4.url })) {
          results.push({ url: mp4.url, title });
        }
      } catch { continue; }
    }
    return results;
  } catch (e) {
    console.warn(`[NASA] video query "${query}" failed:`, e.message);
    return [];
  }
}

async function searchImages(query, count) {
  try {
    const searchUrl =
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`;
    loaderLine(`  "${query}" searching...`);
    const searchRes  = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
    const searchData = await searchRes.json();

    const items = (searchData?.collection?.items || []).slice(0, count * 2);
    if (items.length === 0) throw new Error(`no items for "${query}"`);

    const results = [];
    for (const item of items) {
      if (results.length >= count) break;
      const title = item?.data?.[0]?.title || query;
      const previewLink = item?.links?.[0]?.href;
      const manifestUrl = (item?.href || '').replace(/^http:\/\//, 'https://');
      let url = promoteScienceImageUrl(previewLink);

      if (manifestUrl) {
        try {
          const manifestRes = await fetch(manifestUrl);
          if (manifestRes.ok) {
            const files = await manifestRes.json();
            url = pickPreferredImageAsset(files, url);
          }
        } catch {
          // Fall back to the preview URL when the manifest request fails.
        }
      }

      if (url) results.push({ url, title });
    }

    loaderLine(`  ✓ "${query}" → ${results.length} images`);
    return results;
  } catch (e) {
    loaderLine(`  ✗ "${query}": ${e.message}`);
    console.error(`[NASA] query "${query}" failed:`, e.message);
    return [];
  }
}

// =============================================================
// PANEL SWAP LOOP
// =============================================================
// Each panel picks a new random image or video on a timer.
// `swapGeneration` is a counter that increments every time the tower
// is rebuilt. Each swap callback checks if its generation is still
// current — if not, it stops rescheduling. This prevents old timers
// from writing to materials that no longer exist.

let swapGeneration = 0;
let activeVideoTextureCounts = new Map();
let activeVideoTextureSideCounts = new Map();
let activeVideoTextures = new Map();

function shouldPlayRuntimeVideos() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function playVideoElement(video) {
  const playPromise = video?.play?.();
  if (playPromise?.catch) playPromise.catch(() => {});
}

function pauseVideoElement(video) {
  video?.pause?.();
}

function seekVideoTextureOnFirstPlay(texture) {
  const seekTime = texture?.userData?.initialSeekTime;
  if (!Number.isFinite(seekTime)) return;

  try {
    texture.image.currentTime = seekTime;
    delete texture.userData.initialSeekTime;
  } catch {
    // Some Safari builds reject seeks until the element has buffered a frame.
  }
}

function syncActiveVideoPlayback() {
  activeVideoTextures.forEach((texture) => {
    if (shouldPlayRuntimeVideos()) {
      seekVideoTextureOnFirstPlay(texture);
      playVideoElement(texture.image);
    } else {
      pauseVideoElement(texture.image);
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', syncActiveVideoPlayback);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    activeVideoTextures.forEach((texture) => pauseVideoElement(texture.image));
  });
}

function getVideoTextureKey(texture) {
  return texture?.userData?.contentKey || texture?.uuid || '';
}

function isVideoTexture(texture) {
  return Boolean(texture?.userData?.isVideo);
}

function isUploadedVideoTexture(texture) {
  return texture?.userData?.source === 'upload';
}

function isLocalVideoTexture(texture) {
  return texture?.userData?.source === 'local';
}

function resetActiveVideoTextureCounts() {
  activeVideoTextures.forEach((texture) => pauseVideoElement(texture.image));
  activeVideoTextureCounts = new Map();
  activeVideoTextureSideCounts = new Map();
  activeVideoTextures = new Map();
}

function getVideoTextureSideCount(texture, side) {
  const key = getVideoTextureKey(texture);
  if (!key) return 0;
  return activeVideoTextureSideCounts.get(key)?.get(side) || 0;
}

function countVideoTexture(texture, delta, side = null) {
  if (!isVideoTexture(texture)) return;
  const key = getVideoTextureKey(texture);
  if (!key) return;

  const previousCount = activeVideoTextureCounts.get(key) || 0;
  const nextCount = previousCount + delta;
  if (side !== null) {
    const sideCounts = activeVideoTextureSideCounts.get(key) || new Map();
    const nextSideCount = (sideCounts.get(side) || 0) + delta;
    if (nextSideCount <= 0) {
      sideCounts.delete(side);
    } else {
      sideCounts.set(side, nextSideCount);
    }
    if (sideCounts.size === 0 || nextCount <= 0) {
      activeVideoTextureSideCounts.delete(key);
    } else {
      activeVideoTextureSideCounts.set(key, sideCounts);
    }
  }

  if (nextCount <= 0) {
    activeVideoTextureCounts.delete(key);
    activeVideoTextures.delete(key);
    texture.image?.pause?.();
    return;
  }
  activeVideoTextureCounts.set(key, nextCount);
  activeVideoTextures.set(key, texture);
  if (previousCount <= 0 && shouldPlayRuntimeVideos()) {
    seekVideoTextureOnFirstPlay(texture);
    playVideoElement(texture.image);
  }
}

function setPanelTexture(material, texture) {
  const side = getPanelSide(material);
  countVideoTexture(material.map, -1, side);
  material.map = texture;
  material.needsUpdate = true;
  countVideoTexture(texture, 1, side);
}

function startSwapping(materials, images, videoPools, slabAspect) {
  const gen = ++swapGeneration;
  const { minDelayMs, maxDelayMs, videoWeight, localVideoBias, uploadedVideoBias } = CONFIG.swap;
  const allVideoPool = Array.isArray(videoPools) ? videoPools : videoPools?.all || [];
  const localVideoPool = Array.isArray(videoPools) ? [] : videoPools?.local || [];
  const uploadedVideoPool = Array.isArray(videoPools) ? [] : videoPools?.uploaded || [];
  resetActiveVideoTextureCounts();

  function availableVideos(pool, reuseLimit = 0, side = null) {
    return pool.filter((tex) => {
      const key = getVideoTextureKey(tex);
      if (!key) return false;
      if ((activeVideoTextureCounts.get(key) || 0) > reuseLimit) return false;
      return side === null || getVideoTextureSideCount(tex, side) === 0;
    });
  }

  function pickAvailableVideo(pool, reuseLimit = 0, side = null) {
    const available = availableVideos(pool, reuseLimit, side);
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  function pickLocalVideo(side) {
    const activeLocal = localVideoPool.filter((tex) => {
      const count = activeVideoTextureCounts.get(getVideoTextureKey(tex)) || 0;
      return count > 0;
    });
    const activeLocalForSide = activeLocal.filter((tex) => getVideoTextureSideCount(tex, side) === 0);
    if (
      activeLocal.length >= CONFIG.swap.localActiveVideoLimit &&
      activeLocalForSide.length > 0
    ) {
      return activeLocalForSide[Math.floor(Math.random() * activeLocalForSide.length)];
    }
    return (
      pickAvailableVideo(localVideoPool, CONFIG.swap.localReuseLimit, side) ||
      pickAvailableVideo(localVideoPool, CONFIG.swap.localReuseLimit)
    );
  }

  function pickTexture(idx) {
    const side = idx % 4;
    if (uploadedVideoPool.length > 0 && Math.random() < uploadedVideoBias) {
      const tex =
        pickAvailableVideo(uploadedVideoPool, CONFIG.swap.uploadedReuseLimit, side) ||
        pickAvailableVideo(uploadedVideoPool, CONFIG.swap.uploadedReuseLimit);
      if (tex) {
        cropTextureToAspect(tex, slabAspect);
        return tex;
      }
    }

    if (allVideoPool.length > 0 && Math.random() < videoWeight) {
      const tex =
        localVideoPool.length > 0 && Math.random() < localVideoBias
          ? (
              pickLocalVideo(side) ||
              pickAvailableVideo(allVideoPool, 0, side)
            )
          : (
              pickAvailableVideo(allVideoPool, 0, side) ||
              pickAvailableVideo(allVideoPool)
            );
      if (!tex) return images[Math.floor(Math.random() * images.length)];
      cropTextureToAspect(tex, slabAspect);
      return tex;
    }
    return images[Math.floor(Math.random() * images.length)];
  }

  function showVideoAcrossPanelRun(startIdx, texture, count = 3) {
    for (let offset = 0; offset < count; offset++) {
      const mat = materials[(startIdx + offset) % materials.length];
      setPanelTexture(mat, texture);
    }
  }

  function scheduleSwap(mat, idx) {
    const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    setTimeout(() => {
      // If the pattern changed since this timer was set, stop
      if (gen !== swapGeneration) return;
      const texture = pickTexture(idx);
      if (
        isVideoTexture(texture) &&
        (
          isUploadedVideoTexture(texture)
            ? Math.random() < CONFIG.swap.uploadedPanelSpanChance
            : isLocalVideoTexture(texture)
              ? Math.random() < CONFIG.swap.localPanelSpanChance
            : Math.random() < CONFIG.swap.videoPanelSpanChance &&
              (activeVideoTextureCounts.get(getVideoTextureKey(texture)) || 0) === 0
        )
      ) {
        showVideoAcrossPanelRun(
          idx,
          texture,
          isUploadedVideoTexture(texture)
            ? CONFIG.swap.uploadedPanelSpanCount
            : isLocalVideoTexture(texture)
              ? CONFIG.swap.localPanelSpanCount
              : 3
        );
      } else {
        setPanelTexture(mat, texture);
      }
      scheduleSwap(mat, idx);
    }, delay);
  }

  materials.forEach((mat, idx) => {
    setTimeout(() => {
      if (gen !== swapGeneration) return;
      scheduleSwap(mat, idx);
    }, Math.random() * maxDelayMs);
  });
}

// =============================================================
// HEAD TRACKING — head position drives camera parallax + tower spin
// =============================================================

async function initHeadTracking(input) {
  const webcamEl = document.getElementById('webcam');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: CONFIG.tracking.cameraWidth },
        height: { ideal: CONFIG.tracking.cameraHeight },
        frameRate: {
          ideal: CONFIG.tracking.cameraFrameRate,
          max: CONFIG.tracking.cameraFrameRate,
        },
      },
      audio: false,
    });
  } catch (e) {
    throw new Error(`camera denied: ${e.name}`);
  }
  webcamEl.srcObject = stream;
  await new Promise((r) =>
    webcamEl.addEventListener('loadeddata', r, { once: true })
  );
  startCameraFaviconFlash();
  stream.getVideoTracks().forEach((track) => {
    track.addEventListener('ended', stopCameraFaviconFlash);
  });

  const MP = '0.10.32';
  const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/vision_bundle.mjs`
  );
  const resolver = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/wasm`
  );

  // --- Face landmarker (head parallax) ---
  let faceLandmarker;
  const baseOpts = {
    modelAssetPath:
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  };
  try {
    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { ...baseOpts, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  } catch {
    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { ...baseOpts, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  }

  // --- Hand landmarker (pinch = zoom out, open = zoom in) ---
  // Openness = average fingertip distance from wrist, normalised by
  // the wrist→middle-MCP span so it's scale-independent.
  // Landmarks used:
  //   0  = wrist
  //   9  = middle finger MCP (reference length)
  //   4, 8, 12, 16, 20 = fingertips
  let handLandmarker = null;
  try {
    handLandmarker = await HandLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: CONFIG.tracking.handNumHands,
    });
  } catch {
    try {
      handLandmarker = await HandLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: CONFIG.tracking.handNumHands,
      });
    } catch (e) {
      console.warn('Hand landmarker unavailable:', e.message);
    }
  }
  if (!handLandmarker) status.hand = 'hand: 0/5';

  status.tracking = 'off';
  status.render();

  // Tip landmark indices
  const TIPS = [4, 8, 12, 16, 20];

  function handOpenness(landmarks) {
    // Returns 0 (fully closed / all fingers curled) to 1 (wide open)
    const wrist = landmarks[0];
    const mcp   = landmarks[9];
    // Reference span: wrist to middle-MCP
    const refLen = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y, mcp.z - wrist.z);
    if (refLen < 0.001) return 0.5;
    let sum = 0;
    for (const idx of TIPS) {
      const t = landmarks[idx];
      sum += Math.hypot(t.x - wrist.x, t.y - wrist.y, t.z - wrist.z);
    }
    const avg = sum / TIPS.length;
    // avg/refLen ≈ 1.0 when closed, ≈ 2.2+ when fully open
    return Math.min(1, Math.max(0, (avg / refLen - 1.0) / 1.4));
  }

  const faceIntervalMs = 1000 / CONFIG.tracking.faceFps;
  const handIntervalMs = 1000 / CONFIG.tracking.handFps;
  const statusIntervalMs = 1000 / CONFIG.tracking.statusFps;
  let lastFaceDetectMs = -Infinity;
  let lastHandDetectMs = -Infinity;
  let lastStatusRenderMs = -Infinity;
  let lastFaceSeenMs = -Infinity;
  let lastHandSeenMs = -Infinity;

  function renderTrackingStatus(now, force = false) {
    if (!force && now - lastStatusRenderMs < statusIntervalMs) return;
    lastStatusRenderMs = now;
    status.render();
  }

  function poll() {
    const now = performance.now();
    if (webcamEl.readyState >= 2) {
      // Face tracking
      if (now - lastFaceDetectMs >= faceIntervalMs) {
        lastFaceDetectMs = now;
        const fr = faceLandmarker.detectForVideo(webcamEl, now);
        if (fr.faceLandmarks && fr.faceLandmarks.length > 0) {
          lastFaceSeenMs = now;
          const nose = fr.faceLandmarks[0][1];
          input.targetX = THREE.MathUtils.clamp(
            (0.5 - nose.x) * 2 * CONFIG.camera.headSensitivity,
            -1.6,
            1.6
          );
          input.targetY = THREE.MathUtils.clamp(
            (nose.y - 0.5) * 2 * CONFIG.camera.headSensitivity,
            -1.6,
            1.6
          );
        }
      }
      status.tracking =
        now - lastFaceSeenMs <= CONFIG.tracking.presenceGraceMs ? 'on' : 'off';

      // Hand tracking
      if (handLandmarker && now - lastHandDetectMs >= handIntervalMs) {
        lastHandDetectMs = now;
        const hr = handLandmarker.detectForVideo(webcamEl, now);
        if (hr.landmarks && hr.landmarks.length > 0) {
          lastHandSeenMs = now;
          // Average openness across all detected hands
          let totalOpen = 0;
          for (const hand of hr.landmarks) totalOpen += handOpenness(hand);
          const openness = totalOpen / hr.landmarks.length;
          // open (1) = zoom in = negative zoom (camera closer)
          // closed (0) = zoom out = positive zoom (camera farther)
          const rawZoom = (0.5 - openness) * 2;  // −1 when open, +1 when closed
          if (Math.abs(rawZoom - input.rawTargetZoom) > CONFIG.camera.zoomDeadband) {
            input.rawTargetZoom = rawZoom;
          }
          status.hand = `hand: ${Math.max(0, Math.min(5, Math.round(openness * 5)))}/5`;
        } else if (now - lastHandSeenMs > CONFIG.tracking.presenceGraceMs) {
          input.rawTargetZoom = CONFIG.camera.defaultZoom;
          status.hand = 'hand: 0/5';
        }
      }
      renderTrackingStatus(now);
    }
    requestAnimationFrame(poll);
  }
  poll();
}
