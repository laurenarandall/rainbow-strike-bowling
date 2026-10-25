export interface Character {
  id: "knight" | "dragon" | "princess" | "robot";
  name: string;
  emoji: string;
  ballColor: string;
  studColor: string;
  cheers: string[];
  strikeCheer: string;
}

export const CHARACTERS: Character[] = [
  {
    id: "knight",
    name: "Knight",
    emoji: "🛡️",
    ballColor: "#1fb6ff",
    studColor: "#c0c8d8",
    cheers: ["Brave roll, Sir Knight!", "For the castle!", "Huzzah!", "Mighty throw!"],
    strikeCheer: "The castle is yours, brave Knight!",
  },
  {
    id: "dragon",
    name: "Dragon",
    emoji: "🐉",
    ballColor: "#22c55e",
    studColor: "#ff8c1a",
    cheers: ["ROAR! Great job!", "Fiery roll!", "Dragon power!", "Stomp stomp!"],
    strikeCheer: "ROOOAR! Dragon strike!",
  },
  {
    id: "princess",
    name: "Princess",
    emoji: "👸",
    ballColor: "#ff4fb8",
    studColor: "#ffd60a",
    cheers: ["Royally done!", "Sparkly roll!", "Magnificent!", "Your Highness rocks!"],
    strikeCheer: "A royal strike, Princess!",
  },
  {
    id: "robot",
    name: "Robot",
    emoji: "🤖",
    ballColor: "#b14cff",
    studColor: "#00d1c1",
    cheers: ["Beep boop! Great job!", "Calculations: AWESOME!", "Robo-roll!", "Bleep! Nice!"],
    strikeCheer: "STRIKE.EXE! Beep beep hooray!",
  },
];

export interface BallSkin {
  id: string;
  name: string;
  ballColor: string;
  studColor: string;
  /** Optional per-stud colors (cycled) for patterned balls. */
  studColors?: string[];
  /** Extra glow (0-1). */
  glow?: number;
}

/** "hero" means: use the picked character's own ball. */
export const BALLS: BallSkin[] = [
  { id: "hero", name: "Hero Ball", ballColor: "#ffffff", studColor: "#ffffff" },
  { id: "rainbow", name: "Rainbow", ballColor: "#ffffff", studColor: "#ff3b3b", studColors: ["#ff3b3b", "#ff8c1a", "#ffd60a", "#3ddc4a", "#1fb6ff", "#4c5cff", "#b14cff"] },
  { id: "galaxy", name: "Galaxy", ballColor: "#1e1b4b", studColor: "#fde047", studColors: ["#fde047", "#ffffff", "#c084fc"], glow: 0.35 },
  { id: "lava", name: "Lava", ballColor: "#dc2626", studColor: "#fb923c", studColors: ["#fb923c", "#facc15", "#7f1d1d"], glow: 0.45 },
  { id: "ocean", name: "Ocean", ballColor: "#0369a1", studColor: "#67e8f9", studColors: ["#67e8f9", "#ffffff", "#22d3ee"] },
  { id: "watermelon", name: "Watermelon", ballColor: "#16a34a", studColor: "#ef4444", studColors: ["#ef4444", "#111827", "#ef4444"] },
  { id: "bubblegum", name: "Bubblegum", ballColor: "#f472b6", studColor: "#ffffff", studColors: ["#ffffff", "#fbcfe8"] },
  { id: "gold", name: "Gold Trophy", ballColor: "#eab308", studColor: "#fef08a", glow: 0.4 },
  { id: "ice", name: "Ice Crystal", ballColor: "#bae6fd", studColor: "#ffffff", studColors: ["#ffffff", "#7dd3fc"], glow: 0.3 },
  { id: "unicorn", name: "Unicorn", ballColor: "#e9d5ff", studColor: "#f9a8d4", studColors: ["#f9a8d4", "#a5f3fc", "#fde68a", "#c4b5fd"] },
  { id: "dino", name: "Dino Egg", ballColor: "#84cc16", studColor: "#365314", studColors: ["#365314", "#facc15"] },
  { id: "candy", name: "Candy", ballColor: "#ffffff", studColor: "#ef4444", studColors: ["#ef4444", "#22c55e", "#ef4444", "#ffffff"] },
  { id: "midnight", name: "Midnight", ballColor: "#0f172a", studColor: "#38bdf8", studColors: ["#38bdf8", "#a3e635", "#f472b6"], glow: 0.5 },
  { id: "sunny", name: "Sunshine", ballColor: "#facc15", studColor: "#f97316", studColors: ["#f97316", "#ffffff"] },
];
