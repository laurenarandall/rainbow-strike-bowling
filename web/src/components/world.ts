// 3D world for Rainbow Strike Bowling: realistic lane, gutters, pin deck, pit,
// rainbow castle, PBR pins and balls, lighting, shadows, post-processing and
// static physics. Game.tsx drives the gameplay on top of this.
import type { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { ReflectionProbe } from "@babylonjs/core/Probes/reflectionProbe";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox, PhysicsShapeConvexHull, PhysicsShapeMesh, PhysicsShapeSphere } from "@babylonjs/core/Physics/v2/physicsShape";
import type { PhysicsShape } from "@babylonjs/core/Physics/v2/physicsShape";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { S, BALL_R, FOUL_Z, PIN_Z_START, OIL_END_Z } from "./ballPhysics";
import type { PinStyleId } from "../gear";
import type { BallFinish } from "../characters";
import type { ThemeDef, LaneMode } from "../themes";
import { getTheme } from "../themes";
import { buildBackdrop, drawHeroShield } from "./backdrop";
import type { Backdrop } from "./backdrop";

export interface BallLook {
  id: string;
  finish: BallFinish;
  base: string;
  accents: string[];
  glow: number;
}

export const LANE_W = 1.0541 * S; // ~5
export const HALF_W = LANE_W / 2;
export const GUTTER_W = 0.235 * S;
export const PIN_H = 0.381 * S;
export const PIN_SPACING = 0.3048 * S;
export const PIN_MAX_R = 0.0605 * S;
export const DECK_END = PIN_Z_START - 4.8;
export const PIT_END = DECK_END - 3.6;
export const PIT_Y = -1.3;
export const KICK_X = HALF_W + GUTTER_W + 0.18;
export const RAINBOW = ["#ff3b3b", "#ff8c1a", "#ffd60a", "#3ddc4a", "#1fb6ff", "#4c5cff", "#b14cff"];

export const PIN_SPOTS: Vector3[] = (() => {
  const out: Vector3[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      out.push(new Vector3((row / 2 - col) * PIN_SPACING, 0, PIN_Z_START - row * PIN_SPACING * 0.866));
    }
  }
  return out;
})();

// Real pin profile (USBC-ish): [height in, diameter in].
const PIN_PROFILE_IN: [number, number][] = [
  [0, 2.03], [0.4, 2.45], [1.0, 3.05], [2.0, 3.85], [3.0, 4.42], [4.0, 4.72], [4.5, 4.766], [5.5, 4.62],
  [6.5, 4.2], [7.5, 3.55], [8.5, 2.75], [9.3, 2.12], [10.0, 1.8], [10.8, 1.84], [11.6, 2.15], [12.4, 2.45],
  [13.3, 2.55], [14.0, 2.38], [14.5, 2.0], [14.8, 1.45], [15.0, 0.0],
];
const IN = 0.0254 * S;
export const PIN_SHAPE: Vector3[] = [new Vector3(0, 0, 0), ...PIN_PROFILE_IN.map(([h, d]) => new Vector3((d / 2) * IN, h * IN, 0))];
/** Arc-length fraction of each profile point (the lathe's U coordinate). */
const PIN_U: number[] = (() => {
  const acc = [0];
  for (let i = 1; i < PIN_SHAPE.length; i++) acc.push(acc[i - 1]! + Vector3.Distance(PIN_SHAPE[i]!, PIN_SHAPE[i - 1]!));
  const tot = acc[acc.length - 1]!;
  return acc.map((a) => a / tot);
})();
/** U coordinate at a given height (inches) along the pin. */
function uAtHeight(hIn: number): number {
  for (let i = 1; i < PIN_PROFILE_IN.length; i++) {
    const [h0] = PIN_PROFILE_IN[i - 1]!;
    const [h1] = PIN_PROFILE_IN[i]!;
    if (hIn <= h1) {
      const t = (hIn - h0) / (h1 - h0 || 1);
      return PIN_U[i]! + t * (PIN_U[i + 1]! - PIN_U[i]!);
    }
  }
  return 1;
}

function pbr(scene: Scene, name: string, hex: string, rough = 0.45, metal = 0): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
  m.roughness = rough;
  m.metallic = metal;
  return m;
}

function canvasTex(scene: Scene, name: string, w: number, h: number, paint: (c: CanvasRenderingContext2D, w: number, h: number) => void, mips = true): DynamicTexture {
  const t = new DynamicTexture(name, { width: w, height: h }, scene, mips);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  paint(c, w, h);
  t.update();
  return t;
}

// ---------- Ball textures ----------
function hsl(h: number, s: number, l: number) {
  return `hsl(${h},${s}%,${l}%)`;
}
function paintBall(look: BallLook, c: CanvasRenderingContext2D, w: number, h: number) {
  const f = look.finish;
  const acc = look.accents.length ? look.accents : [look.base];
  const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
  };
  const base = rgb(look.base);
  const accs = acc.map(rgb);
  const img = c.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const u = x / w;
      const v = y / h;
      let r = base[0], g = base[1], b = base[2];
      if (f === "swirl") {
        const t = (u * 2 + Math.sin(v * 9 + u * 12) * 0.25 + v * 0.6) % 1;
        if (look.id === "rainbow") {
          [r, g, b] = hslToRgb(t, 0.85, 0.55);
        } else {
          const a = accs[Math.floor(t * accs.length) % accs.length]!;
          const m = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * accs.length);
          r = base[0] * m + a[0] * (1 - m); g = base[1] * m + a[1] * (1 - m); b = base[2] * m + a[2] * (1 - m);
        }
      } else if (f === "galaxy") {
        const n = 0.5 + 0.5 * Math.sin(u * 17 + Math.sin(v * 11) * 3) * Math.sin(v * 13 + u * 5);
        const a = accs[accs.length - 1]!;
        r = base[0] + (a[0] - base[0]) * n * 0.55; g = base[1] + (a[1] - base[1]) * n * 0.45; b = base[2] + (a[2] - base[2]) * n * 0.6;
      } else if (f === "fire") {
        const k = Math.pow(0.5 + 0.5 * Math.sin(u * 30 + Math.sin(v * 25 + u * 8) * 2.5), 1.5);
        r = 140 + k * 115; g = 20 + k * 170; b = k * 40;
      } else if (f === "waves") {
        const k = 0.5 + 0.5 * Math.sin(v * 40 + Math.sin(u * 25) * 2);
        const a = accs[0]!;
        r = base[0] + (a[0] - base[0]) * k * 0.6; g = base[1] + (a[1] - base[1]) * k * 0.6; b = base[2] + (a[2] - base[2]) * k * 0.6;
      } else if (f === "stripes") {
        const k = Math.floor(u * 16 + Math.sin(v * 6) * 0.6);
        if (k % 2 === 0) {
          const a = accs[(k / 2) % accs.length]!;
          [r, g, b] = a;
        }
      } else if (f === "pearl" || f === "ice") {
        const k = 0.5 + 0.5 * Math.sin(u * 22 + v * 14 + Math.sin(v * 30) * 1.5);
        const a = accs[Math.floor(u * accs.length * 3) % accs.length]!;
        const m = f === "ice" ? 0.25 : 0.35;
        r = base[0] + (a[0] - base[0]) * k * m; g = base[1] + (a[1] - base[1]) * k * m; b = base[2] + (a[2] - base[2]) * k * m;
      } else if (f === "scales") {
        const sx = u * 48 + (Math.floor(v * 24) % 2) * 0.5;
        const fx = sx - Math.floor(sx) - 0.5;
        const fy = v * 24 - Math.floor(v * 24);
        const e = Math.min(1, Math.hypot(fx, fy * 0.9) * 1.7);
        const gold = e > 0.92 ? 1 : 0;
        r = 15 + e * 40 + gold * 160; g = 70 + e * 60 + gold * 110; b = 30 + e * 20 + gold * 20;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  if (f === "galaxy" || f === "pearl" || f === "ice") {
    for (let k = 0; k < (f === "galaxy" ? 420 : 200); k++) {
      c.fillStyle = f === "galaxy" ? look.accents[k % Math.max(1, look.accents.length)] ?? "#fff" : "rgba(255,255,255,0.95)";
      const s = Math.random() < 0.1 ? 3 : 1.4;
      c.beginPath();
      c.arc(Math.random() * w, Math.random() * h, s, 0, Math.PI * 2);
      c.fill();
    }
  } else if (f === "emblem") {
    // Red cape stripe around the middle + original shield emblems
    c.fillStyle = acc[0] ?? "#dc2626";
    c.fillRect(0, h * 0.44, w, h * 0.12);
    for (const cx of [0.25, 0.75]) {
      c.save();
      c.translate(w * cx - 45, h * 0.5 - 40);
      drawHeroShield(c, 90, 80);
      c.restore();
    }
  } else if (f === "spots") {
    for (let k = 0; k < 70; k++) {
      c.fillStyle = acc[k % acc.length]!;
      c.beginPath();
      c.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 12, 4 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// ---------- Pin textures ----------
function paintPin(style: PinStyleId, c: CanvasRenderingContext2D, w: number, h: number) {
  const ux = (hIn: number) => uAtHeight(hIn) * w;
  if (style === "classic") {
    c.fillStyle = "#f7f5ef";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#d4141c";
    c.fillRect(ux(9.6), 0, ux(10.15) - ux(9.6), h);
    c.fillRect(ux(10.7), 0, ux(11.25) - ux(10.7), h);
  } else if (style === "rainbow") {
    const g = c.createLinearGradient(0, 0, w, 0);
    RAINBOW.forEach((hex, i) => g.addColorStop(i / (RAINBOW.length - 1), hex));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.fillRect(ux(10.0), 0, ux(10.6) - ux(10.0), h);
  } else if (style === "lego") {
    const cols = ["#ffd60a", "#1fb6ff", "#ff3b3b", "#3ddc4a", "#ff8c1a"];
    const bands = [0, 3, 6, 9.5, 12.5, 15.01];
    for (let b = 0; b < bands.length - 1; b++) {
      c.fillStyle = cols[b % cols.length]!;
      c.fillRect(ux(bands[b]!), 0, ux(bands[b + 1]!) - ux(bands[b]!) + 1, h);
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillRect(ux(bands[b + 1]!) - 2, 0, 2, h);
    }
  } else if (style === "gold") {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#b07a10";
    c.fillRect(ux(9.6), 0, ux(10.15) - ux(9.6), h);
    c.fillRect(ux(10.7), 0, ux(11.25) - ux(10.7), h);
  } else {
    c.fillStyle = "#050510";
    c.fillRect(0, 0, w, h);
    const neon = ["#39ff14", "#00e5ff", "#ff2bd6", "#ffe600"];
    const rings = [1.2, 4.5, 7.6, 10.3, 13.2];
    rings.forEach((r, i) => {
      c.fillStyle = neon[i % neon.length]!;
      c.fillRect(ux(r), 0, Math.max(3, ux(r + 0.7) - ux(r)), h);
    });
  }
}

export type Quality = 0 | 1 | 2;

export interface World {
  shadowGen: ShadowGenerator;
  sun: DirectionalLight;
  glow: GlowLayer;
  mirror: MirrorTexture | null;
  ball: Mesh;
  ballMass: number;
  bumperMeshes: Mesh[];
  bridgePivot: TransformNode;
  getPinHull: () => PhysicsShape;
  makePin: (i: number) => Mesh;
  setShadowFocus: (x: number, z: number) => void;
  setQuality: (q: Quality) => void;
  quality: () => Quality;
  addStaticPhysics: () => void;
  makeBallBody: () => PhysicsBody;
  backdrop: Backdrop;
}

export function buildWorld(scene: Scene, engine: Engine, camera: Camera, ballDef: BallLook, pinStyle: PinStyleId, ballMass: number, startQuality: Quality, themeIn?: ThemeDef, laneMode: LaneMode = "theme"): World {
  const theme = themeIn ?? getTheme("rainbow");
  scene.clearColor.set(0.53, 0.78, 1, 1);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.1;

  // ---- Lights ----
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = theme.light.hemi;
  hemi.groundColor = new Color3(0.35, 0.3, 0.4);
  const sun = new DirectionalLight("sun", new Vector3(-0.35, -1, -0.45).normalize(), scene);
  sun.intensity = theme.light.sunIntensity;
  sun.diffuse = Color3.FromHexString(theme.light.sun);
  sun.autoUpdateExtends = false;
  sun.orthoLeft = -11;
  sun.orthoRight = 11;
  sun.orthoTop = 11;
  sun.orthoBottom = -11;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 90;
  const deckLight = new PointLight("deckLight", new Vector3(0, 6, PIN_Z_START - 1), scene);
  deckLight.intensity = 25;
  deckLight.diffuse = new Color3(1, 0.95, 0.88);
  deckLight.range = 22;

  const shadowGen = new ShadowGenerator(2048, sun);
  shadowGen.usePercentageCloserFiltering = true;
  shadowGen.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadowGen.bias = 0.0008;
  shadowGen.normalBias = 0.02;
  shadowGen.darkness = 0.15;
  const setShadowFocus = (x: number, z: number) => {
    sun.position.set(x - sun.direction.x * 40, -sun.direction.y * 40, z - sun.direction.z * 40);
  };
  setShadowFocus(0, FOUL_Z - 8);

  const glow = new GlowLayer("glow", scene, { mainTextureSamples: 2, blurKernelSize: 48 });
  glow.intensity = 0.7;

  // ---- Theme background: sky dome, ground and props (also baked into the env map) ----
  const backdrop = buildBackdrop(scene, theme, glow);
  const { sky, floor } = backdrop;

  // ---- Lane: glossy maple boards with an oil sheen ----
  const LANE_LEN = FOUL_Z - DECK_END;
  const lane = MeshBuilder.CreateBox("lane", { width: LANE_W, height: 0.4, depth: LANE_LEN }, scene);
  lane.position.set(0, -0.2, (FOUL_Z + DECK_END) / 2);
  const laneMat = new PBRMaterial("laneMat", scene);
  const rainbowLane = laneMode !== "wood";
  // Painted with a transpose so boards run down the lane (u runs along the lane).
  const woodTex = canvasTex(scene, "wood", 1024, 512, (c, w0, h0) => {
    c.setTransform(0, 1, 1, 0, 0, 0);
    const w = h0, h = w0;
    const boards = 39;
    if (rainbowLane) {
      // Glossy candy-colored boards in bands across the lane, with grain.
      const cols = theme.lane;
      for (let b = 0; b < boards; b++) {
        const x0 = Math.floor((b / boards) * w);
        const x1 = Math.floor(((b + 1) / boards) * w);
        c.fillStyle = cols[Math.min(cols.length - 1, Math.floor((b / boards) * cols.length))]!;
        c.fillRect(x0, 0, x1 - x0, h);
        c.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
        c.fillRect(x0, 0, x1 - x0, h);
        for (let k = 0; k < 30; k++) {
          c.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${0.05 + Math.random() * 0.08})` : `rgba(0,0,0,${0.03 + Math.random() * 0.06})`;
          c.fillRect(x0 + Math.random() * (x1 - x0), 0, 1, h);
        }
        c.fillStyle = "rgba(0,0,0,0.22)";
        c.fillRect(x0, 0, 1, h);
      }
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.fillRect(0, h * 0.04, w, 2);
      return;
    }
    for (let b = 0; b < boards; b++) {
      const x0 = Math.floor((b / boards) * w);
      const x1 = Math.floor(((b + 1) / boards) * w);
      const l = 72 + Math.random() * 10;
      c.fillStyle = hsl(34 + Math.random() * 6, 55 + Math.random() * 10, l);
      c.fillRect(x0, 0, x1 - x0, h);
      for (let k = 0; k < 40; k++) {
        c.fillStyle = `rgba(150,95,40,${0.04 + Math.random() * 0.08})`;
        const gx = x0 + Math.random() * (x1 - x0);
        c.fillRect(gx, 0, 1, h);
      }
      c.fillStyle = "rgba(90,55,20,0.35)";
      c.fillRect(x0, 0, 1, h);
    }
    // Pine/maple seam where the pin deck starts
    c.fillStyle = "rgba(120,70,30,0.25)";
    c.fillRect(0, h * 0.04, w, 2);
  });
  woodTex.wrapU = Texture.WRAP_ADDRESSMODE;
  woodTex.uScale = 3;
  laneMat.albedoTexture = woodTex;
  laneMat.roughness = 0.18;
  laneMat.metallic = 0;
  laneMat.clearCoat.isEnabled = true;
  laneMat.clearCoat.intensity = 0.9;
  laneMat.clearCoat.roughness = 0.04;
  laneMat.environmentIntensity = 0.9;
  lane.material = laneMat;
  lane.receiveShadows = true;

  // Oil sheen: a faint glossy overlay on the oiled part of the lane.
  const oil = MeshBuilder.CreateGround("oil", { width: LANE_W * 0.82, height: FOUL_Z - OIL_END_Z }, scene);
  oil.position.set(0, 0.004, (FOUL_Z + OIL_END_Z) / 2);
  const oilMat = new PBRMaterial("oilMat", scene);
  oilMat.albedoColor = new Color3(0.8, 0.9, 1);
  oilMat.alpha = 0.06;
  oilMat.roughness = 0.02;
  oilMat.metallic = 0.3;
  oil.material = oilMat;
  oil.isPickable = false;

  // Lane arrows (rainbow) at ~15 ft and dots at ~7 ft.
  const arrowZ = FOUL_Z - 4.57 * S;
  for (let k = -3; k <= 3; k++) {
    const a = MeshBuilder.CreateDisc(`laneArrow${k}`, { radius: 0.18, tessellation: 3 }, scene);
    a.rotation.x = Math.PI / 2;
    a.rotation.y = Math.PI / 2;
    a.scaling.set(0.55, 1.8, 1);
    a.position.set(k * (LANE_W / 8), 0.006, arrowZ - Math.abs(k) * 0.55);
    const arrowHex = rainbowLane ? theme.arrows : RAINBOW[k + 3]!;
    const m = pbr(scene, `laneArrowMat${k}`, arrowHex, 0.3);
    m.emissiveColor = Color3.FromHexString(arrowHex).scale(rainbowLane ? 0.7 : 0.35);
    a.material = m;
    a.receiveShadows = true;
  }
  for (const zz of [FOUL_Z - 2.13 * S, FOUL_Z + 1.5]) {
    for (let k = -4; k <= 4; k++) {
      if (k === 0 && zz > FOUL_Z) continue;
      const dot = MeshBuilder.CreateDisc(`laneDot${zz}${k}`, { radius: 0.06, tessellation: 12 }, scene);
      dot.rotation.x = Math.PI / 2;
      dot.position.set(k * (LANE_W / 9), 0.006, zz);
      const m = pbr(scene, `laneDotMat${zz}${k}`, rainbowLane ? "#ffffff" : "#3b2a1a", 0.4);
      if (rainbowLane) m.emissiveColor = new Color3(0.5, 0.5, 0.5);
      dot.material = m;
    }
  }
  // Foul line
  const foul = MeshBuilder.CreateBox("foul", { width: LANE_W + 2 * GUTTER_W, height: 0.01, depth: 0.08 }, scene);
  foul.position.set(0, 0.004, FOUL_Z - 1.4);
  const foulMat = pbr(scene, "foulMat", "#222", 0.5);
  foul.material = foulMat;

  // Approach
  const approach = MeshBuilder.CreateBox("approach", { width: LANE_W + 2 * GUTTER_W + 2, height: 0.4, depth: 16 }, scene);
  approach.position.set(0, -0.2, FOUL_Z + 6.6);
  approach.material = laneMat;
  approach.receiveShadows = true;

  // ---- Gutters: real half-pipe channels ----
  const gutterMat = pbr(scene, "gutterMat", "#a3a8ba", 0.32, 0.6);
  const gutterLen = FOUL_Z - DECK_END + 1.4;
  const gutters: Mesh[] = [];
  for (const side of [-1, 1]) {
    const g = MeshBuilder.CreateCylinder(`gutter${side}`, { height: gutterLen, diameter: GUTTER_W, arc: 0.5, enclose: false, tessellation: 24, sideOrientation: Mesh.DOUBLESIDE, cap: Mesh.NO_CAP }, scene);
    g.rotation.x = -Math.PI / 2; // open side up: a U-shaped channel
    g.position.set(side * (HALF_W + GUTTER_W / 2), -0.14, (FOUL_Z - 1.4 + DECK_END) / 2);
    g.material = gutterMat;
    g.receiveShadows = true;
    gutters.push(g);
    // Divider cap between gutter and neighbouring lane
    const cap = MeshBuilder.CreateBox(`gutterCap${side}`, { width: 0.4, height: 0.4, depth: gutterLen }, scene);
    cap.position.set(side * (HALF_W + GUTTER_W + 0.2), -0.12, g.position.z);
    cap.material = pbr(scene, `capMat${side}`, "#f3f0ff", 0.3);
  }

  // ---- Bumpers (rainbow rails) ----
  const bumperMeshes: Mesh[] = [];
  for (const side of [-1, 1]) {
    const b = MeshBuilder.CreateCylinder(`bumper${side}`, { height: FOUL_Z - PIN_Z_START + 3, diameter: 0.34, tessellation: 20 }, scene);
    b.rotation.x = Math.PI / 2;
    b.position.set(side * (HALF_W + 0.17), 0.3, (FOUL_Z + PIN_Z_START) / 2);
    const m = pbr(scene, `bumperMat${side}`, side < 0 ? "#ff5fb0" : "#3fb7ff", 0.3);
    m.clearCoat.isEnabled = true;
    b.material = m;
    bumperMeshes.push(b);
  }

  // ---- Pin deck, pit and kickbacks ----
  const pit = MeshBuilder.CreateBox("pitFloor", { width: 2 * KICK_X, height: 0.2, depth: DECK_END - PIT_END }, scene);
  pit.position.set(0, PIT_Y - 0.1, (DECK_END + PIT_END) / 2);
  pit.material = pbr(scene, "pitMat", "#1d1530", 0.8);
  const pitFront = MeshBuilder.CreateBox("pitFront", { width: 2 * KICK_X, height: -PIT_Y, depth: 0.1 }, scene);
  pitFront.position.set(0, PIT_Y / 2 - 0.2, DECK_END);
  pitFront.material = pit.material;
  const cushion = MeshBuilder.CreateBox("cushion", { width: 2 * KICK_X, height: 4.2, depth: 0.4 }, scene);
  cushion.position.set(0, PIT_Y + 2.1, PIT_END);
  const cushionMat = pbr(scene, "cushionMat", "#2a1f45", 0.95);
  cushion.material = cushionMat;
  cushion.receiveShadows = true;

  // ---- Rainbow Strike Castle around the pin area ----
  const castle: Mesh[] = [];
  const cstyle = theme.castle.style;
  const castleMats = theme.castle.colors.map((hex, i) => {
    const m = pbr(scene, `castle${i}`, hex, cstyle === "fortress" ? 0.55 : 0.24);
    m.clearCoat.isEnabled = cstyle !== "fortress";
    m.clearCoat.intensity = 1;
    m.clearCoat.roughness = 0.05;
    if (cstyle === "crystal") m.emissiveColor = Color3.FromHexString(hex).scale(0.15);
    return m;
  });
  const stone = pbr(scene, "castleStone", theme.castle.stone, cstyle === "fortress" ? 0.7 : 0.3);
  if (cstyle === "crystal") {
    stone.alpha = 0.82;
    stone.roughness = 0.05;
    stone.metallic = 0.15;
    stone.emissiveColor = Color3.FromHexString(theme.castle.stone).scale(0.25);
  } else if (cstyle === "rainbow") {
    stone.clearCoat.isEnabled = true;
  }
  const lavaGlow = new StandardMaterial("castleLavaGlow", scene);
  lavaGlow.emissiveColor = Color3.FromHexString(theme.castle.gate);
  lavaGlow.disableLighting = true;
  const goldTrim = pbr(scene, "castleGold", "#ffcf4a", 0.2, 1);
  const kickH = 3.2;
  for (const side of [-1, 1]) {
    // Kickback walls: brick courses in rainbow colors
    for (let row = 0; row < 5; row++) {
      const k = MeshBuilder.CreateBox(`kick${side}${row}`, { width: 0.36, height: kickH / 5 - 0.03, depth: PIN_Z_START + 3 - PIT_END }, scene);
      k.position.set(side * (KICK_X + 0.18), PIT_Y + 0.6 + (row + 0.5) * (kickH / 5), (PIN_Z_START + 3 + PIT_END) / 2);
      k.material = castleMats[(row + (side > 0 ? 3 : 0)) % 7]!;
      castle.push(k);
    }
    // Towers
    const tx = side * (KICK_X + 1.6);
    const tz = PIN_Z_START + 2.2;
    const tower = MeshBuilder.CreateCylinder(`tower${side}`, { height: 7.5, diameter: 2.4, tessellation: cstyle === "fortress" ? 8 : cstyle === "crystal" ? 6 : 32 }, scene);
    tower.position.set(tx, 3.2, tz);
    tower.material = stone;
    castle.push(tower);
    for (let r = 0; r < 7; r++) {
      const ring = MeshBuilder.CreateTorus(`ring${side}${r}`, { diameter: 2.45, thickness: 0.22, tessellation: 32 }, scene);
      ring.position.set(tx, 0.2 + r * 0.95, tz);
      ring.material = castleMats[r]!;
      castle.push(ring);
    }
    for (let k = 0; k < 8; k++) {
      const cren = MeshBuilder.CreateBox(`tcren${side}${k}`, { width: 0.5, height: 0.6, depth: 0.5 }, scene);
      const a = (k / 8) * Math.PI * 2;
      cren.position.set(tx + Math.cos(a) * 1.15, 7.2, tz + Math.sin(a) * 1.15);
      cren.rotation.y = -a;
      cren.material = castleMats[k % 7]!;
      castle.push(cren);
    }
    const roof = MeshBuilder.CreateCylinder(`roof${side}`, { height: cstyle === "rainbow" ? 3 : 4, diameterTop: 0, diameterBottom: 2.9, tessellation: cstyle === "fortress" ? 8 : cstyle === "crystal" ? 6 : 32 }, scene);
    roof.position.set(tx, cstyle === "rainbow" ? 9.0 : 9.5, tz);
    roof.material = cstyle === "fortress" ? pbr(scene, `roofLava${side}`, "#7f1d1d", 0.5) : castleMats[side < 0 ? 0 : 5]!;
    castle.push(roof);
    if (cstyle === "rainbow") {
      const fin = MeshBuilder.CreateSphere(`finial${side}`, { diameter: 0.4, segments: 16 }, scene);
      fin.position.set(tx, 10.6, tz);
      fin.material = goldTrim;
    } else if (cstyle === "fortress") {
      // Spiky crown + glowing lava windows
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const sp = MeshBuilder.CreateCylinder(`spike${side}${k}`, { height: 0.9, diameterTop: 0, diameterBottom: 0.32, tessellation: 8 }, scene);
        sp.position.set(tx + Math.cos(a) * 1.15, 7.95, tz + Math.sin(a) * 1.15);
        sp.material = pbr(scene, `spikeMat${side}${k}`, "#e5e7eb", 0.3, 0.6);
      }
      for (let k = 0; k < 3; k++) {
        const win = MeshBuilder.CreatePlane(`lavaWin${side}${k}`, { width: 0.4, height: 0.7 }, scene);
        win.position.set(tx, 1.6 + k * 2, tz + 1.22);
        win.rotation.y = Math.PI;
        win.material = lavaGlow;
        glow.addIncludedOnlyMesh(win);
      }
    } else {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const cr = MeshBuilder.CreateCylinder(`shard${side}${k}`, { height: 2.2, diameterTop: 0, diameterBottom: 0.6, tessellation: 6 }, scene);
        cr.position.set(tx + Math.cos(a) * 1.1, 8.2, tz + Math.sin(a) * 1.1);
        cr.rotation.z = Math.cos(a) * 0.35;
        cr.rotation.x = -Math.sin(a) * 0.35;
        cr.material = stone;
        glow.addIncludedOnlyMesh(cr);
      }
    }
    const flag = MeshBuilder.CreatePlane(`flag${side}`, { width: 1.2, height: 0.7, sideOrientation: Mesh.DOUBLESIDE }, scene);
    flag.position.set(tx + side * 0.6, 11.1, tz);
    flag.material = castleMats[side < 0 ? 2 : 4]!;
    const pole = MeshBuilder.CreateCylinder(`pole${side}`, { height: 1.8, diameter: 0.08 }, scene);
    pole.position.set(tx, 10.9, tz);
    pole.material = stone;
  }
  // Masking panel: a rainbow castle arch spanning the lane above the pins.
  const maskY = 3.0;
  for (let b = 0; b < 7; b++) {
    const band = MeshBuilder.CreateBox(`mask${b}`, { width: 2 * KICK_X + 1.2, height: 0.34, depth: 0.5 }, scene);
    band.position.set(0, maskY + b * 0.34, PIN_Z_START + 1.6);
    band.material = castleMats[6 - b]!;
    castle.push(band);
  }
  for (let k = 0; k < 9; k++) {
    const cren = MeshBuilder.CreateBox(`mcren${k}`, { width: 0.6, height: 0.6, depth: 0.5 }, scene);
    cren.position.set((k - 4) * 1.0, maskY + 7 * 0.34 + 0.3, PIN_Z_START + 1.6);
    cren.material = castleMats[k % 7]!;
    castle.push(cren);
    if (cstyle !== "rainbow") {
      const sp = MeshBuilder.CreateCylinder(`mspike${k}`, { height: 0.7, diameterTop: 0, diameterBottom: 0.36, tessellation: cstyle === "crystal" ? 6 : 8 }, scene);
      sp.position.set((k - 4) * 1.0, maskY + 7 * 0.34 + 0.95, PIN_Z_START + 1.6);
      sp.material = cstyle === "crystal" ? stone : pbr(scene, `mspikeMat${k}`, "#e5e7eb", 0.3, 0.6);
    } else {
      const gem = MeshBuilder.CreateSphere(`mgem${k}`, { diameter: 0.24, segments: 12 }, scene);
      gem.position.set((k - 4) * 1.0, maskY + 7 * 0.34 + 0.7, PIN_Z_START + 1.6);
      gem.material = goldTrim;
    }
  }
  // Big "RAINBOW STRIKE" sign on the masking panel
  const sign = MeshBuilder.CreatePlane("sign", { width: 5.2, height: 1.1 }, scene);
  sign.position.set(0, maskY + 1.2, PIN_Z_START + 1.34);
  const signMat = new StandardMaterial("signMat", scene);
  const signTex = canvasTex(scene, "signTex", 1024, 220, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.font = "bold 150px 'Luckiest Guy', 'Fredoka', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = 16;
    c.strokeStyle = "#ffffff";
    const text = theme.castle.sign;
    c.strokeText(text, w / 2, h / 2 + 8);
    const g = c.createLinearGradient(0, 0, w, 0);
    const sc = theme.castle.signColors;
    sc.forEach((hex, i) => g.addColorStop(i / Math.max(1, sc.length - 1), hex));
    c.fillStyle = g;
    c.fillText(text, w / 2, h / 2 + 8);
  });
  signTex.hasAlpha = true;
  signMat.diffuseTexture = signTex;
  signMat.emissiveTexture = signTex;
  signMat.useAlphaFromDiffuseTexture = true;
  signMat.disableLighting = true;
  sign.material = signMat;
  // Back castle wall with gate + drawbridge behind the pit
  const backZ = PIT_END - 0.6;
  for (let row = 0; row < 6; row++) {
    for (const side of [-1, 1]) {
      const seg = MeshBuilder.CreateBox(`bwall${side}${row}`, { width: 4.2, height: 0.9, depth: 0.7 }, scene);
      seg.position.set(side * 3.6, PIT_Y + 0.45 + row * 0.9, backZ);
      seg.material = castleMats[(row + (side > 0 ? 2 : 5)) % 7]!;
      castle.push(seg);
    }
  }
  const gate = MeshBuilder.CreatePlane("gateGlow", { width: 3, height: 4.4 }, scene);
  gate.position.set(0, PIT_Y + 2.2, backZ + 0.05);
  gate.rotation.y = Math.PI;
  const gateMat = new StandardMaterial("gateMat", scene);
  gateMat.emissiveColor = Color3.FromHexString(theme.castle.gate);
  gateMat.disableLighting = true;
  gate.material = gateMat;
  const lintel = MeshBuilder.CreateBox("lintel", { width: 3.4, height: 1, depth: 0.8 }, scene);
  lintel.position.set(0, PIT_Y + 4.9, backZ);
  lintel.material = castleMats[6]!;
  castle.push(lintel);
  const bridgePivot = new TransformNode("bridgePivot", scene);
  bridgePivot.position.set(0, PIT_Y, backZ + 0.45);
  const bridge = MeshBuilder.CreateBox("bridge", { width: 3, height: 4.4, depth: 0.2 }, scene);
  bridge.parent = bridgePivot;
  bridge.position.y = 2.2;
  bridge.material = pbr(scene, "bridgeMat", "#8a5a2b", 0.7);
  for (let pl = 0; pl < 5; pl++) {
    const plank = MeshBuilder.CreateBox(`plank${pl}`, { width: 3.02, height: 0.1, depth: 0.24 }, scene);
    plank.parent = bridge;
    plank.position.y = -1.8 + pl * 0.9;
    plank.material = castleMats[pl]!;
  }
  for (const m of castle) {
    m.receiveShadows = true;
    shadowGen.addShadowCaster(m, false);
  }

  // ---- Environment: bake the sky + castle into a cube map for PBR reflections ----
  const probe = new ReflectionProbe("envProbe", 128, scene, true, true);
  probe.position = new Vector3(0, 2, PIN_Z_START + 12);
  probe.renderList?.push(...backdrop.envMeshes, ...castle);
  void sky; void floor;
  probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  // Don't sample the env map while baking it (avoids a GL feedback loop).
  probe.cubeTexture.onBeforeRenderObservable.add(() => { scene.environmentTexture = null; });
  probe.cubeTexture.onAfterRenderObservable.add(() => { scene.environmentTexture = probe.cubeTexture; });
  scene.environmentTexture = probe.cubeTexture;
  scene.environmentIntensity = 0.9;

  // ---- Planar reflection on the lane ----
  let mirror: MirrorTexture | null = null;
  const mirrorList: Mesh[] = [];
  function enableMirror(size: number) {
    if (mirror && size > 0) {
      mirror.resize(size);
      return;
    }
    if (mirror) {
      laneMat.reflectionTexture = null;
      mirror.dispose();
      mirror = null;
    }
    if (size <= 0) return;
    mirror = new MirrorTexture("laneMirror", size, scene, true);
    mirror.mirrorPlane = new Plane(0, -1, 0, 0);
    mirror.renderList = mirrorList;
    mirror.adaptiveBlurKernel = 18;
    mirror.level = 0.55;
    laneMat.reflectionTexture = mirror;
  }

  // ---- Pins ----
  const pinMat = makePinMaterial(scene, pinStyle);
  const template = MeshBuilder.CreateLathe("pinTemplate", { shape: PIN_SHAPE, tessellation: pinStyle === "lego" ? 8 : 28, closed: true }, scene);
  template.material = pinMat;
  template.setEnabled(false);
  if (pinStyle === "lego") template.convertToFlatShadedMesh();
  // One shared physics hull for every pin style (always the smooth profile).
  const hullSrc = MeshBuilder.CreateLathe("pinHullSrc", { shape: PIN_SHAPE, tessellation: 14, closed: true }, scene);
  hullSrc.setEnabled(false);
  // Created lazily: the physics engine loads after the world is built.
  let pinHull: PhysicsShape | null = null;
  function getPinHull(): PhysicsShape {
    if (!pinHull) {
      pinHull = new PhysicsShapeConvexHull(hullSrc, scene);
      pinHull.material = { friction: 0.45, restitution: 0.5 };
    }
    return pinHull;
  }
  const studMat = pinStyle === "lego" ? pbr(scene, "pinStudMat", "#ff3b3b", 0.35) : null;
  const friendProtos: Mesh[] = [];
  function makePin(i: number): Mesh {
    if (pinStyle === "mushroom") {
      if (!friendProtos.length) for (let t = 0; t < 6; t++) friendProtos.push(buildFriendProto(scene, template, t));
      const proto = friendProtos[FRIEND_ORDER[i % FRIEND_ORDER.length]!]!;
      const fm = proto.clone(`pin${i}`, null, false)!;
      fm.setEnabled(true);
      fm.isVisible = false;
      fm.position.copyFrom(PIN_SPOTS[i]!);
      fm.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), (Math.random() - 0.5) * 0.5);
      const kids = fm.getChildMeshes(false) as Mesh[];
      for (const k of kids) { k.receiveShadows = true; mirrorList.push(k); }
      shadowGen.addShadowCaster(fm, true);
      fm.onDisposeObservable.addOnce(() => {
        for (const k of kids) { const j = mirrorList.indexOf(k); if (j >= 0) mirrorList.splice(j, 1); }
      });
      return fm;
    }
    const m = template.clone(`pin${i}`, null, true)!;
    m.setEnabled(true);
    m.position.copyFrom(PIN_SPOTS[i]!);
    m.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI * 2);
    m.receiveShadows = true;
    shadowGen.addShadowCaster(m);
    if (studMat) {
      const st = MeshBuilder.CreateCylinder(`pinStud${i}`, { diameter: 0.12, height: 0.06, tessellation: 10 }, scene);
      st.parent = m;
      st.position.y = PIN_H - 0.01;
      st.material = studMat;
    }
    if (pinStyle === "neon") glow.addIncludedOnlyMesh(m);
    mirrorList.push(m);
    m.onDisposeObservable.addOnce(() => {
      const k = mirrorList.indexOf(m);
      if (k >= 0) mirrorList.splice(k, 1);
      if (pinStyle === "neon") glow.removeIncludedOnlyMesh(m);
    });
    return m;
  }

  // ---- Ball ----
  const ball = MeshBuilder.CreateSphere("ball", { diameter: BALL_R * 2, segments: 48 }, scene);
  ball.material = makeBallMaterial(scene, ballDef);
  shadowGen.addShadowCaster(ball, true);
  mirrorList.push(ball);
  if (ballDef.finish === "studs") {
    const studMats2 = (ballDef.accents.length ? ballDef.accents : [ballDef.base]).map((hex, i) => {
      const sm = pbr(scene, `ballStudMat${i}`, hex, 0.3);
      sm.clearCoat.isEnabled = true;
      return sm;
    });
    const N = 34;
    for (let k = 0; k < N; k++) {
      const y = 1 - (2 * (k + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      const th = k * 2.399963;
      const n = new Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      const stud = MeshBuilder.CreateCylinder(`ballStud${k}`, { height: 0.08, diameter: 0.14, tessellation: 12 }, scene);
      stud.position = n.scale(BALL_R);
      stud.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), n, new Quaternion());
      stud.material = studMats2[k % studMats2.length]!;
      stud.parent = ball;
    }
  } else {
    // Finger holes
    const holeMat = pbr(scene, "holeMat", "#0b0b12", 0.9);
    const holes: [number, number, number][] = [[-0.09, 0.16, 0.07], [0.09, 0.16, 0.07], [0, -0.12, 0.085]];
    for (const [hx, hz, d] of holes) {
      const n = new Vector3(hx, 1, hz).normalize();
      const h = MeshBuilder.CreateCylinder(`hole${hx}${hz}`, { diameter: d * 2, height: 0.03, tessellation: 16 }, scene);
      h.position = n.scale(BALL_R - 0.008);
      h.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), n, new Quaternion());
      h.material = holeMat;
      h.parent = ball;
    }
  }
  if (ballDef.glow > 0.2) glow.addIncludedOnlyMesh(ball);
  glow.addIncludedOnlyMesh(sign);
  mirrorList.push(...castle.filter((m) => m.name.startsWith("mask") || m.name.startsWith("tower")));

  // ---- Post-processing & quality ----
  let pipeline: DefaultRenderingPipeline | null = null;
  let ssao: SSAO2RenderingPipeline | null = null;
  let ssaoAttached = false;
  let ssaoFailed = false;
  let q: Quality = startQuality;
  function setQuality(level: Quality) {
    q = level;
    const dpr = Math.min(window.devicePixelRatio || 1, level === 2 ? 2 : level === 1 ? 1.5 : 1);
    engine.setHardwareScalingLevel(1 / dpr);
    enableMirror(level === 2 ? 512 : level === 1 ? 256 : 0);
    shadowGen.mapSize = level === 0 ? 1024 : 2048;
    shadowGen.getShadowMap()?.resize(shadowGen.mapSize);
    shadowGen.filteringQuality = level === 2 ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_LOW;
    if (!pipeline) {
      pipeline = new DefaultRenderingPipeline("pp", true, scene, [camera]);
      pipeline.fxaaEnabled = true;
      pipeline.bloomThreshold = 0.85;
      pipeline.bloomWeight = 0.35;
      pipeline.bloomKernel = 48;
      pipeline.bloomScale = 0.5;
      pipeline.imageProcessing.toneMappingEnabled = true;
      pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
      pipeline.imageProcessing.exposure = 1.1;
      pipeline.imageProcessing.contrast = 1.15;
    }
    pipeline.bloomEnabled = level >= 1;
    pipeline.samples = level === 2 && engine.webGLVersion >= 2 ? 4 : 1;
    if (level === 2 && engine.webGLVersion >= 2 && !ssao && !ssaoFailed) {
      try {
        ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [camera], true);
        ssao.radius = 1.2;
        ssao.totalStrength = 1.1;
        ssao.samples = 12;
        ssao.maxZ = 120;
        ssaoAttached = true;
      } catch (e) {
        console.warn("SSAO unavailable", e);
        ssao = null;
        ssaoFailed = true;
      }
    } else if (ssao) {
      // Detach/re-attach instead of disposing (disposing mid-game breaks the pipeline manager).
      const mgr = scene.postProcessRenderPipelineManager;
      if (level < 2 && ssaoAttached) {
        mgr.detachCamerasFromRenderPipeline("ssao", camera);
        ssaoAttached = false;
      } else if (level === 2 && !ssaoAttached) {
        mgr.attachCamerasToRenderPipeline("ssao", camera);
        ssaoAttached = true;
      }
    }
  }
  setQuality(startQuality);

  // ---- Static physics ----
  function makeStatic(name: string, w: number, h: number, d: number, x: number, y: number, z: number, restitution: number, friction: number) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.isVisible = false;
    m.isPickable = false;
    const body = new PhysicsBody(m, PhysicsMotionType.STATIC, false, scene);
    const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(w, h, d), scene);
    shape.material = { friction, restitution };
    body.shape = shape;
    return body;
  }
  function addStaticPhysics() {
    makeStatic("pLane", LANE_W, 0.4, FOUL_Z - DECK_END + 14, 0, -0.2, (FOUL_Z + 14 + DECK_END) / 2, 0.05, 0.5);
    makeStatic("pDeck", LANE_W, 0.4, DECK_END - PIN_Z_START + 2, 0, -0.2, PIN_Z_START + 1 - (PIN_Z_START + 1 - DECK_END) / 2, 0.1, 0.5);
    for (const g of gutters) {
      const body = new PhysicsBody(g, PhysicsMotionType.STATIC, false, scene);
      const shape = new PhysicsShapeMesh(g, scene);
      shape.material = { friction: 0.4, restitution: 0.1 };
      body.shape = shape;
    }
    for (const side of [-1, 1]) {
      makeStatic(`pCap${side}`, 0.4, 2, FOUL_Z - DECK_END + 4, side * (HALF_W + GUTTER_W + 0.2), 0.6, (FOUL_Z + DECK_END) / 2, 0.3, 0.2);
      makeStatic(`pKick${side}`, 0.4, 5, PIN_Z_START + 3 - PIT_END, side * (KICK_X + 0.2), PIT_Y + 2.5, (PIN_Z_START + 3 + PIT_END) / 2, 0.6, 0.3);
    }
    makeStatic("pPit", 2 * KICK_X + 1, 0.4, DECK_END - PIT_END + 1, 0, PIT_Y - 0.2, (DECK_END + PIT_END) / 2, 0.2, 0.6);
    makeStatic("pCushion", 2 * KICK_X + 1, 5, 0.6, 0, PIT_Y + 2.5, PIT_END - 0.1, 0.12, 0.8);
    makeStatic("pMask", 2 * KICK_X + 1, 2.6, 0.5, 0, maskY + 1.2, PIN_Z_START + 1.6, 0.4, 0.3);
  }
  function makeBallBody(): PhysicsBody {
    const bb = new PhysicsBody(ball, PhysicsMotionType.DYNAMIC, false, scene);
    const shape = new PhysicsShapeSphere(Vector3.Zero(), BALL_R, scene);
    // Lane contact friction is handled by the oil model (ballPhysics.ts),
    // so the solver friction is zero for the ball.
    shape.material = { friction: 0.0, restitution: 0.12 };
    bb.shape = shape;
    bb.setMassProperties({ mass: ballMass, inertia: new Vector3(1, 1, 1).scale(0.4 * ballMass * BALL_R * BALL_R), centerOfMass: Vector3.Zero(), inertiaOrientation: Quaternion.Identity() });
    bb.setLinearDamping(0);
    bb.setAngularDamping(0);
    return bb;
  }

  return {
    shadowGen, sun, glow, get mirror() { return mirror; }, ball, ballMass, bumperMeshes, bridgePivot, getPinHull, makePin,
    setShadowFocus, setQuality, quality: () => q, addStaticPhysics, makeBallBody, backdrop,
  };
}

function makePinMaterial(scene: Scene, style: PinStyleId): PBRMaterial {
  const m = new PBRMaterial(`pinMat_${style}`, scene);
  const tex = canvasTex(scene, `pinTex_${style}`, 1024, 16, (c, w, h) => paintPin(style, c, w, h));
  m.albedoTexture = tex;
  m.roughness = 0.22;
  m.metallic = 0;
  m.clearCoat.isEnabled = true;
  m.clearCoat.intensity = 1;
  m.clearCoat.roughness = 0.06;
  if (style === "gold") {
    m.albedoColor = Color3.FromHexString("#ffcf4a").toLinearSpace();
    m.metallic = 1;
    m.roughness = 0.18;
    m.clearCoat.isEnabled = false;
  } else if (style === "neon") {
    m.emissiveTexture = tex;
    m.emissiveColor = new Color3(1, 1, 1);
    m.emissiveIntensity = 1.4;
    m.roughness = 0.35;
  } else if (style === "lego") {
    m.roughness = 0.3;
    m.clearCoat.intensity = 0.5;
  }
  return m;
}

function makeBallMaterial(scene: Scene, b: BallLook): PBRMaterial {
  const m = new PBRMaterial(`ballMat_${b.id}`, scene);
  const tex = canvasTex(scene, `ballTex_${b.id}`, 512, 256, (c, w, h) => paintBall(b, c, w, h));
  m.albedoTexture = tex;
  m.roughness = 0.12;
  m.metallic = 0.05;
  m.clearCoat.isEnabled = true;
  m.clearCoat.intensity = 1;
  m.clearCoat.roughness = 0.02;
  if (b.glow > 0) {
    m.emissiveTexture = tex;
    m.emissiveColor = new Color3(1, 1, 1);
    m.emissiveIntensity = b.glow * (b.finish === "fire" ? 1.6 : 1.0);
  }
  if (b.finish === "pearl") {
    m.iridescence.isEnabled = true;
    m.iridescence.intensity = 1;
    m.metallic = 0.2;
  } else if (b.finish === "metal") {
    m.metallic = 1;
    m.roughness = 0.2;
    m.clearCoat.isEnabled = false;
  } else if (b.finish === "scales") {
    m.metallic = 0.55;
    m.roughness = 0.28;
  } else if (b.finish === "ice") {
    m.roughness = 0.05;
    m.subSurface.isTranslucencyEnabled = true;
    m.subSurface.translucencyIntensity = 0.6;
  } else if (b.finish === "studs") {
    m.roughness = 0.3;
    m.clearCoat.intensity = 0.4;
  }
  return m;
}

// ---------- "Mushroom Friends" pins (original designs from simple shapes) ----------
// 0 red spotted mushroom, 1 green spotted mushroom, 2 gold star-face pin,
// 3 spiky shell critter, 4 grumpy brown mushroom, 5 little ghost.
const FRIEND_ORDER = [2, 0, 1, 4, 3, 5, 0, 1, 4, 3];
const friendMats = new WeakMap<Scene, Record<string, PBRMaterial>>();
function fmat(scene: Scene, key: string, hex: string, rough = 0.25, metal = 0, emissive = 0): PBRMaterial {
  let reg = friendMats.get(scene);
  if (!reg) { reg = {}; friendMats.set(scene, reg); }
  const hit = reg[key];
  if (hit) return hit;
  const m = pbr(scene, `friend_${key}`, hex, rough, metal);
  m.clearCoat.isEnabled = metal < 0.5;
  m.clearCoat.intensity = 0.8;
  if (emissive > 0) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
  reg[key] = m;
  return m;
}
function buildFriendProto(scene: Scene, template: Mesh, type: number): Mesh {
  const root = template.clone(`friendProto${type}`, null, true)!;
  root.isVisible = false;
  root.setEnabled(false);
  root.rotationQuaternion = Quaternion.Identity();
  const part = (m: Mesh, mat: PBRMaterial, x: number, y: number, z: number) => {
    m.parent = root;
    m.position.set(x, y, z);
    m.material = mat;
    return m;
  };
  const sph = (n: string, d: number, seg = 16, slice?: number) =>
    MeshBuilder.CreateSphere(`${n}${type}`, slice ? { diameter: d, segments: seg, slice } : { diameter: d, segments: seg }, scene);
  const cream = fmat(scene, "cream", "#fde9c9", 0.35);
  const black = fmat(scene, "black", "#141414", 0.2);
  const white = fmat(scene, "white", "#ffffff", 0.25);
  const ovalEyes = (y: number, z: number, gap = 0.085, size = 0.16) => {
    for (const s of [-1, 1]) {
      const e = sph("eye", size, 12);
      e.scaling.set(0.55, 1, 0.45);
      part(e, black, s * gap, y, z);
      const hl = sph("eyeHl", size * 0.3, 8);
      part(hl, white, s * gap + 0.012, y + size * 0.22, z + size * 0.07);
    }
  };
  const roundEyes = (y: number, z: number, gap = 0.08, size = 0.13) => {
    for (const s of [-1, 1]) {
      const e = sph("eyeW", size, 12);
      e.scaling.z = 0.6;
      part(e, white, s * gap, y, z);
      const p = sph("eyeP", size * 0.5, 10);
      part(p, black, s * gap, y, z + size * 0.27);
    }
  };
  if (type === 0 || type === 1) {
    const stem = MeshBuilder.CreateCylinder(`stem${type}`, { height: 1.25, diameterTop: 0.44, diameterBottom: 0.56, tessellation: 24 }, scene);
    part(stem, cream, 0, 0.625, 0);
    ovalEyes(0.9, 0.235);
    const capMat = type === 0 ? fmat(scene, "redCap", "#e52521", 0.2) : fmat(scene, "greenCap", "#2fbf4a", 0.2);
    const cap = sph("cap", 0.95, 24, 0.5);
    cap.scaling.y = 1.05;
    part(cap, capMat, 0, 1.2, 0);
    const under = MeshBuilder.CreateDisc(`under${type}`, { radius: 0.475, tessellation: 24 }, scene);
    under.rotation.x = -Math.PI / 2;
    part(under, fmat(scene, "gill", "#f3d2a2", 0.6), 0, 1.2, 0);
    const spots: [number, number][] = [[0, 0.5], [0.9, 0.25], [-0.9, 0.25], [2.2, 0.75], [-2.2, 0.75], [3.14, 0.35], [0, 1.25]];
    for (const [az, el] of spots) {
      const sp = sph("spot", 0.24, 12);
      sp.scaling.y = 0.35;
      const r = 0.475, ry = 0.5;
      const pos = new Vector3(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * ry, Math.cos(az) * Math.cos(el) * r);
      part(sp, white, pos.x, 1.2 + pos.y, pos.z);
      sp.lookAt(sp.position.add(new Vector3(pos.x, pos.y * 0.6, pos.z)), 0, Math.PI / 2, 0);
    }
  } else if (type === 2) {
    const body = template.clone(`goldBody${type}`, null, true)!;
    body.isVisible = true;
    body.rotationQuaternion = null;
    body.setEnabled(true);
    part(body, fmat(scene, "gold", "#ffcf3a", 0.15, 1), 0, 0, 0);
    // Star face on the head
    const star = new TransformNode(`star${type}`, scene);
    star.parent = root;
    star.position.set(0, 1.45, 0.17);
    const starMat = fmat(scene, "star", "#ffe14a", 0.2, 0.3, 0.45);
    const core = MeshBuilder.CreateCylinder(`starCore${type}`, { height: 0.08, diameter: 0.2, tessellation: 10 }, scene);
    core.rotation.x = Math.PI / 2;
    core.parent = star;
    core.material = starMat;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const arm = MeshBuilder.CreateCylinder(`starArm${type}${k}`, { height: 0.2, diameterTop: 0, diameterBottom: 0.13, tessellation: 4 }, scene);
      arm.parent = star;
      arm.position.set(-Math.sin(a) * 0.14, Math.cos(a) * 0.14, 0);
      arm.rotation.z = a;
      arm.scaling.z = 0.4;
      arm.material = starMat;
    }
    for (const s of [-1, 1]) {
      const e = sph("starEye", 0.06, 8);
      e.scaling.set(0.6, 1, 0.5);
      e.parent = star;
      e.position.set(s * 0.035, 0.01, 0.04);
      e.material = black;
    }
  } else if (type === 3) {
    const bodyMat = fmat(scene, "shellBody", "#ffd166", 0.3);
    const legs = MeshBuilder.CreateCylinder(`shellLegs${type}`, { height: 0.55, diameter: 0.46, tessellation: 20 }, scene);
    part(legs, bodyMat, 0, 0.275, 0);
    const shell = sph("shell", 0.8, 24);
    shell.scaling.set(1, 1.05, 0.95);
    part(shell, fmat(scene, "shell", "#2f9e44", 0.2), 0, 0.85, -0.03);
    const rim = MeshBuilder.CreateTorus(`shellRim${type}`, { diameter: 0.74, thickness: 0.1, tessellation: 28 }, scene);
    part(rim, fmat(scene, "shellRim", "#fff3c4", 0.3), 0, 0.55, -0.03);
    const spikeMat = white;
    const dirs: [number, number][] = [[0, 1.2], [1.6, 0.55], [-1.6, 0.55], [3.14, 0.6], [0.8, 0.35], [-0.8, 0.35], [2.4, 0.4], [-2.4, 0.4]];
    for (const [az, el] of dirs) {
      const n = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      const sp = MeshBuilder.CreateCylinder(`shellSpike${type}`, { height: 0.24, diameterTop: 0, diameterBottom: 0.14, tessellation: 8 }, scene);
      part(sp, spikeMat, n.x * 0.4, 0.85 + n.y * 0.42, -0.03 + n.z * 0.38);
      sp.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), n, new Quaternion());
    }
    const head = sph("shellHead", 0.42, 18);
    part(head, bodyMat, 0, 1.45, 0.06);
    roundEyes(1.5, 0.24, 0.07, 0.12);
  } else if (type === 4) {
    const stem = MeshBuilder.CreateCylinder(`gStem${type}`, { height: 0.7, diameterTop: 0.5, diameterBottom: 0.56, tessellation: 20 }, scene);
    part(stem, cream, 0, 0.35, 0);
    const head = sph("gHead", 1.0, 24, 0.5);
    head.scaling.y = 1.55;
    part(head, fmat(scene, "brownCap", "#9a5a2b", 0.3), 0, 0.62, 0);
    const under = MeshBuilder.CreateDisc(`gUnder${type}`, { radius: 0.5, tessellation: 24 }, scene);
    under.rotation.x = -Math.PI / 2;
    part(under, fmat(scene, "gUnder", "#f3d2a2", 0.6), 0, 0.62, 0);
    roundEyes(1.0, 0.43, 0.12, 0.17);
    const brow = fmat(scene, "brow", "#2b160a", 0.4);
    for (const s of [-1, 1]) {
      const b = MeshBuilder.CreateBox(`brow${type}`, { width: 0.2, height: 0.05, depth: 0.05 }, scene);
      part(b, brow, s * 0.12, 1.15, 0.44);
      b.rotation.z = s * 0.45;
      const fang = MeshBuilder.CreateCylinder(`fang${type}`, { height: 0.07, diameterTop: 0, diameterBottom: 0.05, tessellation: 6 }, scene);
      fang.rotation.x = Math.PI;
      part(fang, white, s * 0.07, 0.72, 0.47);
      const foot = sph("foot", 0.3, 12);
      foot.scaling.set(1, 0.5, 1.3);
      part(foot, fmat(scene, "foot", "#4a2a12", 0.5), s * 0.16, 0.06, 0.08);
    }
  } else {
    const ghost = fmat(scene, "ghost", "#f8fafc", 0.3, 0, 0.35);
    ghost.alpha = 0.92;
    const body = MeshBuilder.CreateCylinder(`ghostBody${type}`, { height: 1.2, diameterTop: 0.62, diameterBottom: 0.5, tessellation: 24 }, scene);
    part(body, ghost, 0, 0.7, 0);
    const top = sph("ghostTop", 0.62, 20, 0.5);
    part(top, ghost, 0, 1.3, 0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const scallop = sph("ghostHem", 0.2, 10);
      part(scallop, ghost, Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2);
    }
    ovalEyes(1.32, 0.29, 0.09, 0.15);
    const mouth = sph("ghostMouth", 0.12, 10);
    mouth.scaling.set(1, 0.7, 0.4);
    part(mouth, fmat(scene, "ghostMouth", "#ff7aa8", 0.4), 0, 1.13, 0.3);
    for (const s of [-1, 1]) {
      const arm = sph("ghostArm", 0.18, 10);
      arm.scaling.set(1, 0.7, 0.8);
      part(arm, ghost, s * 0.33, 0.95, 0.05);
      const blush = sph("blush", 0.08, 8);
      blush.scaling.z = 0.3;
      part(blush, fmat(scene, "blush", "#ffb3c7", 0.5), s * 0.17, 1.2, 0.29);
    }
  }
  return root;
}
