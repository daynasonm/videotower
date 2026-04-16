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
    queries: [
      'carina nebula', 'orion nebula', 'crab nebula', 'helix nebula',
      'butterfly nebula', 'eagle nebula', 'lagoon nebula', 'ring nebula',
      'andromeda galaxy', 'whirlpool galaxy', 'sombrero galaxy',
      'pillars of creation', 'hubble deep field',
      'webb telescope first images', 'black hole',
    ],
    imageItemsPerQuery: 8,
    videoQueries: [
      'hubble nebula', 'carina nebula', 'james webb galaxy',
      'black hole simulation', 'solar dynamics', 'pillars of creation',
    ],
    videoItemsPerQuery: 2,
  },
  swap: { minDelayMs: 1500, maxDelayMs: 5000, videoWeight: 0.5 },
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
  status.source = 'nasa';
  status.render();
  loaderShow();
  loaderLine('fetching NASA images (fast) + videos (background)...');

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
  loadNASAVideos().then((videos) => {
    videos.forEach((v) => videoPool.push(v));
    console.log(`[NASA] ${videos.length} videos now in rotation`);
  }).catch((e) => {
    console.warn('NASA video pool failed (non-fatal):', e);
  });

  // ---------- tower container ----------
  const tower = new THREE.Group();
  scene.add(tower);

  // These are mutable — they get replaced each time the pattern changes.
  let slabs = [];
  let allMaterials = [];
  let activePattern = null;   // reference to the current PATTERNS entry
  let swapGeneration = 0;     // incremented on rebuild to stop old swap timers

  // ---------- build / rebuild the tower from a pattern ----------
  // Geometry always comes from SLAB (fixed). Only motion behavior
  // changes between patterns. On switch: old meshes are removed,
  // new ones created, swap loop restarted.
  function buildFromPattern(patternName) {
    const pat = PATTERNS[patternName];
    activePattern = pat;

    // Stop old swap timers by incrementing the generation counter
    swapGeneration++;

    // Remove old slabs from the scene and free their GPU memory
    slabs.forEach((slab) => {
      slab.children.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      tower.remove(slab);
    });
    slabs = [];
    allMaterials = [];

    // Crop all image textures for the slab aspect ratio.
    const slabAspect = SLAB.width / SLAB.height;
    images.forEach((tex) => cropTextureToAspect(tex, slabAspect));

    // Build new slabs
    const halfCount = SLAB.count / 2;
    const faceGeom  = new THREE.PlaneGeometry(1, 1);
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
        const mat = new THREE.MeshBasicMaterial({
          map: images[poolIdx],
          side: THREE.DoubleSide,
        });
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
      // Wave: each slab twists by a sine offset based on its position
      const wave = rot.waveAmplitude * Math.sin(k * i - rot.waveSpeed * t);
      // Helix: a fixed angular offset per slab (0 for most patterns)
      const helix = pat.helixOffset * i;
      slabs[i].rotation.y = baseRot + wave + helix;
    }

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
  if (!img || !img.width) return;
  const imageAspect = img.width / img.height;

  // How much of the image's height to use (1 = full height, 0.5 = half)
  const cropY = Math.min(1, imageAspect / slabAspect);
  // How much of the image's width to use
  const cropX = Math.min(1, slabAspect / imageAspect);

  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(cropX, cropY);
  tex.offset.set((1 - cropX) / 2, (1 - cropY) / 2);
  tex.needsUpdate = true;
}

// =============================================================
// NASA Image Library
// =============================================================

async function loadNASAImages() {
  const queries = CONFIG.nasa.queries;
  const resultsPerQuery = await Promise.all(
    queries.map((q) => searchImages(q, CONFIG.nasa.imageItemsPerQuery))
  );
  const urls = resultsPerQuery.flat();

  const seen = new Set();
  const unique = urls.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  if (unique.length === 0) {
    throw new Error('no NASA images resolved from any query');
  }

  loaderLine(`loading ${unique.length} image textures...`);

  function loadImageTexture(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.needsUpdate = true;
        resolve(tex);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  let loadedCount = 0;
  const textures = await Promise.all(unique.map(({ url, title }, idx) =>
    loadImageTexture(url)
      .then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter  = THREE.LinearFilter;
        tex.magFilter  = THREE.LinearFilter;
        loadedCount++;
        if (loadedCount % 10 === 0) {
          loaderLine(`  loaded ${loadedCount}/${unique.length}`);
        }
        return tex;
      })
      .catch(() => {
        console.warn(`[NASA] image ${idx} failed: ${title}`);
        return null;
      })
  ));

  return textures.filter(Boolean);
}

// ---------- videos ----------

async function loadNASAVideos() {
  const queries = CONFIG.nasa.videoQueries;
  const resultsPerQuery = await Promise.all(
    queries.map((q) => resolveVideoUrls(q, CONFIG.nasa.videoItemsPerQuery))
  );
  const urls = resultsPerQuery.flat();

  const seen = new Set();
  const unique = urls.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  console.log(`[NASA] fetching ${unique.length} videos in background`);

  const videoTextures = unique.map(({ url, title }, idx) => {
    const v = document.createElement('video');
    v.crossOrigin  = 'anonymous';
    v.loop         = true;
    v.muted        = true;
    v.playsInline  = true;
    v.preload      = 'auto';
    v.src          = url;

    v.addEventListener('loadeddata', () => {
      v.currentTime = Math.random() * Math.max(0, v.duration - 1);
      console.log(`[NASA] video loaded: ${title}`);
    });
    v.addEventListener('error', () => {
      console.error(`[NASA] video ${idx} failed: ${title}`);
    });
    v.play().catch(() => {});

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter  = THREE.LinearFilter;
    tex.magFilter  = THREE.LinearFilter;
    return tex;
  });

  return videoTextures;
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
    for (let i = 0; i < Math.min(items.length, count * 2); i++) {
      if (results.length >= count) break;
      const item  = items[i];
      const title = item?.data?.[0]?.title || query;
      const manifestUrl = (item.href || '').replace(/^http:\/\//, 'https://');
      if (!manifestUrl) continue;
      try {
        const manifestRes = await fetch(manifestUrl);
        if (!manifestRes.ok) continue;
        const files = await manifestRes.json();
        const mp4 = (
          files.find((f) => /~mobile\.mp4$/i.test(f)) ||
          files.find((f) => /~small\.mp4$/i.test(f))  ||
          files.find((f) => /~preview\.mp4$/i.test(f)) ||
          files.find((f) => /\.mp4$/i.test(f) && !/~orig\.mp4$/i.test(f)) ||
          files.find((f) => /\.mp4$/i.test(f))
        );
        if (mp4) {
          results.push({ url: mp4.replace(/^http:\/\//, 'https://'), title });
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

    const items = (searchData?.collection?.items || []).slice(0, count);
    if (items.length === 0) throw new Error(`no items for "${query}"`);

    const results = items.map((item) => {
      const title = item?.data?.[0]?.title || query;
      const link  = item?.links?.[0]?.href;
      if (!link) return null;
      return { url: link.replace(/^http:\/\//, 'https://'), title };
    }).filter(Boolean);

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

function startSwapping(materials, images, videoPool, slabAspect) {
  const gen = ++swapGeneration;
  const { minDelayMs, maxDelayMs, videoWeight } = CONFIG.swap;

  function pickTexture() {
    if (videoPool.length > 0 && Math.random() < videoWeight) {
      const tex = videoPool[Math.floor(Math.random() * videoPool.length)];
      cropTextureToAspect(tex, slabAspect);
      return tex;
    }
    return images[Math.floor(Math.random() * images.length)];
  }

  function scheduleSwap(mat) {
    const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    setTimeout(() => {
      // If the pattern changed since this timer was set, stop
      if (gen !== swapGeneration) return;
      mat.map = pickTexture();
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
// INPUT — head tracking only
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
