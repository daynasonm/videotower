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
    parallaxX: 0.6,
    parallaxY: 0.8,
    smoothing: 0.09,
  },
  headRotation: { influence: 1.6 },
  requireNASA: true,
  nasa: {
    webbImagePageSize: 80,
    hubbleVideoPageSize: 36,
    hubbleVideoPages: 3,
    fallbackWebbQueries: [
      'James Webb nebula',
      'Webb telescope galaxy',
      'James Webb star cluster',
      'James Webb deep field',
    ],
    fallbackHubbleVideoQueries: [
      'Cloud 9 Starless Gas Cloud',
      'Black Hole Tidal Disruption Event',
      'Planetary Nebula NGC 2899',
      'Hubble Milky Way star field',
      'Egg Nebula visualization',
      'HLX-1 animation',
      'Fomalhaut video',
      'Hubble planetary nebula zoom',
      'Hubble colorful nebula animation',
      'Hubble galaxy cluster flythrough',
    ],
    imageItemsPerQuery: 8,
    videoItemsPerQuery: 4,
    blockedMediaTitleTerms: [
      'webb spectrum showcases galaxy',
      'distant galaxy behind smacs 0723',
      'smacs 0723',
    ],
    priorityVideoTitleTerms: [
      'cloud 9, starless gas cloud',
      'cloud 9 starless gas cloud',
      'black hole tidal disruption event',
      'planetary nebula ngc 2899',
      'ngc 2899',
    ],
    imagePreferredTerms: [
      'nebula',
      'galaxy',
      'cluster',
      'deep field',
      'star',
      'stars',
      'starburst',
      'quasar',
      'planetary nebula',
      'spiral',
      'cosmic cliffs',
      'pillars',
      'carina',
      'orion',
      'tarantula',
      'webb',
      'james webb',
      'milky way',
    ],
    imageForbiddenTerms: [
      'spectrum',
      'spectra',
      'showcase',
      'showcases',
      'annotated',
      'annotation',
      'label',
      'labels',
      'diagram',
      'chart',
      'graph',
      'graphical',
      'infographic',
      'map',
      'comparison',
      'compare',
      'caption',
      'captions',
      'title card',
      'poster',
      'brochure',
      'illustration',
      'rendering',
      'artist concept',
    ],
    videoPreferredTerms: [
      'visualization',
      'animation',
      'flyby',
      'fly-through',
      'zoom',
      'pan',
      'nebula',
      'galaxy',
      'cluster',
      'deep field',
      'supernova',
      'star',
      'stars',
      'cosmic',
      'universe',
      'pillars',
      'carina',
      'eagle',
      'orion',
      'helix',
      'infrared',
      'telescope view',
      'space',
      'planet',
      'planets',
      'planetary nebula',
      'star field',
      'starfield',
      'milky way',
      'wide field',
      'vivid',
      'colorful',
      'purple',
      'pink',
      'magenta',
      'teal',
      'cyan',
      'violet',
    ],
    videoForbiddenTerms: [
      'astronaut',
      'astronauts',
      'person',
      'people',
      'human',
      'face',
      'portrait',
      'interview',
      'host',
      'presenter',
      'speaker',
      'scientist',
      'scientists',
      'engineer',
      'engineers',
      'teacher',
      'student',
      'students',
      'lecture',
      'talk',
      'discussion',
      'podcast',
      'news',
      'press',
      'event',
      'ceremony',
      'behind the scenes',
      'behind-the-scenes',
      'caption',
      'captions',
      'captioned',
      'subtitle',
      'subtitles',
      'text overlay',
      'on-screen text',
      'lower third',
      'logo',
      'credits',
      'credit roll',
      'title card',
      'label',
      'labels',
      'annotated',
      'infographic',
      'explainer',
      'episode',
      'showcase',
      'showcases',
      'structure',
      'spectrum',
      'spectra',
      'title sequence',
    ],
    videoIntroSkip: { min: 0.18, max: 0.82 },
    textBannerScan: {
      maxDim: 256,
      bandHeightRatio: 0.24,
      minBrightRatio: 0.1,
      maxBrightRatio: 0.58,
      minTransitionRatio: 0.06,
      minClusterRows: 4,
    },
  },
  mirror: {
    cubeMapSize: 256,
    captureShellRadius: 9,
    coreRadius: 0.52,
    coreScaleX: 1.08,
    coreScaleY: 0.84,
    wobbleSpeed: 0.55,
    wobbleAmount: 0.05,
    spinSpeed: 0.18,
  },
  swap: {
    minDelayMs: 1500,
    maxDelayMs: 5000,
    videoWeight: 0.34,
    maxPanelsPerVideo: 2,
    recentVideoMemory: 12,
    videoChoicePool: 12,
  },
};

// =============================================================
// LOADER + FATAL UI
// =============================================================
const loaderEl  = document.getElementById('loader');
const loaderLog = document.getElementById('loader-log');
const fatalEl   = document.getElementById('fatal');

function loaderShow() { loaderEl.classList.add('show'); }
function loaderHide() { loaderEl.classList.remove('show'); }
function loaderLine(msg) {
  const t = new Date().toISOString().slice(11, 19);
  loaderLog.textContent += `[${t}] ${msg}\n`;
  console.log(`[loader] ${msg}`);
}
function fatal(title, details) {
  loaderHide();
  fatalEl.innerHTML = `<h2>${title}</h2><div>${details}</div>`;
  fatalEl.classList.add('show');
}

// =============================================================
// STATUS HUD
// =============================================================
const statusEl = document.getElementById('status');
const patternLabelEl = document.getElementById('pattern-label');

const status = {
  source: '—',
  assets: 0, total: 0,
  tracking: 'off',
  error: '',
  render() {
    const parts = [
      `source ${this.source}`,
      `assets ${this.assets}/${this.total}`,
      `tracking ${this.tracking}`,
    ];
    if (this.error) parts.push(`err: ${this.error}`);
    statusEl.textContent = parts.join('  ·  ');
  },
};
status.render();

function showPatternLabel(name) {
  patternLabelEl.textContent = name;
}

// =============================================================
// ENTRY
// =============================================================
const overlay  = document.getElementById('overlay');
const startBtn = document.getElementById('start');
let started = false;

startBtn.addEventListener('click', () => {
  if (started) return;
  started = true;
  overlay.classList.add('hidden');
  run().catch((e) => {
    console.error(e);
    status.error = (e && e.message) || String(e);
    status.render();
  });
});

// =============================================================
// MAIN
// =============================================================
async function run() {
  const canvas   = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping      = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog  = new THREE.Fog(0x000000, 6, 14);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 100
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(3, 2, 4);
  scene.add(rim);

  // Create the webcam texture early. It feeds the hidden capture shell
  // that the CubeCamera sees while building the mirror sculpture's env map.
  const webcamEl  = document.getElementById('webcam');
  const webcamTex = new THREE.VideoTexture(webcamEl);
  webcamTex.colorSpace = THREE.SRGBColorSpace;
  webcamTex.minFilter  = THREE.LinearFilter;
  webcamTex.magFilter  = THREE.LinearFilter;

  // ---------- load telescope media ----------
  status.source = 'webb + hubble';
  status.render();
  loaderShow();
  loaderLine('fetching Webb imagery + Hubble video source...');

  let images;
  try {
    images = await loadNASAImages();
    if (images.length === 0) throw new Error('no telescope images resolved');
    loaderLine(`✓ ${images.length} images ready, building tower`);
    loaderHide();
  } catch (e) {
    console.error('Telescope media load failed:', e);
    if (CONFIG.requireNASA) {
      fatal('Telescope media load failed',
        `${e.message}\n\nOpen DevTools → Network tab, refresh, and look for ` +
        `requests to webbtelescope.org or hubblesite.org.\nIf blocked, try incognito with extensions disabled.`);
      throw e;
    }
    throw e;
  }

  // Videos load in background
  const videoPool = [];
  loadNASAVideos().then((videos) => {
    videos.forEach((v) => videoPool.push(v));
    console.log(`[media] ${videos.length} Hubble videos now in rotation`);
  }).catch((e) => {
    console.warn('Hubble video pool failed (non-fatal):', e);
  });

  // ---------- tower container ----------
  const tower = new THREE.Group();
  scene.add(tower);
  const mirrorRig = createMirrorRig(scene, webcamTex);
  tower.add(mirrorRig.rig);

  // These are mutable — they get replaced each time the pattern changes.
  let slabs = [];
  let allMaterials = [];
  let activePattern = null;   // reference to the current PATTERNS entry

  // ---------- build / rebuild the tower from a pattern ----------
  function buildFromPattern(patternName) {
    const pat = PATTERNS[patternName];
    activePattern = pat;

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
    startSwapping(allMaterials, images, videoPool, slabAspect);

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

  // ---------- input (head tracking only) ----------
  const input = { x: 0, y: 0, targetX: 0, targetY: 0 };
  initHeadTracking(input).catch((e) => {
    console.warn('Head tracking failed:', e);
    status.tracking = 'failed';
    status.error = e.message || 'camera unavailable';
    status.render();
  });

  // ---------- animation loop ----------
  const clock = new THREE.Clock();

  function animate() {
    const t   = clock.getElapsedTime();
    const pat = activePattern;
    const rot = pat.rotation;

    // Smooth the head input so the tower doesn't jitter
    input.x += (input.targetX - input.x) * CONFIG.camera.smoothing;
    input.y += (input.targetY - input.y) * CONFIG.camera.smoothing;

    // Move the camera based on head position (parallax effect)
    camera.position.x = input.x * CONFIG.camera.parallaxX;
    camera.position.y = input.y * CONFIG.camera.parallaxY;
    camera.position.z = pat.cameraDistance;
    camera.lookAt(0, 0, 0);

    // Head horizontal movement also drives the tower's rotation,
    // so tilting your head left/right spins the tower
    const headDriven = input.x * CONFIG.headRotation.influence;
    const baseRot    = rot.baseSpeed * t + headDriven;

    // Wave constant: converts slab index into radians along the wave
    const k = (Math.PI * 2) / rot.waveLength;

    for (let i = 0; i < slabs.length; i++) {
      const wave  = rot.waveAmplitude * Math.sin(k * i - rot.waveSpeed * t);
      const helix = pat.helixOffset * i;
      slabs[i].rotation.y = baseRot + wave + helix;
    }

    mirrorRig.sculpture.rotation.y = t * CONFIG.mirror.spinSpeed + input.x * 0.2;
    mirrorRig.sculpture.rotation.x =
      Math.sin(t * CONFIG.mirror.wobbleSpeed) * CONFIG.mirror.wobbleAmount + input.y * 0.08;

    // ── Two-pass render ───────────────────────────────────────────────
    // Pass 1: update the sculpture's environment map. The hidden shell
    // carries the webcam feed so the CubeCamera captures the viewer and
    // the rotating tower as one continuous reflected environment.
    mirrorRig.sculpture.visible = false;
    mirrorRig.captureShell.visible = webcamEl.readyState >= webcamEl.HAVE_CURRENT_DATA;
    mirrorRig.cubeCamera.update(renderer, scene);

    // Pass 2: draw the final frame the viewer sees.
    mirrorRig.captureShell.visible = false;
    mirrorRig.sculpture.visible = true;

    renderer.render(scene, camera);

    requestAnimationFrame(animate);
  }
  animate();
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
  tex.center.set(0.5, 0.5);
  tex.repeat.set(cropX, cropY);
  tex.offset.set(0.5 - cropX / 2, 0.5 - cropY / 2);
  tex.needsUpdate = true;
}

// =============================================================
// HUBBLE + WEBB IMAGE & VIDEO LOADING
// =============================================================
// Primary sources: the official STScI HubbleSite and WebbTelescope APIs.
// The tower now stays strict about source selection:
// - panel stills: James Webb imagery only
// - panel motion clips: Hubble video source only
// NASA Images fallback queries are filtered the same way so unrelated
// NASA collections do not leak into the rotation.
// =============================================================

// ---------- helpers ----------
function configureMediaTexture(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter  = THREE.LinearFilter;
  tex.magFilter  = THREE.LinearFilter;
  return tex;
}

function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (hasLikelyTextBannerInImage(img)) {
        reject(new Error(`text-like overlay detected: ${url}`));
        return;
      }
      const tex = configureMediaTexture(new THREE.Texture(img));
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => reject(new Error(`img failed: ${url}`));
    img.src = url;
  });
}

function fixUrl(raw) {
  if (!raw) return null;
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw.replace(/^http:\/\//, 'https://');
}

function dedupeByUrl(items) {
  const seen = new Set();
  return items.filter(({ url }) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function telescopeMetadataText(item) {
  const meta = item?.data?.[0] || item || {};
  const fields = [
    meta.title,
    meta.name,
    meta.description,
    meta.short_description,
    meta.long_description,
    meta.description_508,
    meta.center,
    meta.secondary_creator,
    meta.credit,
    meta.credits,
    meta.photographer,
    meta.location,
    ...(Array.isArray(meta.keywords) ? meta.keywords : [meta.keywords].filter(Boolean)),
  ];
  return fields.filter(Boolean).join(' ').toLowerCase();
}

function metadataTextFor(...items) {
  return items.map((item) => telescopeMetadataText(item)).filter(Boolean).join(' ');
}

function countMatches(haystack, terms) {
  return terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
}

function matchesRequiredTerms(item, requiredTerms) {
  const haystack = metadataTextFor(item);
  return requiredTerms.some((term) => haystack.includes(term));
}

function matchesAnyTerm(haystack, terms) {
  return terms.some((term) => haystack.includes(term));
}

function matchesBlockedMedia(...items) {
  const haystack = metadataTextFor(...items);
  return haystack && matchesAnyTerm(haystack, CONFIG.nasa.blockedMediaTitleTerms);
}

function isPriorityVideoCandidate(...items) {
  const haystack = metadataTextFor(...items);
  return haystack && matchesAnyTerm(haystack, CONFIG.nasa.priorityVideoTitleTerms);
}

function isCleanCosmicImageCandidate(...items) {
  const haystack = metadataTextFor(...items);
  if (!haystack) return false;
  if (matchesBlockedMedia(...items)) return false;

  const hasPreferred = matchesAnyTerm(haystack, CONFIG.nasa.imagePreferredTerms);
  const hasForbidden = matchesAnyTerm(haystack, CONFIG.nasa.imageForbiddenTerms);
  return hasPreferred && !hasForbidden;
}

function isCleanCosmicVideoCandidate(...items) {
  const haystack = metadataTextFor(...items);
  if (!haystack) return false;
  if (matchesBlockedMedia(...items)) return false;

  const isPriority = isPriorityVideoCandidate(...items);
  const hasPreferred = matchesAnyTerm(haystack, CONFIG.nasa.videoPreferredTerms);
  const hasForbidden = matchesAnyTerm(haystack, CONFIG.nasa.videoForbiddenTerms);
  return (hasPreferred || isPriority) && (!hasForbidden || isPriority);
}

function scoreCosmicVideoCandidate(...items) {
  const haystack = metadataTextFor(...items);
  if (!haystack || !isCleanCosmicVideoCandidate(...items)) return -1;

  let score = countMatches(haystack, CONFIG.nasa.videoPreferredTerms) * 3;
  if (isPriorityVideoCandidate(...items)) score += 30;
  if (haystack.includes('milky way')) score += 8;
  if (haystack.includes('planetary nebula')) score += 7;
  if (haystack.includes('star field') || haystack.includes('starfield')) score += 5;
  if (haystack.includes('planet') || haystack.includes('planets')) score += 4;
  if (haystack.includes('purple') || haystack.includes('pink') || haystack.includes('magenta')) score += 6;
  if (haystack.includes('teal') || haystack.includes('cyan') || haystack.includes('violet')) score += 4;
  return score;
}

function hasLikelyTextBannerInImage(image) {
  try {
    const sourceWidth = image.naturalWidth || image.videoWidth || image.width || 0;
    const sourceHeight = image.naturalHeight || image.videoHeight || image.height || 0;
    if (!sourceWidth || !sourceHeight) return false;

    const maxDim = CONFIG.nasa.textBannerScan.maxDim;
    const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(32, Math.round(sourceWidth * scale));
    const height = Math.max(32, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;

    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const bandHeight = Math.max(18, Math.floor(height * CONFIG.nasa.textBannerScan.bandHeightRatio));

    return (
      bandLooksLikeText(data, width, 0, bandHeight) ||
      bandLooksLikeText(data, width, Math.max(0, height - bandHeight), height)
    );
  } catch (err) {
    console.warn('[media] text banner check skipped:', err);
    return false;
  }
}

function bandLooksLikeText(data, width, startRow, endRow) {
  let clusterRows = 0;
  for (let y = startRow; y < endRow; y++) {
    let brightPixels = 0;
    let transitions = 0;
    let prevIsText = false;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const isTextPixel = isPotentialTextPixel(r, g, b, alpha);
      if (isTextPixel) brightPixels++;
      if (x > 0 && isTextPixel !== prevIsText) transitions++;
      prevIsText = isTextPixel;
    }

    const brightRatio = brightPixels / width;
    const transitionRatio = transitions / width;
    const looksLikeTextRow =
      brightRatio >= CONFIG.nasa.textBannerScan.minBrightRatio &&
      brightRatio <= CONFIG.nasa.textBannerScan.maxBrightRatio &&
      transitionRatio >= CONFIG.nasa.textBannerScan.minTransitionRatio;

    clusterRows = looksLikeTextRow ? clusterRows + 1 : 0;
    if (clusterRows >= CONFIG.nasa.textBannerScan.minClusterRows) return true;
  }

  return false;
}

function isPotentialTextPixel(r, g, b, alpha) {
  if (alpha < 24) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 170 || (luminance > 120 && saturation > 0.45 && max > 165);
}

function pickPreferredMp4(files) {
  return (
    files.find((f) => /~mobile\.mp4$/i.test(f)) ||
    files.find((f) => /~small\.mp4$/i.test(f)) ||
    files.find((f) => /~preview\.mp4$/i.test(f)) ||
    files.find((f) => /\.mp4$/i.test(f) && !/~orig\.mp4$/i.test(f)) ||
    files.find((f) => /\.mp4$/i.test(f))
  );
}

function createVideoTexture(url, label, score = 0) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.loop        = true;
  video.muted       = true;
  video.playsInline = true;
  video.preload     = 'auto';
  video.src         = url;

  const tex = configureMediaTexture(new THREE.VideoTexture(video));
  tex.userData = {
    ...(tex.userData || {}),
    mediaType: 'video',
    title: label || url,
    score,
  };
  let seekAttempts = 0;
  let playbackStarted = false;

  function startPlayback() {
    if (playbackStarted) return;
    playbackStarted = true;
    video.play().catch((err) => {
      console.warn(`[media] autoplay blocked for ${label || url}:`, err);
    });
  }

  function seekToCandidateMoment() {
    if (!Number.isFinite(video.duration) || video.duration <= 1) {
      startPlayback();
      return;
    }

    const startMin = CONFIG.nasa.videoIntroSkip.min;
    const startMax = CONFIG.nasa.videoIntroSkip.max;
    const normalized = startMin + Math.random() * (startMax - startMin);
    const safeSeek = Math.max(0, video.duration - 0.25);
    video.currentTime = Math.min(safeSeek, video.duration * normalized);
  }

  video.addEventListener('loadedmetadata', () => {
    cropTextureToAspect(tex, SLAB.width / SLAB.height);
    seekToCandidateMoment();
  }, { once: true });

  video.addEventListener('seeked', () => {
    if (seekAttempts < 4 && hasLikelyTextBannerInImage(video)) {
      seekAttempts++;
      seekToCandidateMoment();
      return;
    }
    startPlayback();
  });

  video.addEventListener('loadeddata', () => {
    console.log(`[media] video ready: ${label || url}`);
  });

  return tex;
}

// ---------- images ----------
async function loadNASAImages() {
  const webbUrls = [];

  try {
    loaderLine('fetching Webb image list...');
    const res = await fetch(
      `https://webbtelescope.org/api/v3/images/all?page=1&per_page=${CONFIG.nasa.webbImagePageSize}`
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const list = await res.json();
    for (const item of list) {
      if (!isCleanCosmicImageCandidate(item)) continue;
      const url = fixUrl(item.thumbnail_url);
      if (url) webbUrls.push({ url, title: item.name || 'webb' });
    }
    loaderLine(`  ✓ Webb after clean-image filter: ${webbUrls.length}`);
  } catch (e) {
    loaderLine(`  ✗ Webb API: ${e.message}`);
  }

  if (webbUrls.length === 0) {
    loaderLine('Webb API unavailable — trying strict NASA Webb search...');
    const parts = await Promise.all(
      CONFIG.nasa.fallbackWebbQueries.map((query) =>
        searchStrictNASAImages(query, CONFIG.nasa.imageItemsPerQuery, ['james webb', 'webb'])
      )
    );
    parts.flat().forEach((item) => webbUrls.push(item));
  }

  if (webbUrls.length === 0) {
    throw new Error('no James Webb imagery resolved');
  }

  const unique = dedupeByUrl(webbUrls);
  loaderLine(`loading ${unique.length} Webb textures...`);

  let loadedCount = 0;
  const textures = await Promise.all(unique.map(({ url, title }, idx) =>
    loadImageTexture(url)
      .then((tex) => {
        loadedCount++;
        if (loadedCount % 10 === 0) loaderLine(`  loaded ${loadedCount}/${unique.length}`);
        return tex;
      })
      .catch(() => {
        console.warn(`[Webb] img ${idx} failed: ${title}`);
        return null;
      })
  ));

  return textures.filter(Boolean);
}

// ---------- videos ----------
async function loadNASAVideos() {
  const hubbleVideos = [];

  try {
    loaderLine('fetching Hubble video pages...');
    const pageNumbers = Array.from(
      { length: CONFIG.nasa.hubbleVideoPages },
      (_, idx) => idx + 1
    );
    const pageLists = await Promise.all(
      pageNumbers.map(async (page) => {
        const listRes = await fetch(
          `https://hubblesite.org/api/v3/videos?page=${page}&per_page=${CONFIG.nasa.hubbleVideoPageSize}`
        );
        if (!listRes.ok) throw new Error(`list ${listRes.status} (page ${page})`);
        const list = await listRes.json();
        loaderLine(`  ✓ Hubble page ${page}: ${list.length} items`);
        return list;
      })
    );
    const list = pageLists.flat();

    const details = await Promise.allSettled(
      list.map((item) =>
        fetch(`https://hubblesite.org/api/v3/video/${item.id}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    for (let i = 0; i < details.length; i++) {
      const detail = details[i];
      if (detail.status !== 'fulfilled' || !detail.value) continue;
      if (!isCleanCosmicVideoCandidate(list[i], detail.value)) continue;

      const files = detail.value.video_files || [];
      const mp4 = (
        files.find((f) => /H\.264/i.test(f.format || '') && f.width && f.width <= 1280) ||
        files.find((f) => /H\.264|h264/i.test(f.format || '') && f.file_url) ||
        files.find((f) => /mp4/i.test(f.format || '') && f.file_url)
      );
      if (!mp4) continue;

      const url = fixUrl(mp4.file_url);
      if (!url) continue;
      hubbleVideos.push({
        url,
        title: list[i]?.name || detail.value?.name || 'hubble video',
        score: scoreCosmicVideoCandidate(list[i], detail.value),
      });
    }

    hubbleVideos.sort((a, b) => b.score - a.score);
    loaderLine(`  ✓ Hubble videos after clean-content filter: ${hubbleVideos.length}`);
  } catch (e) {
    loaderLine(`  ✗ Hubble video API: ${e.message}`);
  }

  if (hubbleVideos.length === 0) {
    loaderLine('Hubble API unavailable — trying strict NASA Hubble video search...');
    const parts = await Promise.all(
      CONFIG.nasa.fallbackHubbleVideoQueries.map((query) =>
        resolveStrictNASAVideoUrls(query, CONFIG.nasa.videoItemsPerQuery, ['hubble'])
      )
    );
    parts.flat().forEach((item) => hubbleVideos.push(item));
  }

  const unique = dedupeByUrl(
    [...hubbleVideos].sort((a, b) => (b.score || 0) - (a.score || 0))
  );
  if (unique.length === 0) {
    loaderLine('  no Hubble videos passed the no-people / no-text filter');
    return [];
  }

  unique.sort((a, b) => (b.score || 0) - (a.score || 0));
  loaderLine(`preparing ${unique.length} Hubble videos with priority favorites + better spread...`);
  return unique.map(({ url, title, score }) => createVideoTexture(url, title, score));
}

async function searchStrictNASAImages(query, count, requiredTerms) {
  try {
    const searchUrl =
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`;
    loaderLine(`  "${query}" searching...`);
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
    const searchData = await searchRes.json();

    const items = (searchData?.collection?.items || [])
      .filter((item) => matchesRequiredTerms(item, requiredTerms))
      .filter((item) => isCleanCosmicImageCandidate(item))
      .slice(0, count);
    if (items.length === 0) throw new Error(`no ${requiredTerms.join('/')} items`);

    const results = items.map((item) => {
      const title = item?.data?.[0]?.title || query;
      const link = fixUrl(item?.links?.[0]?.href);
      if (!link) return null;
      return { url: link, title };
    }).filter(Boolean);

    loaderLine(`  ✓ "${query}" → ${results.length} images`);
    return results;
  } catch (e) {
    loaderLine(`  ✗ "${query}": ${e.message}`);
    console.error(`[NASA] image query "${query}" failed:`, e.message);
    return [];
  }
}

async function resolveStrictNASAVideoUrls(query, count, requiredTerms) {
  try {
    const searchUrl =
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=video`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
    const searchData = await searchRes.json();

    const items = (searchData?.collection?.items || [])
      .filter((item) => matchesRequiredTerms(item, requiredTerms))
      .filter((item) => isCleanCosmicVideoCandidate(item));
    if (items.length === 0) return [];

    const results = [];
    for (let i = 0; i < Math.min(items.length, count * 3); i++) {
      if (results.length >= count) break;
      const item = items[i];
      const title = item?.data?.[0]?.title || query;
      const manifestUrl = fixUrl(item.href || '');
      if (!manifestUrl) continue;

      try {
        const manifestRes = await fetch(manifestUrl);
        if (!manifestRes.ok) continue;
        const files = await manifestRes.json();
        const mp4 = pickPreferredMp4(files);
        if (mp4) {
          results.push({
            url: fixUrl(mp4),
            title,
            score: scoreCosmicVideoCandidate(item),
          });
        }
      } catch {
        continue;
      }
    }

    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  } catch (e) {
    console.warn(`[NASA] video query "${query}" failed:`, e.message);
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

function startSwapping(materials, images, videoPool, slabAspect) {
  const gen = ++swapGeneration;
  const {
    minDelayMs,
    maxDelayMs,
    videoWeight,
    maxPanelsPerVideo,
    recentVideoMemory,
    videoChoicePool,
  } = CONFIG.swap;

  const videoUsage = new Map();
  const recentVideos = [];

  function isVideoTexture(tex) {
    return !!tex?.userData && tex.userData.mediaType === 'video';
  }

  function videoUseCount(tex) {
    return videoUsage.get(tex) || 0;
  }

  function noteVideoUse(prevTex, nextTex) {
    if (isVideoTexture(prevTex)) {
      const nextCount = Math.max(0, videoUseCount(prevTex) - 1);
      if (nextCount === 0) videoUsage.delete(prevTex);
      else videoUsage.set(prevTex, nextCount);
    }

    if (isVideoTexture(nextTex)) {
      videoUsage.set(nextTex, videoUseCount(nextTex) + 1);
      recentVideos.push(nextTex);
      while (recentVideos.length > recentVideoMemory) recentVideos.shift();
    }
  }

  function pickVideoTexture(currentMap) {
    if (videoPool.length === 0) return null;

    let candidates = videoPool.filter((tex) =>
      tex !== currentMap &&
      videoUseCount(tex) < maxPanelsPerVideo &&
      !recentVideos.includes(tex)
    );

    if (candidates.length === 0) {
      candidates = videoPool.filter((tex) =>
        tex !== currentMap && videoUseCount(tex) < maxPanelsPerVideo
      );
    }

    if (candidates.length === 0) {
      candidates = videoPool.filter((tex) => tex !== currentMap);
    }

    if (candidates.length === 0) candidates = videoPool.slice();
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const usageDiff = videoUseCount(a) - videoUseCount(b);
      if (usageDiff !== 0) return usageDiff;
      return (b.userData?.score || 0) - (a.userData?.score || 0);
    });

    const pool = candidates.slice(0, Math.min(videoChoicePool, candidates.length));
    const tex = pool[Math.floor(Math.random() * pool.length)];
    cropTextureToAspect(tex, slabAspect);
    return tex;
  }

  function pickImageTexture(currentMap) {
    const candidates = images.filter((tex) => tex !== currentMap);
    if (candidates.length === 0) return images[0];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function pickTexture(currentMap) {
    if (videoPool.length > 0 && Math.random() < videoWeight) {
      const videoTex = pickVideoTexture(currentMap);
      if (videoTex) return videoTex;
    }
    return pickImageTexture(currentMap);
  }

  function scheduleSwap(mat) {
    const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    setTimeout(() => {
      if (gen !== swapGeneration) return;
      const nextMap = pickTexture(mat.map);
      if (nextMap === mat.map) {
        scheduleSwap(mat);
        return;
      }
      noteVideoUse(mat.map, nextMap);
      mat.map = nextMap;
      mat.needsUpdate = true;
      scheduleSwap(mat);
    }, delay);
  }

  materials.forEach((mat) => {
    setTimeout(() => {
      if (gen !== swapGeneration) return;
      scheduleSwap(mat);
    }, Math.random() * maxDelayMs);
  });
}

// =============================================================
// MIRROR SCULPTURE
// =============================================================
function createMirrorRig(scene, webcamTex) {
  const rig = new THREE.Group();

  const cubeTarget = new THREE.WebGLCubeRenderTarget(CONFIG.mirror.cubeMapSize, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cubeCamera = new THREE.CubeCamera(0.05, 30, cubeTarget);
  rig.add(cubeCamera);

  const sculpture = new THREE.Group();
  rig.add(sculpture);

  const chrome = new THREE.MeshPhysicalMaterial({
    envMap: cubeTarget.texture,
    metalness: 1.0,
    roughness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.35,
  });

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.mirror.coreRadius, 96, 96),
    chrome
  );
  core.scale.set(
    CONFIG.mirror.coreScaleX,
    CONFIG.mirror.coreScaleY,
    CONFIG.mirror.coreScaleX
  );
  sculpture.add(core);

  const captureShell = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.mirror.captureShellRadius, 64, 40),
    new THREE.MeshBasicMaterial({
      map: webcamTex,
      side: THREE.BackSide,
      toneMapped: false,
      fog: false,
    })
  );
  captureShell.rotation.y = Math.PI;
  captureShell.visible = false;
  scene.add(captureShell);

  return { rig, sculpture, cubeCamera, captureShell };
}
// =============================================================
// HEAD TRACKING — head position drives camera parallax + tower spin
// =============================================================

async function initHeadTracking(input) {
  const webcamEl = document.getElementById('webcam');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }, audio: false,
    });
  } catch (e) {
    throw new Error(`camera denied: ${e.name}`);
  }
  webcamEl.srcObject = stream;
  await new Promise((r) =>
    webcamEl.addEventListener('loadeddata', r, { once: true })
  );

  const MP = '0.10.32';
  const { FaceLandmarker, FilesetResolver } = await import(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/vision_bundle.mjs`
  );
  const resolver = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/wasm`
  );

  let faceLandmarker;
  const baseOpts = {
    modelAssetPath:
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  };
  try {
    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { ...baseOpts, delegate: 'GPU' },
      runningMode: 'VIDEO', numFaces: 1,
    });
  } catch {
    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: { ...baseOpts, delegate: 'CPU' },
      runningMode: 'VIDEO', numFaces: 1,
    });
  }

  status.tracking = 'on';
  status.render();

  function poll() {
    if (webcamEl.readyState >= 2) {
      const result = faceLandmarker.detectForVideo(webcamEl, performance.now());
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        const nose = result.faceLandmarks[0][1];
        input.targetX = (0.5 - nose.x) * 2;
        input.targetY = (nose.y - 0.5) * 2;
      }
    }
    requestAnimationFrame(poll);
  }
  poll();
}
