// Pin style choices (balls live in characters.ts). Pure data so it can be unit tested and shown in the UI.

export type PinStyleId = "classic" | "rainbow" | "lego" | "gold" | "neon" | "mushroom";

export interface PinStyleDef {
  id: PinStyleId;
  name: string;
  emoji: string;
  blurb: string;
  preview: string;
}

export const PIN_STYLES: PinStyleDef[] = [
  { id: "classic", name: "Classic", emoji: "🎳", blurb: "Real white pins with red stripes",
    preview: "linear-gradient(180deg,#fff 0 22%,#e11 22% 27%,#fff 27% 31%,#e11 31% 36%,#fff 36%)" },
  { id: "rainbow", name: "Rainbow", emoji: "🌈", blurb: "Every color of the rainbow",
    preview: "linear-gradient(180deg,#ff3b3b,#ff8c1a,#ffd60a,#3ddc4a,#1fb6ff,#4c5cff,#b14cff)" },
  { id: "lego", name: "LEGO Bricks", emoji: "🧱", blurb: "Blocky brick pins",
    preview: "repeating-linear-gradient(180deg,#ffd60a 0 25%,#1fb6ff 25% 50%,#ff3b3b 50% 75%,#3ddc4a 75% 100%)" },
  { id: "gold", name: "Gold", emoji: "🏆", blurb: "Shiny golden trophies",
    preview: "linear-gradient(120deg,#fff6c2,#f5c542 30%,#b8860b 60%,#ffe680)" },
  { id: "neon", name: "Neon Glow", emoji: "✨", blurb: "Glow-in-the-dark",
    preview: "linear-gradient(180deg,#39ff14,#00e5ff 50%,#ff2bd6)" },
  { id: "mushroom", name: "Mushroom Friends", emoji: "🍄", blurb: "Spotted mushrooms, star pins and cute critters",
    preview: "radial-gradient(circle at 35% 20%,#fff 0 9%,transparent 10%),radial-gradient(circle at 65% 26%,#fff 0 8%,transparent 9%),linear-gradient(180deg,#e52521 0 36%,#fde9c9 36%)" },
];

/** Real bowling ball and pin masses (kg). */
export const LB = 0.4536;
export const PIN_MASS_KG = 1.59; // ~3.5 lb
export function ballMassKg(pounds: number): number {
  return pounds * LB;
}

const PIN_KEY = "rainbow-strike-bowling-pins";
export function loadPinStyleId(): PinStyleId {
  try {
    const v = localStorage.getItem(PIN_KEY);
    if (v && PIN_STYLES.some((p) => p.id === v)) return v as PinStyleId;
  } catch { /* ignore */ }
  return "classic";
}
export function savePinStyleId(id: PinStyleId) {
  try { localStorage.setItem(PIN_KEY, id); } catch { /* ignore */ }
}
