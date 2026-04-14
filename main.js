import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// ---------- CONFIG ----------
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
    parallaxX: 2.8,
    parallaxY: 1.6,
    smoothing: 0.09,
  },
  videoPool: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  ],
};

// ---------- STATUS HUD ----------
const statusEl = document.getElementById('status');
const status = {
  videos: 0,
  total: CONFIG.videoPool.length,
  tracking: 'off',
  error: '',
  render() {
    const parts = [`videos ${this.videos}/${this.total}`, `tracking ${this.tracking}`];
    if (this.error) parts.push(`err: ${this.error}`);
    statusEl.textContent = parts.join('  ·  ');
  },
};
status.render();

// ---------- WIRE BUTTON IMMEDIATELY ----------
// Attach listener synchronously at top of module. If anything below throws,
// the button still responds and we surface the error on-screen.
const overlay = document.getElementById('overlay');
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

// ---------- MAIN ----------
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
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1, 100
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

  // ---------- VIDEO POOL ----------
  const videoTextures = CONFIG.videoPool.map((src, idx) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';   // MUST be set before src
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = src;

    v.addEventListener('loadeddata', () => {
      v.currentTime = Math.random() * Math.max(0, v.duration - 1);
      status.videos++;
      status.render();
    });
    v.addEventListener('error', () => {
      console.error(`Video ${idx} failed: ${src}`);
    });

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { video: v, texture: tex };
  });

  videoTextures.forEach(({ video }) => {
    video.play().catch((err) => console.warn('Autoplay blocked:', err));
  });

  // ---------- TOWER ----------
  const tower = new THREE.Group();
  scene.add(tower);

  const slabs = [];
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
      const poolIdx = (i * 3 + fIdx * 5) % videoTextures.length;
      const mat = new THREE.MeshBasicMaterial({
        color: 0x222222,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(faceGeom, mat);
      mesh.scale.set(f.w, CONFIG.slabHeight, 1);
      mesh.position.set(Math.sin(f.rotY) * f.d, 0, Math.cos(f.rotY) * f.d);
      mesh.rotation.y = f.rotY;
      slab.add(mesh);

      const { video, texture } = videoTextures[poolIdx];
      const attach = () => {
        mat.map = texture;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
      };
      if (video.readyState >= 2) attach();
      else video.addEventListener('loadeddata', attach, { once: true });
    });

    tower.add(slab);
    slabs.push(slab);
  }

  // ---------- ANIMATION (starts immediately) ----------
  const rot = CONFIG.rotation;
  const k = (Math.PI * 2) / rot.waveLength;
  const clock = new THREE.Clock();
  const head = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function animate() {
    const t = clock.getElapsedTime();
    const tMs = performance.now();

    pollHead(tMs);

    head.x += (head.targetX - head.x) * CONFIG.camera.smoothing;
    head.y += (head.targetY - head.y) * CONFIG.camera.smoothing;

    camera.position.x = head.x * CONFIG.camera.parallaxX;
    camera.position.y = head.y * CONFIG.camera.parallaxY;
    camera.position.z = CONFIG.camera.distance;
    camera.lookAt(0, 0, 0);

    const baseRot = rot.baseSpeed * t;
    for (let i = 0; i < slabs.length; i++) {
      const wave = rot.waveAmplitude * Math.sin(k * i - rot.waveSpeed * t);
      slabs[i].rotation.y = baseRot + wave;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // ---------- HEAD TRACKING (dynamic import — failure is non-fatal) ----------
  const webcamEl = document.getElementById('webcam');
  let faceLandmarker = null;
  let tracking = false;

  function pollHead(tMs) {
    if (!tracking || !faceLandmarker || webcamEl.readyState < 2) return;
    const result = faceLandmarker.detectForVideo(webcamEl, tMs);
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const nose = result.faceLandmarks[0][1];
      head.targetX = (0.5 - nose.x) * 2;
      head.targetY = (0.5 - nose.y) * 2;
    }
  }

  try {
    const MP = '0.10.32';
    const { FaceLandmarker, FilesetResolver } = await import(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/vision_bundle.mjs`
    );
    const resolver = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP}/wasm`
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    webcamEl.srcObject = stream;
    await new Promise((r) => webcamEl.addEventListener('loadeddata', r, { once: true }));
    tracking = true;
    status.tracking = 'on';
    status.render();
  } catch (e) {
    console.warn('Head tracking unavailable:', e);
    status.tracking = 'unavailable';
    status.render();
  }
}
