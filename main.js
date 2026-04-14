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
    baseSpeed: 0.08,
    waveAmplitude: 0.48,
    waveLength: 22,
    waveSpeed: 1.0,
  },

  camera: {
    distance: 2.3,
    fov: 45,
    parallaxX: 0.6,
    parallaxY: 0.8,
    smoothing: 0.09,
  },

  headRotation: {
    influence: 1.6,
  },

  // If true, show a fatal error instead of silently falling back to local.
  // Keeps you honest: you'll SEE when NASA fails.
  requireNASA: true,

  // ---------- NASA Image & Video Library ----------
  // Hybrid pool: images for speed (fill the tower instantly), videos for
  // motion. Browsers cap at ~6-8 concurrent video decodes, so we fetch a
  // small video pool that paints many panels (same stream on multiple
  // panels is free — GPU uploads each frame once).
  nasa: {
    queries: [
      'carina nebula',
      'orion nebula',
      'crab nebula',
      'helix nebula',
      'butterfly nebula',
      'eagle nebula',
      'lagoon nebula',
      'ring nebula',
      'andromeda galaxy',
      'whirlpool galaxy',
      'sombrero galaxy',
      'pillars of creation',
      'hubble deep field',
      'webb telescope first images',
      'black hole',
    ],
    imageItemsPerQuery: 8,    // 15 × 8 = ~120 unique images (instant tower)
    videoQueries: [           // focused subset for video fetching
      'hubble nebula',
      'carina nebula',
      'james webb galaxy',
      'black hole simulation',
      'solar dynamics',
      'pillars of creation',
    ],
    videoItemsPerQuery: 2,    // 6 × 2 = ~12 videos (below browser decode cap)
  },

  swap: {
    minDelayMs: 1500,
    maxDelayMs: 5000,
    videoWeight: 0.5,         // 50% chance each swap lands on a video
  },

  // Used only if requireNASA is false
  videoPool: [
    './videos/1.mp4', './videos/2.mp4', './videos/3.mp4', './videos/4.mp4',
    './videos/5.mp4', './videos/6.mp4', './videos/7.mp4', './videos/8.mp4',
  ],
};

// =============================================================
// LOADER + FATAL UI
// =============================================================
const loaderEl = document.getElementById('loader');
const loaderLog = document.getElementById('loader-log');
const fatalEl = document.getElementById('fatal');

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
  status.source = 'nasa';
  status.render();
  loaderShow();
  loaderLine(`fetching NASA images (fast) + videos (background)...`);

  let images;
  try {
    images = await loadNASAImages();
    if (images.length === 0) throw new Error('no NASA images resolved');
    loaderLine(`✓ ${images.length} images ready, building tower`);
    loaderHide();
  } catch (e) {
    console.error('NASA load failed:', e);
    if (CONFIG.requireNASA) {
      fatal('NASA load failed', `${e.message}\n\nOpen DevTools Network tab, refresh, and look for requests to images-api.nasa.gov.\nIf they're blocked (red), it's a CORS / extension / network issue.\nTry: incognito window with extensions disabled.`);
      throw e;
    }
    throw e;
  }

  // Videos load in background; gets added to the swap pool as it arrives.
  const videoPool = [];
  loadNASAVideos().then((videos) => {
    videos.forEach((v) => videoPool.push(v));
    console.log(`[NASA] ${videos.length} videos now in rotation`);
  }).catch((e) => {
    console.warn('NASA video pool failed (non-fatal):', e);
  });

  // ---------- tower ----------
  const tower = new THREE.Group();
  scene.add(tower);

  const slabs = [];
  const halfCount = CONFIG.slabCount / 2;
  const faceGeom = new THREE.PlaneGeometry(1, 1);

  const allMaterials = [];
  const totalPanels = CONFIG.slabCount * 4;
  status.total = totalPanels;
  status.assets = totalPanels;
  status.render();

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
      const poolIdx = (i * 3 + fIdx * 5) % images.length;
      const mat = new THREE.MeshBasicMaterial({
        map: images[poolIdx],
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(faceGeom, mat);
      mesh.scale.set(f.w, CONFIG.slabHeight, 1);
      mesh.position.set(Math.sin(f.rotY) * f.d, 0, Math.cos(f.rotY) * f.d);
      mesh.rotation.y = f.rotY;
      slab.add(mesh);
      allMaterials.push(mat);
    });

    tower.add(slab);
    slabs.push(slab);
  }

  // Rapid swap: each panel picks from images OR the video pool (as videos
  // arrive in the background, they gradually start appearing on panels).
  startSwapping(allMaterials, images, videoPool);

  // ---------- input ----------
  const input = { x: 0, y: 0, targetX: 0, targetY: 0 };
  setupMouseFallback(input);
  initHeadTracking(input).catch((e) => {
    console.warn('Head tracking failed, using mouse fallback:', e);
    status.tracking = 'mouse';
    status.render();
  });

  // ---------- animation ----------
  const rot = CONFIG.rotation;
  const k = (Math.PI * 2) / rot.waveLength;
  const clock = new THREE.Clock();

  function animate() {
    const t = clock.getElapsedTime();

    input.x += (input.targetX - input.x) * CONFIG.camera.smoothing;
    input.y += (input.targetY - input.y) * CONFIG.camera.smoothing;

    camera.position.x = input.x * CONFIG.camera.parallaxX;
    camera.position.y = input.y * CONFIG.camera.parallaxY;
    camera.position.z = CONFIG.camera.distance;
    camera.lookAt(0, 0, 0);

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
// NASA Image Library
// =============================================================
// Uses media_type=image. Each result's `links[0].href` is a ~150KB thumbnail
// JPG. We load all of them in parallel as THREE.Texture, then rapidly swap
// which texture each panel shows so the tower feels alive.

function cropTextureToSlabAspect(tex) {
  // Dynamic crop: uses the loaded image's actual aspect ratio, not an
  // assumed 16:9. For square images we get a thin horizontal band; for
  // wide images a taller band. Result: no stretching, no empty space.
  const img = tex.image;
  if (!img || !img.width) return;
  const imageAspect = img.width / img.height;
  const slabAspect = CONFIG.slabWidth / CONFIG.slabHeight;
  const cropY = Math.min(1, imageAspect / slabAspect);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1, cropY);
  tex.offset.set(0, (1 - cropY) / 2);
  tex.needsUpdate = true;
}

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

  // Chrome is stricter than Safari about cross-origin images. NASA's image
  // CDN (images-assets.nasa.gov) doesn't send ACAO headers, so Chrome
  // blocks them when loaded via TextureLoader. Workaround: load via a plain
  // <img> tag (which Chrome allows, just taints the texture) and wrap in a
  // CanvasTexture via Texture.image assignment.
  function loadImageTexture(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // Intentionally do NOT set img.crossOrigin — this lets Chrome load it
      // even without ACAO headers. The resulting texture is "tainted" but
      // that only blocks readPixels/toDataURL, not rendering.
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
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        cropTextureToSlabAspect(tex);
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

// ---------- videos (loaded in background, added to pool as they arrive) ----------
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

  // Build VideoTextures. Each video will start streaming immediately and
  // appear on panels (via the swap loop) as soon as the first frame decodes.
  const videoTextures = unique.map(({ url, title }, idx) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';   // NASA video CDN DOES send CORS headers
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;

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
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    // Apply crop once the video reports its dimensions
    v.addEventListener('loadedmetadata', () => {
      tex.image = v;
      cropTextureToSlabAspect(tex);
    }, { once: true });

    return tex;
  });

  return videoTextures;
}

async function resolveVideoUrls(query, count) {
  try {
    const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=video`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
    const searchData = await searchRes.json();

    const items = searchData?.collection?.items || [];
    if (items.length === 0) return [];

    const results = [];
    for (let i = 0; i < Math.min(items.length, count * 2); i++) {
      if (results.length >= count) break;
      const item = items[i];
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
          const url = mp4.replace(/^http:\/\//, 'https://');
          results.push({ url, title });
        }
      } catch (e) {
        continue;
      }
    }
    return results;
  } catch (e) {
    console.warn(`[NASA] video query "${query}" failed:`, e.message);
    return [];
  }
}

async function searchImages(query, count) {
  // Returns up to `count` image URLs for a query.
  try {
    const searchUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`;
    loaderLine(`  "${query}" searching...`);
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
    const searchData = await searchRes.json();

    const items = (searchData?.collection?.items || []).slice(0, count);
    if (items.length === 0) throw new Error(`no items for "${query}"`);

    const results = items.map((item) => {
      const title = item?.data?.[0]?.title || query;
      const link = item?.links?.[0]?.href;
      if (!link) return null;
      const url = link.replace(/^http:\/\//, 'https://');
      return { url, title };
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
// Each panel independently reschedules itself. At each swap it picks either
// a video (if any loaded) or an image, weighted by videoWeight. Videos can
// repeat across panels — GPU uploads each video frame only once regardless.
function startSwapping(materials, images, videoPool) {
  const { minDelayMs, maxDelayMs, videoWeight } = CONFIG.swap;

  function pickTexture() {
    if (videoPool.length > 0 && Math.random() < videoWeight) {
      return videoPool[Math.floor(Math.random() * videoPool.length)];
    }
    return images[Math.floor(Math.random() * images.length)];
  }

  function scheduleSwap(mat) {
    const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    setTimeout(() => {
      mat.map = pickTexture();
      mat.needsUpdate = true;
      scheduleSwap(mat);
    }, delay);
  }

  materials.forEach((mat) => {
    setTimeout(() => scheduleSwap(mat), Math.random() * maxDelayMs);
  });
}

// =============================================================
// LOCAL FALLBACK
// =============================================================
function buildLocalVideoTextures() {
  status.total = CONFIG.videoPool.length;
  return CONFIG.videoPool.map((src, idx) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
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
    v.addEventListener('error', () => console.error(`Video ${idx} failed: ${src}`));
    v.play().catch(() => {});
    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  });
}

// =============================================================
// INPUT
// =============================================================
function setupMouseFallback(input) {
  window.addEventListener('mousemove', (e) => {
    input.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    input.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
  });
}

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
  await new Promise((r) => webcamEl.addEventListener('loadeddata', r, { once: true }));

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
  } catch (e) {
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
        // Invert Y: when head goes UP (nose.y decreases in image coords),
        // we want input.y to go UP too. In image coords, y=0 is top, so
        // (nose.y - 0.5) gives "down is positive", which when passed to
        // parallax makes camera move DOWN when head moves UP. We want
        // the opposite: head up → tower/camera up.
        input.targetY = (nose.y - 0.5) * 2;
      }
    }
    requestAnimationFrame(poll);
  }
  poll();
}
