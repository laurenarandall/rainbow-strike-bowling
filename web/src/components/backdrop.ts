// Theme backgrounds: sky dome, ground and decorative props (all original art
// built from simple shapes). Purely visual: no physics here.
import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import type { ThemeDef } from "../themes";

export interface Backdrop {
  sky: Mesh;
  floor: Mesh;
  envMeshes: AbstractMesh[];
  update: (t: number, dt: number) => void;
}

function tex(scene: Scene, name: string, w: number, h: number, paint: (c: CanvasRenderingContext2D, w: number, h: number) => void): DynamicTexture {
  const t = new DynamicTexture(name, { width: w, height: h }, scene, true);
  const c = t.getContext() as unknown as CanvasRenderingContext2D;
  paint(c, w, h);
  t.update();
  return t;
}
function flat(scene: Scene, name: string, hex: string, emissive = 0): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = new Color3(0.15, 0.15, 0.15);
  if (emissive > 0) m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
  return m;
}
function glowMat(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.emissiveColor = Color3.FromHexString(hex);
  m.diffuseColor = Color3.Black();
  m.disableLighting = true;
  return m;
}
function gloss(scene: Scene, name: string, hex: string, rough = 0.2, metal = 0): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
  m.roughness = rough;
  m.metallic = metal;
  m.clearCoat.isEnabled = rough < 0.3;
  return m;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function paintSky(theme: ThemeDef, c: CanvasRenderingContext2D, w: number, h: number) {
  // The dome's v runs bottom-up, so paint upside down.
  c.setTransform(1, 0, 0, -1, 0, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  for (const [p, col] of theme.sky.stops) g.addColorStop(p, col);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < theme.sky.stars; i++) {
    const y = Math.pow(Math.random(), 1.4) * h * 0.46;
    const s = Math.random() < 0.06 ? 2.2 : Math.random() * 1.3 + 0.4;
    c.fillStyle = `rgba(255,255,${200 + Math.floor(Math.random() * 55)},${0.4 + Math.random() * 0.6})`;
    c.beginPath();
    c.arc(Math.random() * w, y, s, 0, Math.PI * 2);
    c.fill();
    if (s > 2) {
      // sparkle cross
      c.fillRect(0, 0, 0, 0);
    }
  }
  for (let i = 0; i < theme.sky.clouds; i++) {
    const cx = Math.random() * w;
    const cy = h * rnd(0.3, 0.47);
    const sc = rnd(0.6, 1.4);
    c.fillStyle = theme.sky.cloudColor;
    c.globalAlpha = 0.85;
    for (let k = 0; k < 7; k++) {
      c.beginPath();
      c.arc(cx + (k - 3) * 9 * sc, cy - Math.sin((k / 6) * Math.PI) * 9 * sc, (9 + Math.random() * 6) * sc, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 0.35;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(cx - 6 * sc, cy - 10 * sc, 7 * sc, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
  }
}

function paintGround(theme: ThemeDef, c: CanvasRenderingContext2D, w: number, h: number) {
  const { color, color2, pattern } = theme.ground;
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  if (pattern === "grass") {
    for (let i = 0; i < 2500; i++) {
      c.fillStyle = Math.random() < 0.5 ? color2 : "rgba(30,90,40,0.35)";
      c.fillRect(Math.random() * w, Math.random() * h, 2, 5);
    }
    for (let i = 0; i < 60; i++) {
      c.fillStyle = ["#ffe066", "#ff8fc8", "#ffffff", "#a5b4fc"][i % 4]!;
      c.beginPath();
      c.arc(Math.random() * w, Math.random() * h, 3, 0, Math.PI * 2);
      c.fill();
    }
  } else if (pattern === "candy") {
    const n = 8;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if ((x + y) % 2) { c.fillStyle = color2; c.fillRect((x * w) / n, (y * h) / n, w / n, h / n); }
    }
    for (let i = 0; i < 300; i++) {
      c.fillStyle = ["#ff4fa8", "#ffe600", "#22d3ee", "#a855f7", "#ffffff"][i % 5]!;
      c.fillRect(Math.random() * w, Math.random() * h, 6, 2);
    }
  } else if (pattern === "space" || pattern === "carpet") {
    c.strokeStyle = color2;
    c.lineWidth = 2;
    if (pattern === "space") {
      for (let i = 0; i <= 8; i++) {
        c.beginPath(); c.moveTo((i * w) / 8, 0); c.lineTo((i * w) / 8, h); c.stroke();
        c.beginPath(); c.moveTo(0, (i * h) / 8); c.lineTo(w, (i * h) / 8); c.stroke();
      }
    } else {
      const cols = ["#ff2bd6", "#00e5ff", "#39ff14", "#ffe600", "#a855f7"];
      for (let i = 0; i < 90; i++) {
        c.strokeStyle = cols[i % cols.length]!;
        c.lineWidth = 3;
        c.beginPath();
        if (i % 3 === 0) c.arc(Math.random() * w, Math.random() * h, rnd(6, 16), 0, Math.PI * 2);
        else {
          const x = Math.random() * w, y = Math.random() * h;
          c.moveTo(x, y);
          c.bezierCurveTo(x + 15, y - 20, x + 25, y + 20, x + 40, y);
        }
        c.stroke();
      }
    }
    for (let i = 0; i < 200; i++) {
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  } else if (pattern === "lava") {
    for (let i = 0; i < 400; i++) {
      c.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`;
      c.beginPath();
      c.arc(Math.random() * w, Math.random() * h, rnd(4, 14), 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = color2;
    c.lineWidth = 3;
    c.shadowColor = "#ffd000";
    c.shadowBlur = 8;
    for (let i = 0; i < 40; i++) {
      let x = Math.random() * w, y = Math.random() * h;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += rnd(-25, 25); y += rnd(-25, 25); c.lineTo(x, y); }
      c.stroke();
    }
    c.shadowBlur = 0;
  } else if (pattern === "city") {
    c.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 800; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    c.fillStyle = color2;
    for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 3, y, 6, 36);
  }
}

export function buildBackdrop(scene: Scene, theme: ThemeDef, glow: GlowLayer): Backdrop {
  const anim: ((t: number, dt: number) => void)[] = [];
  const envMeshes: AbstractMesh[] = [];

  // ---- Sky dome ----
  const sky = MeshBuilder.CreateSphere("sky", { diameter: 400, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene);
  const skyMat = new StandardMaterial("skyMat", scene);
  skyMat.disableLighting = true;
  skyMat.emissiveTexture = tex(scene, "skyTex", 1024, 512, (c, w, h) => paintSky(theme, c, w, h));
  skyMat.backFaceCulling = false;
  sky.material = skyMat;
  sky.isPickable = false;
  sky.infiniteDistance = true;
  envMeshes.push(sky);

  // ---- Ground ----
  const floor = MeshBuilder.CreateGround("floor", { width: 700, height: 700 }, scene);
  floor.position.set(0, -0.6, -60);
  const floorMat = new StandardMaterial("floorMat", scene);
  const gt = tex(scene, "groundTex", 512, 512, (c, w, h) => paintGround(theme, c, w, h));
  gt.uScale = gt.vScale = 40;
  gt.wrapU = gt.wrapV = Texture.WRAP_ADDRESSMODE;
  floorMat.diffuseTexture = gt;
  floorMat.specularColor = new Color3(0.05, 0.05, 0.05);
  if (theme.ground.pattern === "space" || theme.ground.pattern === "carpet" || theme.ground.pattern === "lava") {
    floorMat.emissiveTexture = gt;
    floorMat.emissiveColor = new Color3(0.55, 0.55, 0.55);
  }
  floor.material = floorMat;
  floor.receiveShadows = true;
  envMeshes.push(floor);

  // Optional low sun
  if (theme.sky.sun) {
    const sun = MeshBuilder.CreateDisc("skySun", { radius: 14, tessellation: 48 }, scene);
    sun.position.set(-40, 14, -185);
    sun.material = glowMat(scene, "skySunMat", theme.sky.sun);
    glow.addIncludedOnlyMesh(sun);
    envMeshes.push(sun);
  }

  const balloons = (count: number, cols: string[]) => {
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const b = MeshBuilder.CreateSphere(`balloon${i}`, { diameter: 1.7, segments: 16 }, scene);
      b.scaling.y = 1.2;
      const x = side * rnd(9, 26), y = rnd(5, 17), z = rnd(-75, 0);
      b.position.set(x, y, z);
      b.material = gloss(scene, `balloonMat${i}`, cols[i % cols.length]!, 0.15);
      const str = MeshBuilder.CreateCylinder(`balloonStr${i}`, { height: 3, diameter: 0.04 }, scene);
      str.parent = b;
      str.position.y = -1.9;
      str.material = flat(scene, `balloonStrMat${i}`, "#ffffff");
      const ph = Math.random() * 6;
      anim.push((t) => { b.position.y = y + Math.sin(t * 0.8 + ph) * 0.6; b.rotation.z = Math.sin(t * 0.6 + ph) * 0.08; });
    }
  };

  if (theme.props === "hills") {
    const greens = ["#3fae5a", "#5cc96c", "#7ad877", "#48b860", "#2f9a4f"];
    for (let i = 0; i < 12; i++) {
      const h = MeshBuilder.CreateSphere(`hill${i}`, { diameter: 1, segments: 24 }, scene);
      const back = i < 7;
      h.scaling.set(rnd(50, 90), rnd(14, 30), rnd(30, 50));
      h.position.set(back ? (i - 3) * 38 + rnd(-8, 8) : (i % 2 ? 1 : -1) * rnd(55, 80), -4, back ? rnd(-150, -120) : rnd(-60, 10));
      h.material = flat(scene, `hillMat${i}`, greens[i % greens.length]!);
      envMeshes.push(h);
    }
    // Big rainbow arc behind the castle
    const cols = ["#ff3b3b", "#ff8c1a", "#ffd60a", "#3ddc4a", "#1fb6ff", "#4c5cff", "#b14cff"];
    cols.forEach((col, k) => {
      const r = MeshBuilder.CreateTorus(`arc${k}`, { diameter: 190 - k * 7, thickness: 3.6, tessellation: 96 }, scene);
      r.rotation.x = Math.PI / 2;
      r.position.set(0, -8, -175);
      const m = glowMat(scene, `arcMat${k}`, col);
      m.alpha = 0.8;
      r.material = m;
      envMeshes.push(r);
    });
    balloons(16, ["#ff3b3b", "#ffd60a", "#1fb6ff", "#ff4fb8", "#3ddc4a", "#b14cff", "#ff8c1a"]);
  } else if (theme.props === "candy") {
    const pastel = ["#ff8fc8", "#9ff0c8", "#ffe58a", "#c9a8ff", "#9fd8ff", "#ffb3a8"];
    for (let i = 0; i < 16; i++) {
      const g = MeshBuilder.CreateSphere(`gum${i}`, { diameter: 1, segments: 20, slice: 0.5 }, scene);
      const s = rnd(10, 26);
      g.scaling.set(s, s * rnd(0.8, 1.2), s);
      const back = i < 8;
      g.position.set(back ? (i - 3.5) * 22 + rnd(-6, 6) : (i % 2 ? 1 : -1) * rnd(28, 60), -0.6, back ? rnd(-130, -95) : rnd(-80, 10));
      g.material = gloss(scene, `gumMat${i}`, pastel[i % pastel.length]!, 0.25);
      envMeshes.push(g);
    }
    const swirl = tex(scene, "swirlTex", 256, 256, (c, w, h) => {
      const cols = ["#ff4fa8", "#ffffff", "#ffe600", "#ffffff", "#22d3ee", "#ffffff"];
      for (let k = 0; k < 60; k++) {
        c.strokeStyle = cols[k % cols.length]!;
        c.lineWidth = 9;
        c.beginPath();
        c.arc(w / 2, h / 2, k * 2.2, k * 0.5, k * 0.5 + Math.PI);
        c.stroke();
      }
    });
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * rnd(9, 24), z = rnd(-70, -5), hgt = rnd(5, 10);
      const stick = MeshBuilder.CreateCylinder(`lolliStick${i}`, { height: hgt, diameter: 0.25 }, scene);
      stick.position.set(x, hgt / 2 - 0.6, z);
      stick.material = flat(scene, `lolliStickMat${i}`, "#ffffff");
      const pop = MeshBuilder.CreateCylinder(`lolli${i}`, { height: 0.5, diameter: rnd(3, 4.5), tessellation: 40 }, scene);
      pop.rotation.x = Math.PI / 2;
      pop.position.set(x, hgt - 0.6, z);
      const m = new StandardMaterial(`lolliMat${i}`, scene);
      m.diffuseTexture = swirl;
      m.emissiveColor = new Color3(0.25, 0.2, 0.25);
      pop.material = m;
      envMeshes.push(stick, pop);
    }
    const caneTex = tex(scene, "caneTex", 64, 256, (c, w, h) => {
      c.fillStyle = "#fff"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#ef4444";
      for (let y = -w; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + w); c.lineTo(w, y + w + 14); c.lineTo(0, y + 14); c.fill(); }
    });
    caneTex.vScale = 6;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const path: Vector3[] = [];
      for (let k = 0; k <= 10; k++) path.push(new Vector3(0, k, 0));
      for (let k = 1; k <= 12; k++) { const a = (k / 12) * Math.PI; path.push(new Vector3(-side * (1.4 - Math.cos(a) * 1.4), 10 + Math.sin(a) * 1.4, 0)); }
      const cane = MeshBuilder.CreateTube(`cane${i}`, { path, radius: 0.35, tessellation: 16 }, scene);
      cane.position.set(side * rnd(12, 20), -0.6, rnd(-60, -10));
      const m = new StandardMaterial(`caneMat${i}`, scene);
      m.diffuseTexture = caneTex;
      cane.material = m;
      envMeshes.push(cane);
    }
    balloons(10, ["#ff8fc8", "#9ff0c8", "#ffe58a", "#c9a8ff"]);
  } else if (theme.props === "space") {
    const planets: [number, number, number, number, string, string, boolean][] = [
      [-70, 40, -150, 26, "#f59e0b", "#b45309", true], [80, 26, -130, 16, "#22d3ee", "#0e7490", false],
      [30, 65, -170, 36, "#c4b5fd", "#6d28d9", false], [-30, 18, -110, 8, "#f472b6", "#9d174d", false],
    ];
    planets.forEach(([x, y, z, d, a, b, ring], i) => {
      const p = MeshBuilder.CreateSphere(`planet${i}`, { diameter: d, segments: 32 }, scene);
      p.position.set(x, y, z);
      const m = new StandardMaterial(`planetMat${i}`, scene);
      m.diffuseTexture = tex(scene, `planetTex${i}`, 256, 128, (c, w, h) => {
        for (let yy = 0; yy < h; yy++) {
          const k = 0.5 + 0.5 * Math.sin(yy * 0.25 + Math.sin(yy * 0.07) * 3);
          c.fillStyle = k > 0.5 ? a : b;
          c.fillRect(0, yy, w, 1);
        }
      });
      m.emissiveColor = Color3.FromHexString(a).scale(0.35);
      p.material = m;
      envMeshes.push(p);
      anim.push((_t, dt) => { p.rotation.y += dt * 0.05; });
      if (ring) {
        const r = MeshBuilder.CreateTorus(`planetRing${i}`, { diameter: d * 1.9, thickness: d * 0.12, tessellation: 64 }, scene);
        r.scaling.y = 0.1;
        r.rotation.z = 0.35;
        r.position.copyFrom(p.position);
        const rm = glowMat(scene, `planetRingMat${i}`, "#fde68a");
        rm.alpha = 0.7;
        r.material = rm;
        envMeshes.push(r);
      }
    });
    for (let i = 0; i < 18; i++) {
      const rock = MeshBuilder.CreateIcoSphere(`rock${i}`, { radius: rnd(0.6, 2), subdivisions: 1, flat: true }, scene);
      const side = i % 2 ? 1 : -1;
      const x = side * rnd(10, 30), y = rnd(4, 16), z = rnd(-80, 0);
      rock.position.set(x, y, z);
      rock.material = flat(scene, `rockMat${i}`, ["#6b7280", "#7c6f64", "#4b5563"][i % 3]!);
      const sp = rnd(0.2, 0.8);
      anim.push((t, dt) => { rock.rotation.x += dt * sp; rock.rotation.y += dt * sp * 0.7; rock.position.y = y + Math.sin(t * 0.5 + i) * 0.5; });
    }
    for (let i = 0; i < 30; i++) {
      const st = MeshBuilder.CreateSphere(`twinkle${i}`, { diameter: 0.35, segments: 6 }, scene);
      st.position.set(rnd(-40, 40), rnd(6, 25), rnd(-110, -10));
      if (Math.abs(st.position.x) < 6) st.position.x += 12 * Math.sign(st.position.x || 1);
      st.material = glowMat(scene, `twinkleMat${i}`, ["#ffffff", "#67e8f9", "#f0abfc", "#fde68a"][i % 4]!);
      glow.addIncludedOnlyMesh(st);
      anim.push((t) => st.scaling.setAll(0.6 + 0.5 * Math.abs(Math.sin(t * 2 + i))));
    }
  } else if (theme.props === "disco") {
    // Neighbouring lanes with glowing edges and their own pins.
    const laneTex = tex(scene, "otherLaneTex", 64, 512, (c, w, h) => {
      for (let x = 0; x < w; x += 4) { c.fillStyle = `hsl(${30 + Math.random() * 8},50%,${55 + Math.random() * 12}%)`; c.fillRect(x, 0, 4, h); }
    });
    const neon = ["#ff2bd6", "#00e5ff", "#39ff14", "#ffe600", "#a855f7", "#ff6b00"];
    for (const side of [-1, 1]) {
      for (let k = 1; k <= 3; k++) {
        const x = side * (k * 7.2 + 1);
        const l = MeshBuilder.CreateBox(`otherLane${side}${k}`, { width: 5, height: 0.2, depth: 70 }, scene);
        l.position.set(x, -0.45, -22);
        const lm = new StandardMaterial(`otherLaneMat${side}${k}`, scene);
        lm.diffuseTexture = laneTex;
        lm.emissiveColor = new Color3(0.12, 0.08, 0.15);
        l.material = lm;
        envMeshes.push(l);
        for (const e of [-1, 1]) {
          const strip = MeshBuilder.CreateBox(`neonStrip${side}${k}${e}`, { width: 0.12, height: 0.12, depth: 70 }, scene);
          strip.position.set(x + e * 2.6, -0.3, -22);
          strip.material = glowMat(scene, `neonStripMat${side}${k}${e}`, neon[(k + (e > 0 ? 1 : 0)) % neon.length]!);
          glow.addIncludedOnlyMesh(strip);
        }
        for (let p = 0; p < 10; p++) {
          const row = p < 1 ? 0 : p < 3 ? 1 : p < 6 ? 2 : 3;
          const col = p - [0, 1, 3, 6][row]!;
          const pin = MeshBuilder.CreateCylinder(`otherPin${side}${k}${p}`, { height: 1.8, diameterTop: 0.25, diameterBottom: 0.35, tessellation: 10 }, scene);
          pin.position.set(x + (col - row / 2) * 1.2, 0.5, -52 - row * 1.1);
          pin.material = glowMat(scene, `otherPinMat${side}${k}${p}`, "#f5f3ff");
          envMeshes.push(pin);
        }
        const mask = MeshBuilder.CreateBox(`otherMask${side}${k}`, { width: 6.5, height: 2.2, depth: 0.4 }, scene);
        mask.position.set(x, 4.2, -49);
        mask.material = glowMat(scene, `otherMaskMat${side}${k}`, neon[(k * 2 + (side > 0 ? 1 : 0)) % neon.length]!);
        (mask.material as StandardMaterial).emissiveColor.scaleInPlace(0.6);
        envMeshes.push(mask);
      }
      // Wall neon tubes
      for (let k = 0; k < 6; k++) {
        const tube = MeshBuilder.CreateTorus(`wallNeon${side}${k}`, { diameter: 3, thickness: 0.15, tessellation: 40 }, scene);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(side * 26, 6 + (k % 2) * 3, -10 - k * 12);
        tube.material = glowMat(scene, `wallNeonMat${side}${k}`, neon[k % neon.length]!);
        glow.addIncludedOnlyMesh(tube);
      }
    }
    // Ceiling with neon rings
    const ceil = MeshBuilder.CreatePlane("ceiling", { width: 80, height: 120, sideOrientation: Mesh.DOUBLESIDE }, scene);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 16, -30);
    ceil.material = flat(scene, "ceilMat", "#0d0620");
    // Disco ball
    const ball = MeshBuilder.CreateSphere("discoBall", { diameter: 3.2, segments: 10 }, scene);
    ball.convertToFlatShadedMesh();
    ball.position.set(0, 11.5, -24);
    const dm = new PBRMaterial("discoMat", scene);
    dm.albedoColor = new Color3(0.9, 0.9, 0.95);
    dm.metallic = 1;
    dm.roughness = 0.05;
    dm.emissiveColor = new Color3(0.25, 0.25, 0.3);
    ball.material = dm;
    const cord = MeshBuilder.CreateCylinder("discoCord", { height: 4.5, diameter: 0.06 }, scene);
    cord.position.set(0, 13.9, -24);
    cord.material = flat(scene, "discoCordMat", "#999999");
    anim.push((_t, dt) => { ball.rotation.y += dt * 0.6; });
    // Light beams sweeping from the disco ball
    for (let k = 0; k < 6; k++) {
      const beam = MeshBuilder.CreateCylinder(`beam${k}`, { height: 14, diameterTop: 0.2, diameterBottom: 3.5, tessellation: 16 }, scene);
      beam.setPivotPoint(new Vector3(0, 7, 0));
      beam.position.set(0, 11.5 - 7, -24);
      const bm = glowMat(scene, `beamMat${k}`, neon[k]!);
      bm.alpha = 0.16;
      beam.material = bm;
      beam.isPickable = false;
      anim.push((t) => { beam.rotation.z = Math.sin(t * 0.7 + k) * 0.7; beam.rotation.x = Math.cos(t * 0.5 + k * 1.3) * 0.6; });
    }
  } else if (theme.props === "lava") {
    // Lava moat around the fortress
    const lavaTex = tex(scene, "lavaTex", 256, 256, (c, w, h) => {
      c.fillStyle = "#ff4d00"; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 140; i++) {
        c.fillStyle = ["#ffd000", "#ff8a00", "#b91c1c"][i % 3]!;
        c.globalAlpha = 0.6;
        c.beginPath(); c.arc(Math.random() * w, Math.random() * h, rnd(6, 22), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    });
    lavaTex.uScale = lavaTex.vScale = 6;
    for (const side of [-1, 1]) {
      const moat = MeshBuilder.CreateGround(`moat${side}`, { width: 9, height: 90 }, scene);
      moat.position.set(side * 12, -0.55, -30);
      const mm = new StandardMaterial(`moatMat${side}`, scene);
      mm.emissiveTexture = lavaTex;
      mm.diffuseColor = Color3.Black();
      mm.disableLighting = true;
      moat.material = mm;
      glow.addIncludedOnlyMesh(moat);
      envMeshes.push(moat);
    }
    const backMoat = MeshBuilder.CreateGround("moatBack", { width: 40, height: 10 }, scene);
    backMoat.position.set(0, -0.55, -70);
    backMoat.material = backMoat.getScene().getMaterialByName("moatMat1");
    anim.push((t) => { lavaTex.uOffset = t * 0.02; lavaTex.vOffset = Math.sin(t * 0.3) * 0.05; });
    // Volcano
    const volc = MeshBuilder.CreateCylinder("volcano", { height: 50, diameterTop: 14, diameterBottom: 110, tessellation: 40 }, scene);
    volc.position.set(30, 20, -170);
    volc.material = flat(scene, "volcMat", "#2a1a14");
    const crater = MeshBuilder.CreateDisc("crater", { radius: 7, tessellation: 32 }, scene);
    crater.rotation.x = Math.PI / 2;
    crater.position.set(30, 45.1, -170);
    crater.material = glowMat(scene, "craterMat", "#ff6a00");
    glow.addIncludedOnlyMesh(crater);
    envMeshes.push(volc);
    // ? blocks (original: yellow block with a drawn question mark)
    const qTex = tex(scene, "qTex", 128, 128, (c, w, h) => {
      c.fillStyle = "#f8b800"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "#8a4b00"; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
      c.fillStyle = "#8a4b00";
      for (const [x, y] of [[14, 14], [w - 18, 14], [14, h - 18], [w - 18, h - 18]]) c.fillRect(x!, y!, 6, 6);
      c.font = "bold 90px 'Luckiest Guy', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "#fff"; c.fillText("?", w / 2 + 3, h / 2 + 7);
      c.fillStyle = "#8a4b00"; c.fillText("?", w / 2, h / 2 + 4);
    });
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const q = MeshBuilder.CreateBox(`qBlock${i}`, { size: 1.6 }, scene);
      const y = rnd(5, 9), x = side * rnd(7.5, 14), z = -6 - i * 7;
      q.position.set(x, y, z);
      const qm = new StandardMaterial(`qMat${i}`, scene);
      qm.diffuseTexture = qTex;
      qm.emissiveColor = new Color3(0.35, 0.25, 0.05);
      q.material = qm;
      envMeshes.push(q);
      anim.push((t) => { q.position.y = y + Math.abs(Math.sin(t * 1.2 + i)) * 0.4; });
    }
    // Coins
    const coinMat = gloss(scene, "coinMat", "#fbd000", 0.25, 0.9);
    coinMat.emissiveColor = new Color3(0.4, 0.3, 0);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const coin = MeshBuilder.CreateCylinder(`coin${i}`, { height: 0.15, diameter: 1, tessellation: 24 }, scene);
      coin.rotation.x = Math.PI / 2;
      const y = 3.5 + (i % 3) * 1.2;
      coin.position.set(side * (6.5 + (i % 3) * 0.2), y, -4 - Math.floor(i / 2) * 5);
      coin.material = coinMat;
      const ph = i * 0.4;
      anim.push((t) => { coin.rotation.y = t * 2.5 + ph; });
    }
    // Green pipes
    const pipeMat = gloss(scene, "pipeMat", "#1fa83a", 0.3);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const h = rnd(3, 6);
      const x = side * rnd(16, 24), z = -10 - i * 10;
      const pipe = MeshBuilder.CreateCylinder(`pipe${i}`, { height: h, diameter: 3, tessellation: 32 }, scene);
      pipe.position.set(x, h / 2 - 0.6, z);
      pipe.material = pipeMat;
      const rim = MeshBuilder.CreateCylinder(`pipeRim${i}`, { height: 1, diameter: 3.6, tessellation: 32 }, scene);
      rim.position.set(x, h - 0.6, z);
      rim.material = pipeMat;
      envMeshes.push(pipe, rim);
    }
    // Fireballs arcing out of the lava
    const fireMat = glowMat(scene, "fireballMat", "#ff7a00");
    for (let i = 0; i < 6; i++) {
      const f = MeshBuilder.CreateSphere(`fireball${i}`, { diameter: 0.9, segments: 10 }, scene);
      f.material = fireMat;
      glow.addIncludedOnlyMesh(f);
      const side = i % 2 ? 1 : -1;
      const x = side * rnd(10, 14), z = -8 - i * 9, per = rnd(2.5, 4), ph = Math.random() * per;
      anim.push((t) => {
        const u = ((t + ph) % per) / per;
        f.position.set(x - side * u * 2, -0.5 + Math.sin(u * Math.PI) * 9, z);
        f.setEnabled(u < 0.95);
      });
    }
  } else if (theme.props === "city") {
    const winTex = tex(scene, "winTex", 128, 256, (c, w, h) => {
      c.fillStyle = "#1e293b"; c.fillRect(0, 0, w, h);
      for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) {
        c.fillStyle = Math.random() < 0.55 ? ["#fde68a", "#fbbf24", "#fff7d6"][Math.floor(Math.random() * 3)]! : "#0f172a";
        c.fillRect(x, y, 8, 10);
      }
    });
    const tints = ["#334155", "#475569", "#1e3a8a", "#3f3f46", "#7f1d1d"];
    for (let i = 0; i < 46; i++) {
      const back = i < 30;
      const w = rnd(8, 18), d = rnd(8, 16), h = rnd(14, 60);
      const b = MeshBuilder.CreateBox(`bld${i}`, { width: w, depth: d, height: h }, scene);
      b.position.set(back ? (i - 15) * 12 + rnd(-3, 3) : (i % 2 ? 1 : -1) * rnd(40, 80), h / 2 - 0.6, back ? rnd(-170, -110) : rnd(-100, 0));
      const m = new StandardMaterial(`bldMat${i}`, scene);
      m.diffuseTexture = winTex;
      m.emissiveTexture = winTex;
      m.emissiveColor = new Color3(0.7, 0.7, 0.7);
      m.diffuseColor = Color3.FromHexString(tints[i % tints.length]!);
      (m.diffuseTexture as DynamicTexture).vScale = 1;
      b.material = m;
      envMeshes.push(b);
    }
    // Crystal hero tower behind the castle
    const crystal = new PBRMaterial("crystalMat", scene);
    crystal.albedoColor = new Color3(0.6, 0.9, 1);
    crystal.alpha = 0.75;
    crystal.roughness = 0.05;
    crystal.metallic = 0.1;
    crystal.emissiveColor = new Color3(0.15, 0.4, 0.6);
    for (let i = 0; i < 9; i++) {
      const h = i === 0 ? 38 : rnd(12, 28);
      const c = MeshBuilder.CreateCylinder(`crystal${i}`, { height: h, diameterTop: 0, diameterBottom: i === 0 ? 7 : rnd(2.5, 5), tessellation: 6 }, scene);
      const a = (i / 8) * Math.PI * 2;
      c.position.set(i === 0 ? 0 : Math.cos(a) * 7, h / 2 - 0.6, -92 + (i === 0 ? 0 : Math.sin(a) * 5));
      c.rotation.z = i === 0 ? 0 : Math.cos(a) * 0.18;
      c.rotation.x = i === 0 ? 0 : Math.sin(a) * 0.15;
      c.material = crystal;
      glow.addIncludedOnlyMesh(c);
      envMeshes.push(c);
    }
    // Original hero shield emblem floating over the tower
    const shield = MeshBuilder.CreatePlane("heroShield", { width: 9, height: 8 }, scene);
    shield.position.set(0, 30, -86);
    const sm = new StandardMaterial("heroShieldMat", scene);
    const st = tex(scene, "heroShieldTex", 256, 228, (c, w, h) => drawHeroShield(c, w, h));
    st.hasAlpha = true;
    sm.diffuseTexture = st;
    sm.emissiveTexture = st;
    sm.useAlphaFromDiffuseTexture = true;
    sm.disableLighting = true;
    sm.backFaceCulling = false;
    shield.material = sm;
    anim.push((t) => { shield.position.y = 30 + Math.sin(t) * 0.6; });
    // A hero streak flying across the sky now and then
    const streak = MeshBuilder.CreateCylinder("skyStreak", { height: 18, diameterTop: 0.1, diameterBottom: 1.2, tessellation: 12 }, scene);
    streak.rotation.z = Math.PI / 2;
    streak.material = glowMat(scene, "skyStreakMat", "#ef4444");
    glow.addIncludedOnlyMesh(streak);
    anim.push((t) => {
      const u = (t % 9) / 9;
      streak.position.set(-120 + u * 240, 40 + Math.sin(u * Math.PI) * 8, -140);
    });
  }

  return {
    sky, floor, envMeshes,
    update: (t, dt) => { for (const f of anim) f(t, dt); },
  };
}

/** Original shield emblem: red/yellow five-sided shield with a lightning-swoosh. */
export function drawHeroShield(c: CanvasRenderingContext2D, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const shape = (inset: number) => {
    c.beginPath();
    c.moveTo(w * 0.22 + inset, h * 0.05 + inset);
    c.lineTo(w * 0.78 - inset, h * 0.05 + inset);
    c.lineTo(w * 0.97 - inset, h * 0.32);
    c.lineTo(w * 0.5, h * 0.96 - inset * 1.4);
    c.lineTo(w * 0.03 + inset, h * 0.32);
    c.closePath();
  };
  shape(0); c.fillStyle = "#dc2626"; c.fill();
  shape(12); c.fillStyle = "#fbbf24"; c.fill();
  // Lightning swoosh (original shape)
  c.beginPath();
  c.moveTo(w * 0.62, h * 0.16);
  c.lineTo(w * 0.32, h * 0.5);
  c.lineTo(w * 0.5, h * 0.5);
  c.lineTo(w * 0.38, h * 0.84);
  c.lineTo(w * 0.7, h * 0.42);
  c.lineTo(w * 0.52, h * 0.42);
  c.closePath();
  c.fillStyle = "#dc2626";
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = "#1d4ed8";
  c.stroke();
}
