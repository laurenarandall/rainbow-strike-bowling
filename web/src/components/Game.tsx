import { useRef, useEffect } from "react";
import { useSound } from "@freegamestore/games";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
// Side-effect: registers the scene component that hooks shadowGen into the render pipeline.
// Without this, `new ShadowGenerator(...)` throws "needs to be imported before".
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { SoundFX } from "../sound";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox, PhysicsShapeSphere, PhysicsShapeContainer } from "@babylonjs/core/Physics/v2/physicsShape";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import type { Character } from "../characters";
import { CHARACTERS } from "../characters";
import { PLAYER_NAME, NAME_PHRASES, floatPhrase, animalDisco, fireworks } from "../fx";

export interface FrameStars {
  pins: number;
  stars: number;
  strike: boolean;
  spare: boolean;
  done: boolean;
}

export function starsForFrame(throws: number[]): number {
  const first = throws[0] ?? 0;
  const total = Math.min(10, first + (throws[1] ?? 0));
  if (first === 10 || total >= 10) return 3;
  if (total >= 6) return 2;
  if (total >= 1) return 1;
  return 0;
}

interface GameProps {
  onScore: (score: number) => void;
  onGameOver: () => void;
  onStats?: (stats: { frame: number; frames?: FrameStars[] }) => void;
  character?: Character;
  bumpers?: boolean;
  onThrow?: (t: { pins: number; strike: boolean; spare: boolean; gutter: boolean; frame: number }) => void;
}

// --- Pin layout: standard triangle, 10 pins ---
const PIN_SPACING = 0.9;
const PIN_Z_START = -18;

function getPinPositions(): Vector3[] {
  const positions: Vector3[] = [];
  let id = 0;
  for (let row = 0; row < 4; row++) {
    const count = row + 1;
    const offsetX = -(count - 1) * PIN_SPACING * 0.5;
    for (let col = 0; col < count; col++) {
      positions[id] = new Vector3(
        offsetX + col * PIN_SPACING,
        0,
        PIN_Z_START - row * PIN_SPACING,
      );
      id++;
    }
  }
  return positions;
}

const PIN_POSITIONS = getPinPositions();
const LANE_WIDTH = 5;
const LANE_LENGTH = 25;
const BALL_RADIUS = 0.35;
const PIN_RADIUS = 0.18;
const PIN_HEIGHT = 1.05;
const BALL_SPEED = 25;
const KNOCK_DISTANCE = BALL_RADIUS + 0.22;
// Easy mode: bigger hit zone when the power lands in the green sweet spot.
const SWEET_MIN = 0.6;
const SWEET_MAX = 0.72;
const EASY_MODE = true;
// Ball feel: a gentle, consistent hook that kicks in down-lane, plus random drift
// that gets bigger the further the power is from the sweet spot.
const HOOK_ACCEL = 0.5;
const HOOK_START_Z = -4;
const PIN_HIT_RADIUS = 0.55; // knocked pin vs standing pin contact distance
const PIN_FRICTION = 2.2;
const RAINBOW = ["#ff3b3b", "#ff8c1a", "#ffd60a", "#3ddc4a", "#1fb6ff", "#4c5cff", "#b14cff"];
const PIN_COLORS = ["#ff3b3b", "#ff8c1a", "#ffd60a", "#3ddc4a", "#1fb6ff", "#4c5cff", "#b14cff", "#ff4fb8", "#00d1c1", "#ffffff"];
const CHEERS = ["Great job!", "Awesome!", "Way to go!", "Super!", "Nice roll!", "You rock!", "Wow!"];
const TOTAL_FRAMES = 10;

interface PinState {
  mesh: Mesh;
  knocked: boolean;
  fallAngle: number;
  fallAxis: Vector3;
  // Direction (in the xz plane) the pin's tip travels while falling.
  // Precomputed at knock time so the per-frame animation does zero allocs.
  fallTipX: number;
  fallTipZ: number;
  // Persistent quaternion reused each frame to avoid per-frame allocations.
  quat: Quaternion;
  originalPos: Vector3;
  knockDelay: number;
  vx: number;
  vz: number;
  offX: number;
  offZ: number;
  // Real rigid body when Havok physics is running (null in fallback mode).
  body: PhysicsBody | null;
}

interface FrameScore {
  throws: number[];
  pinsDown: number[];
}

function computeTotalScore(frames: FrameScore[]): number {
  let total = 0;
  const allThrows: number[] = [];
  for (const f of frames) {
    for (const t of f.throws) {
      allThrows.push(t);
    }
  }

  let throwIdx = 0;
  for (let f = 0; f < 10; f++) {
    const frame = frames[f];
    if (!frame) break;

    if (f < 9) {
      if (frame.throws[0] === 10) {
        const b1 = allThrows[throwIdx + 1] ?? 0;
        const b2 = allThrows[throwIdx + 2] ?? 0;
        total += 10 + b1 + b2;
        throwIdx += 1;
      } else if ((frame.throws[0] ?? 0) + (frame.throws[1] ?? 0) === 10) {
        const b1 = allThrows[throwIdx + 2] ?? 0;
        total += 10 + b1;
        throwIdx += 2;
      } else {
        total += (frame.throws[0] ?? 0) + (frame.throws[1] ?? 0);
        throwIdx += 2;
      }
    } else {
      for (const t of frame.throws) {
        total += t;
      }
      throwIdx += frame.throws.length;
    }
  }
  return total;
}

type ThrowPhase = "aiming" | "power" | "spin" | "rolling" | "settling" | "done";

// How aggressively spin accumulates lateral velocity per second while the
// ball is rolling. Tuned so spin=±1 produces a visibly hooked path that
// can swing wide enough to convert outer-pin spares but won't curve into
// the gutter from a centerline aim at typical power.
const CURVE_RATE = 4;

// Procedural wood-grain texture for the lane. Eight vertical planks with
// a subtle grain speckle. Painted once into a DynamicTexture so the
// material has real visual detail without shipping an image asset.
function createWoodTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture("laneTex", size, scene, true);
  const c = tex.getContext() as unknown as CanvasRenderingContext2D;
  // Rainbow stripes running down the lane (one per color across the width).
  const n = RAINBOW.length;
  for (let i = 0; i < n; i++) {
    c.fillStyle = RAINBOW[i]!;
    c.fillRect(0, Math.floor((i / n) * size), size, Math.ceil(size / n) + 1);
  }
  // Soft white seams + a little sparkle so it still reads as a lane.
  c.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 1; i < n; i++) c.fillRect(0, Math.round((i / n) * size) - 1, size, 2);
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
    c.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 1);
  }
  tex.update();
  return tex;
}

export function Game({ onScore, onGameOver, onStats, character, bumpers = false, onThrow }: GameProps) {
  const bumpersRef = useRef(bumpers);
  bumpersRef.current = bumpers;
  const onThrowRef = useRef(onThrow);
  onThrowRef.current = onThrow;
  const characterRef = useRef<Character>(character ?? CHARACTERS[0]!);
  characterRef.current = character ?? CHARACTERS[0]!;
  // Pulls from the SoundProvider that GameShell wraps around its children.
  // Gates the SoundFX class's playback so the topbar Mute button works.
  const { muted, toggle } = useSound();
  // Kids want sound: turn it on once at startup (the speaker button still mutes).
  const unmutedOnce = useRef(false);
  useEffect(() => {
    if (!unmutedOnce.current) {
      unmutedOnce.current = true;
      if (muted) toggle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sfxRef = useRef<SoundFX | null>(null);
  const onScoreRef = useRef(onScore);
  const onGameOverRef = useRef(onGameOver);
  const onStatsRef = useRef(onStats);
  onScoreRef.current = onScore;
  onGameOverRef.current = onGameOver;
  onStatsRef.current = onStats;

  // Forward platform mute state into SoundFX whenever it changes.
  const startPlayed = useRef(false);
  useEffect(() => {
    sfxRef.current?.setMuted(muted);
    if (!muted && !startPlayed.current && sfxRef.current) {
      startPlayed.current = true;
      sfxRef.current.startJingle();
    }
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, {
      // preserveDrawingBuffer was only needed for screenshot capture; off saves a copy each frame.
      preserveDrawingBuffer: false,
      stencil: true,
    });
    engineRef.current = engine;
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.45, 0.75, 1, 1);

    // ---- Camera: fixed behind ball, no user rotation, never moves ----
    const camera = new FreeCamera("cam", new Vector3(0, 6.5, 13.5), scene);
    camera.setTarget(new Vector3(0, 0, -10));
    camera.fov = 0.78;
    // Do NOT attach controls -- the camera is locked for the whole game

    // ---- Lighting ----
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.95;
    hemi.groundColor = new Color3(0.15, 0.12, 0.1);

    const dir = new DirectionalLight(
      "dir",
      new Vector3(-0.5, -2, -1).normalize(),
      scene,
    );
    dir.intensity = 0.9;
    dir.position = new Vector3(5, 12, 5);

    const shadowGen = new ShadowGenerator(1024, dir);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 32;
    shadowGen.darkness = 0.5;

    // Subtle point light near pins for visibility
    const pinSpot = new PointLight("pinSpot", new Vector3(0, 5, PIN_Z_START), scene);
    pinSpot.intensity = 0.5;
    pinSpot.diffuse = new Color3(1, 0.95, 0.85);

    const glow = new GlowLayer("glow", scene, { mainTextureSamples: 2 });
    glow.intensity = 0.5;
    const glowMeshes: Mesh[] = [];

    // ---- Surrounding floor (so the lane doesn't float in the void) ----
    const floor = MeshBuilder.CreateGround(
      "floor",
      { width: 60, height: 80 },
      scene,
    );
    floor.position.y = -0.15;
    floor.position.z = -LANE_LENGTH / 2 + 5;
    const floorMat = new StandardMaterial("floorMat", scene);
    floorMat.diffuseColor = new Color3(0.35, 0.8, 0.4);
    floorMat.specularColor = new Color3(0.05, 0.05, 0.05);
    floor.material = floorMat;
    floor.receiveShadows = true;

    // ---- Lane floor ----
    const lane = MeshBuilder.CreateBox(
      "lane",
      { width: LANE_WIDTH, height: 0.2, depth: LANE_LENGTH },
      scene,
    );
    lane.position.y = -0.1;
    lane.position.z = -LANE_LENGTH / 2 + 5;
    const laneMat = new StandardMaterial("laneMat", scene);
    laneMat.diffuseTexture = createWoodTexture(scene);
    // V repeats along the lane length so plank seams look long & thin.
    (laneMat.diffuseTexture as DynamicTexture).vScale = 1;
    laneMat.emissiveColor = new Color3(0.15, 0.15, 0.15);
    laneMat.specularColor = new Color3(0.35, 0.3, 0.18);
    laneMat.specularPower = 96;
    lane.material = laneMat;
    lane.receiveShadows = true;

    // Lane arrows (decorative guide marks)
    for (let i = -1; i <= 1; i++) {
      const guide = MeshBuilder.CreateBox(
        `guide${i}`,
        { width: 0.06, height: 0.01, depth: 1.5 },
        scene,
      );
      guide.position.set(i * 0.8, 0.01, 1);
      const gMat = new StandardMaterial(`gMat${i}`, scene);
      gMat.diffuseColor = new Color3(1, 1, 1);
      gMat.alpha = 0.8;
      guide.material = gMat;
    }

    // ---- Gutters ----
    for (const side of [-1, 1]) {
      const gutter = MeshBuilder.CreateBox(
        "gutter",
        { width: 0.5, height: 0.15, depth: LANE_LENGTH },
        scene,
      );
      gutter.position.x = side * (LANE_WIDTH / 2 + 0.25);
      gutter.position.y = -0.05;
      gutter.position.z = -LANE_LENGTH / 2 + 5;
      const gutterMat = new StandardMaterial("gutterMat", scene);
      gutterMat.diffuseColor = new Color3(0.25, 0.25, 0.3);
      gutter.material = gutterMat;
    }

    // ---- Bumpers: soft rainbow rails over the gutters ----
    const bumperMeshes: Mesh[] = [];
    {
      for (const side of [-1, 1]) {
        const bumper = MeshBuilder.CreateCylinder(
          `bumper${side}`,
          { height: LANE_LENGTH, diameter: 0.35, tessellation: 16 },
          scene,
        );
        bumper.rotation.x = Math.PI / 2;
        bumper.position.set(side * (LANE_WIDTH / 2 + 0.2), 0.2, -LANE_LENGTH / 2 + 5);
        const bMat = new StandardMaterial(`bumperMat${side}`, scene);
        bMat.diffuseColor = side < 0 ? new Color3(1, 0.3, 0.7) : new Color3(0.2, 0.7, 1);
        bMat.emissiveColor = bMat.diffuseColor.scale(0.4);
        bumper.material = bMat;
        bumperMeshes.push(bumper);
      }
    }

    // ---- Back wall ----
    const backWall = MeshBuilder.CreateBox(
      "backWall",
      { width: LANE_WIDTH + 1, height: 2, depth: 0.3 },
      scene,
    );
    backWall.position.z = PIN_Z_START - 3.5;
    backWall.position.y = 1;
    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new Color3(0.6, 0.4, 0.9);
    backWall.material = wallMat;
    backWall.isVisible = false;

    // ---- Rainbow Strike Castle ----
    const CASTLE_Z = PIN_Z_START - 4.2;
    const castleColors = RAINBOW.map((hex) => {
      const m = new StandardMaterial(`castle${hex}`, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(0.2);
      return m;
    });
    const stoneMat = new StandardMaterial("stoneMat", scene);
    stoneMat.diffuseColor = new Color3(0.95, 0.9, 1);
    // Wall segments either side of the gate, each brick course a rainbow color.
    const WALL_H = 3.2;
    const GATE_W = 3;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        const seg = MeshBuilder.CreateBox(`wall${side}${row}`, { width: 5.5, height: WALL_H / 4, depth: 0.6 }, scene);
        seg.position.set(side * (GATE_W / 2 + 2.75), (row + 0.5) * (WALL_H / 4), CASTLE_Z);
        seg.material = castleColors[(row + (side > 0 ? 3 : 0)) % castleColors.length]!;
      }
      // Crenellations
      for (let k = 0; k < 4; k++) {
        const cren = MeshBuilder.CreateBox(`cren${side}${k}`, { width: 0.7, height: 0.6, depth: 0.6 }, scene);
        cren.position.set(side * (GATE_W / 2 + 0.6 + k * 1.4), WALL_H + 0.3, CASTLE_Z);
        cren.material = castleColors[(k * 2 + (side > 0 ? 1 : 0)) % castleColors.length]!;
      }
      // Towers with cone roofs and banners
      const tower = MeshBuilder.CreateCylinder(`tower${side}`, { height: 5.5, diameter: 2, tessellation: 20 }, scene);
      tower.position.set(side * (GATE_W / 2 + 5.8), 2.75, CASTLE_Z);
      tower.material = stoneMat;
      for (let r = 0; r < 7; r++) {
        const ring = MeshBuilder.CreateCylinder(`tring${side}${r}`, { height: 0.25, diameter: 2.08, tessellation: 20 }, scene);
        ring.position.set(tower.position.x, 0.4 + r * 0.75, CASTLE_Z);
        ring.material = castleColors[r]!;
      }
      const roof = MeshBuilder.CreateCylinder(`roof${side}`, { height: 2.2, diameterTop: 0, diameterBottom: 2.6, tessellation: 20 }, scene);
      roof.position.set(tower.position.x, 6.6, CASTLE_Z);
      roof.material = castleColors[side < 0 ? 0 : 5]!;
      const pole = MeshBuilder.CreateCylinder(`pole${side}`, { height: 1.4, diameter: 0.08 }, scene);
      pole.position.set(tower.position.x, 8.2, CASTLE_Z);
      pole.material = stoneMat;
      const flag = MeshBuilder.CreatePlane(`flag${side}`, { width: 1, height: 0.6, sideOrientation: 2 }, scene);
      flag.position.set(tower.position.x + side * 0.5, 8.55, CASTLE_Z);
      flag.material = castleColors[side < 0 ? 2 : 4]!;
      // Hanging banners on the wall
      for (let b = 0; b < 2; b++) {
        const banner = MeshBuilder.CreatePlane(`banner${side}${b}`, { width: 0.8, height: 1.8 }, scene);
        banner.position.set(side * (GATE_W / 2 + 1.5 + b * 2.2), 2, CASTLE_Z + 0.32);
        banner.rotation.y = Math.PI;
        banner.material = castleColors[(b * 3 + (side > 0 ? 1 : 4)) % castleColors.length]!;
      }
    }
    // Gate arch top + dark gate opening
    const lintel = MeshBuilder.CreateBox("lintel", { width: GATE_W + 0.2, height: 0.8, depth: 0.7 }, scene);
    lintel.position.set(0, WALL_H - 0.1, CASTLE_Z);
    lintel.material = castleColors[6]!;
    const gateDark = MeshBuilder.CreatePlane("gateDark", { width: GATE_W, height: WALL_H - 0.5 }, scene);
    gateDark.position.set(0, (WALL_H - 0.5) / 2, CASTLE_Z + 0.1);
    gateDark.rotation.y = Math.PI;
    const gateDarkMat = new StandardMaterial("gateDarkMat", scene);
    gateDarkMat.diffuseColor = new Color3(1, 0.85, 0.2);
    gateDarkMat.emissiveColor = new Color3(1, 0.75, 0.1);
    gateDark.material = gateDarkMat;
    // Drawbridge, hinged at its bottom edge; drops toward the lane on a strike.
    const bridgePivot = new TransformNode("bridgePivot", scene);
    bridgePivot.position.set(0, 0, CASTLE_Z + 0.4);
    const bridge = MeshBuilder.CreateBox("bridge", { width: GATE_W, height: WALL_H - 0.5, depth: 0.2 }, scene);
    bridge.parent = bridgePivot;
    bridge.position.y = (WALL_H - 0.5) / 2;
    const bridgeMat = new StandardMaterial("bridgeMat", scene);
    bridgeMat.diffuseColor = new Color3(0.6, 0.38, 0.2);
    bridge.material = bridgeMat;
    for (let pl = 0; pl < 4; pl++) {
      const plank = MeshBuilder.CreateBox(`plank${pl}`, { width: GATE_W + 0.02, height: 0.08, depth: 0.22 }, scene);
      plank.parent = bridge;
      plank.position.y = -0.9 + pl * 0.6;
      plank.material = castleColors[pl * 2]!;
    }
    let bridgeTarget = 0; // 0 = up (closed), 1 = down (open)
    let bridgeOpen = 0;

    // ---- Pin materials ----
    const pinMat = new StandardMaterial("pinMat", scene);
    pinMat.diffuseColor = new Color3(0.97, 0.97, 0.92);
    pinMat.specularColor = new Color3(0.6, 0.6, 0.6);
    pinMat.specularPower = 32;

    const pinRedMat = new StandardMaterial("pinRedMat", scene);
    pinRedMat.diffuseColor = new Color3(1, 1, 1);
    pinRedMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
    const pinMats = PIN_COLORS.map((hex, i) => {
      const m = new StandardMaterial(`pinMat${i}`, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(0.25);
      m.specularColor = new Color3(0.6, 0.6, 0.6);
      m.specularPower = 32;
      return m;
    });
    void pinMat;

    // ---- Real physics (Havok) ----
    // Loaded async; until it is ready (or if it fails) the old arcade
    // simulation keeps the game playable.
    let physOn = false;
    let physPending = false;
    let disposed = false;
    let ballBody: PhysicsBody | null = null;
    let bumperBodies: PhysicsBody[] = [];
    let lastHitSfx = 0;
    let physRollTime = 0;
    let firstCrash = false;
    let shake = 0;
    let camT = 0;
    const camTarget = new Vector3(0, 0, -10);
    const PIN_MASS = 1.5;
    const BALL_MASS = 7;
    function makeStatic(name: string, w: number, h: number, d: number, x: number, y: number, z: number, restitution = 0.2, friction = 0.5): PhysicsBody {
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
    function disposeBody(b: PhysicsBody | null) {
      if (!b) return;
      b.shape?.dispose();
      b.dispose();
    }
    function onCrash(ev: { impulse: number }) {
      const now = performance.now();
      const imp = ev.impulse || 0;
      if (imp < 0.6 || now - lastHitSfx < 35) return;
      lastHitSfx = now;
      sfx.pinHit(Math.min(1, imp / 12));
      if (!firstCrash && imp > 4 && throwPhase === "rolling") {
        firstCrash = true;
        shake = 0.35;
      }
    }
    function addPinBody(p: PinState) {
      if (!physOn || p.body) return;
      const BH = PIN_HEIGHT / 3;
      p.mesh.rotationQuaternion = p.mesh.rotationQuaternion ?? Quaternion.Identity();
      const c = new PhysicsShapeContainer(scene);
      c.addChild(new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(0.43, BH, 0.43), scene), new Vector3(0, -BH, 0));
      c.addChild(new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(0.36, BH, 0.36), scene), new Vector3(0, 0, 0));
      c.addChild(new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(0.29, BH + 0.07, 0.29), scene), new Vector3(0, BH + 0.035, 0));
      c.material = { friction: 0.7, restitution: 0.4 };
      const body = new PhysicsBody(p.mesh, PhysicsMotionType.DYNAMIC, false, scene);
      body.shape = c;
      body.setMassProperties({ mass: PIN_MASS, centerOfMass: new Vector3(0, 0.12, 0) });
      body.setAngularDamping(0.25);
      body.setLinearDamping(0.15);
      body.setCollisionCallbackEnabled(true);
      body.getCollisionObservable().add(onCrash);
      p.body = body;
    }
    function removePinBody(p: PinState) {
      disposeBody(p.body);
      p.body = null;
    }
    function updateBumperBodies() {
      for (const b of bumperBodies) {
        const m = b.transformNode;
        disposeBody(b);
        m.dispose();
      }
      bumperBodies = [];
      if (!physOn || !bumpersRef.current) return;
      for (const side of [-1, 1]) {
        bumperBodies.push(makeStatic(`bumperBody${side}`, 0.24, 0.7, LANE_LENGTH, side * (LANE_WIDTH / 2 + 0.12), 0.3, -LANE_LENGTH / 2 + 5, 0.55, 0.2));
      }
    }
    function activatePhysics() {
      physOn = true;
      physPending = false;
      for (const p of pins) if (!p.knocked && p.mesh.isEnabled()) addPinBody(p);
      updateBumperBodies();
    }
    HavokPhysics({ locateFile: () => havokWasmUrl })
      .then((hk) => {
        if (disposed) return;
        const plugin = new HavokPlugin(true, hk);
        // The world is ~2.7x real scale, so gravity is scaled to keep pins
        // falling at a believable speed.
        scene.enablePhysics(new Vector3(0, -9.81 * 2.6, 0), plugin);
        scene.getPhysicsEngine()?.setSubTimeStep(4);
        const LZ = -LANE_LENGTH / 2 + 5;
        // Gutter/floor level, the lane, the pin deck and the pit.
        makeStatic("physFloor", 40, 0.2, 60, 0, -0.25, LZ, 0.1, 0.6);
        makeStatic("physLane", LANE_WIDTH, 0.2, LANE_LENGTH, 0, -0.1, LZ, 0.05, 0.25);
        makeStatic("physDeck", LANE_WIDTH, 0.2, 2.2, 0, -0.1, PIN_Z_START - 2.5, 0.05, 0.5);
        // Gutter outer walls and pin-deck side walls (kickbacks!).
        for (const side of [-1, 1]) {
          makeStatic(`physGutterWall${side}`, 0.3, 0.8, LANE_LENGTH + 4, side * (LANE_WIDTH / 2 + 0.65), 0.2, LZ - 2, 0.3, 0.3);
          makeStatic(`physKick${side}`, 0.3, 3, 7, side * (LANE_WIDTH / 2 + 0.55), 1.3, PIN_Z_START - 1.8, 0.5, 0.3);
        }
        makeStatic("physBack", LANE_WIDTH + 2, 4, 0.4, 0, 1.8, PIN_Z_START - 3.5, 0.15, 0.6);
        if (throwPhase === "rolling" || throwPhase === "settling" || throwPhase === "done") physPending = true;
        else activatePhysics();
      })
      .catch((e) => {
        console.warn("Havok physics unavailable, using arcade physics", e);
      });

    // ---- Create pins ----
    function createPins(): PinState[] {
      const pins: PinState[] = [];
      for (let i = 0; i < 10; i++) {
        const pos = PIN_POSITIONS[i]!;
        // LEGO-style pin: three stacked bricks (narrowing) with studs on top.
        const BH = PIN_HEIGHT / 3;
        const pinBody = MeshBuilder.CreateBox(
          `pin${i}`,
          { width: 0.36, height: BH, depth: 0.36 },
          scene,
        );
        const lower = MeshBuilder.CreateBox(`pinLo${i}`, { width: 0.43, height: BH * 0.96, depth: 0.43 }, scene);
        lower.parent = pinBody;
        lower.position.y = -BH;
        lower.material = pinMats[i]!;
        const upper = MeshBuilder.CreateBox(`pinUp${i}`, { width: 0.29, height: BH * 0.96, depth: 0.29 }, scene);
        upper.parent = pinBody;
        upper.position.y = BH;
        upper.material = pinMats[(i + 3) % pinMats.length]!;
        for (let sx = -1; sx <= 1; sx += 2) {
          for (let sz = -1; sz <= 1; sz += 2) {
            const stud = MeshBuilder.CreateCylinder(`pinStud${i}${sx}${sz}`, { height: 0.07, diameter: 0.1, tessellation: 10 }, scene);
            stud.parent = pinBody;
            stud.position.set(sx * 0.072, BH * 1.5 + 0.035, sz * 0.072);
            stud.material = pinMats[(i + 3) % pinMats.length]!;
          }
        }
        pinBody.position = pos.clone();
        pinBody.position.y = PIN_HEIGHT / 2;
        pinBody.material = pinMats[i]!;
        shadowGen.addShadowCaster(pinBody, true);

        // White "smile" stripe on the middle brick
        const stripe = MeshBuilder.CreateBox(`stripe${i}`, { width: 0.37, height: 0.06, depth: 0.37 }, scene);
        stripe.parent = pinBody;
        stripe.position.y = 0;
        stripe.material = pinRedMat;

        for (const c of pinBody.getChildMeshes()) shadowGen.addShadowCaster(c as Mesh);
        pins.push({
          mesh: pinBody,
          knocked: false,
          fallAngle: 0,
          fallAxis: Vector3.Right(),
          fallTipX: 0,
          fallTipZ: 0,
          quat: new Quaternion(),
          originalPos: pos.clone(),
          knockDelay: 0,
          vx: 0,
          vz: 0,
          offX: 0,
          offZ: 0,
          body: null,
        });
      }
      if (physOn) for (const p of pins) addPinBody(p);
      return pins;
    }

    let pins = createPins();

    // Knock a pin and lock in its fall direction.
    // `axisX, axisZ` is the rotation axis in the xz-plane (y is always 0, so the
    // pin tips horizontally). The tip travels along (axisZ, -axisX) — the cross
    // of world-up with the axis. Both are pre-normalized here so no per-frame
    // sqrt or Vector3 allocation is needed inside the render loop.
    function setPinFall(p: PinState, axisX: number, axisZ: number) {
      const mag = Math.hypot(axisX, axisZ) || 1;
      const ax = axisX / mag;
      const az = axisZ / mag;
      p.fallAxis.set(ax, 0, az);
      p.fallTipX = az;
      p.fallTipZ = -ax;
      p.fallAngle = 0;
      p.knocked = true;
    }

    // ---- Ball ----
    const ball = MeshBuilder.CreateSphere(
      "ball",
      { diameter: BALL_RADIUS * 2, segments: 16 },
      scene,
    );
    const ballMat = new StandardMaterial("ballMat", scene);
    ballMat.diffuseColor = Color3.FromHexString(characterRef.current.ballColor);
    ballMat.emissiveColor = Color3.FromHexString(characterRef.current.ballColor).scale(0.2);
    const studMat = new StandardMaterial("ballStudMat", scene);
    studMat.diffuseColor = Color3.FromHexString(characterRef.current.studColor);
    studMat.emissiveColor = studMat.diffuseColor.scale(0.2);
    {
      // Fibonacci-sphere distribution of LEGO studs over the ball.
      const N = 26;
      const up = Vector3.Up();
      for (let k = 0; k < N; k++) {
        const y = 1 - (2 * (k + 0.5)) / N;
        const r = Math.sqrt(1 - y * y);
        const th = k * 2.399963;
        const n = new Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
        const stud = MeshBuilder.CreateCylinder(`ballStud${k}`, { height: 0.1, diameter: 0.12, tessellation: 10 }, scene);
        stud.parent = null;
        stud.position = n.scale(BALL_RADIUS);
        stud.rotationQuaternion = Quaternion.FromUnitVectorsToRef(up, n, new Quaternion());
        stud.material = studMat;
        // parent after placement so positions are in ball-local space
        stud.parent = ball;
      }
    }
    ballMat.specularColor = new Color3(0.6, 0.6, 0.8);
    ballMat.specularPower = 64;
    ball.material = ballMat;
    shadowGen.addShadowCaster(ball);

    // Finger holes
    for (let h = 0; h < 0; h++) {
      const hole = MeshBuilder.CreateCylinder(
        `hole${h}`,
        { height: 0.08, diameter: 0.09, tessellation: 8 },
        scene,
      );
      hole.parent = ball;
      const angle = (h - 1) * 0.3;
      hole.position.set(
        Math.sin(angle) * 0.2,
        BALL_RADIUS - 0.02,
        Math.cos(angle) * 0.2,
      );
      const holeMat = new StandardMaterial(`holeMat${h}`, scene);
      holeMat.diffuseColor = new Color3(0.02, 0.02, 0.08);
      hole.material = holeMat;
    }

    // ---- Aiming arrow (3D indicator on lane) ----
    const arrow = MeshBuilder.CreateBox(
      "arrow",
      { width: 0.02, height: 0.01, depth: 0.02 },
      scene,
    );
    const arrowMat = new StandardMaterial("arrowMat", scene);
    arrowMat.diffuseColor = new Color3(1, 1, 1);
    arrowMat.emissiveColor = new Color3(1, 1, 1);
    arrow.material = arrowMat;
    // Thick rainbow shaft: seven glowing color bands side by side.
    const SHAFT_W = 0.7;
    RAINBOW.forEach((hex, k) => {
      const band = MeshBuilder.CreateBox(`arrowBand${k}`, { width: SHAFT_W / RAINBOW.length + 0.005, height: 0.04, depth: 2.8 }, scene);
      band.parent = arrow;
      band.position.x = (k - (RAINBOW.length - 1) / 2) * (SHAFT_W / RAINBOW.length);
      band.position.y = 0.02;
      const m = new StandardMaterial(`arrowBandMat${k}`, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(0.55);
      band.material = m;
    });

    // Arrow head: a flat triangle on the lane with its apex pointing along -z
    // (toward the pins). Babylon's cylinder is Y-aligned, so we lay it on its
    // side (rotation.x = -π/2) and then rotate around the now-Z axis by π/2
    // so the cone's apex (originally on +Y) ends up at -Z.
    const arrowHead = MeshBuilder.CreateCylinder(
      "arrowHead",
      { height: 0.9, diameterTop: 0, diameterBottom: 1.3, tessellation: 3 },
      scene,
    );
    arrowHead.parent = arrow;
    arrowHead.position.z = -1.8;
    arrowHead.position.y = 0.03;
    arrowHead.rotation.x = -Math.PI / 2;
    arrowHead.scaling.z = 0.08;
    const headMat = new StandardMaterial("arrowHeadMat", scene);
    headMat.diffuseColor = Color3.FromHexString("#ff4fb8");
    headMat.emissiveColor = Color3.FromHexString("#ff4fb8").scale(0.9);
    arrowHead.material = headMat;
    glowMeshes.push(arrowHead);
    glow.addIncludedOnlyMesh(arrowHead);
    for (const gm of glowMeshes) glow.addIncludedOnlyMesh(gm);

    // ---- Trajectory preview: a dashed line showing the predicted ball path
    // given current aim+power+spin. Updated each frame during AIM and SPIN
    // phases so the player can see the curve before committing.
    const TRAJ_POINTS = 48;
    const initialTrajPoints: Vector3[] = [];
    for (let i = 0; i < TRAJ_POINTS; i++) initialTrajPoints.push(new Vector3(0, 0.06, 5 - i * 0.5));
    let trajectory: LinesMesh = MeshBuilder.CreateLines(
      "trajectory",
      { points: initialTrajPoints, updatable: true },
      scene,
    );
    trajectory.color = new Color3(0.4, 0.9, 1);
    trajectory.alpha = 0.55;
    trajectory.isPickable = false;

    // ---- HUD: 2D overlay using AdvancedDynamicTexture ----
    // We use simple DOM elements instead for maximum compatibility
    // Create HUD container
    const hudDiv = document.createElement("div");
    hudDiv.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;";
    canvas.parentElement?.appendChild(hudDiv);

    // Phase label
    const phaseLabel = document.createElement("div");
    phaseLabel.style.cssText =
      "position:absolute;top:84px;left:50%;transform:translateX(-50%);white-space:nowrap;" +
      "font-family:Fraunces,serif;font-size:30px;font-weight:800;" +
      "color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.7);text-align:center;" +
      "padding:6px 18px;border-radius:12px;background:rgba(0,0,0,0.35);" +
      "backdrop-filter:blur(4px);transition:opacity 0.3s;";
    hudDiv.appendChild(phaseLabel);


    // Instructions (fade out)
    const instrLabel = document.createElement("div");
    instrLabel.style.cssText =
      "position:absolute;bottom:24px;left:50%;transform:translateX(-50%);" +
      "font-family:Manrope,sans-serif;font-size:18px;font-weight:700;" +
      "color:rgba(255,255,255,0.85);text-shadow:0 1px 4px rgba(0,0,0,0.6);" +
      "text-align:center;padding:8px 20px;border-radius:10px;" +
      "background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);" +
      "transition:opacity 0.5s;";
    hudDiv.appendChild(instrLabel);

    // Power meter (screen overlay bar)
    // Wrapper holds the label outside the clipping bar
    const powerWrap = document.createElement("div");
    powerWrap.style.cssText =
      "position:absolute;left:16px;top:50%;transform:translateY(-50%);" +
      "display:none;flex-direction:column;align-items:center;gap:6px;";
    hudDiv.appendChild(powerWrap);

    const powerContainer = document.createElement("div");
    powerContainer.style.cssText =
      "position:relative;width:44px;height:260px;border-radius:22px;" +
      "overflow:hidden;background:rgba(0,0,0,0.4);" +
      "border:2px solid rgba(255,255,255,0.25);backdrop-filter:blur(4px);";
    powerWrap.appendChild(powerContainer);

    const powerFillDiv = document.createElement("div");
    powerFillDiv.style.cssText =
      "position:absolute;bottom:0;left:0;width:100%;height:0%;" +
      "border-radius:0 0 12px 12px;transition:background 0.1s;";
    powerContainer.appendChild(powerFillDiv);
    // Big green sweet spot band (easy mode).
    const sweetDiv = document.createElement("div");
    sweetDiv.style.cssText =
      `position:absolute;left:0;width:100%;bottom:${SWEET_MIN * 100}%;height:${(SWEET_MAX - SWEET_MIN) * 100}%;` +
      "background:rgba(34,197,94,0.45);border-top:3px solid #4ade80;border-bottom:3px solid #4ade80;" +
      "box-shadow:0 0 16px #22c55e inset;";
    if (EASY_MODE) powerContainer.appendChild(sweetDiv);

    const powerLabel = document.createElement("div");
    powerLabel.style.cssText =
      "font-family:Manrope,sans-serif;font-size:16px;font-weight:800;" +
      "color:#fff;white-space:nowrap;letter-spacing:0.05em;text-shadow:0 2px 4px rgba(0,0,0,0.6);";
    powerLabel.textContent = "POWER";
    powerWrap.appendChild(powerLabel);

    // Spin slider: horizontal bar at the bottom, centered. Visible during the
    // Spin phase. Range -1 (full left hook) .. +1 (full right hook), 0 = straight.
    const spinWrap = document.createElement("div");
    spinWrap.style.cssText =
      "position:absolute;bottom:72px;left:50%;transform:translateX(-50%);" +
      "display:none;flex-direction:column;align-items:center;gap:6px;";
    hudDiv.appendChild(spinWrap);

    const spinContainer = document.createElement("div");
    spinContainer.style.cssText =
      "position:relative;width:240px;height:24px;border-radius:12px;" +
      "background:rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.25);" +
      "backdrop-filter:blur(4px);overflow:hidden;";
    spinWrap.appendChild(spinContainer);

    // The fill bar grows from the center notch out toward the spin direction.
    const spinFillDiv = document.createElement("div");
    spinFillDiv.style.cssText =
      "position:absolute;top:0;left:50%;height:100%;width:0%;background:#7dd3fc;" +
      "transition:background 0.1s;";
    spinContainer.appendChild(spinFillDiv);

    // Center notch so the user can see exactly where "no spin" sits.
    const spinNotch = document.createElement("div");
    spinNotch.style.cssText =
      "position:absolute;top:2px;left:50%;width:2px;height:calc(100% - 4px);" +
      "background:rgba(255,255,255,0.55);transform:translateX(-1px);";
    spinContainer.appendChild(spinNotch);

    const spinLabel = document.createElement("div");
    spinLabel.style.cssText =
      "font-family:Manrope,sans-serif;font-size:11px;font-weight:600;" +
      "color:rgba(255,255,255,0.7);letter-spacing:0.05em;";
    spinLabel.textContent = "SPIN";
    spinWrap.appendChild(spinLabel);

    // Strike/spare overlay
    const bigLabel = document.createElement("div");
    bigLabel.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);" +
      "font-family:Fraunces,serif;font-size:clamp(40px,9vw,84px);font-weight:900;" +
      "color:#fff;text-align:center;line-height:1.05;white-space:nowrap;" +
      "-webkit-text-stroke:2px #7c3aed;" +
      "text-shadow:0 0 24px rgba(255,255,255,0.8),4px 4px 0 #ff3b3b,8px 8px 0 #ffd60a,12px 12px 0 #1fb6ff;" +
      "pointer-events:none;transition:transform 0.3s ease-out,opacity 0.5s;opacity:0;";
    hudDiv.appendChild(bigLabel);

    let bigLabelTimer: ReturnType<typeof setTimeout> | null = null;
    function showBigLabel(text: string, sub = "", ms = 1600) {
      bigLabel.textContent = text;
      if (sub) {
        const subEl = document.createElement("div");
        subEl.textContent = sub;
        subEl.style.cssText =
          "font-size:0.55em;margin-top:8px;-webkit-text-stroke:1px #7c3aed;" +
          "text-shadow:3px 3px 0 #ff8c1a,6px 6px 0 #3ddc4a;";
        bigLabel.appendChild(subEl);
      }
      bigLabel.style.transform = "translate(-50%,-50%) scale(1)";
      bigLabel.style.opacity = "1";
      if (bigLabelTimer !== null) clearTimeout(bigLabelTimer);
      bigLabelTimer = setTimeout(() => {
        bigLabel.style.transform = "translate(-50%,-50%) scale(1.2)";
        bigLabel.style.opacity = "0";
        bigLabelTimer = null;
      }, ms);
    }

    // Rainbow confetti burst (DOM, cheap and very colorful).
    if (!document.getElementById("rsb-confetti-style")) {
      const st = document.createElement("style");
      st.id = "rsb-confetti-style";
      st.textContent =
        "@keyframes rsbConfetti{0%{transform:translate(0,0) rotate(0);opacity:1}" +
        "100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}";
      document.head.appendChild(st);
    }
    function confetti(count = 160) {
      for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        const size = 8 + Math.random() * 10;
        const ang = Math.random() * Math.PI * 2;
        const dist = 150 + Math.random() * 450;
        el.style.cssText =
          `position:absolute;left:${30 + Math.random() * 40}%;top:${30 + Math.random() * 20}%;` +
          `width:${size}px;height:${size * (Math.random() < 0.5 ? 0.5 : 1)}px;` +
          `background:${RAINBOW[i % RAINBOW.length]};border-radius:${Math.random() < 0.4 ? "50%" : "2px"};` +
          `--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist * 0.6 + 260}px;--rot:${Math.random() * 1080 - 540}deg;` +
          `animation:rsbConfetti ${1.6 + Math.random() * 1.4}s cubic-bezier(.15,.7,.4,1) forwards;`;
        hudDiv.appendChild(el);
        setTimeout(() => el.remove(), 3200);
      }
    }

    // Remove old 3D power bar meshes - we use DOM now
    // (We don't create 3D power bars at all)

    // ---- Game state ----
    let throwPhase: ThrowPhase = "aiming";
    let aimX = 0;
    let power = 0;
    let powerDir = 1;
    // Spin: -1 = full left hook, +1 = full right hook, 0 = straight.
    let spin = 0;
    const ballStartZ = 5;
    let ballZ = ballStartZ;
    let ballX = 0;
    let ballVx = 0;
    let guttered = false;
    let settleTimer = 0;
    let instrFadeTimer = 0;
    let showInstr = true;
    let currentFrame = 0;
    let currentThrow = 0;
    let standingBeforeThrow: boolean[] = new Array(10).fill(true) as boolean[];
    const frames: FrameScore[] = [];
    for (let i = 0; i < 10; i++) {
      frames.push({ throws: [], pinsDown: [] });
    }

    const sfx = new SoundFX();
    // Initial mute state is synced by the [muted] effect that runs right
    // after this engine-setup effect completes; SoundFX defaults to muted.
    sfxRef.current = sfx;
    const GUTTER_EDGE = LANE_WIDTH / 2 - BALL_RADIUS;

    // Project the predicted ball path forward from the current aim/power/spin.
    // Used to render the trajectory line during AIM and SPIN phases. Stops
    // early when the ball would gutter or pass the back wall so the line
    // doesn't extend past meaningful play.
    function simulateTrajectory(
      startX: number,
      powerSample: number,
      spinSample: number,
    ): Vector3[] {
      const pts: Vector3[] = [];
      const dtSim = 0.04;
      const speed = BALL_SPEED * (0.4 + powerSample * 0.6);
      let x = startX;
      let z = ballStartZ;
      let vx = 0;
      let gutteredSim = false;
      for (let i = 0; i < TRAJ_POINTS; i++) {
        if (!gutteredSim && Math.abs(x) > GUTTER_EDGE) {
          gutteredSim = true;
        }
        const yPos = gutteredSim ? -0.04 : 0.06;
        pts.push(new Vector3(
          gutteredSim ? Math.sign(x) * (LANE_WIDTH / 2 + 0.25) : x,
          yPos,
          z,
        ));
        if (!gutteredSim) {
          // Spin sign matches the slider visual: spin>0 (right on the bar)
          // curves the ball to the player's right (camera-right). Babylon is
          // left-handed and the camera looks down -Z, so camera-right is -X.
          vx -= spinSample * CURVE_RATE * dtSim;
          x += vx * dtSim;
        }
        z -= speed * dtSim;
        if (z < HOOK_START_Z) {
          // pad remaining points at the last position so the line mesh
          // stays at a fixed length for in-place updates.
          while (pts.length < TRAJ_POINTS) {
            const last = pts[pts.length - 1]!;
            pts.push(new Vector3(last.x, last.y, last.z));
          }
          break;
        }
      }
      return pts;
    }

    function updateTrajectory() {
      // Sample power=0.7 during AIM so the line is stable (the power bar
      // is still oscillating); use the locked value once we're in SPIN.
      const powerSample = throwPhase === "spin" ? power : 0.7;
      const pts = simulateTrajectory(aimX, powerSample, spin);
      trajectory = MeshBuilder.CreateLines(
        "trajectory",
        { points: pts, instance: trajectory },
        scene,
      );
    }

    function updateHUD() {
      if (throwPhase === "aiming") {
        phaseLabel.textContent = "🎯 Aim!";
        phaseLabel.style.opacity = "1";
        if (showInstr) {
          instrLabel.textContent = "Slide to aim, then tap! Or swipe up to throw!";
          instrLabel.style.opacity = "1";
        }
        powerWrap.style.display = "none";
        spinWrap.style.display = "none";
        trajectory.isVisible = true;
      } else if (throwPhase === "power") {
        phaseLabel.textContent = "💪 Tap in the green!";
        phaseLabel.style.opacity = "1";
        if (showInstr) {
          instrLabel.textContent = "Tap when the bar is in the green!";
          instrLabel.style.opacity = "1";
        }
        powerWrap.style.display = "flex";
        spinWrap.style.display = "none";
        trajectory.isVisible = false;
      } else if (throwPhase === "spin") {
        phaseLabel.textContent = "SET SPIN";
        phaseLabel.style.opacity = "1";
        if (showInstr) {
          instrLabel.textContent = "Drag or use arrow keys to curve. Tap / Space to throw.";
          instrLabel.style.opacity = "1";
        }
        powerWrap.style.display = "none";
        spinWrap.style.display = "flex";
        trajectory.isVisible = true;
      } else if (throwPhase === "rolling") {
        if (!sweetThrow) {
          phaseLabel.textContent = "";
          phaseLabel.style.opacity = "0";
        }
        instrLabel.style.opacity = "0";
        powerWrap.style.display = "none";
        spinWrap.style.display = "none";
        trajectory.isVisible = false;
      } else if (throwPhase === "settling") {
        phaseLabel.textContent = "";
        phaseLabel.style.opacity = "0";
        instrLabel.style.opacity = "0";
        powerWrap.style.display = "none";
        spinWrap.style.display = "none";
        trajectory.isVisible = false;
      }
    }

    function resetBallPosition() {
      ballZ = ballStartZ;
      ballX = 0;
      ballVx = 0;
      disposeBody(ballBody);
      ballBody = null;
      ball.rotationQuaternion = null;
      ball.position.set(0, BALL_RADIUS, ballStartZ);
      ball.rotation.set(0, 0, 0);
      ball.setEnabled(true);
    }

    function resetAllPins() {
      for (const p of pins) {
        removePinBody(p);
        p.mesh.dispose();
      }
      pins = createPins();
      standingBeforeThrow = new Array(10).fill(true) as boolean[];
    }

    function resetStandingPins() {
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i]!;
        if (!p.knocked && physOn) {
          // Stand it back up where it slid to, with a fresh body.
          const x = p.mesh.position.x;
          const z = p.mesh.position.z;
          removePinBody(p);
          p.mesh.rotationQuaternion = Quaternion.Identity();
          p.mesh.position.set(x, PIN_HEIGHT / 2, z);
          addPinBody(p);
        } else if (!p.knocked) {
          p.mesh.rotationQuaternion = null;
          p.mesh.rotation.set(0, 0, 0);
          p.mesh.position.set(p.originalPos.x, PIN_HEIGHT / 2, p.originalPos.z);
          p.fallAngle = 0;
        }
      }
      standingBeforeThrow = pins.map((p) => !p.knocked);
    }

    function hideKnockedPins() {
      for (const p of pins) {
        if (p.knocked) {
          removePinBody(p);
          p.mesh.setEnabled(false);
        }
      }
    }

    // Set up the next throw. resetAll=true for a fresh rack (strike, new
    // frame, bonus throw); false to keep already-knocked pins down.
    function nextThrow(resetAll: boolean) {
      if (physPending) activatePhysics();
      if (resetAll) resetAllPins();
      else {
        hideKnockedPins();
        resetStandingPins();
      }
      startAiming();
    }

    function emitStats() {
      const fs: FrameStars[] = frames.map((f, idx) => ({
        pins: Math.min(10, (f.throws[0] ?? 0) + (f.throws[1] ?? 0)),
        stars: starsForFrame(f.throws),
        strike: f.throws[0] === 10,
        spare: f.throws[0] !== 10 && (f.throws[0] ?? 0) + (f.throws[1] ?? 0) >= 10,
        done: idx < currentFrame || f.throws.length >= 2 || f.throws[0] === 10,
      }));
      onStatsRef.current?.({ frame: Math.min(currentFrame + 1, 10), frames: fs });
    }

    function updateScore() {
      const total = computeTotalScore(frames);
      onScoreRef.current(total);
    }

    function startAiming() {
      throwPhase = "aiming";
      for (const b of bumperMeshes) b.setEnabled(bumpersRef.current);
      updateBumperBodies();
      aimX = 0;
      power = 0;
      powerDir = 1;
      spin = 0;
      resetBallPosition();
      arrow.setEnabled(true);
      onStatsRef.current?.({ frame: Math.min(currentFrame + 1, 10) });
      updateTrajectory();
      updateHUD();
    }

    function startPower() {
      throwPhase = "power";
      power = 0;
      powerDir = 1;
      arrow.setEnabled(false);
      updateHUD();
    }

    function startSpin() {
      throwPhase = "spin";
      spin = 0;
      updateTrajectory();
      updateHUD();
    }

    let sweetThrow = false;
    let ballSpeed = BALL_SPEED;
    let driftAcc = 0;
    function throwBall() {
      bridgeTarget = 0;
      sweetThrow = EASY_MODE && power >= SWEET_MIN && power <= SWEET_MAX;
      if (sweetThrow) {
        phaseLabel.textContent = "⭐ Perfect power!";
        phaseLabel.style.opacity = "1";
      }
      throwPhase = "rolling";
      ballX = aimX;
      ballZ = ballStartZ;
      // Spin-driven hook: lateral velocity accumulates per-frame in the
      // rolling-phase loop, so the ball starts straight and curves over time
      // like a real hook ball. No more fixed aim-X reverse-drift.
      ballVx = 0;
      guttered = false;
      ballSpeed = BALL_SPEED * (0.45 + power * 0.55);
      const miss = sweetThrow ? 0 : Math.min(1, Math.abs(power - (SWEET_MIN + SWEET_MAX) / 2) * 3);
      driftAcc = (Math.random() * 2 - 1) * (0.12 + miss * 1.4);
      ball.position.x = ballX;
      ball.position.z = ballZ;
      ball.position.y = BALL_RADIUS;
      if (physOn) {
        disposeBody(ballBody);
        ball.rotationQuaternion = Quaternion.Identity();
        const bb = new PhysicsBody(ball, PhysicsMotionType.DYNAMIC, false, scene);
        const shape = new PhysicsShapeSphere(Vector3.Zero(), BALL_RADIUS, scene);
        shape.material = { friction: 0.2, restitution: 0.1 };
        bb.shape = shape;
        bb.setMassProperties({ mass: BALL_MASS });
        bb.setLinearVelocity(new Vector3(0, 0, -ballSpeed));
        bb.setAngularVelocity(new Vector3(-ballSpeed / BALL_RADIUS, 0, 0));
        ballBody = bb;
        physRollTime = 0;
        firstCrash = false;
      }
      sfx.startRoll();

      // Fade out instructions after first throw
      instrFadeTimer = 3;
      updateHUD();
    }

    function handleThrowComplete() {
      let newlyKnocked = 0;
      for (let i = 0; i < pins.length; i++) {
        if (pins[i]!.knocked && standingBeforeThrow[i]) {
          newlyKnocked++;
        }
      }

      const frame = frames[currentFrame]!;
      frame.throws.push(newlyKnocked);
      frame.pinsDown.push(newlyKnocked);
      updateScore();
      emitStats();

      const isStrike = currentThrow === 0 && newlyKnocked === 10;
      const totalDown = frame.throws.reduce((a, b) => a + b, 0);
      const isSpare = currentThrow === 1 && totalDown >= 10;

      const pool = [...CHEERS, ...characterRef.current.cheers, ...characterRef.current.cheers, ...NAME_PHRASES];
      const cheer = pool[Math.floor(Math.random() * pool.length)]!;
      onThrowRef.current?.({ pins: newlyKnocked, strike: currentThrow === 0 && newlyKnocked === 10, spare: currentThrow === 1 && frame.throws.reduce((a, b) => a + b, 0) >= 10 && frame.throws[0] !== 10, gutter: guttered, frame: currentFrame + 1 });
      if (Math.random() < 0.6) floatPhrase(hudDiv);
      bridgeTarget = 0;
      if (isStrike) {
        showBigLabel("🌈 STRIKE! 🌈", characterRef.current.strikeCheer, 2400);
        bridgeTarget = 1;
        sfx.strike();
        confetti(260);
        fireworks(hudDiv, 12, 2600);
        animalDisco(hudDiv, 4200);
      } else if (isSpare) {
        showBigLabel("✨ SPARE! ✨", `You got them all! ${cheer}`, 2000);
        sfx.spare();
        confetti(140);
        fireworks(hudDiv, 6, 1800);
        animalDisco(hudDiv, 3200);
      } else if (newlyKnocked === 0) {
        showBigLabel(guttered ? "Oops, gutter!" : "So close!", `Try again, ${PLAYER_NAME}! You can do it!`);
        if (!guttered) sfx.encourage();
      } else {
        showBigLabel(`${newlyKnocked} pin${newlyKnocked === 1 ? "" : "s"}!`, cheer);
        sfx.cheer();
        if (newlyKnocked >= 7) animalDisco(hudDiv, 2600);
      }

      if (currentFrame < 9) {
        if (isStrike || currentThrow === 1) {
          currentFrame++;
          currentThrow = 0;
          if (currentFrame >= TOTAL_FRAMES) {
            { sfx.gameOver(); onGameOverRef.current(); }
            return;
          }
          nextThrow(true);
        } else {
          currentThrow = 1;
          nextThrow(false);
        }
      } else {
        // 10th frame
        if (currentThrow === 0) {
          currentThrow = 1;
          nextThrow(isStrike);
        } else if (currentThrow === 1) {
          const firstThrow = frame.throws[0] ?? 0;
          if (firstThrow === 10) {
            currentThrow = 2;
            nextThrow(newlyKnocked === 10);
          } else if (isSpare) {
            currentThrow = 2;
            nextThrow(true);
          } else {
            { sfx.gameOver(); onGameOverRef.current(); }
            return;
          }
        } else {
          { sfx.gameOver(); onGameOverRef.current(); }
          return;
        }
      }
    }

    // ---- Input handling ----
    // Touch/pointer: drag to aim, release to lock aim -> power, tap again to throw
    // Keyboard: arrows to aim, space/enter to advance phase

    let pointerDown = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartT = 0;
    let aimXAtPointerStart = 0;

    let spinAtPointerStart = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (throwPhase === "aiming") {
          bridgeTarget = 0;
          startPower();
        } else if (throwPhase === "power") {
          if (EASY_MODE) throwBall();
          else startSpin();
        } else if (throwPhase === "spin") {
          throwBall();
        }
      } else if (e.key === "ArrowLeft" && throwPhase === "aiming") {
        // Camera-left is +X in Babylon's left-handed coords with the camera
        // looking down -Z, so Left = aimX += and Right = aimX -=.
        aimX = Math.min(LANE_WIDTH / 2 - 0.5, aimX + 0.15);
      } else if (e.key === "ArrowRight" && throwPhase === "aiming") {
        aimX = Math.max(-LANE_WIDTH / 2 + 0.5, aimX - 0.15);
      } else if (e.key === "ArrowLeft" && throwPhase === "spin") {
        spin = Math.max(-1, spin - 0.1);
      } else if (e.key === "ArrowRight" && throwPhase === "spin") {
        spin = Math.min(1, spin + 0.1);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (throwPhase === "aiming") {
        pointerDown = true;
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        pointerStartT = performance.now();
        aimXAtPointerStart = aimX;
      } else if (throwPhase === "power") {
        if (EASY_MODE) throwBall();
        else startSpin();
      } else if (throwPhase === "spin") {
        pointerDown = true;
        pointerStartX = e.clientX;
        spinAtPointerStart = spin;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      if (throwPhase === "aiming" && pointerStartY - e.clientY > 40 && pointerStartY - e.clientY > Math.abs(e.clientX - pointerStartX)) {
        // Looks like an upward swipe: keep aim where it started.
        aimX = aimXAtPointerStart;
      } else if (throwPhase === "aiming") {
        // Negative dx maps dragging right (positive pointer delta) to the
        // ball moving camera-right (-X in Babylon's left-handed coords with
        // the camera looking down -Z). This matches the spin slider's
        // direction so all controls feel consistent.
        const dx = (e.clientX - pointerStartX) * -0.015;
        aimX = Math.max(
          -LANE_WIDTH / 2 + 0.5,
          Math.min(LANE_WIDTH / 2 - 0.5, aimXAtPointerStart + dx),
        );
      } else if (throwPhase === "spin") {
        const dx = (e.clientX - pointerStartX) * 0.008;
        spin = Math.max(-1, Math.min(1, spinAtPointerStart + dx));
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      // Swipe up to throw: speed sets power, sideways drift adds angle.
      const sdy = pointerStartY - e.clientY;
      const sdx = e.clientX - pointerStartX;
      if (throwPhase === "aiming" && sdy > 50 && sdy > Math.abs(sdx)) {
        pointerDown = false;
        const ms = Math.max(60, performance.now() - pointerStartT);
        const speed = sdy / ms; // px per ms
        aimX = aimXAtPointerStart;
        power = Math.max(0.35, Math.min(1, 0.3 + speed * 0.35));
        // Generous: most swipes land in the green.
        throwBall();
        ballVx = Math.max(-1.2, Math.min(1.2, -(sdx / sdy) * 2.2));
        return;
      }
      const wasSpin = throwPhase === "spin";
      const wasAiming = throwPhase === "aiming";
      pointerDown = false;
      // A drag in either phase counts as the "commit" gesture, same as a tap.
      if (wasAiming) startPower();
      else if (wasSpin) throwBall();
    };

    window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);

    // Test hook (used by the screenshot script): trigger the strike celebration.
    (window as unknown as { __rsbCelebrate?: () => void }).__rsbCelebrate = () => {
      bridgeTarget = 1;
      confetti(200);
      fireworks(hudDiv, 12, 2600);
      animalDisco(hudDiv, 4200);
      floatPhrase(hudDiv);
      showBigLabel("🌈 STRIKE! 🌈", characterRef.current.strikeCheer, 4000);
    };

    (window as unknown as { __rsbDebug?: () => unknown }).__rsbDebug = () => ({
      physOn,
      phase: throwPhase,
      ball: ball.position.asArray().map((n) => +n.toFixed(2)),
      ballBody: !!ballBody,
      pins: pins.map((p) => ({ b: !!p.body, k: p.knocked, y: +p.mesh.position.y.toFixed(2), z: +p.mesh.position.z.toFixed(2) })),
    });

    // ---- Main loop ----
    startAiming();

    scene.registerBeforeRender(() => {
      const dt = engine.getDeltaTime() / 1000;

      // Fade out instructions after a few throws
      if (showInstr) {
        if (instrFadeTimer > 0) {
          instrFadeTimer -= dt;
          if (instrFadeTimer <= 0) {
            showInstr = false;
            instrLabel.style.opacity = "0";
          }
        }
      }

      if (throwPhase === "aiming") {
        // Position ball at aim point (no auto-oscillation -- user controls aim)
        ball.position.x = aimX;
        ball.position.z = ballStartZ;
        ball.position.y = BALL_RADIUS;

        // Arrow
        arrow.position.set(aimX, 0.05, ballStartZ - 2.2);
        glow.intensity = 0.45 + 0.25 * Math.sin(performance.now() / 180);
        arrow.setEnabled(true);
        updateTrajectory();
      }

      if (throwPhase === "spin") {
        // Spin bar fills from center toward the current direction. Sky-blue
        // for left hook, amber for right hook so the user can see at a glance
        // which way the ball will curve.
        const half = Math.abs(spin) * 50;
        spinFillDiv.style.width = `${half}%`;
        if (spin < 0) {
          spinFillDiv.style.left = `${50 - half}%`;
          spinFillDiv.style.background = "#7dd3fc";
        } else {
          spinFillDiv.style.left = "50%";
          spinFillDiv.style.background = "#fbbf24";
        }
        updateTrajectory();
      }

      if (throwPhase === "power") {
        power += powerDir * (EASY_MODE ? 0.8 : 1.2) * dt;
        if (power >= 1) {
          power = 1;
          powerDir = -1;
        } else if (power <= 0) {
          power = 0;
          powerDir = 1;
        }

        // Update DOM power bar
        const pct = Math.round(power * 100);
        powerFillDiv.style.height = `${pct}%`;

        // Color: green -> yellow -> red
        const inSweet = power >= SWEET_MIN && power <= SWEET_MAX;
        powerFillDiv.style.background = inSweet
          ? "linear-gradient(#86efac,#16a34a)"
          : "linear-gradient(#ff8c1a,#ff3b3b)";
      }

      if (throwPhase === "rolling" && physOn && ballBody) {
        physRollTime += dt;
        ballX = ball.position.x;
        ballZ = ball.position.z;
        const v = ballBody.getLinearVelocity();
        if (!guttered && ballZ > PIN_Z_START + 0.45 && ball.position.y > BALL_RADIUS * 0.6) {
          // Oiled lane: keep forward speed, add hook + drift sideways.
          let ax = driftAcc;
          if (ballZ < HOOK_START_Z) ax += HOOK_ACCEL;
          if (!EASY_MODE) ax -= spin * CURVE_RATE;
          v.x += ax * dt;
          v.z = -ballSpeed;
          ballBody.setLinearVelocity(v);
        }
        if (!bumpersRef.current && !guttered && Math.abs(ballX) > LANE_WIDTH / 2 + 0.05) {
          guttered = true;
          sfx.gutter();
        }
        if (ballZ < PIN_Z_START - 1.6 || physRollTime > 5 || (ballZ < PIN_Z_START + 1 && v.z > 0.5) || (physRollTime > 1 && v.length() < 0.8)) {
          throwPhase = "settling";
          settleTimer = 0;
          sfx.stopRoll();
          updateHUD();
        }
      } else if (throwPhase === "settling" && physOn) {
        settleTimer += dt;
        let moving = false;
        for (const p of pins) {
          if (p.body && p.body.getLinearVelocity().length() > 0.25) moving = true;
        }
        if (settleTimer > 0.6 && ball.isEnabled()) {
          disposeBody(ballBody);
          ballBody = null;
          ball.setEnabled(false);
        }
        if ((settleTimer > 1.4 && !moving) || settleTimer > 3.8) {
          // Count fallen pins by tilt (or if they flew off the deck).
          for (let i = 0; i < pins.length; i++) {
            const p = pins[i]!;
            if (p.knocked || !standingBeforeThrow[i]) continue;
            const q = p.mesh.rotationQuaternion;
            const upY = q ? 1 - 2 * (q.x * q.x + q.z * q.z) : 1;
            if (upY < 0.85 || p.mesh.position.y < PIN_HEIGHT / 2 - 0.2 || Math.abs(p.mesh.position.x) > LANE_WIDTH / 2 + 0.1 || p.mesh.position.z < PIN_Z_START - 3.2) {
              p.knocked = true;
            }
          }
          throwPhase = "done";
          handleThrowComplete();
        }
      } else if (throwPhase === "rolling") {
        const speed = ballSpeed;
        ballZ -= speed * dt;
        if (!guttered) {
          if (!EASY_MODE) ballVx -= spin * CURVE_RATE * dt;
          // Down-lane hook toward the player's left (+X) and a little random drift.
          if (ballZ < HOOK_START_Z) ballVx += HOOK_ACCEL * dt;
          ballVx += driftAcc * dt;
        }
        ballX += ballVx * dt;

        if (bumpersRef.current && Math.abs(ballX) > GUTTER_EDGE) {
          // Bumpers only stop gutters: bounce back gently toward the middle.
          const side = Math.sign(ballX);
          ballX = side * GUTTER_EDGE;
          ballVx = -side * Math.max(Math.abs(ballVx) * 0.5, 0.6);
          ballSpeed *= 0.92;
          sfx.bumper();
        }
        if (!bumpersRef.current && !guttered && Math.abs(ballX) > GUTTER_EDGE + 0.1) {
          guttered = true;
          ballVx = 0;
          sfx.gutter();
        }
        if (guttered) {
          ballX = Math.sign(ballX) * (LANE_WIDTH / 2 + 0.25);
          ball.position.y = -0.05;
        } else {
          ball.position.y = BALL_RADIUS;
        }

        ball.position.x = ballX;
        ball.position.z = ballZ;
        ball.rotation.x -= speed * dt / BALL_RADIUS;

        // Ball vs standing pins: momentum transfer + ball deflection.
        if (!guttered) for (let i = 0; i < pins.length; i++) {
          const p = pins[i]!;
          if (p.knocked) continue;
          const dx = p.originalPos.x - ballX;
          const dz = p.originalPos.z - ballZ;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < KNOCK_DISTANCE) {
            const nx = dx / (dist || 1);
            const nz = dz / (dist || 1);
            const impact = speed * (0.55 + 0.45 * Math.abs(nz));
            const kick = impact * (0.22 + Math.random() * 0.12);
            p.vx = nx * kick + ballVx * 0.3 + (Math.random() - 0.5) * 0.8;
            p.vz = nz * kick - speed * 0.05;
            setPinFall(p, -p.vz, p.vx);
            p.knockDelay = 0;
            // Ball deflects away from the pin and loses some momentum.
            ballVx -= nx * speed * 0.06;
            ballSpeed *= 0.93;
            sfx.pinHit(1);
            sfx.happy(i);
          }
        }

        // Ball passed pins
        if (ballZ < PIN_Z_START - 5) {
          throwPhase = "settling";
          settleTimer = 0;
          ball.setEnabled(false);
          sfx.stopRoll();
          updateHUD();
        }
      }

      if (throwPhase === "settling" && !physOn) {
        settleTimer += dt;
        if (settleTimer > 1.4) {
          throwPhase = "done";
          handleThrowComplete();
        }
      }

      // Drawbridge animation
      if (bridgeOpen !== bridgeTarget) {
        const step = dt * (bridgeTarget > bridgeOpen ? 1.6 : 0.9);
        bridgeOpen = bridgeTarget > bridgeOpen ? Math.min(bridgeTarget, bridgeOpen + step) : Math.max(bridgeTarget, bridgeOpen - step);
        bridgePivot.rotation.x = -bridgeOpen * (Math.PI / 2) * 0.95;
      }

      // Knocked pins slide, tip over and can bump into other pins.
      // Crash cam: swoop toward the pins as the ball arrives, then back.
      {
        const want = physOn && ((throwPhase === "rolling" && ballZ < -5) || throwPhase === "settling") ? 1 : 0;
        const prev = camT;
        camT += (want - camT) * Math.min(1, dt * (want ? 2.2 : 3.5));
        if (Math.abs(camT - want) < 0.002) camT = want;
        shake = Math.max(0, shake - dt);
        if (camT !== prev || shake > 0 || camT > 0) {
          const e = camT * camT * (3 - 2 * camT);
          const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;
          const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.4 : 0;
          camera.position.set(sx, 6.5 + (3.9 - 6.5) * e + sy, 13.5 + (-9 - 13.5) * e);
          camTarget.set(0, 0.5 * e, -10 + (-19.6 + 10) * e);
          camera.setTarget(camTarget);
        }
      }
      if (!physOn) for (let i = 0; i < pins.length; i++) {
        const p = pins[i]!;
        if (!p.knocked) continue;
        if (p.knockDelay > 0) {
          p.knockDelay -= dt;
          continue;
        }
        const sp0 = Math.hypot(p.vx, p.vz);
        // A pin that is still tipping over swings its body into neighbours too.
        const tipping = p.fallAngle < Math.PI / 2 - 0.05;
        const sp = tipping ? Math.max(sp0, 1.6) : sp0;
        if (sp > 0.05) {
          p.offX += p.vx * dt;
          p.offZ += p.vz * dt;
          const damp = Math.exp(-PIN_FRICTION * dt);
          p.vx *= damp;
          p.vz *= damp;
          const reach = PIN_HEIGHT * Math.sin(p.fallAngle);
          for (let j = 0; j < pins.length; j++) {
            const q = pins[j]!;
            if (q.knocked || j === i) continue;
            // Closest point on the pin's body segment (base -> tip) to pin q.
            const bx0 = p.originalPos.x + p.offX;
            const bz0 = p.originalPos.z + p.offZ;
            const rx = q.originalPos.x - bx0;
            const rz = q.originalPos.z - bz0;
            const along = Math.max(0, Math.min(reach, rx * p.fallTipX + rz * p.fallTipZ));
            const ddx = rx - p.fallTipX * along;
            const ddz = rz - p.fallTipZ * along;
            const d = Math.hypot(ddx, ddz);
            if (d < PIN_HIT_RADIUS && sp > 0.9) {
              // Not every brush topples a pin.
              const chance = Math.min(0.95, 0.5 + sp * 0.15);
              if (Math.random() < chance) {
                // Push mostly along the falling pin's direction, a bit along the contact normal.
                const nx0 = ddx / (d || 1) * 0.5 + p.fallTipX * 0.5;
                const nz0 = ddz / (d || 1) * 0.5 + p.fallTipZ * 0.5;
                const nl = Math.hypot(nx0, nz0) || 1;
                const nx = nx0 / nl;
                const nz = nz0 / nl;
                const tr = sp * (0.45 + Math.random() * 0.35);
                q.vx = nx * tr + (Math.random() - 0.5) * 0.6;
                q.vz = nz * tr + (Math.random() - 0.5) * 0.6;
                setPinFall(q, -q.vz, q.vx);
                q.knockDelay = 0.02 + Math.random() * 0.05;
                p.vx *= 0.55;
                p.vz *= 0.55;
                sfx.pinHit(0.6);
                sfx.happy(j);
              } else {
                // Glancing wobble: deflect the moving pin instead.
                p.vx = -p.vx * 0.4;
                p.vz *= 0.6;
              }
            }
          }
        }

        if (p.fallAngle < Math.PI / 2) {
          p.fallAngle = Math.min(Math.PI / 2, p.fallAngle + dt * 6);
          Quaternion.RotationAxisToRef(p.fallAxis, p.fallAngle, p.quat);
          p.mesh.rotationQuaternion = p.quat;
        }
        const cosA = Math.cos(p.fallAngle);
        const sinA = Math.sin(p.fallAngle);
        const tipOffset = (PIN_HEIGHT / 2) * sinA;
        p.mesh.position.x = p.originalPos.x + p.offX + p.fallTipX * tipOffset;
        p.mesh.position.z = p.originalPos.z + p.offZ + p.fallTipZ * tipOffset;
        p.mesh.position.y =
          p.originalPos.y + (PIN_HEIGHT / 2) * cosA + PIN_RADIUS * 1.2 * sinA;
      }
    });

    const phraseTimer = setInterval(() => {
      if (throwPhase === "aiming" || throwPhase === "power") floatPhrase(hudDiv);
    }, 9000);
    setTimeout(() => floatPhrase(hudDiv, `Go, ${PLAYER_NAME}!`), 1200);

    engine.runRenderLoop(() => scene.render());
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("resize", onResize);
      if (bigLabelTimer !== null) clearTimeout(bigLabelTimer);
      clearInterval(phraseTimer);
      disposed = true;
      sfx.dispose();
      // Clean up HUD
      hudDiv.remove();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        outline: "none",
        touchAction: "none",
      }}
      tabIndex={0}
    />
  );
}
