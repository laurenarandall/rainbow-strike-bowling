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
