import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { FinishId, FitMode, SceneId } from "@/lib/render-mockup";

export type PhonePose = {
  yaw: number;
  pitch: number;
  closeness: number;
  fov: number;
};

export const DEFAULT_POSE: PhonePose = { yaw: 32, pitch: 18, closeness: 0.42, fov: 30 };

export type PhoneCutout = "isla" | "perla" | "clasico" | "nada";

export type PhoneSpec = {
  id: string;
  w: number;
  h: number;
  t: number;
  r: number;
  bezel: number;
  chin: number;
  cutout: PhoneCutout;
  fold: boolean;
  lenses: number;
};

export const PHONE_SPECS: Record<string, PhoneSpec> = {
  isla: { id: "isla", w: 0.74, h: 1.56, t: 0.084, r: 0.13, bezel: 0.02, chin: 0.02, cutout: "isla", fold: false, lenses: 2 },
  perla: { id: "perla", w: 0.76, h: 1.58, t: 0.09, r: 0.1, bezel: 0.032, chin: 0.034, cutout: "perla", fold: false, lenses: 3 },
  clasico: { id: "clasico", w: 0.75, h: 1.5, t: 0.098, r: 0.07, bezel: 0.046, chin: 0.13, cutout: "clasico", fold: false, lenses: 1 },
  compacto: { id: "compacto", w: 0.67, h: 1.36, t: 0.086, r: 0.12, bezel: 0.02, chin: 0.02, cutout: "isla", fold: false, lenses: 1 },
  pliegue: { id: "pliegue", w: 1.2, h: 1.4, t: 0.072, r: 0.055, bezel: 0.018, chin: 0.018, cutout: "nada", fold: true, lenses: 2 },
  paisaje: { id: "paisaje", w: 1.56, h: 0.74, t: 0.084, r: 0.13, bezel: 0.02, chin: 0.02, cutout: "isla", fold: false, lenses: 2 },
};

const BACKDROP: Record<SceneId, number> = {
  papel: 0xe6dfd3,
  estudio: 0xd5cec1,
  tinta: 0x141311,
  blanco: 0xf6f3ec,
};

const METAL: Record<FinishId, number> = {
  grafito: 0x2e2c29,
  plata: 0xd9d4cb,
  arena: 0xc9a27a,
};

type ArtInput = {
  image: HTMLImageElement | null;
  zoom: number;
  panX: number;
  panY: number;
  fit: FitMode;
  quiet?: boolean;
};

const geos = new Map<string, THREE.BufferGeometry>();

function roundedShape(w: number, h: number, r: number) {
  const radius = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001));
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + w - radius, y);
  shape.absarc(x + w - radius, y + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - radius);
  shape.absarc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(x + radius, y + h);
  shape.absarc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, (Math.PI * 3) / 2, false);
  return shape;
}

function plateGeometry(key: string, w: number, h: number, r: number, depth: number) {
  const id = `${key}:${w.toFixed(3)}:${h.toFixed(3)}:${r.toFixed(3)}:${depth.toFixed(3)}`;
  const cached = geos.get(id);
  if (cached) return cached;
  const geo = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.01, depth * 0.18),
    bevelSize: Math.min(0.01, depth * 0.16),
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (box) {
    geo.translate(
      -((box.max.x + box.min.x) / 2),
      -((box.max.y + box.min.y) / 2),
      -((box.max.z + box.min.z) / 2),
    );
  }
  geos.set(id, geo);
  return geo;
}

function faceGeometry(key: string, w: number, h: number, r: number) {
  const id = `face:${key}:${w.toFixed(3)}:${h.toFixed(3)}:${r.toFixed(3)}`;
  const cached = geos.get(id);
  if (cached) return cached;
  const geo = new THREE.ShapeGeometry(roundedShape(w, h, r), 8);
  geos.set(id, geo);
  return geo;
}

function brushTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    const band = 150 + Math.round(Math.sin(y * 0.85) * 18 + Math.random() * 22);
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const n = band + ((x * 13 + y * 3) % 11) - 5;
      image.data[i] = n;
      image.data[i + 1] = n;
      image.data[i + 2] = n;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 6);
  return texture;
}

let sharedBrush: THREE.CanvasTexture | null | undefined;

function metalMaterial(finish: FinishId) {
  if (sharedBrush === undefined) sharedBrush = brushTexture();
  const material = new THREE.MeshPhysicalMaterial({
    color: METAL[finish],
    metalness: 1,
    roughness: finish === "plata" ? 0.28 : 0.38,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1,
    roughnessMap: sharedBrush ?? null,
  });
  material.anisotropy = 0.65;
  return material;
}

function paintArt(canvas: HTMLCanvasElement, art: ArtInput) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#070706";
  ctx.fillRect(0, 0, width, height);
  const image = art.image;
  if (image && image.complete && image.naturalWidth > 0) {
    const base =
      art.fit === "contain"
        ? Math.min(width / image.naturalWidth, height / image.naturalHeight)
        : Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const scale = base * art.zoom;
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, (width - dw) / 2 + art.panX, (height - dh) / 2 + art.panY, dw, dh);
    return;
  }
  if (art.quiet) return;
  ctx.strokeStyle = "rgba(243,241,236,0.35)";
  ctx.setLineDash([12, 14]);
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.setLineDash([]);
  ctx.fillStyle = "#f3f1ec";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "560 54px Fraunces, Georgia, serif";
  ctx.fillText("Sube tu imagen", width / 2, height / 2 - 16);
  ctx.font = "400 28px Outfit, sans-serif";
  ctx.fillStyle = "#a39e96";
  ctx.fillText("JPG o PNG", width / 2, height / 2 + 36);
}

function shadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
  g.addColorStop(0, "rgba(20,18,16,0.45)");
  g.addColorStop(1, "rgba(20,18,16,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class PhoneView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly screenCanvas = document.createElement("canvas");
  private readonly screenTex: THREE.CanvasTexture;
  private phone = new THREE.Group();
  private shadow: THREE.Mesh | null = null;
  private spec: PhoneSpec = PHONE_SPECS.isla!;
  private finish: FinishId = "grafito";
  private sceneId: SceneId = "papel";
  private cut = false;
  private lastPose: PhonePose | null = null;
  private dragging = false;
  private settle = 0;
  private applying = false;
  private disposed = false;
  onPose: ((pose: PhonePose) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, live: boolean) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    this.renderer.setPixelRatio(live ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.7;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI - 0.12;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.screenCanvas.width = 900;
    this.screenCanvas.height = 1800;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.AmbientLight(0xfff8ef, 0.35));
    const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
    key.position.set(2.4, 3.2, 4);
    const fill = new THREE.DirectionalLight(0xd7e2ee, 0.7);
    fill.position.set(-3.2, 1.2, 2.2);
    const rim = new THREE.DirectionalLight(0xfff7ee, 1.6);
    rim.position.set(-1.6, 2.4, -3.2);
    this.scene.add(key, fill, rim);
    const shadowMap = shadowTexture();
    if (shadowMap) {
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      this.shadow = shadow;
      this.scene.add(shadow);
    }
    this.controls.addEventListener("change", () => {
      if (this.applying || !this.onPose) return;
      const pose = this.getPose();
      const prev = this.lastPose;
      if (
        prev &&
        Math.abs(prev.yaw - pose.yaw) < 0.5 &&
        Math.abs(prev.pitch - pose.pitch) < 0.5 &&
        Math.abs(prev.closeness - pose.closeness) < 0.012 &&
        Math.abs(prev.fov - pose.fov) < 0.5
      ) {
        return;
      }
      this.lastPose = pose;
      this.onPose(pose);
    });
    if (live) {
      const step = () => {
        if (this.disposed || (!this.dragging && this.settle <= 0)) return;
        this.render();
        if (!this.dragging) this.settle -= 1;
        requestAnimationFrame(step);
      };
      this.controls.addEventListener("start", () => {
        this.dragging = true;
        this.settle = 0;
        requestAnimationFrame(step);
      });
      this.controls.addEventListener("end", () => {
        this.dragging = false;
        this.settle = 28;
        requestAnimationFrame(step);
      });
    }
  }

  setSize(width: number, height: number) {
    if (width < 2 || height < 2) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setModel(id: string) {
    this.spec = PHONE_SPECS[id] ?? PHONE_SPECS.isla!;
    this.rebuild();
    const fit = Math.max(this.spec.w, this.spec.h);
    this.controls.minDistance = fit * 0.92;
    this.controls.maxDistance = fit * 3.35;
  }

  setFinish(finish: FinishId) {
    if (finish === this.finish && this.phone.children.length) return;
    this.finish = finish;
    this.rebuild();
  }

  setBackdrop(scene: SceneId, cut: boolean) {
    this.sceneId = scene;
    this.cut = cut;
    this.scene.background = cut ? null : new THREE.Color(BACKDROP[scene]);
    if (this.shadow) this.shadow.visible = !cut;
    this.renderer.setClearColor(0x000000, cut ? 0 : 1);
  }

  setOrbitEnabled(enabled: boolean) {
    this.controls.enabled = enabled;
    this.controls.enableZoom = enabled;
  }

  setArt(art: ArtInput) {
    const aspect = this.spec.w / this.spec.h;
    this.screenCanvas.width = 1200;
    this.screenCanvas.height = Math.max(400, Math.round(1200 / aspect));
    paintArt(this.screenCanvas, art);
    this.screenTex.needsUpdate = true;
  }

  getPose(): PhonePose {
    const fit = Math.max(this.spec.w, this.spec.h);
    const far = fit * 3.35;
    const near = fit * 0.92;
    const dist = this.camera.position.distanceTo(this.controls.target);
    let yaw = THREE.MathUtils.radToDeg(this.controls.getAzimuthalAngle());
    yaw = ((((yaw + 180) % 360) + 360) % 360) - 180;
    const pitch = 90 - THREE.MathUtils.radToDeg(this.controls.getPolarAngle());
    const closeness = THREE.MathUtils.clamp((far - dist) / (far - near), 0, 1);
    return {
      yaw,
      pitch,
      closeness,
      fov: this.camera.fov,
    };
  }

  applyPose(pose: PhonePose) {
    const fit = Math.max(this.spec.w, this.spec.h);
    const far = fit * 3.35;
    const near = fit * 0.92;
    this.controls.minDistance = near;
    this.controls.maxDistance = far;
    const dist = far + (near - far) * THREE.MathUtils.clamp(pose.closeness, 0, 1);
    const phi = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(90 - pose.pitch, 8, 172));
    const theta = THREE.MathUtils.degToRad(pose.yaw);
    this.applying = true;
    this.camera.fov = THREE.MathUtils.clamp(pose.fov, 16, 68);
    this.camera.updateProjectionMatrix();
    this.camera.position.setFromSphericalCoords(dist, phi, theta);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.lastPose = this.getPose();
    this.applying = false;
  }

  render() {
    if (this.disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  async capture(transparent: boolean) {
    const previousCut = this.cut;
    const previousBg = this.scene.background;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const aspect = size.x / Math.max(1, size.y);
    const long = 1800;
    const width = aspect >= 1 ? long : Math.round(long * aspect);
    const height = aspect >= 1 ? Math.round(long / aspect) : long;
    if (transparent) {
      this.scene.background = null;
      if (this.shadow) this.shadow.visible = false;
      this.renderer.setClearColor(0x000000, 0);
    }
    this.setSize(width, height);
    this.renderer.render(this.scene, this.camera);
    const blob = await new Promise<Blob | null>((resolve) => {
      this.renderer.domElement.toBlob((value) => resolve(value), "image/png");
    });
    this.scene.background = previousBg;
    this.cut = previousCut;
    if (this.shadow) this.shadow.visible = !previousCut;
    this.renderer.setClearColor(0x000000, previousCut ? 0 : 1);
    this.setSize(size.x, size.y);
    this.render();
    return blob;
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.screenTex.dispose();
    this.renderer.dispose();
  }

  private rebuild() {
    this.scene.remove(this.phone);
    this.disposeGroup(this.phone);
    this.phone = buildPhone(this.spec, this.finish, this.screenTex);
    this.scene.add(this.phone);
    if (this.shadow) {
      const fit = Math.max(this.spec.w, this.spec.h);
      this.shadow.scale.set(fit * 1.35, fit * 0.72, 1);
      this.shadow.position.set(0, -this.spec.h / 2 - 0.012, 0);
    }
  }

  private disposeGroup(group: THREE.Group) {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) mat?.dispose();
      let shared = false;
      for (const geo of geos.values()) {
        if (geo === mesh.geometry) shared = true;
      }
      if (!shared) mesh.geometry?.dispose();
    });
  }
}

function buildPhone(spec: PhoneSpec, finish: FinishId, screenTex: THREE.Texture) {
  const group = new THREE.Group();
  const metal = metalMaterial(finish);
  const body = new THREE.Mesh(plateGeometry("body", spec.w, spec.h, spec.r, spec.t), metal);
  group.add(body);

  const lip = 0.007;
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x070708,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.1,
  });
  const frontGlass = new THREE.Mesh(
    faceGeometry("front", spec.w - lip * 2, spec.h - lip * 2, Math.max(0.02, spec.r - lip)),
    glassMat,
  );
  frontGlass.position.z = spec.t / 2 + 0.001;
  group.add(frontGlass);

  const backMat = new THREE.MeshPhysicalMaterial({
    color: METAL[finish],
    metalness: 0.92,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1,
  });
  const back = new THREE.Mesh(
    faceGeometry("back", spec.w - lip * 2, spec.h - lip * 2, Math.max(0.02, spec.r - lip)),
    backMat,
  );
  back.position.z = -spec.t / 2 - 0.001;
  back.rotation.y = Math.PI;
  group.add(back);

  const screenW = spec.w - spec.bezel * 2;
  const screenH = spec.h - spec.bezel * 2 - spec.chin;
  const screenY = spec.chin / 2;
  const screen = new THREE.Mesh(
    faceGeometry("screen", screenW, screenH, Math.max(0.012, spec.r - spec.bezel)),
    new THREE.MeshBasicMaterial({ map: screenTex }),
  );
  screen.position.set(0, screenY, spec.t / 2 + 0.003);
  group.add(screen);

  const sheen = new THREE.Mesh(
    faceGeometry("sheen", screenW, screenH, Math.max(0.012, spec.r - spec.bezel)),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.04,
      transparent: true,
      opacity: 0.16,
      clearcoat: 1,
      depthWrite: false,
    }),
  );
  sheen.position.set(0, screenY, spec.t / 2 + 0.004);
  group.add(sheen);

  const zFront = spec.t / 2 + 0.008;
  if (spec.cutout === "isla") {
    const wide = !spec.fold && spec.w > spec.h;
    const island = new THREE.Mesh(
      faceGeometry(wide ? "island-v" : "island", wide ? 0.034 : 0.118, wide ? 0.118 : 0.034, 0.017),
      new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.35, metalness: 0.2 }),
    );
    island.position.set(wide ? -spec.w / 2 + spec.bezel + 0.05 : 0, wide ? 0 : spec.h / 2 - spec.bezel - 0.048, zFront);
    group.add(island);
    const lens = lensMesh(0.007);
    lens.position.copy(island.position);
    lens.position.z += 0.002;
    if (wide) lens.position.y += 0.03;
    else lens.position.x += 0.034;
    group.add(lens);
  } else if (spec.cutout === "perla") {
    const dot = lensMesh(0.009);
    dot.position.set(0, spec.h / 2 - spec.bezel - 0.04, zFront);
    group.add(dot);
  } else if (spec.cutout === "clasico") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0024, 10, 28), metal);
    ring.position.set(0, -spec.h / 2 + spec.chin * 0.46, zFront);
    group.add(ring);
  }

  if (spec.fold) {
    const crease = new THREE.Mesh(
      new THREE.BoxGeometry(0.003, screenH * 0.96, 0.001),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    crease.position.set(0, screenY, spec.t / 2 + 0.006);
    group.add(crease);
  }

  addRails(group, spec, metal);
  addCamera(group, spec, backMat, metal);
  return group;
}

function lensMesh(radius: number) {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.004, 24),
    new THREE.MeshPhysicalMaterial({
      color: 0x071018,
      metalness: 0,
      roughness: 0.04,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.4,
    }),
  );
  glass.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.28, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xcfc8bc, metalness: 1, roughness: 0.22 }),
  );
  group.add(glass, ring);
  return group;
}

function addRails(group: THREE.Group, spec: PhoneSpec, metal: THREE.Material) {
  const buttonMat = metal;
  const z = 0;
  const rail = (x: number, y: number, w: number, h: number, d: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buttonMat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  const side = spec.w / 2 + 0.004;
  if (spec.w > spec.h) {
    rail(-spec.w * 0.18, spec.h / 2 + 0.004, spec.w * 0.08, 0.008, 0.02);
    rail(-spec.w * 0.04, spec.h / 2 + 0.004, spec.w * 0.12, 0.008, 0.02);
    rail(spec.w * 0.2, -spec.h / 2 - 0.004, spec.w * 0.14, 0.008, 0.02);
    return;
  }
  rail(-side, spec.h * 0.16, 0.008, spec.h * 0.07, 0.022);
  rail(-side, spec.h * 0.28, 0.008, spec.h * 0.12, 0.022);
  rail(side, spec.h * 0.22, 0.008, spec.h * 0.14, 0.022);
}

function addCamera(group: THREE.Group, spec: PhoneSpec, backMat: THREE.Material, metal: THREE.Material) {
  const wide = spec.w > spec.h;
  const bw = wide ? 0.28 : 0.25;
  const bh = wide ? 0.25 : 0.3;
  const bump = new THREE.Mesh(plateGeometry(`bump-${spec.id}`, bw, bh, 0.04, 0.012), backMat);
  const x = wide ? -spec.w / 2 + 0.24 : 0;
  const y = wide ? spec.h / 2 - 0.2 : spec.h / 2 - 0.26;
  bump.position.set(x, y, -spec.t / 2 - 0.008);
  group.add(bump);
  const spots =
    spec.lenses >= 3
      ? [
          [-0.05, 0.05],
          [0.05, 0.05],
          [0, -0.05],
        ]
      : spec.lenses === 2
        ? [
            [-0.045, 0.02],
            [0.045, -0.02],
          ]
        : [[0, 0]];
  for (const [ox, oy] of spots) {
    const lens = lensMesh(spec.lenses === 1 ? 0.045 : 0.032);
    lens.position.set(x + (ox ?? 0), y + (oy ?? 0), -spec.t / 2 - 0.016);
    group.add(lens);
  }
  const flash = new THREE.Mesh(
    new THREE.CircleGeometry(0.01, 16),
    new THREE.MeshStandardMaterial({
      color: 0xfff4d2,
      emissive: 0xffe2a8,
      emissiveIntensity: 0.4,
      metalness: metal ? 0 : 0,
      roughness: 0.3,
    }),
  );
  flash.position.set(x + bw * 0.28, y - bh * 0.28, -spec.t / 2 - 0.015);
  flash.rotation.y = Math.PI;
  group.add(flash);
}

let thumbView: PhoneView | null = null;

export function drawPhoneThumb(
  ctx: CanvasRenderingContext2D,
  modelId: string,
  finish: FinishId,
  image: HTMLImageElement | null,
) {
  if (!thumbView) {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 280;
    thumbView = new PhoneView(canvas, false);
    thumbView.setBackdrop("papel", false);
  }
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  thumbView.setSize(width, height);
  thumbView.setModel(modelId);
  thumbView.setFinish(finish);
  thumbView.setArt({ image, zoom: 1, panX: 0, panY: 0, fit: "cover", quiet: true });
  thumbView.applyPose(DEFAULT_POSE);
  thumbView.render();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(thumbView.renderer.domElement, 0, 0, width, height);
}
