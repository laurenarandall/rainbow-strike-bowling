// Looks for the frame scoreboard (frames 1-10) at the top of the game.
export type BoardStyleId = "world" | "rainbow" | "redglitter" | "blackglitter" | "blackgold" | "glass" | "neon" | "candy";

export interface BoardStyle { id: BoardStyleId; name: string; emoji: string }

export const BOARD_STYLES: BoardStyle[] = [
  { id: "world", name: "Match the World", emoji: "🌍" },
  { id: "rainbow", name: "Rainbow", emoji: "🌈" },
  { id: "redglitter", name: "Red Glitter", emoji: "❤️" },
  { id: "blackglitter", name: "Black Glitter", emoji: "🖤" },
  { id: "blackgold", name: "Black & Gold", emoji: "👑" },
  { id: "glass", name: "Glass", emoji: "🫧" },
  { id: "neon", name: "Neon Glow", emoji: "⚡" },
  { id: "candy", name: "Candy Stripes", emoji: "🍬" },
];

export const BOARD_ALPHAS: { value: number; name: string; emoji: string }[] = [
  { value: 1, name: "Solid", emoji: "🟪" },
  { value: 0.6, name: "See-through", emoji: "🔮" },
  { value: 0.28, name: "Ghost", emoji: "👻" },
];

const STYLE_KEY = "rainbow-strike-bowling-board";
const ALPHA_KEY = "rainbow-strike-bowling-board-alpha";

export function getBoardStyle(id: string | null | undefined): BoardStyle {
  return BOARD_STYLES.find((b) => b.id === id) ?? BOARD_STYLES[0]!;
}
export function loadBoardStyle(): BoardStyleId {
  try { return getBoardStyle(localStorage.getItem(STYLE_KEY)).id; } catch { return "world"; }
}
export function saveBoardStyle(id: BoardStyleId) {
  try { localStorage.setItem(STYLE_KEY, id); } catch { /* ignore */ }
}
export function loadBoardAlpha(): number {
  try {
    const v = Number(localStorage.getItem(ALPHA_KEY));
    return BOARD_ALPHAS.some((a) => a.value === v) ? v : 1;
  } catch { return 1; }
}
export function saveBoardAlpha(v: number) {
  try { localStorage.setItem(ALPHA_KEY, String(v)); } catch { /* ignore */ }
}
