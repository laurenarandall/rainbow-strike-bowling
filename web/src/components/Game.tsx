import { useRef, useEffect } from "react";
import { useSound } from "@freegamestore/games";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TrailMesh } from "@babylonjs/core/Meshes/trailMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { getTheme } from "../themes";
import type { ThemeId, LaneMode } from "../themes";
import { SoundFX } from "../sound";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox } from "@babylonjs/core/Physics/v2/physicsShape";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import "@babylonjs/core/Physics/v2/physicsEngineComponent";
import type { Character, BallSkin } from "../characters";
import { CHARACTERS, BALLS, ballFeel } from "../characters";
import { PLAYER_NAME, NAME_PHRASES, STRIKE_PHRASES, SPARE_PHRASES, MISS_PHRASES, BIG_HIT_PHRASES, pick, floatPhrase, animalDisco, fireworks } from "../fx";
import type { PinStyleId } from "../gear";
import { PIN_MASS_KG, ballMassKg } from "../gear";
import { buildWorld, HALF_W, GUTTER_W, PIN_H, PIN_MAX_R, DECK_END, RAINBOW } from "./world";
import type { BallLook, Quality } from "./world";
import { BALL_R, FOUL_Z, PIN_Z_START, GRAVITY, S, laneFriction, applyContactFriction, releaseState, predictPath } from "./ballPhysics";

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
  ballSkin?: BallSkin;
  pinStyle?: PinStyleId;
  theme?: ThemeId;
  laneMode?: LaneMode;
  bumpers?: boolean;
  onThrow?: (t: { pins: number; strike: boolean; spare: boolean; gutter: boolean; frame: number }) => void;
}


const START_Z = FOUL_Z + 0.6; // ball release point, just behind the foul line
const AIM_MAX = HALF_W - BALL_R - 0.05;
const PIN_COM_Y = 0.145 * S; // pin centre of mass above its base
// Big green sweet spot on the power bar.
const SWEET_MIN = 0.6;
const SWEET_MAX = 0.72;
const TOTAL_FRAMES = 10;

interface PinState {
  mesh: Mesh;
  knocked: boolean;
  body: PhysicsBody | null;
  // Simple-physics fallback tip-over animation.
  fall: { t: number; ax: number; az: number; vx: number; vz: number } | null;
}

const CHEERS = [
  "Great job!", "Awesome!", "Way to go!", "Super!", "Nice roll!", "You rock!", "Wow!", "Fantastic!", "Brilliant!",
  "Amazing!", "Outstanding!", "Incredible!", "Woo-hoo!", "Yippee!", "Keep it up!", "Rock and roll!", "Nailed it!",
  "Look at those pins fly!", "Super duper!", "Magnificent!", "Spectacular!", "Bravo!", "High five!", "Boom!",
  "That's the way!", "Pin-credible!", "Bowl-tastic!", "Splendid!", "You're a star!", "Totally awesome!", "Mega roll!",
  "Excellent!", "Hip hip hooray!", "Out of this world!", "Ka-pow!", "Superb!",
];

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

export function Game({ onScore, onGameOver, onStats, character, ballSkin, pinStyle = "classic", theme = "rainbow", laneMode = "theme", bumpers = false, onThrow }: GameProps) {
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const laneModeRef = useRef(laneMode);
  laneModeRef.current = laneMode;
  const ballSkinRef = useRef(ballSkin);
  ballSkinRef.current = ballSkin;
  const pinStyleRef = useRef(pinStyle);
  pinStyleRef.current = pinStyle;
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

    // ---- World (lane, castle, lights, materials, post-processing) ----
    const camera = new FreeCamera("cam", new Vector3(0, 3.2, START_Z + 7.5), scene);
    camera.minZ = 0.1;
    camera.maxZ = 600;
    camera.fov = 0.78;
    const camPos = camera.position.clone();
    const camTarget = new Vector3(0, 0.3, START_Z - 26);
    camera.setTarget(camTarget);

    const skin = ballSkinRef.current ?? BALLS[0]!;
    const feel = ballFeel(skin);
    const isHero = skin.id === "hero";
    const look: BallLook = {
      id: skin.id,
      finish: feel.finish,
      base: isHero ? characterRef.current.ballColor : skin.ballColor,
      accents: isHero ? [characterRef.current.studColor] : (skin.studColors ?? [skin.studColor]),
      glow: skin.glow ?? 0,
    };
    const ballMass = ballMassKg(feel.pounds);
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    // ?q=0|1|2 pins the quality (and turns off the automatic fallback).
    const qParam = new URLSearchParams(window.location.search).get("q");
    const forcedQ = qParam === "0" || qParam === "1" || qParam === "2" ? (Number(qParam) as Quality) : null;
    const startQ: Quality = forcedQ ?? (coarse || window.innerWidth < 1000 ? 1 : 2);
    const th = getTheme(themeRef.current);
    const world = buildWorld(scene, engine, camera, look, pinStyleRef.current, ballMass, startQ, th, laneModeRef.current);
    // Flying cape streak behind the ball (hero ball or hero theme).
    const capeOn = feel.finish === "emblem" || th.id === "hero";
    const capeNode = new TransformNode("capeNode", scene);
    let cape: TrailMesh | null = null;
    if (capeOn) {
      cape = new TrailMesh("cape", capeNode, scene, 0.55, 46, true);
      const cm = new StandardMaterial("capeMat", scene);
      cm.emissiveColor = new Color3(0.9, 0.08, 0.1);
      cm.diffuseColor = new Color3(0.8, 0.05, 0.08);
      cm.alpha = 0.75;
      cm.backFaceCulling = false;
      cape.material = cm;
    }
    let capePhaseWasRolling = false;
    let animT = 0;
    const { ball, bumperMeshes, bridgePivot } = world;
    let bridgeTarget = 0; // 0 = up (closed), 1 = down (open)
    let bridgeOpen = 0;

    // ---- Real physics (Havok) ----
    let physOn = false;
    let physPending = false;
    let physFailed = false;
    let disposed = false;
    let ballBody: PhysicsBody | null = null;
    let bumperBodies: PhysicsBody[] = [];
    let lastHitSfx = 0;
    let rollTime = 0;
    let firstCrash = false;
    let shake = 0;

    function disposeBallBody() {
      if (!ballBody) return;
      const sh = ballBody.shape;
      ballBody.dispose();
      sh?.dispose();
      ballBody = null;
    }
    function onCrash(ev: { impulse: number }) {
      const now = performance.now();
      const imp = ev.impulse || 0;
      if (imp < 0.8 || now - lastHitSfx < 35) return;
      lastHitSfx = now;
      sfx.pinHit(Math.min(1, imp / 30));
      if (!firstCrash && imp > 8 && throwPhase === "rolling") {
        firstCrash = true;
        shake = 0.3;
      }
    }
    function addPinBody(p: PinState) {
      if (!physOn || p.body) return;
      p.mesh.rotationQuaternion = p.mesh.rotationQuaternion ?? Quaternion.Identity();
      const body = new PhysicsBody(p.mesh, PhysicsMotionType.DYNAMIC, false, scene);
      body.shape = world.getPinHull();
      // Real pin: 1.59 kg, centre of mass ~14.5 cm up. Havok computes the
      // inertia for unit density, so scale it to the real mass.
      const mp = body.computeMassProperties();
      const k = mp.mass && mp.mass > 0 ? PIN_MASS_KG / mp.mass : 1;
      body.setMassProperties({
        mass: PIN_MASS_KG,
        centerOfMass: new Vector3(0, PIN_COM_Y, 0),
        inertia: (mp.inertia ?? new Vector3(1, 1, 1)).scale(k),
        inertiaOrientation: mp.inertiaOrientation ?? Quaternion.Identity(),
      });
      body.setAngularDamping(0.12);
      body.setLinearDamping(0.04);
      body.setCollisionCallbackEnabled(true);
      body.getCollisionObservable().add(onCrash);
      p.body = body;
    }
    function removePinBody(p: PinState) {
      // The hull shape is shared by every pin: dispose the body only.
      p.body?.dispose();
      p.body = null;
    }
    function updateBumperBodies() {
      for (const b of bumperBodies) {
        const m = b.transformNode;
        const sh = b.shape;
        b.dispose();
        sh?.dispose();
        m.dispose();
      }
      bumperBodies = [];
      if (!physOn || !bumpersRef.current) return;
      const len = FOUL_Z - PIN_Z_START + 2;
      for (const side of [-1, 1]) {
        const m = MeshBuilder.CreateBox(`bumperBody${side}`, { width: 0.26, height: 0.8, depth: len }, scene);
        m.position.set(side * (HALF_W + 0.13), 0.35, (FOUL_Z + PIN_Z_START) / 2);
        m.isVisible = false;
        const b = new PhysicsBody(m, PhysicsMotionType.STATIC, false, scene);
        const sh = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(0.26, 0.8, len), scene);
        sh.material = { friction: 0.1, restitution: 0.55 };
        b.shape = sh;
        bumperBodies.push(b);
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
        scene.enablePhysics(new Vector3(0, -GRAVITY, 0), plugin);
        // 4 sub-steps per frame: fast ball vs. thin pins stays stable.
        scene.getPhysicsEngine()?.setSubTimeStep(4);
        world.addStaticPhysics();
        if (throwPhase === "rolling" || throwPhase === "settling" || throwPhase === "done") physPending = true;
        else activatePhysics();
      })
      .catch((e) => {
        physFailed = true;
        console.warn("Havok physics unavailable, using simple physics", e);
      });

    // ---- Pins ----
    function createPins(): PinState[] {
      const out: PinState[] = [];
      for (let i = 0; i < 10; i++) {
        const mesh = world.makePin(i);
        const p: PinState = { mesh, knocked: false, body: null, fall: null };
        out.push(p);
      }
      if (physOn) for (const p of out) addPinBody(p);
      return out;
    }
    let pins = createPins();

    // ---- Trajectory preview (shows the oily skid part of the path) ----
    const TRAJ_N = 40;
    const trajPts = Array.from({ length: TRAJ_N }, () => new Vector3());
    let trajectory: LinesMesh = MeshBuilder.CreateLines("trajectory", { points: trajPts, updatable: true }, scene);
    trajectory.color = new Color3(1, 0.95, 0.45);
    trajectory.alpha = 0.85;
    trajectory.isPickable = false;
    const aimRing = MeshBuilder.CreateTorus("aimRing", { diameter: BALL_R * 2.6, thickness: 0.06, tessellation: 32 }, scene);
    const aimMat = new StandardMaterial("aimMat", scene);
    aimMat.emissiveColor = new Color3(1, 0.85, 0.2);
    aimMat.disableLighting = true;
    aimRing.material = aimMat;
    aimRing.isPickable = false;
    world.glow.addIncludedOnlyMesh(aimRing);

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
    powerContainer.appendChild(sweetDiv);

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

    // Strike/spare/pins pop-up: big, bouncy, rainbow-filled, outlined and glowing.
    // Sits in the top band (over the sky/castle), never over the lane.
    if (!document.getElementById("rsb-pop-style")) {
      const st = document.createElement("style");
      st.id = "rsb-pop-style";
      st.textContent =
        "@keyframes rsbPopIn{0%{transform:translate(-50%,0) scale(0) rotate(-10deg)}55%{transform:translate(-50%,0) scale(1.28) rotate(4deg)}75%{transform:translate(-50%,0) scale(0.92) rotate(-2deg)}100%{transform:translate(-50%,0) scale(1) rotate(0)}}" +
        "@keyframes rsbWobble{0%,100%{transform:translate(-50%,0) scale(1) rotate(-2deg)}50%{transform:translate(-50%,0) scale(1.07) rotate(2deg)}}" +
        "@keyframes rsbPopOut{0%{transform:translate(-50%,0) scale(1);opacity:1}100%{transform:translate(-50%,-30px) scale(1.35);opacity:0}}" +
        "@keyframes rsbHue{0%{background-position:0% 50%}100%{background-position:200% 50%}}";
      document.head.appendChild(st);
    }
    const bigLabel = document.createElement("div");
    bigLabel.style.cssText =
      "position:absolute;top:13%;left:50%;transform:translate(-50%,0) scale(0);" +
      "font-family:'Luckiest Guy',Fredoka,Fraunces,sans-serif;font-size:clamp(46px,10.5vw,118px);font-weight:900;" +
      "text-align:center;line-height:1.02;white-space:nowrap;letter-spacing:0.02em;" +
      "background:linear-gradient(90deg,#ff3b3b,#ff8c1a,#ffd60a,#3ddc4a,#1fb6ff,#b14cff,#ff3b3b);background-size:200% 100%;" +
      "-webkit-background-clip:text;background-clip:text;color:transparent;" +
      "-webkit-text-stroke:3px #ffffff;" +
      "filter:drop-shadow(0 0 14px rgba(255,255,255,0.9)) drop-shadow(0 0 28px rgba(255,90,200,0.75)) drop-shadow(5px 6px 0 #4c1d95);" +
      "pointer-events:none;opacity:0;z-index:30;";
    hudDiv.appendChild(bigLabel);

    let bigLabelTimer: ReturnType<typeof setTimeout> | null = null;
    function showBigLabel(text: string, sub = "", ms = 1600) {
      bigLabel.textContent = text;
      if (sub) {
        const subEl = document.createElement("div");
        subEl.textContent = sub;
        subEl.style.cssText =
          "font-size:0.42em;margin-top:6px;color:#fff;-webkit-text-stroke:2px #7c3aed;white-space:normal;max-width:92vw;" +
          "text-shadow:3px 3px 0 #ff8c1a,6px 6px 0 #1fb6ff;";
        bigLabel.appendChild(subEl);
      }
      bigLabel.style.opacity = "1";
      bigLabel.style.animation = "none";
      void bigLabel.offsetWidth;
      bigLabel.style.animation = "rsbPopIn 0.65s cubic-bezier(.2,1.5,.4,1) both, rsbWobble 1.3s ease-in-out 0.65s infinite, rsbHue 2.4s linear infinite";
      if (bigLabelTimer !== null) clearTimeout(bigLabelTimer);
      bigLabelTimer = setTimeout(() => {
        bigLabel.style.animation = "rsbPopOut 0.45s ease-in both";
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
    let aimAngle = 0;
    let power = 0;
    let powerDir = 1;
    // Spin: -1 = hook to the left, +1 = hook to the right, 0 = straight.
    let spin = 0;
    let spinT = 0;
    let spinManual = false;
    let ballX = 0;
    let ballZ = START_Z;
    let guttered = false;
    let settleTimer = 0;
    let instrFadeTimer = 0;
    let showInstr = true;
    let currentFrame = 0;
    let currentThrow = 0;
    let standingBeforeThrow: boolean[] = new Array(10).fill(true) as boolean[];
    const frames: FrameScore[] = [];
    for (let i = 0; i < 10; i++) frames.push({ throws: [], pinsDown: [] });
    // Simple (no Havok) fallback ball state.
    const simV = { x: 0, y: 0, z: 0 };
    const simW = { x: 0, y: 0, z: 0 };

    const sfx = new SoundFX();
    sfxRef.current = sfx;

    function throwSpeed(p: number) {
      return (27 + p * 16) * (1 + (12 - feel.pounds) * 0.012);
    }

    function updateTrajectory() {
      const powerSample = throwPhase === "aiming" ? 0.66 : power;
      const spinSample = throwPhase === "spin" ? spin : 0;
      const path = predictPath(aimX, throwSpeed(powerSample), aimAngle, spinSample, feel.hook, HALF_W, 80);
      // Only show ~70% of the way: the hook near the pins is for Narek to discover.
      const stopZ = FOUL_Z - 0.7 * (FOUL_Z - PIN_Z_START);
      const pts = path.filter((p) => p.z >= stopZ);
      if (pts.length < 2) return;
      for (let i = 0; i < TRAJ_N; i++) {
        const f = (i / (TRAJ_N - 1)) * (pts.length - 1);
        const a = pts[Math.floor(f)]!;
        const b = pts[Math.min(pts.length - 1, Math.floor(f) + 1)]!;
        const t = f - Math.floor(f);
        trajPts[i]!.set(a.x + (b.x - a.x) * t, 0.03, a.z + (b.z - a.z) * t);
      }
      trajectory = MeshBuilder.CreateLines("trajectory", { points: trajPts, instance: trajectory }, scene);
      const g = pts.some((p) => p.gutter);
      trajectory.color.set(1, g ? 0.4 : 0.95, g ? 0.35 : 0.45);
    }

    function updateHUD() {
      const show = (el: HTMLElement, on: boolean) => { el.style.display = on ? "flex" : "none"; };
      if (throwPhase === "aiming") {
        phaseLabel.textContent = "🎯 Aim!";
        phaseLabel.style.opacity = "1";
        if (showInstr) {
          instrLabel.textContent = "Slide to aim, then tap! Or swipe up to throw!";
          instrLabel.style.opacity = "1";
        }
        show(powerWrap, false); show(spinWrap, false);
        trajectory.isVisible = true; aimRing.setEnabled(true);
      } else if (throwPhase === "power") {
        phaseLabel.textContent = "💪 Tap in the green!";
        phaseLabel.style.opacity = "1";
        if (showInstr) {
          instrLabel.textContent = "Tap when the bar is in the green!";
          instrLabel.style.opacity = "1";
        }
        show(powerWrap, true); show(spinWrap, false);
        trajectory.isVisible = true; aimRing.setEnabled(true);
      } else if (throwPhase === "spin") {
        phaseLabel.textContent = "🌀 Tap to spin!";
        phaseLabel.style.opacity = "1";
        if (showInstr) {
          instrLabel.textContent = "Tap to pick your spin (middle = straight). Spin makes it hook!";
          instrLabel.style.opacity = "1";
        }
        show(powerWrap, false); show(spinWrap, true);
        trajectory.isVisible = true; aimRing.setEnabled(true);
      } else {
        if (throwPhase !== "rolling" || !sweetThrow) {
          phaseLabel.textContent = "";
          phaseLabel.style.opacity = "0";
        }
        instrLabel.style.opacity = "0";
        show(powerWrap, false); show(spinWrap, false);
        trajectory.isVisible = false; aimRing.setEnabled(false);
      }
    }

    function resetBallPosition() {
      disposeBallBody();
      ballX = aimX;
      ballZ = START_Z;
      ball.rotationQuaternion = null;
      ball.rotation.set(0, 0, 0);
      ball.position.set(aimX, BALL_R + 0.002, START_Z);
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

    // Second ball: knocked pins are swept away, standing pins stay exactly
    // where they ended up (like a real pinsetter).
    function clearKnockedPins() {
      for (const p of pins) {
        if (p.knocked && p.mesh.isEnabled()) {
          removePinBody(p);
          p.mesh.setEnabled(false);
        } else if (!p.knocked && p.body) {
          p.body.setLinearVelocity(Vector3.Zero());
          p.body.setAngularVelocity(Vector3.Zero());
        }
      }
      standingBeforeThrow = pins.map((p) => !p.knocked);
    }

    // Set up the next throw. resetAll=true for a fresh rack.
    function nextThrow(resetAll: boolean) {
      if (physPending) activatePhysics();
      if (resetAll) resetAllPins();
      else clearKnockedPins();
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
      aimAngle = 0;
      power = 0;
      powerDir = 1;
      spin = 0;
      resetBallPosition();
      onStatsRef.current?.({ frame: Math.min(currentFrame + 1, 10) });
      updateTrajectory();
      updateHUD();
    }

    function startPower() {
      throwPhase = "power";
      bridgeTarget = 0;
      power = 0;
      powerDir = 1;
      updateHUD();
    }

    function startSpin() {
      throwPhase = "spin";
      spin = 0;
      spinT = 0;
      spinManual = false;
      updateTrajectory();
      updateHUD();
    }

    let sweetThrow = false;
    function throwBall() {
      bridgeTarget = 0;
      sweetThrow = power >= SWEET_MIN && power <= SWEET_MAX;
      if (sweetThrow) {
        phaseLabel.textContent = "⭐ Perfect power!";
        phaseLabel.style.opacity = "1";
      }
      throwPhase = "rolling";
      guttered = false;
      rollTime = 0;
      firstCrash = false;
      const miss = sweetThrow ? 0 : Math.min(1, Math.abs(power - (SWEET_MIN + SWEET_MAX) / 2) * 3);
      const angle = aimAngle + (Math.random() * 2 - 1) * (0.003 + miss * 0.02);
      const speed = throwSpeed(power);
      const rel = releaseState(speed, angle, spin, feel.hook);
      ballX = aimX;
      ballZ = START_Z;
      ball.position.set(aimX, BALL_R + 0.002, START_Z);
      if (physOn) {
        disposeBallBody();
        ball.rotationQuaternion = Quaternion.Identity();
        const bb = world.makeBallBody();
        bb.setLinearVelocity(new Vector3(rel.v.x, 0, rel.v.z));
        bb.setAngularVelocity(new Vector3(rel.w.x, rel.w.y, rel.w.z));
        ballBody = bb;
      } else {
        simV.x = rel.v.x; simV.y = 0; simV.z = rel.v.z;
        simW.x = rel.w.x; simW.y = 0; simW.z = rel.w.z;
      }
      sfx.startRoll();
      instrFadeTimer = 3;
      updateHUD();
    }

    // Throw API for tests/screenshots: __rsbThrow({ aimX, power, spin, angle })
    function scriptedThrow(o: { aimX?: number; power?: number; spin?: number; angle?: number }) {
      if (throwPhase !== "aiming" && throwPhase !== "power" && throwPhase !== "spin") return false;
      aimX = Math.max(-AIM_MAX, Math.min(AIM_MAX, o.aimX ?? 0));
      aimAngle = o.angle ?? 0;
      power = o.power ?? 0.66;
      spin = Math.max(-1, Math.min(1, o.spin ?? 0));
      resetBallPosition();
      throwBall();
      return true;
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

      const thm = getTheme(themeRef.current);
      const pool = [...CHEERS, ...characterRef.current.cheers, ...characterRef.current.cheers, ...NAME_PHRASES, ...thm.cheers, ...thm.cheers];
      if (thm.sfx === "coin" && newlyKnocked > 0) for (let k = 0; k < Math.min(newlyKnocked, 6); k++) setTimeout(() => sfx.coin(), 120 + k * 110);
      const cheer = pool[Math.floor(Math.random() * pool.length)]!;
      onThrowRef.current?.({ pins: newlyKnocked, strike: currentThrow === 0 && newlyKnocked === 10, spare: currentThrow === 1 && frame.throws.reduce((a, b) => a + b, 0) >= 10 && frame.throws[0] !== 10, gutter: guttered, frame: currentFrame + 1 });
      if (Math.random() < 0.6) floatPhrase(hudDiv);
      bridgeTarget = 0;
      if (isStrike) {
        const r = Math.random();
        showBigLabel(`${thm.emoji} STRIKE! ${thm.emoji}`, r < 0.35 ? characterRef.current.strikeCheer : r < 0.7 ? pick(thm.strikeCheers) : pick(STRIKE_PHRASES), 2600);
        setTimeout(() => floatPhrase(hudDiv, pick([...STRIKE_PHRASES, ...thm.strikeCheers])), 700);
        bridgeTarget = 1;
        sfx.strike();
        if (thm.sfx === "coin") setTimeout(() => sfx.powerUp(), 900);
        else if (thm.sfx === "hero") setTimeout(() => sfx.heroFanfare(), 700);
        confetti(260);
        fireworks(hudDiv, 12, 2600);
        animalDisco(hudDiv, 4200);
      } else if (isSpare) {
        showBigLabel("✨ SPARE! ✨", pick(SPARE_PHRASES), 2200);
        sfx.spare();
        if (thm.sfx === "hero") setTimeout(() => sfx.heroFanfare(), 600);
        confetti(140);
        fireworks(hudDiv, 6, 1800);
        animalDisco(hudDiv, 3200);
      } else if (newlyKnocked === 0) {
        showBigLabel(guttered ? "Oops, gutter!" : "So close!", pick(MISS_PHRASES));
        if (!guttered) sfx.encourage();
      } else {
        showBigLabel(`${newlyKnocked} pin${newlyKnocked === 1 ? "" : "s"}!`, newlyKnocked >= 7 && Math.random() < 0.6 ? pick(BIG_HIT_PHRASES) : cheer);
        if (newlyKnocked >= 5) setTimeout(() => floatPhrase(hudDiv), 500);
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
    // Tap/Space: aim -> power -> spin -> throw. Drag to aim. Swipe up to throw
    // (swipe speed = power, sideways = angle, a curved swipe = spin).
    let pointerDown = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartT = 0;
    let aimXAtPointerStart = 0;
    let spinAtPointerStart = 0;
    let swipeMidX = 0;
    let swipeMidY = 0;
    let swipeMaxUp = 0;

    function advance() {
      if (throwPhase === "aiming") startPower();
      else if (throwPhase === "power") startSpin();
      else if (throwPhase === "spin") throwBall();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft" && throwPhase === "aiming") {
        // Camera-left is +X (left-handed coords, camera looking down -Z).
        aimX = Math.min(AIM_MAX, aimX + 0.15);
      } else if (e.key === "ArrowRight" && throwPhase === "aiming") {
        aimX = Math.max(-AIM_MAX, aimX - 0.15);
      } else if (e.key === "ArrowLeft" && throwPhase === "spin") {
        spinManual = true;
        spin = Math.max(-1, spin - 0.1);
      } else if (e.key === "ArrowRight" && throwPhase === "spin") {
        spinManual = true;
        spin = Math.min(1, spin + 0.1);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      pointerStartT = performance.now();
      swipeMidX = e.clientX;
      swipeMidY = e.clientY;
      swipeMaxUp = 0;
      if (throwPhase === "aiming") {
        pointerDown = true;
        aimXAtPointerStart = aimX;
      } else if (throwPhase === "power") {
        startSpin();
      } else if (throwPhase === "spin") {
        pointerDown = true;
        spinAtPointerStart = spin;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const up = pointerStartY - e.clientY;
      if (up > swipeMaxUp) swipeMaxUp = up;
      if (throwPhase === "aiming" && up > 40 && up > Math.abs(e.clientX - pointerStartX)) {
        aimX = aimXAtPointerStart;
        if (up < swipeMaxUp * 0.5 + 30 || Math.abs(swipeMidY - pointerStartY) < up / 2) {
          swipeMidX = e.clientX;
          swipeMidY = e.clientY;
        }
      } else if (throwPhase === "aiming") {
        const dx = (e.clientX - pointerStartX) * -0.012;
        aimX = Math.max(-AIM_MAX, Math.min(AIM_MAX, aimXAtPointerStart + dx));
      } else if (throwPhase === "spin" && Math.abs(e.clientX - pointerStartX) > 6) {
        spinManual = true;
        spin = Math.max(-1, Math.min(1, spinAtPointerStart + (e.clientX - pointerStartX) * 0.008));
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      const sdy = pointerStartY - e.clientY;
      const sdx = e.clientX - pointerStartX;
      if (throwPhase === "aiming" && sdy > 50 && sdy > Math.abs(sdx)) {
        const ms = Math.max(60, performance.now() - pointerStartT);
        const speed = sdy / ms; // px per ms
        aimX = aimXAtPointerStart;
        power = Math.max(0.35, Math.min(1, 0.3 + speed * 0.35));
        // Sideways swipe = angle (dragging right sends it camera-right, -X).
        aimAngle = Math.max(-0.05, Math.min(0.05, -(sdx / sdy) * 0.06));
        // Curve of the swipe = spin: compare the second half to the first.
        const firstDx = swipeMidX - pointerStartX;
        const secondDx = e.clientX - swipeMidX;
        spin = Math.max(-1, Math.min(1, ((secondDx - firstDx) / Math.max(40, sdy)) * 2.5));
        throwBall();
        return;
      }
      if (throwPhase === "aiming") startPower();
      else if (throwPhase === "spin") throwBall();
    };

    window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);

    // Test hooks (used by the screenshot scripts).
    (window as unknown as { __rsbCelebrate?: () => void }).__rsbCelebrate = () => {
      bridgeTarget = 1;
      confetti(200);
      fireworks(hudDiv, 12, 2600);
      animalDisco(hudDiv, 4200);
      floatPhrase(hudDiv);
      const thc = getTheme(themeRef.current);
      showBigLabel(`${thc.emoji} STRIKE! ${thc.emoji}`, pick(thc.strikeCheers), 4000);
    };
    (window as unknown as { __rsbThrow?: typeof scriptedThrow }).__rsbThrow = scriptedThrow;
    let fps = 60;
    (window as unknown as { __rsbDebug?: () => unknown }).__rsbDebug = () => ({
      physOn,
      physFailed,
      phase: throwPhase,
      quality: world.quality(),
      fps: Math.round(fps),
      ballLb: feel.pounds,
      hook: feel.hook,
      ball: ball.position.asArray().map((n) => +n.toFixed(2)),
      ballBody: !!ballBody,
      frame: currentFrame + 1,
      pins: pins.map((p) => ({ b: !!p.body, k: p.knocked, y: +p.mesh.position.y.toFixed(2), z: +p.mesh.position.z.toFixed(2) })),
    });

    // ---- Main loop ----
    startAiming();
    const tmpV = { x: 0, y: 0, z: 0 };
    const tmpW = { x: 0, y: 0, z: 0 };
    const vIn = new Vector3();
    const wIn = new Vector3();
    let fpsFrames = 0;
    let fpsTime = 0;
    let slowChecks = 0;

    function countFallen() {
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i]!;
        if (p.knocked || !standingBeforeThrow[i]) continue;
        const q = p.mesh.rotationQuaternion;
        const upY = q ? 1 - 2 * (q.x * q.x + q.z * q.z) : 1;
        const pos = p.mesh.position;
        if (upY < 0.85 || pos.y < -0.25 || Math.abs(pos.x) > HALF_W + 0.1 || pos.z < DECK_END + 0.2) p.knocked = true;
      }
    }

    // Simple physics when Havok can't load: ball follows the oil model,
    // pins near the ball (or a falling pin) tip over.
    function simStep(dt: number) {
      if (!guttered) applyContactFriction(simV, simW, laneFriction(ballZ), dt);
      ballX += simV.x * dt;
      ballZ += simV.z * dt;
      if (bumpersRef.current && Math.abs(ballX) > HALF_W - BALL_R) {
        ballX = Math.sign(ballX) * (HALF_W - BALL_R);
        simV.x = -simV.x * 0.5;
        simW.z = 0;
        sfx.bumper();
      }
      ball.position.set(guttered ? Math.sign(ballX) * (HALF_W + GUTTER_W / 2) : ballX, guttered ? BALL_R - 0.25 : BALL_R, ballZ);
      ball.rotation.x += (simV.z / BALL_R) * dt;
      if (!guttered) {
        for (let i = 0; i < pins.length; i++) {
          const p = pins[i]!;
          if (p.knocked || p.fall || !p.mesh.isEnabled()) continue;
          const dx = p.mesh.position.x - ballX;
          const dz = p.mesh.position.z - ballZ;
          const d = Math.hypot(dx, dz);
          if (d < BALL_R + PIN_MAX_R * 1.4) {
            p.fall = { t: 0, ax: -dz / (d || 1), az: dx / (d || 1), vx: (dx / (d || 1)) * 5 + simV.x * 0.3, vz: (dz / (d || 1)) * 5 - 8 };
            simV.x -= (dx / (d || 1)) * 2.5;
            simV.z *= 0.9;
            sfx.pinHit(0.9);
            if (!firstCrash) { firstCrash = true; shake = 0.3; }
          }
        }
      }
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i]!;
        if (!p.fall || p.fall.t >= 1) continue;
        p.fall.t = Math.min(1, p.fall.t + dt * 2.2);
        p.mesh.position.x += p.fall.vx * dt * (1 - p.fall.t);
        p.mesh.position.z += p.fall.vz * dt * (1 - p.fall.t);
        p.mesh.rotationQuaternion = Quaternion.RotationAxis(new Vector3(p.fall.ax, 0, p.fall.az), p.fall.t * Math.PI * 0.5);
        for (let j = 0; j < pins.length; j++) {
          const q = pins[j]!;
          if (q.fall || q.knocked || j === i) continue;
          const dx = q.mesh.position.x - p.mesh.position.x;
          const dz = q.mesh.position.z - p.mesh.position.z;
          if (Math.hypot(dx, dz) < PIN_H * 0.8 * p.fall.t && Math.random() < 0.08) {
            q.fall = { t: 0, ax: -dz, az: dx, vx: dx * 1.5, vz: dz * 1.5 - 2 };
            sfx.pinHit(0.6);
          }
        }
      }
    }

    scene.registerBeforeRender(() => {
      const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
      animT += dt;
      world.backdrop.update(animT, dt);
      capeNode.position.set(ball.position.x, ball.position.y + 0.25, ball.position.z);
      if (cape) {
        const rollingNow = throwPhase === "rolling" || throwPhase === "settling";
        if (rollingNow && !capePhaseWasRolling) cape.reset();
        capePhaseWasRolling = rollingNow;
        cape.isVisible = rollingNow;
      }

      // FPS watchdog: drop quality if the tablet can't keep up.
      fpsFrames++;
      fpsTime += dt;
      if (fpsTime > 2) {
        fps = fpsFrames / fpsTime;
        fpsFrames = 0;
        fpsTime = 0;
        if (fps < 40 && world.quality() > 0 && forcedQ === null) {
          slowChecks++;
          if (slowChecks >= 2) {
            const nq = (world.quality() - 1) as Quality;
            slowChecks = 0;
            // Change render targets between frames, never mid-render.
            scene.onAfterRenderObservable.addOnce(() => {
              try { world.setQuality(nq); } catch (e) { console.warn("quality change failed", e); }
            });
          }
        } else slowChecks = 0;
      }

      if (showInstr && instrFadeTimer > 0) {
        instrFadeTimer -= dt;
        if (instrFadeTimer <= 0) {
          showInstr = false;
          instrLabel.style.opacity = "0";
        }
      }

      if (throwPhase === "aiming" || throwPhase === "power" || throwPhase === "spin") {
        ball.position.set(aimX, BALL_R + 0.002, START_Z);
        aimRing.position.set(aimX, 0.03, START_Z);
        aimRing.scaling.setAll(1 + 0.08 * Math.sin(performance.now() / 180));
        if (throwPhase === "aiming") updateTrajectory();
      }

      if (throwPhase === "power") {
        power += powerDir * 0.8 * dt;
        if (power >= 1) { power = 1; powerDir = -1; }
        else if (power <= 0) { power = 0; powerDir = 1; }
        powerFillDiv.style.height = `${Math.round(power * 100)}%`;
        const inSweet = power >= SWEET_MIN && power <= SWEET_MAX;
        powerFillDiv.style.background = inSweet ? "linear-gradient(#86efac,#16a34a)" : "linear-gradient(#ff8c1a,#ff3b3b)";
      }

      if (throwPhase === "spin") {
        if (!spinManual) {
          spinT += dt;
          spin = Math.sin(spinT * 2.2);
        }
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

      if (throwPhase === "rolling") {
        rollTime += dt;
        let vz = -30;
        if (physOn && ballBody) {
          ballX = ball.position.x;
          ballZ = ball.position.z;
          ballBody.getLinearVelocityToRef(vIn);
          ballBody.getAngularVelocityToRef(wIn);
          vz = vIn.z;
          const y = ball.position.y;
          const onLane = Math.abs(ballX) < HALF_W && y < BALL_R + 0.04 && y > BALL_R - 0.08 && ballZ > DECK_END;
          const inGutter = Math.abs(ballX) >= HALF_W && y < BALL_R + 0.04 && ballZ > DECK_END;
          if (onLane || inGutter) {
            tmpV.x = vIn.x; tmpV.y = vIn.y; tmpV.z = vIn.z;
            tmpW.x = wIn.x; tmpW.y = wIn.y; tmpW.z = wIn.z;
            const mu = inGutter ? 0.15 : laneFriction(ballZ);
            for (let k = 0; k < 4; k++) applyContactFriction(tmpV, tmpW, mu, dt / 4);
            vIn.set(tmpV.x, tmpV.y, tmpV.z);
            wIn.set(tmpW.x, tmpW.y, tmpW.z);
            ballBody.setLinearVelocity(vIn);
            ballBody.setAngularVelocity(wIn);
          }
          if (!guttered && !bumpersRef.current && Math.abs(ballX) > HALF_W && ballZ > PIN_Z_START + 1) {
            guttered = true;
            sfx.gutter();
          }
          if (ballZ < PIN_Z_START - 2 || rollTime > 7 || ball.position.y < -3 || (rollTime > 1 && vIn.length() < 0.6) || (ballZ < PIN_Z_START + 2 && vz > 1)) {
            throwPhase = "settling";
            settleTimer = 0;
            sfx.stopRoll();
            updateHUD();
          }
        } else {
          simStep(dt);
          vz = simV.z;
          if (!guttered && !bumpersRef.current && Math.abs(ballX) > HALF_W) {
            guttered = true;
            sfx.gutter();
          }
          if (ballZ < PIN_Z_START - 4 || rollTime > 7) {
            throwPhase = "settling";
            settleTimer = 0;
            ball.setEnabled(false);
            sfx.stopRoll();
            updateHUD();
          }
        }
        void vz;
      } else if (throwPhase === "settling") {
        settleTimer += dt;
        let moving = false;
        if (physOn) {
          for (const p of pins) {
            if (p.body && (p.body.getLinearVelocity().length() > 0.3 || p.body.getAngularVelocity().length() > 0.8)) moving = true;
          }
        } else {
          simStep(dt);
          moving = pins.some((p) => p.fall && p.fall.t < 1);
        }
        if ((settleTimer > 1.8 && !moving) || settleTimer > 5) {
          disposeBallBody();
          ball.setEnabled(false);
          countFallen();
          for (const p of pins) if (p.fall) p.knocked = true;
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

      // ---- Cinematic camera ----
      // Aim: behind the ball. Rolling: chase right behind it. Near the pins:
      // swoop to a low close-up of the deck for the crash, hold while pins
      // settle, then glide back for the next ball.
      {
        shake = Math.max(0, shake - dt);
        let px: number, py: number, pz: number, tx: number, ty: number, tz: number;
        let rate = 2.4;
        const crashPx = 1.6, crashPy = 1.55, crashPz = PIN_Z_START + 6.2;
        const crashTx = 0, crashTy = 0.7, crashTz = PIN_Z_START - 1.8;
        if (throwPhase === "rolling" && ball.isEnabled()) {
          const bx = ball.position.x;
          const bz = ball.position.z;
          // Lead the target by the ball speed so the smoothing doesn't lag behind.
          const lead = Math.max(-8, vIn.z / 9);
          px = bx * 0.75; py = 1.5; pz = bz + 5.2 + lead;
          tx = bx * 0.5; ty = 0.45; tz = Math.max(bz - 14, PIN_Z_START - 2);
          // Blend into the crash close-up over the last ~18 units.
          const s0 = Math.min(1, Math.max(0, (PIN_Z_START + 18 - bz) / 14));
          const s = s0 * s0 * (3 - 2 * s0);
          px += (crashPx - px) * s; py += (crashPy - py) * s; pz += (Math.min(pz, crashPz) - pz) * s;
          tx += (crashTx - tx) * s; ty += (crashTy - ty) * s; tz += (crashTz - tz) * s;
          rate = 9;
        } else if (throwPhase === "rolling" || throwPhase === "settling" || throwPhase === "done") {
          // Slow dolly while the pins mix.
          const dolly = Math.min(1, settleTimer / 4);
          px = crashPx - dolly * 0.6; py = crashPy + dolly * 0.25; pz = crashPz - dolly * 0.8;
          tx = crashTx; ty = crashTy; tz = crashTz;
          rate = 4;
        } else {
          px = aimX * 0.4; py = 3.0; pz = START_Z + 7.2;
          tx = aimX * 0.15; ty = 0.2; tz = START_Z - 28;
          rate = 2.2;
        }
        const k = 1 - Math.exp(-dt * rate);
        camPos.x += (px - camPos.x) * k; camPos.y += (py - camPos.y) * k; camPos.z += (pz - camPos.z) * k;
        camTarget.x += (tx - camTarget.x) * k; camTarget.y += (ty - camTarget.y) * k; camTarget.z += (tz - camTarget.z) * k;
        const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
        const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.35 : 0;
        camera.position.set(camPos.x + sx, camPos.y + sy, camPos.z);
        camera.setTarget(camTarget);
        // Keep the soft shadows sharp around whatever we're looking at.
        world.setShadowFocus(camTarget.x * 0.5 + camPos.x * 0.5, Math.max(PIN_Z_START - 2, Math.min(camPos.z - 6, camTarget.z + 8)));
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
      scene.dispose();
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
