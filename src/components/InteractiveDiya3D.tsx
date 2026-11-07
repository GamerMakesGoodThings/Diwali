import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Flame, Sparkles, Camera, Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { sitarAudio } from '../utils/sitarAudio';

export type DiyaMaterialFinish = 'terracotta' | 'temple-brass' | 'royal-ruby';
export type CameraPresetId = 'isometric' | 'flame-closeup' | 'top-mandala';

interface InteractiveDiya3DProps {
  isLit: boolean;
  onLightDiya?: () => void;
  onToggleLit?: (nextLit: boolean) => void;
  palette?: string[];
  recipientName?: string;
  stageAlign?: 'right' | 'left' | 'center';
  heightClass?: string;
  initialFinish?: DiyaMaterialFinish;
}

// Pre-allocated scratch math objects outside render loop (Zero GC in rAF)
const _scratchVec3 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _scratchColor = new THREE.Color();

/**
 * Generates a tileable procedural CanvasTexture bump & roughness map for clay and hammered brass.
 */
function createProceduralSurfaceBumpMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    // Fine wheel-thrown clay rings + organic mineral grain
    for (let y = 0; y < 256; y += 2) {
      const wave = Math.floor(120 + Math.sin(y * 0.25) * 18);
      ctx.fillStyle = `rgb(${wave},${wave},${wave})`;
      ctx.fillRect(0, y, 256, 2);
    }
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = Math.floor(100 + Math.random() * 55);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

/**
 * Generates a colorful radial Rangoli decal texture for the altar platter beneath the 3D diya.
 */
function createAltarRangoliTexture(
  palette: string[],
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256;
  const cy = 256;

  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);

    // Outer lotus mandala rings
    const colors =
      palette.length >= 4
        ? palette
        : ['#F59E0B', '#E11D48', '#4F46E5', '#10B981', '#FBBF24'];

    // Soft golden base disc
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 248);
    grad.addColorStop(0, '#FFF8E7');
    grad.addColorStop(0.55, '#FDE68A');
    grad.addColorStop(0.88, '#F59E0B');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 248, 0, Math.PI * 2);
    ctx.fill();

    // 12-Fold Kaleidoscope Lotus Petals
    const petals = 12;
    for (let i = 0; i < petals; i++) {
      const angle = (i * Math.PI * 2) / petals;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(0, -45);
      ctx.quadraticCurveTo(48, -135, 0, -225);
      ctx.quadraticCurveTo(-48, -135, 0, -45);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFBEB';
      ctx.stroke();

      // Inner jewel dot
      ctx.beginPath();
      ctx.arc(0, -145, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFBEB';
      ctx.fill();

      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a soft radial contact shadow texture.
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    g.addColorStop(0, 'rgba(30, 15, 5, 0.65)');
    g.addColorStop(0.55, 'rgba(30, 15, 5, 0.25)');
    g.addColorStop(1, 'rgba(30, 15, 5, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

export const InteractiveDiya3D: React.FC<InteractiveDiya3DProps> = ({
  isLit,
  onLightDiya,
  onToggleLit,
  palette = ['#F59E0B', '#E11D48', '#4F46E5', '#10B981', '#FBBF24'],
  recipientName = 'Friend',
  stageAlign = 'right',
  initialFinish = 'terracotta',
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // UI HUD states
  const [finish, setFinish] = useState<DiyaMaterialFinish>(initialFinish);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('isometric');
  const [flameBrilliance] = useState<number>(1.25);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [surgeCount, setSurgeCount] = useState<number>(0);

  // Refs synced into the persistent WebGL animation loop without tearing down the canvas
  const isLitRef = useRef<boolean>(isLit);
  const finishRef = useRef<DiyaMaterialFinish>(finish);
  const flameBrillianceRef = useRef<number>(flameBrilliance);
  const stageAlignRef = useRef<'right' | 'left' | 'center'>(stageAlign);
  const cameraPresetRef = useRef<CameraPresetId>(cameraPreset);
  const activeCameraTransitionRef = useRef<boolean>(false);
  const flameSurgeBoostRef = useRef<number>(0);
  const onLightDiyaRef = useRef(onLightDiya);
  const onToggleLitRef = useRef(onToggleLit);

  useEffect(() => {
    isLitRef.current = isLit;
    if (isLit) {
      flameSurgeBoostRef.current = 1.0;
    }
  }, [isLit]);

  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  useEffect(() => {
    stageAlignRef.current = stageAlign;
  }, [stageAlign]);

  useEffect(() => {
    onLightDiyaRef.current = onLightDiya;
    onToggleLitRef.current = onToggleLit;
  }, [onLightDiya, onToggleLit]);

  const handleSelectCameraPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    cameraPresetRef.current = preset;
    activeCameraTransitionRef.current = true;
  };

  const handleTriggerSparkSurge = () => {
    flameSurgeBoostRef.current = 1.35;
    setSurgeCount((c) => c + 1);
    if (!isLitRef.current) {
      onLightDiyaRef.current?.();
      onToggleLitRef.current?.(true);
    } else {
      sitarAudio.playFireworkBurst();
    }
  };

  // Keyboard shortcut 'H' to toggle collapsible bottom dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setIsDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Mount WebGLRenderer & 10-part procedural 3D Diya scene ONCE
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL probe (Three.js skill Section 2.1)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 1280;
    const height = container.clientHeight || 680;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene & Studio RoomEnvironment (Transparent background so it spans the whole section seamlessly)
    const scene = new THREE.Scene();
    scene.background = null;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls with Frustum Offset for Full-Bleed Background Framing
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 2.85, 5.6);
    camera.lookAt(0, 0.85, 0.15);

    const applyStageFrustumOffset = (w: number, h: number, align: 'right' | 'left' | 'center') => {
      camera.aspect = w / h;
      if (w >= 960 && align !== 'center') {
        const offsetX = align === 'right' ? -Math.round(w * 0.21) : Math.round(w * 0.21);
        camera.setViewOffset(w, h, offsetX, 0, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    applyStageFrustumOffset(width, height, stageAlignRef.current);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enableZoom = false; // Allow page scrolling while dragging to orbit 360°
    controls.minDistance = 2.6;
    controls.maxDistance = 8.5;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minPolarAngle = 0.15;
    controls.target.set(0, 0.85, 0.15);

    const onControlStart = () => {
      activeCameraTransitionRef.current = false;
    };
    controls.addEventListener('start', onControlStart);

    // 4. Balanced 3-Point Studio & Festival Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xfff1c9, 0x4c1d95, 1.1);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe8b3, 1.75);
    keyLight.position.set(3.8, 6.2, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const d = 3.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 18;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 1.05);
    rimLight.position.set(-4.0, 3.5, -3.5);
    scene.add(rimLight);

    // Dynamic Flame PointLight positioned above the diya spout
    const flameLight = new THREE.PointLight(0xffa726, isLitRef.current ? 4.2 : 0.3, 10, 1.5);
    flameLight.position.set(0, 1.68, 1.05);
    scene.add(flameLight);

    // 5. Procedural Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const bumpTex = createProceduralSurfaceBumpMap();
    const rangoliTex = createAltarRangoliTexture(palette, maxAniso);
    const shadowTex = createContactShadowTexture();

    // 6. Composite 10-Part Procedural 3D Diya & Ritual Altar Assembly (THREE.Group)
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Part 1: Carved Sandstone & Marble Festival Altar Plinth (sits at y = -0.15..0)
    const plinthGeo = new THREE.CylinderGeometry(3.3, 3.6, 0.16, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0xfff3db,
      roughness: 0.62,
      metalness: 0.08,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.position.y = -0.08;
    plinthMesh.receiveShadow = true;
    rootGroup.add(plinthMesh);

    // Part 2: Colorful Mandala Rangoli Decal Disc on the Altar (offset y = 0.012 to prevent Z-fighting)
    const rangoliDiscGeo = new THREE.CircleGeometry(2.95, 64);
    rangoliDiscGeo.rotateX(-Math.PI / 2);
    const rangoliDiscMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: rangoliTex,
      transparent: true,
      roughness: 0.55,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rangoliDisc = new THREE.Mesh(rangoliDiscGeo, rangoliDiscMat);
    rangoliDisc.position.y = 0.012;
    rangoliDisc.receiveShadow = true;
    rootGroup.add(rangoliDisc);

    // Part 3: Soft Radial Contact Shadow Disc (y = 0.02, depthWrite: false)
    const contactGeo = new THREE.CircleGeometry(1.95, 32);
    contactGeo.rotateX(-Math.PI / 2);
    const contactMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const contactMesh = new THREE.Mesh(contactGeo, contactMat);
    contactMesh.position.y = 0.02;
    rootGroup.add(contactMesh);

    // Part 4: Hammered Temple Brass Pedestal Base (LatheGeometry, flush at y = 0)
    const pedestalPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.88, 0),
      new THREE.Vector2(0.82, 0.08),
      new THREE.Vector2(0.55, 0.18),
      new THREE.Vector2(0.46, 0.34),
      new THREE.Vector2(0.68, 0.44),
      new THREE.Vector2(0, 0.44),
    ];
    const pedestalGeo = new THREE.LatheGeometry(pedestalPoints, 40);
    const brassPedestalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.24,
      metalness: 0.88,
      bumpMap: bumpTex,
      bumpScale: 0.012,
    });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, brassPedestalMat);
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    rootGroup.add(pedestalMesh);

    // Part 5: Scalloped Lotus Petal Collar around the Diya Base (InstancedMesh of 16 beveled petals)
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.quadraticCurveTo(0.16, 0.22, 0, 0.48);
    petalShape.quadraticCurveTo(-0.16, 0.22, 0, 0);
    const petalGeo = new THREE.ExtrudeGeometry(petalShape, {
      steps: 1,
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    petalGeo.rotateX(Math.PI / 2.5);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.32,
      metalness: 0.78,
    });
    const petalCount = 16;
    const petalInstanced = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
    for (let i = 0; i < petalCount; i++) {
      const ang = (i * Math.PI * 2) / petalCount;
      _dummyObj.position.set(Math.sin(ang) * 0.65, 0.36, Math.cos(ang) * 0.65);
      _dummyObj.rotation.set(0, ang, 0);
      _dummyObj.scale.setScalar(1);
      _dummyObj.updateMatrix();
      petalInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    petalInstanced.instanceMatrix.needsUpdate = true;
    petalInstanced.computeBoundingSphere();
    rootGroup.add(petalInstanced);

    // Part 6: Primary Hero Silhouette — Hand-Spun Diya Vessel with Sculpted Spout Beak (LatheGeometry + Vertex Displacement)
    const bowlLathePts = [
      new THREE.Vector2(0, 0.42),
      new THREE.Vector2(0.58, 0.44),
      new THREE.Vector2(1.05, 0.62),
      new THREE.Vector2(1.26, 0.92),
      new THREE.Vector2(1.32, 1.12),
      new THREE.Vector2(1.18, 1.15),
      new THREE.Vector2(1.02, 0.92),
      new THREE.Vector2(0.68, 0.64),
      new THREE.Vector2(0, 0.56),
    ];
    const bowlGeo = new THREE.LatheGeometry(bowlLathePts, 64);
    // Elongate the front (+Z) lip into an authentic traditional pinched diya spout (jyoti-mukha)
    const posAttr = bowlGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      if (vz > 0.25 && vy > 0.55) {
        const forwardFactor = Math.max(0, vz / 1.32);
        const pinch = Math.exp(-vx * vx * 3.8) * Math.pow(forwardFactor, 1.5);
        posAttr.setZ(i, vz + pinch * 0.44);
        posAttr.setY(i, vy + pinch * 0.06);
        posAttr.setX(i, vx * (1 - pinch * 0.32));
      }
    }
    bowlGeo.computeVertexNormals();

    const vesselMat = new THREE.MeshPhysicalMaterial({
      color: 0xc84b28,
      roughness: 0.68,
      metalness: 0.08,
      clearcoat: 0.15,
      bumpMap: bumpTex,
      bumpScale: 0.022,
    });
    const vesselMesh = new THREE.Mesh(bowlGeo, vesselMat);
    vesselMesh.castShadow = true;
    vesselMesh.receiveShadow = true;
    rootGroup.add(vesselMesh);

    // Part 7: Decorative Repoussé Gold Beaded Rim along the Diya Lip (InstancedMesh of 28 beads)
    const beadGeo = new THREE.SphereGeometry(0.042, 12, 12);
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      roughness: 0.18,
      metalness: 0.94,
    });
    const beadCount = 28;
    const beadInstanced = new THREE.InstancedMesh(beadGeo, beadMat, beadCount);
    for (let i = 0; i < beadCount; i++) {
      const ang = (i * Math.PI * 2) / beadCount;
      const vx = Math.sin(ang) * 1.25;
      let vz = Math.cos(ang) * 1.25;
      let vy = 1.14;
      let rx = vx;
      if (vz > 0.25) {
        const forwardFactor = Math.max(0, vz / 1.25);
        const pinch = Math.exp(-vx * vx * 3.8) * Math.pow(forwardFactor, 1.5);
        vz += pinch * 0.44;
        vy += pinch * 0.06;
        rx = vx * (1 - pinch * 0.32);
      }
      _dummyObj.position.set(rx, vy, vz);
      _dummyObj.scale.setScalar(1);
      _dummyObj.updateMatrix();
      beadInstanced.setMatrixAt(i, _dummyObj.matrix);
    }
    beadInstanced.instanceMatrix.needsUpdate = true;
    beadInstanced.computeBoundingSphere();
    rootGroup.add(beadInstanced);

    // Part 8: Golden Ghee Pool Inside the Diya Bowl
    const gheeGeo = new THREE.CylinderGeometry(1.06, 0.72, 0.08, 48);
    const gheeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const gheeMesh = new THREE.Mesh(gheeGeo, gheeMat);
    gheeMesh.position.set(0, 0.88, 0.05);
    rootGroup.add(gheeMesh);

    // Part 9: Braided Cotton Wick (TubeGeometry along a curved path resting in the beak spout)
    const wickCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.82, 0.35),
      new THREE.Vector3(0, 0.96, 0.85),
      new THREE.Vector3(0, 1.15, 1.32),
      new THREE.Vector3(0, 1.28, 1.48),
    ]);
    const wickGeo = new THREE.TubeGeometry(wickCurve, 24, 0.048, 12, false);
    const wickMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.88,
      metalness: 0.0,
      emissive: new THREE.Color(0xff6f00),
      emissiveIntensity: isLitRef.current ? 0.65 : 0.15,
    });
    const wickMesh = new THREE.Mesh(wickGeo, wickMat);
    rootGroup.add(wickMesh);

    // Part 10: Multi-Layer 3D Flame Assembly + Festive Marigold Flower Garland Ring
    const flameGroup = new THREE.Group();
    flameGroup.position.set(0, 1.28, 1.48);
    rootGroup.add(flameGroup);

    const flameLathePts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.12, 0.08),
      new THREE.Vector2(0.16, 0.22),
      new THREE.Vector2(0.11, 0.42),
      new THREE.Vector2(0.04, 0.58),
      new THREE.Vector2(0, 0.68),
    ];
    const outerFlameGeo = new THREE.LatheGeometry(flameLathePts, 28);
    const outerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff7b00,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });
    const outerFlameMesh = new THREE.Mesh(outerFlameGeo, outerFlameMat);
    outerFlameMesh.renderOrder = 10;
    flameGroup.add(outerFlameMesh);

    const innerFlameGeo = outerFlameGeo.clone();
    innerFlameGeo.scale(0.62, 0.72, 0.62);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xfff9c4,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    });
    const innerFlameMesh = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    innerFlameMesh.position.y = 0.03;
    innerFlameMesh.renderOrder = 11;
    flameGroup.add(innerFlameMesh);

    const haloGeo = new THREE.SphereGeometry(0.44, 20, 20);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffb300,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.y = 0.28;
    haloMesh.renderOrder = 12;
    flameGroup.add(haloMesh);

    // Unlit Hovering Spark Orb above Wick (guides user to click/tap the wick to ignite)
    const sparkOrbGeo = new THREE.OctahedronGeometry(0.12, 1);
    const sparkOrbMat = new THREE.MeshBasicMaterial({
      color: 0xffe082,
    });
    const sparkOrbMesh = new THREE.Mesh(sparkOrbGeo, sparkOrbMat);
    sparkOrbMesh.position.set(0, 1.72, 1.48);
    rootGroup.add(sparkOrbMesh);

    // Festive Marigold Flower Garland encircling the altar (InstancedMesh of 24 blossoms, per-instance scale ±15% & tint)
    const marigoldGeo = new THREE.DodecahedronGeometry(0.18, 1);
    const marigoldMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.02,
    });
    const marigoldCount = 24;
    const marigoldInstanced = new THREE.InstancedMesh(marigoldGeo, marigoldMat, marigoldCount);
    const garlandColors = [0xf59e0b, 0xff7043, 0xfbbf24, 0xe11d48];
    for (let i = 0; i < marigoldCount; i++) {
      const ang = (i * Math.PI * 2) / marigoldCount;
      const radius = 2.28 + (i % 2 === 0 ? 0.06 : -0.05);
      const scaleVar = 0.88 + ((i * 7) % 5) * 0.06; // ±15% scale variation
      _dummyObj.position.set(Math.sin(ang) * radius, 0.14 * scaleVar, Math.cos(ang) * radius);
      _dummyObj.rotation.set(i * 0.4, ang, i * 0.2);
      _dummyObj.scale.set(scaleVar * 1.15, scaleVar * 0.78, scaleVar * 1.15);
      _dummyObj.updateMatrix();
      marigoldInstanced.setMatrixAt(i, _dummyObj.matrix);
      _scratchColor.setHex(garlandColors[i % garlandColors.length]);
      marigoldInstanced.setColorAt(i, _scratchColor);
    }
    marigoldInstanced.instanceMatrix.needsUpdate = true;
    if (marigoldInstanced.instanceColor) marigoldInstanced.instanceColor.needsUpdate = true;
    marigoldInstanced.computeBoundingSphere();
    rootGroup.add(marigoldInstanced);

    // Rising Golden Spark Embers (InstancedMesh of 36 particles)
    const emberCount = 36;
    const emberGeo = new THREE.SphereGeometry(0.028, 8, 8);
    const emberMat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      transparent: true,
      opacity: 0.92,
    });
    const emberInstanced = new THREE.InstancedMesh(emberGeo, emberMat, emberCount);
    emberInstanced.frustumCulled = false;
    rootGroup.add(emberInstanced);

    const emberStates = Array.from({ length: emberCount }, (_, idx) => ({
      x: (Math.random() - 0.5) * 0.5,
      y: 1.3 + (idx / emberCount) * 1.8,
      z: 1.48 + (Math.random() - 0.5) * 0.5,
      vy: 0.55 + Math.random() * 0.75,
      phase: Math.random() * Math.PI * 2,
    }));

    // Simplified invisible collision proxy sphere for fast Raycasting
    const hitProxyGeo = new THREE.SphereGeometry(1.55, 12, 12);
    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitProxyMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxyMesh.position.set(0, 1.0, 0.4);
    rootGroup.add(hitProxyMesh);
    const interactables: THREE.Object3D[] = [hitProxyMesh];

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. Raycasting Interaction (Click Diya to Ignite or Stoke Flame Surge)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 8) return; // User was orbiting camera, not clicking

      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactables, false);
      if (hits.length > 0) {
        flameSurgeBoostRef.current = 1.4;
        if (!isLitRef.current) {
          onLightDiyaRef.current?.();
          onToggleLitRef.current?.(true);
        } else {
          sitarAudio.playFireworkBurst();
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // 8. Animation Loop with Software-WebGL afterDraw Pacing
    let frameId = 0;
    let isDisposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (sync && state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function applyMaterialFinish(currentFinish: DiyaMaterialFinish) {
      if (currentFinish === 'temple-brass') {
        vesselMat.color.setHex(0xf59e0b);
        vesselMat.roughness = 0.22;
        vesselMat.metalness = 0.92;
        vesselMat.clearcoat = 0.35;
      } else if (currentFinish === 'royal-ruby') {
        vesselMat.color.setHex(0xbe123c);
        vesselMat.roughness = 0.26;
        vesselMat.metalness = 0.25;
        vesselMat.clearcoat = 0.9;
      } else {
        vesselMat.color.setHex(0xc84b28);
        vesselMat.roughness = 0.68;
        vesselMat.metalness = 0.08;
        vesselMat.clearcoat = 0.15;
      }
    }

    let lastAppliedFinish: DiyaMaterialFinish = finishRef.current;
    let lastAppliedAlign: 'right' | 'left' | 'center' = stageAlignRef.current;
    applyMaterialFinish(lastAppliedFinish);

    function tick() {
      if (isDisposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Sync material finish if changed
      if (finishRef.current !== lastAppliedFinish) {
        lastAppliedFinish = finishRef.current;
        applyMaterialFinish(lastAppliedFinish);
      }

      // Sync stage alignment frustum offset if changed
      if (stageAlignRef.current !== lastAppliedAlign) {
        lastAppliedAlign = stageAlignRef.current;
        const w = container?.clientWidth || 1280;
        const h = container?.clientHeight || 680;
        applyStageFrustumOffset(w, h, lastAppliedAlign);
      }

      // Smooth exponential camera preset transitions
      if (activeCameraTransitionRef.current) {
        const preset = cameraPresetRef.current;
        if (preset === 'flame-closeup') {
          _targetCamPos.set(1.4, 2.05, 3.25);
          _targetLookAt.set(0, 1.25, 1.15);
        } else if (preset === 'top-mandala') {
          _targetCamPos.set(0, 5.8, 1.2);
          _targetLookAt.set(0, 0.4, 0.1);
        } else {
          _targetCamPos.set(0, 2.85, 5.6);
          _targetLookAt.set(0, 0.85, 0.15);
        }
        const alpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(_targetCamPos, alpha);
        controls.target.lerp(_targetLookAt, alpha);
        if (camera.position.distanceToSquared(_targetCamPos) < 0.002) {
          activeCameraTransitionRef.current = false;
        }
      }

      // Decay flame surge boost
      if (flameSurgeBoostRef.current > 0) {
        flameSurgeBoostRef.current = Math.max(0, flameSurgeBoostRef.current - dt * 0.9);
      }

      const lit = isLitRef.current;
      const brilliance = flameBrillianceRef.current + flameSurgeBoostRef.current * 0.85;

      flameGroup.visible = lit;
      sparkOrbMesh.visible = !lit;

      if (lit) {
        // Organic 3D flame dance
        const flickerX = Math.sin(elapsed * 11.3) * 0.04 + Math.cos(elapsed * 17.1) * 0.02;
        const flickerZ = Math.cos(elapsed * 9.7) * 0.03;
        const scaleY = (0.95 + Math.sin(elapsed * 14.5) * 0.09) * brilliance;
        const scaleXZ = (0.96 + Math.cos(elapsed * 12.2) * 0.05) * Math.sqrt(brilliance);

        flameGroup.rotation.set(flickerZ, 0, flickerX);
        flameGroup.scale.set(scaleXZ, scaleY, scaleXZ);

        flameLight.intensity = (3.6 + Math.sin(elapsed * 15.0) * 0.45) * brilliance;
        wickMat.emissiveIntensity = 0.75;
      } else {
        // Bobbing golden spark orb inviting the user to click/tap
        sparkOrbMesh.position.y = 1.65 + Math.sin(elapsed * 3.5) * 0.12;
        sparkOrbMesh.rotation.y = elapsed * 2.2;
        flameLight.intensity = 0.25 + Math.sin(elapsed * 4.0) * 0.08;
        wickMat.emissiveIntensity = 0.18;
      }

      // Update rising golden ember particles
      for (let i = 0; i < emberCount; i++) {
        const st = emberStates[i];
        if (lit) {
          st.y += st.vy * dt * (1 + flameSurgeBoostRef.current);
          if (st.y > 3.2) {
            st.y = 1.32;
            st.x = (Math.random() - 0.5) * (0.28 + flameSurgeBoostRef.current * 0.45);
            st.z = 1.48 + (Math.random() - 0.5) * (0.28 + flameSurgeBoostRef.current * 0.45);
          }
          const heightNorm = Math.max(0, Math.min(1, (st.y - 1.32) / 1.88));
          const s = (1 - heightNorm) * (1 + flameSurgeBoostRef.current * 0.5);
          _dummyObj.position.set(
            st.x + Math.sin(elapsed * 3 + st.phase) * 0.08,
            st.y,
            st.z + Math.cos(elapsed * 3 + st.phase) * 0.08
          );
          _dummyObj.scale.setScalar(Math.max(0.01, s));
        } else {
          _dummyObj.position.set(0, -10, 0);
          _dummyObj.scale.setScalar(0.001);
        }
        _dummyObj.updateMatrix();
        emberInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      emberInstanced.instanceMatrix.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    // 9. Responsive Resize Handler
    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || 1280;
      const h = container.clientHeight || 680;
      applyStageFrustumOffset(w, h, stageAlignRef.current);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlStart);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden select-none">
      {/* Dedicated Full-Bleed WebGL Mount Container (Zero sibling React nodes inside, no pop-out border) */}
      <div
        ref={canvasMountRef}
        data-testid="interactive-diya-3d-canvas"
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Unified Collapsible Bottom Control Dock (Anchored to the 3D Diya side of the full-bleed background) */}
      <div
        className={`absolute bottom-3 z-20 flex flex-col items-center max-w-[560px] transition-transform duration-300 ${
          stageAlign === 'left'
            ? 'left-4 sm:left-8 right-4 sm:right-auto'
            : 'right-4 sm:right-8 left-4 sm:left-auto'
        }`}
        style={{
          transform: isDockCollapsed ? 'translateY(calc(100% - 26px))' : 'translateY(0)',
        }}
      >
        {/* Collapse / Expand Tab */}
        <button
          type="button"
          onClick={() => setIsDockCollapsed((v) => !v)}
          className="px-3 py-1 text-[11px] font-medium text-amber-100 bg-[#231123] hover:bg-[#311831] border border-amber-400/30 border-b-0 rounded-t-lg flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="w-3 h-3 text-amber-300" />
              <span>Show 3D Diya Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 text-amber-300" />
              <span>Hide Controls (H)</span>
            </>
          )}
        </button>

        {/* Main Horizontal Control Bar (No CSS backdrop-filter over WebGL) */}
        <div className="w-full px-3 py-2 rounded-xl bg-[#1E0E1F] border border-amber-400/35 shadow-2xl flex flex-wrap items-center justify-center sm:justify-between gap-2">
          {/* Ignite / Stoke Action */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!isLit) {
                  onLightDiya?.();
                  onToggleLit?.(true);
                } else {
                  handleTriggerSparkSurge();
                }
              }}
              className="px-3 py-1.5 text-xs font-semibold text-[#1A0D06] bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#FDE047] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isLit ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Stoke Flame {surgeCount > 0 ? `(${surgeCount})` : ''}</span>
                </>
              ) : (
                <>
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Light 3D Diya</span>
                </>
              )}
            </button>

            {isLit && onToggleLit && (
              <button
                type="button"
                onClick={() => onToggleLit(false)}
                className="px-2 py-1.5 text-[11px] font-medium text-amber-100 bg-[#2E1630] hover:bg-[#3D1E40] border border-amber-400/25 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Unlight
              </button>
            )}
          </div>

          {/* Vessel Material Finish Switcher */}
          <div className="flex items-center gap-1">
            <Palette className="w-3.5 h-3.5 text-amber-300 shrink-0 hidden sm:block" />
            <div
              role="group"
              aria-label="3D Diya Material Finish"
              className="flex items-center gap-0.5 p-0.5 bg-[#120813] rounded-lg border border-white/10"
            >
              {(
                [
                  { id: 'terracotta', label: 'Terracotta' },
                  { id: 'temple-brass', label: 'Brass' },
                  { id: 'royal-ruby', label: 'Ruby' },
                ] as { id: DiyaMaterialFinish; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFinish(item.id)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    finish === item.id
                      ? 'bg-amber-400 text-[#1A0D06] font-semibold'
                      : 'text-amber-100/80 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Angle Presets */}
          <div className="flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-amber-300 shrink-0 hidden sm:block" />
            <div
              role="group"
              aria-label="3D Camera View Presets"
              className="flex items-center gap-0.5 p-0.5 bg-[#120813] rounded-lg border border-white/10"
            >
              {(
                [
                  { id: 'isometric', label: 'Altar' },
                  { id: 'flame-closeup', label: 'Flame' },
                  { id: 'top-mandala', label: 'Top' },
                ] as { id: CameraPresetId; label: string }[]
              ).map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => handleSelectCameraPreset(cam.id)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    cameraPreset === cam.id
                      ? 'bg-rose-500 text-white font-semibold'
                      : 'text-amber-100/80 hover:text-white'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
