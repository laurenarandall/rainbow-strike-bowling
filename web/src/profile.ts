// Single-player progress saved in localStorage: best score, history, awards.
export interface GameRecord {
  date: string;
  score: number;
  stars: number;
  strikes: number;
  hero: string;
}
export interface Profile {
  best: number;
  games: number;
  history: GameRecord[];
  awards: Record<string, string>; // award id -> ISO date earned
}
export interface Award {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

export const AWARDS: Award[] = [
  { id: "first-game", icon: "🎳", title: "First Game!", desc: "Finish your first game" },
  { id: "first-spare", icon: "✨", title: "Spare Maker", desc: "Get your first spare" },
  { id: "first-strike", icon: "⚡", title: "First Strike!", desc: "Knock down all 10 pins in one roll" },
  { id: "double", icon: "🔥", title: "Double!", desc: "2 strikes in a row" },
  { id: "turkey", icon: "🦃", title: "Turkey!", desc: "3 strikes in a row" },
  { id: "score-50", icon: "🥉", title: "50 Club", desc: "Score 50+ points" },
  { id: "score-100", icon: "🥈", title: "100 Club", desc: "Score 100+ points" },
  { id: "score-150", icon: "🥇", title: "150 Club", desc: "Score 150+ points" },
  { id: "score-200", icon: "👑", title: "Bowling Royalty", desc: "Score 200+ points" },
  { id: "stars-20", icon: "🌟", title: "Star Collector", desc: "Earn 20+ stars in one game" },
  { id: "no-gutter", icon: "🛡️", title: "Gutter Guard", desc: "A whole game without a gutter ball" },
  { id: "five-games", icon: "🏅", title: "Bowling Buddy", desc: "Play 5 games" },
];

const KEY = "rainbow-strike-bowling-profile";

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      return {
        best: typeof p.best === "number" ? p.best : 0,
        games: typeof p.games === "number" ? p.games : 0,
        history: Array.isArray(p.history) ? p.history : [],
        awards: p.awards && typeof p.awards === "object" ? p.awards : {},
      };
    }
  } catch {
    // ignore
  }
  return { best: 0, games: 0, history: [], awards: {} };
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore (private mode)
  }
}

export interface LiveStats {
  score: number;
  stars: number;
  throwsSeq: number[]; // pins per throw in order, first throws flagged via strikes
  strikesInRow: number;
  maxStrikesInRow: number;
  strikes: number;
  spares: number;
  gutters: number;
  finished: boolean;
}

/** Award ids earned by these stats (regardless of whether already owned). */
export function earnedAwards(s: LiveStats, gamesPlayed: number): string[] {
  const out: string[] = [];
  if (s.finished) out.push("first-game");
  if (s.spares > 0) out.push("first-spare");
  if (s.strikes > 0) out.push("first-strike");
  if (s.maxStrikesInRow >= 2) out.push("double");
  if (s.maxStrikesInRow >= 3) out.push("turkey");
  if (s.score >= 50) out.push("score-50");
  if (s.score >= 100) out.push("score-100");
  if (s.score >= 150) out.push("score-150");
  if (s.score >= 200) out.push("score-200");
  if (s.stars >= 20) out.push("stars-20");
  if (s.finished && s.gutters === 0) out.push("no-gutter");
  if (gamesPlayed >= 5) out.push("five-games");
  return out;
}
