import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// =============================================================
// CONFIG
// =============================================================
const CONFIG = {
  slabCount: 32,
  slabHeight: 0.11,
  slabWidth:  1.2,
  slabDepth:  1.2,
  slabGap:    0.002,

  rotation: {
    baseSpeed: 0.08,       // rad/s, slow continuous drift
    waveAmplitude: 0.48,   // ~27°, stays inside iframe-safe 30° envelope
    waveLength: 22,
    waveSpeed: 1.0,
  },

  camera: {
    distance: 2.3,
    fov: 45,
    parallaxX: 0.6,        // subtle parallax now; head drives tower rotation
    parallaxY: 0.8,
    smoothing: 0.09,
  },

  // Head drives tower Y rotation. Tilt right → tower spins right (and vice versa).
  // This is ADDITIVE to baseSpeed drift.
  headRotation: {
    influence: 1.6,        // radians of tower rotation per unit head offset
  },

  // ---------- YouTube Data API ----------
  // Leave apiKey empty to use local video pool (./videos/N.mp4).
  // Set apiKey + query to populate the tower with YouTube thumbnails.
  // Restrict your API key to your domain in Google Cloud Console before shipping.
  youtube: {
    apiKey:  '',                   // ← paste your key here to enable
    query:   'contemporary art installation',
    count:   50,                   // thumbnails to fetch (max 50 per request)
    swapIntervalMs: 5000,          // mean interval between per-face swaps
    swapJitterMs:   4000,          // ± randomization so swaps don't sync
  },

  // Local video fallback if YouTube is disabled or fails
  videoPool: [
    './videos/1.mp4', './videos/2.mp4', './videos/3.mp4', './videos/4.mp4',
    './videos/5.mp4', './videos/6.mp4', './videos/7.mp4', './videos/8.mp4',
  ],
};

// =============================================================
// STATUS HUD
// =============================================================
const statusEl = document.getElementById('status');
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

// =============================================================
// WIRE BUTTON IMMEDIATELY
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
  // ---------- three setup ----------
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 6, 14);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, CONFIG.camera.distance);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(3, 2, 4);
  scene.add(rim);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- texture pool ----------
  // Returns an array of THREE.Texture. Either YouTube thumbnails or video textures.
  const useYouTube = !!CONFIG.youtube.apiKey;
  let textures = [];
  let poolIsVideo = false;

  if (useYouTube) {
    status.source = 'youtube';
    status.render();
    try {
      textures = await loadYouTubeThumbnails();
      status.total = textures.length;
      status.assets = textures.length;
      status.render();
    } catch (e) {
      console.error('YouTube load failed, falling back to local videos:', e);
      status.source = 'local (fallback)';
      status.error = `youtube: ${e.message}`;
      status.render();
      textures = buildVideoTextures();
      poolIsVideo = true;
    }
  } else {
    status.source = 'local';
    status.render();
    textures = buildVideoTextures();
    poolIsVideo = true;
  }

  // ---------- build the tower ----------
  const tower = new THREE.Group();
  scene.add(tower);

  const slabs = [];
  const allFaceMats = []; // track every face material for thumbnail swapping
  const halfCount = CONFIG.slabCount / 2;
  const faceGeom = new THREE.PlaneGeometry(1, 1);

  for (let i = 0; i < CONFIG.slabCount; i++) {
    const slab = new THREE.Group();
    slab.position.y = (i - halfCount + 0.5) * (CONFIG.slabHeight + CONFIG.slabGap);

    const faceDefs = [
      { rotY: 0,            w: CONFIG.slabWidth, d: CONFIG.slabDepth / 2 },
      { rotY: Math.PI / 2,  w: CONFIG.slabDepth, d: CONFIG.slabWidth / 2 },
      { rotY: Math.PI,      w: CONFIG.slabWidth, d: CONFIG.slabDepth / 2 },
      { rotY: -Math.PI / 2, w: CONFIG.slabDepth, d: CONFIG.slabWidth / 2 },
    ];

    faceDefs.forEach((f, fIdx) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(faceGeom, mat);
      mesh.scale.set(f.w, CONFIG.slabHeight, 1);
      mesh.position.set(Math.sin(f.rotY) * f.d, 0, Math.cos(f.rotY) * f.d);
      mesh.rotation.y = f.rotY;
      slab.add(mesh);

      // Initial texture assignment
      const tex = textures[(i * 3 + fIdx * 5) % textures.length];
      if (tex) {
        assignTexture(mat, tex);
      }
      allFaceMats.push(mat);
    });

    tower.add(slab);
    slabs.push(slab);
  }

  // Periodic swaps (only useful when textures are still images, i.e. YouTube)
  if (!poolIsVideo && textures.length > 1) {
    allFaceMats.forEach((mat) => scheduleSwap(mat, textures));
  }

  // ---------- input: head tracking (with mouse fallback) ----------
  const input = { x: 0, y: 0, targetX: 0, targetY: 0 };
  setupMouseFallback(input);
  initHeadTracking(input).catch((e) => {
    console.warn('Head tracking failed, using mouse fallback:', e);
    status.tracking = 'mouse';
    status.render();
  });

  // ---------- animation loop ----------
  const rot = CONFIG.rotation;
  const k = (Math.PI * 2) / rot.waveLength;
  const clock = new THREE.Clock();

  function animate() {
    const t = clock.getElapsedTime();

    // Smooth input
    input.x += (input.targetX - input.x) * CONFIG.camera.smoothing;
    input.y += (input.targetY - input.y) * CONFIG.camera.smoothing;

    // Camera: gentle parallax
    camera.position.x = input.x * CONFIG.camera.parallaxX;
    camera.position.y = input.y * CONFIG.camera.parallaxY;
    camera.position.z = CONFIG.camera.distance;
    camera.lookAt(0, 0, 0);

    // Tower: base drift + head-driven rotation
    const headDriven = input.x * CONFIG.headRotation.influence;
    const baseRot = rot.baseSpeed * t + headDriven;

    for (let i = 0; i < slabs.length; i++) {
      const wave = rot.waveAmplitude * Math.sin(k * i - rot.waveSpeed * t);
      slabs[i].rotation.y = baseRot + wave;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

// =============================================================
// TEXTURES
// =============================================================
function assignTexture(mat, tex) {
  mat.map = tex;
  mat.color.set(0xffffff);
  mat.needsUpdate = true;
}

// ---------- local video pool ----------
function buildVideoTextures() {
  status.total = CONFIG.videoPool.length;
  return CONFIG.videoPool.map((src, idx) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';  // MUST be before src
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = src;

    v.addEventListener('loadeddata', () => {
      v.currentTime = Math.random() * Math.max(0, v.duration - 1);
      status.assets++;
      status.render();
    });
    v.addEventListener('error', () => {
      console.error(`Video ${idx} failed: ${src}`);
    });
    v.play().catch(() => {});

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  });
}

// ---------- YouTube thumbnails via Data API v3 ----------
async function loadYouTubeThumbnails() {
  const { apiKey, query, count } = CONFIG.youtube;
  const url = `https://www.googleapis.com/youtube/v3/search`
    + `?part=snippet`
    + `&maxResults=${Math.min(count, 50)}`
    + `&q=${encodeURIComponent(query)}`
    + `&type=video`
    + `&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = await res.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('No YouTube results for query');
  }

  status.total = data.items.length;
  status.render();

  // Slab aspect (1.2 × 0.11) vs thumbnail aspect (16:9). Crop thumbnail to
  // a centered horizontal band so subjects aren't stretched.
  const slabAspect = CONFIG.slabWidth / CONFIG.slabHeight;   // ~10.9
  const thumbAspect = 16 / 9;                                // ~1.78
  const cropY = thumbAspect / slabAspect;                    // ~0.163
  const offsetY = (1 - cropY) / 2;

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  const textures = await Promise.all(data.items.map((item, idx) => {
    const thumbs = item.snippet.thumbnails;
    const src = (thumbs.maxres || thumbs.high || thumbs.medium || thumbs.default).url;
    return new Promise((resolve) => {
      loader.load(
        src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.repeat.set(1, cropY);
          tex.offset.set(0, offsetY);
          status.assets++;
          status.render();
          resolve(tex);
        },
        undefined,
        (err) => {
          console.warn(`Thumbnail ${idx} failed:`, src, err);
          resolve(null);
        }
      );
    });
  }));

  return textures.filter(Boolean);
}

// ---------- periodic thumbnail swap ----------
function scheduleSwap(mat, textures) {
  const { swapIntervalMs, swapJitterMs } = CONFIG.youtube;
  const delay = swapIntervalMs + (Math.random() - 0.5) * swapJitterMs;

  setTimeout(() => {
    // Quick fade to dark → swap → fade back in. ~220ms round trip.
    const from = { v: 1 };
    const fadeOut = fadeMaterial(mat, 1, 0.15, 110);
    fadeOut.then(() => {
      const next = textures[Math.floor(Math.random() * textures.length)];
      assignTexture(mat, next);
      fadeMaterial(mat, 0.15, 1, 110);
    });
    scheduleSwap(mat, textures);
  }, delay);
}

function fadeMaterial(mat, from, to, durationMs) {
  return new Promise((resolve) => {
    const start = performance.now();
    function step() {
      const p = Math.min(1, (performance.now() - start) / durationMs);
      const v = from + (to - from) * p;
      mat.color.setScalar(v);
      mat.needsUpdate = true;
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    }
    step();
  });
}

// =============================================================
// INPUT
// =============================================================
function setupMouseFallback(input) {
  // Mouse provides a baseline so the interaction works even without webcam.
  // Head tracking, once up, overrides these values each frame.
  window.addEventListener('mousemove', (e) => {
    input.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    input.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
}

async function initHeadTracking(input) {
  const webcamEl = document.getElementById('webcam');

  // Request camera FIRST — surfaces permission errors clearly before we spend
  // 10+MB downloading MediaPipe.
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }, audio: false,
    });
  } catch (e) {
    throw new Error(`camera denied: ${e.name}`);
  }
  webcamEl.srcObject = stream;
  await new Promise((r) => webcamEl.addEventListener('loadeddata', r, { once: true }));

  // Now load MediaPipe
  const MP = '0.10.32';
  let FaceLandmarker, FilesetResolver;
  try {
    ({ FaceLandmarker, FilesetResolver } = await import(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/vision_bundle.mjs`
    ));
  } catch (e) {
    throw new Error(`mediapipe module load: ${e.message}`);
  }

  const resolver = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/wasm`
  );

  let faceLandmarker;
  try {
    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  } catch (e) {
    // GPU delegate can fail on some machines — retry with CPU
    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  }

  status.tracking = 'on';
  status.render();

  // Poll every animation frame via a separate rAF loop
  function poll() {
    if (webcamEl.readyState >= 2) {
      const result = faceLandmarker.detectForVideo(webcamEl, performance.now());
      if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        const nose = result.faceLandmarks[0][1];
        input.targetX = (0.5 - nose.x) * 2;
        input.targetY = (0.5 - nose.y) * 2;
      }
    }
    requestAnimationFrame(poll);
  }
  poll();
}
