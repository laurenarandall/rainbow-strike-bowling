// Self-contained theme configs. A theme restyles the sky/background, the
// castle around the pins, the lane colors, default ball + pins and the cheers.
// To add a theme: add an entry here (and, for brand-new props, a builder in
// components/backdrop.ts keyed by `props`). All art is original and built
// from simple shapes and colors.
import { PLAYER_NAME } from "./fx";
import type { PinStyleId } from "./gear";

export type ThemeId = "rainbow" | "candy" | "space" | "disco" | "lava" | "hero";
export type PropsKind = "hills" | "candy" | "space" | "disco" | "lava" | "city";
export type CastleStyle = "rainbow" | "fortress" | "crystal";
export type SfxFlavor = "classic" | "coin" | "hero";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  emoji: string;
  blurb: string;
  preview: string; // CSS background for the picker card
  sky: { stops: [number, string][]; stars: number; clouds: number; cloudColor: string; sun?: string };
  ground: { color: string; color2: string; pattern: "grass" | "candy" | "space" | "carpet" | "lava" | "city" };
  props: PropsKind;
  lane: string[]; // board stripe colors across the lane
  arrows: string;
  castle: { colors: string[]; stone: string; style: CastleStyle; sign: string; signColors: string[]; gate: string };
  light: { sun: string; sunIntensity: number; hemi: number; fogColor?: string };
  defaults: { ball: string; pins: PinStyleId };
  cheers: string[];
  strikeCheers: string[];
  sfx: SfxFlavor;
}

const N = PLAYER_NAME;
const RAINBOW = ["#ff3b3b", "#ff8c1a", "#ffd60a", "#3ddc4a", "#1fb6ff", "#4c5cff", "#b14cff"];

export const THEMES: ThemeDef[] = [
  {
    id: "rainbow", name: "Rainbow Sky", emoji: "🌈", blurb: "Sunset sky, hills, a rainbow and balloons",
    preview: "linear-gradient(180deg,#4b3bbf,#ff7eb3 45%,#ffc46b 62%,#5fd17a 63%)",
    sky: { stops: [[0, "#2b2a8f"], [0.28, "#6b4fd8"], [0.4, "#ff7eb3"], [0.47, "#ffb36b"], [0.5, "#ffe9a8"], [0.52, "#bdf0b0"], [1, "#3f9f55"]], stars: 160, clouds: 22, cloudColor: "#fff1f7", sun: "#fff3b0" },
    ground: { color: "#58c46a", color2: "#7fdc7a", pattern: "grass" },
    props: "hills",
    lane: RAINBOW,
    arrows: "#ffffff",
    castle: { colors: RAINBOW, stone: "#fdf4ff", style: "rainbow", sign: "RAINBOW STRIKE", signColors: RAINBOW, gate: "#ffd36b" },
    light: { sun: "#fff0dc", sunIntensity: 2.4, hemi: 0.4 },
    defaults: { ball: "rainbow", pins: "classic" },
    cheers: [`Rainbow roll, ${N}!`, "Over the rainbow!", "Balloon-tastic!"],
    strikeCheers: [`Rainbow STRIKE, ${N}!`, "Pot of gold strike!"],
    sfx: "classic",
  },
  {
    id: "candy", name: "Candy Land", emoji: "🍭", blurb: "Lollipops, gumdrops and cotton-candy clouds",
    preview: "linear-gradient(180deg,#ffb3e6,#ffe0f0 55%,#9ff0d0 56%)",
    sky: { stops: [[0, "#ff8fd8"], [0.35, "#ffc2ea"], [0.49, "#fff0f8"], [0.52, "#b8f5dc"], [1, "#ff9fcf"]], stars: 40, clouds: 26, cloudColor: "#ffd9f2" },
    ground: { color: "#ffc6e4", color2: "#b8f5dc", pattern: "candy" },
    props: "candy",
    lane: ["#ff8fc8", "#ffd1e8", "#a6f0d6", "#fff2a8", "#c9b6ff", "#ffb3a8", "#9fe3ff"],
    arrows: "#ffffff",
    castle: { colors: ["#ff7ac0", "#ffb3d9", "#ffe58a", "#9ff0c8", "#9fd8ff", "#c9a8ff", "#ff9f9f"], stone: "#fff5fb", style: "rainbow", sign: "SWEET STRIKE", signColors: ["#ff4fa8", "#ff9f40", "#7c3aed"], gate: "#ffe0f5" },
    light: { sun: "#fff2fa", sunIntensity: 2.3, hemi: 0.5 },
    defaults: { ball: "candy", pins: "rainbow" },
    cheers: ["Sweet roll!", `Sugar rush, ${N}!`, "Lolli-POP!", "Yummy shot!"],
    strikeCheers: ["SWEET STRIKE!", `Candy crush, ${N}!`],
    sfx: "classic",
  },
  {
    id: "space", name: "Outer Space", emoji: "🪐", blurb: "Planets, stars and a glowing moon base",
    preview: "radial-gradient(circle at 70% 30%,#c084fc 0 8%,transparent 9%),radial-gradient(circle at 25% 60%,#fff 0 1%,transparent 2%),linear-gradient(180deg,#05061a,#1e1b4b 60%,#3b0764)",
    sky: { stops: [[0, "#02030f"], [0.35, "#0b0d33"], [0.48, "#2a1561"], [0.5, "#4c1d95"], [0.52, "#1a1040"], [1, "#05061a"]], stars: 900, clouds: 0, cloudColor: "#ffffff" },
    ground: { color: "#1b1240", color2: "#3d2a80", pattern: "space" },
    props: "space",
    lane: ["#7c3aed", "#4c1d95", "#1d4ed8", "#0e7490", "#be185d", "#6d28d9", "#2563eb"],
    arrows: "#67e8f9",
    castle: { colors: ["#a78bfa", "#60a5fa", "#22d3ee", "#f472b6", "#c084fc", "#818cf8", "#38bdf8"], stone: "#cbd5e1", style: "crystal", sign: "COSMIC STRIKE", signColors: ["#67e8f9", "#c084fc", "#f472b6"], gate: "#67e8f9" },
    light: { sun: "#dfe7ff", sunIntensity: 1.8, hemi: 0.35 },
    defaults: { ball: "galaxy", pins: "neon" },
    cheers: ["Out of this world!", `Blast off, ${N}!`, "Cosmic roll!", "To the moon!"],
    strikeCheers: ["COSMIC STRIKE!", `${N} the Space Ace!`],
    sfx: "classic",
  },
  {
    id: "disco", name: "Neon Disco Alley", emoji: "🪩", blurb: "Glowing lanes, neon lights and a disco ball",
    preview: "radial-gradient(circle at 50% 20%,#e5e7eb 0 9%,transparent 10%),linear-gradient(90deg,#ff2bd6 0 3%,transparent 3% 97%,#00e5ff 97%),linear-gradient(180deg,#0b0420,#2a0a4a)",
    sky: { stops: [[0, "#070212"], [0.45, "#1a0833"], [0.5, "#2a0a4a"], [1, "#0b0420"]], stars: 260, clouds: 0, cloudColor: "#ffffff" },
    ground: { color: "#140a2e", color2: "#ff2bd6", pattern: "carpet" },
    props: "disco",
    lane: ["#ff2bd6", "#a855f7", "#00e5ff", "#39ff14", "#ffe600", "#ff6b00", "#ff2b6b"],
    arrows: "#ffffff",
    castle: { colors: ["#ff2bd6", "#a855f7", "#00e5ff", "#39ff14", "#ffe600", "#ff6b00", "#ff2b6b"], stone: "#1f1238", style: "rainbow", sign: "DISCO STRIKE", signColors: ["#ff2bd6", "#00e5ff", "#ffe600"], gate: "#ff2bd6" },
    light: { sun: "#e9d5ff", sunIntensity: 1.6, hemi: 0.3 },
    defaults: { ball: "midnight", pins: "neon" },
    cheers: ["Groovy!", `Dance it out, ${N}!`, "Disco roll!", "Funky fresh!"],
    strikeCheers: ["DISCO STRIKE!", `${N} owns the dance floor!`],
    sfx: "classic",
  },
  {
    id: "lava", name: "Bowser's Lava Castle", emoji: "🌋", blurb: "Spiky fortress, lava, coins, pipes and ? blocks",
    preview: "radial-gradient(circle at 30% 30%,#ffd60a 0 6%,transparent 7%),linear-gradient(180deg,#3b0a0a,#c2410c 45%,#f97316 58%,#4a2512 59%)",
    sky: { stops: [[0, "#1a0505"], [0.25, "#5c1010"], [0.4, "#b91c1c"], [0.47, "#f97316"], [0.5, "#fdba74"], [0.52, "#7c2d12"], [1, "#2a0d05"]], stars: 0, clouds: 14, cloudColor: "#4b2a2a" },
    ground: { color: "#3d2416", color2: "#ff6a00", pattern: "lava" },
    props: "lava",
    lane: ["#e52521", "#fbd000", "#43b047", "#049cd8", "#b5651d", "#e52521", "#fbd000"],
    arrows: "#ffffff",
    castle: { colors: ["#4b4b52", "#5d5d66", "#3f3f46", "#6b5b52", "#52525b", "#44403c", "#57534e"], stone: "#3a3a40", style: "fortress", sign: "LAVA STRIKE", signColors: ["#fbd000", "#ff6a00", "#e52521"], gate: "#ff6a00" },
    light: { sun: "#ffd2a8", sunIntensity: 2.0, hemi: 0.35 },
    defaults: { ball: "lava", pins: "mushroom" },
    cheers: ["Wahoo!", `Let's-a go, ${N}!`, "Here we gooo!", "Coin-tastic!", "Power up!", "Yahoo!"],
    strikeCheers: [`Super STRIKE, ${N}! Wahoo!`, "1-UP STRIKE!", "Castle cleared!"],
    sfx: "coin",
  },
  {
    id: "hero", name: "Super Hero City", emoji: "🦸", blurb: "City skyline at sunset and a crystal hero tower",
    preview: "linear-gradient(180deg,#1e3a8a,#dc2626 50%,#fbbf24 62%),linear-gradient(90deg,#0f172a,#0f172a)",
    sky: { stops: [[0, "#0b1d5c"], [0.3, "#1d4ed8"], [0.42, "#f43f5e"], [0.48, "#fb923c"], [0.5, "#fde68a"], [0.52, "#334155"], [1, "#0f172a"]], stars: 60, clouds: 12, cloudColor: "#ffd1b3", sun: "#fff1b8" },
    ground: { color: "#334155", color2: "#fbbf24", pattern: "city" },
    props: "city",
    lane: ["#dc2626", "#1d4ed8", "#fbbf24", "#dc2626", "#1d4ed8", "#fbbf24", "#dc2626"],
    arrows: "#fbbf24",
    castle: { colors: ["#dc2626", "#1d4ed8", "#fbbf24", "#2563eb", "#ef4444", "#facc15", "#1e40af"], stone: "#bfe9ff", style: "crystal", sign: "SUPER STRIKE", signColors: ["#fbbf24", "#ef4444", "#1d4ed8"], gate: "#7dd3fc" },
    light: { sun: "#ffe4c4", sunIntensity: 2.3, hemi: 0.4 },
    defaults: { ball: "superhero", pins: "classic" },
    cheers: [`Up, up and away, ${N}!`, "Super roll!", "Hero power!", "Faster than a speeding ball!", "To the rescue!"],
    strikeCheers: ["SUPER STRIKE!", `${N} saves the day!`, "Hero strike!"],
    sfx: "hero",
  },
];

export function getTheme(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

const THEME_KEY = "rainbow-strike-bowling-theme";
const LANE_KEY = "rainbow-strike-bowling-lane";
export type LaneMode = "theme" | "wood";
export function loadThemeId(): ThemeId {
  try { return getTheme(localStorage.getItem(THEME_KEY)).id; } catch { return "rainbow"; }
}
export function saveThemeId(id: ThemeId) {
  try { localStorage.setItem(THEME_KEY, id); } catch { /* ignore */ }
}
export function loadLaneMode(): LaneMode {
  try { return localStorage.getItem(LANE_KEY) === "wood" ? "wood" : "theme"; } catch { return "theme"; }
}
export function saveLaneMode(m: LaneMode) {
  try { localStorage.setItem(LANE_KEY, m); } catch { /* ignore */ }
}
