import { useState, useCallback, useEffect, useRef } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { Game } from "./components/Game";
import type { FrameStars } from "./components/Game";
import { CHARACTERS } from "./characters";
import type { Character } from "./characters";
import type { GamePhase } from "./types";

const BEST_SCORE_KEY = "rainbow-strike-bowling-best";
const RAINBOW_TEXT =
  "linear-gradient(90deg,#ff3b3b,#ff8c1a,#ffd60a,#3ddc4a,#1fb6ff,#4c5cff,#b14cff)";

function getBestScore(): number {
  try {
    const v = localStorage.getItem(BEST_SCORE_KEY);
    if (!v) return 0;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function trySetBestScore(value: number) {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // ignore
  }
}

function StarRow({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span style={{ fontSize: size, letterSpacing: -1, whiteSpace: "nowrap" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ opacity: i < n ? 1 : 0.2, filter: i < n ? "none" : "grayscale(1)" }}>
          ⭐
        </span>
      ))}
    </span>
  );
}

function StarBoard({ frames, current }: { frames: FrameStars[]; current: number }) {
  const total = frames.reduce((a, f) => a + (f.done || f.pins > 0 ? f.stars : 0), 0);
  return (
    <div
      data-testid="starboard"
      style={{
        position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)", zIndex: 20,
        display: "flex", gap: 4, alignItems: "stretch", padding: 6, borderRadius: 16,
        background: "rgba(255,255,255,0.85)", boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        pointerEvents: "none", maxWidth: "98vw",
      }}
    >
      {Array.from({ length: 10 }, (_, i) => {
        const f = frames[i];
        const active = i === current - 1;
        const shown = !!f && (f.done || f.pins > 0);
        return (
          <div
            key={i}
            style={{
              minWidth: 0, width: "clamp(26px,7vw,52px)", borderRadius: 10, padding: "2px 2px",
              textAlign: "center", fontFamily: "Manrope,sans-serif", fontWeight: 800, fontSize: 11,
              color: "#4c1d95", position: "relative",
              background: active ? "#fef08a" : "#f5f3ff",
              border: active ? "2px solid #f59e0b" : "2px solid #ddd6fe",
            }}
          >
            <div style={{ height: 16, fontSize: 14 }}>{shown && f.strike ? "👑" : i + 1}</div>
            <StarRow n={shown ? f.stars : 0} size={10} />
          </div>
        );
      })}
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "0 8px", borderRadius: 10, background: "#fde68a", fontFamily: "Fraunces,serif",
          fontWeight: 900, color: "#92400e", fontSize: 18, whiteSpace: "nowrap",
        }}
      >
        ⭐ {total}
      </div>
    </div>
  );
}

function StartScreen({ onPick }: { onPick: (c: Character) => void }) {
  return (
    <div
      data-testid="start-screen"
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-4"
      style={{ zIndex: 30, background: "linear-gradient(160deg,#a5f3fc,#fbcfe8 50%,#fef08a)" }}
    >
      <h1
        style={{
          fontFamily: "Fraunces,serif", fontWeight: 900, fontSize: "clamp(36px,8vw,72px)",
          lineHeight: 1, textAlign: "center", background: RAINBOW_TEXT,
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          filter: "drop-shadow(3px 3px 0 #fff)",
        }}
      >
        🏰 Rainbow Strike Bowling 🎳
      </h1>
      <p style={{ fontFamily: "Manrope,sans-serif", fontWeight: 800, fontSize: 24, color: "#6d28d9" }}>
        Who do you want to be?
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            data-testid={`pick-${c.id}`}
            onClick={() => onPick(c)}
            className="flex flex-col items-center gap-2 rounded-3xl px-6 py-4 transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "#fff", border: `6px solid ${c.ballColor}`, cursor: "pointer",
              boxShadow: `0 8px 0 ${c.ballColor}`, fontFamily: "Manrope,sans-serif",
            }}
          >
            <span style={{ fontSize: 64, lineHeight: 1 }}>{c.emoji}</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#1f2937" }}>{c.name}</span>
            <span
              style={{
                width: 34, height: 34, borderRadius: "50%", background: c.ballColor,
                boxShadow: `inset -4px -4px 0 rgba(0,0,0,0.2), 0 0 0 3px ${c.studColor}`,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [character, setCharacter] = useState<Character>(CHARACTERS[0]!);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(getBestScore);
  const [gameKey, setGameKey] = useState(0);
  const [frame, setFrame] = useState(1);
  const [frames, setFrames] = useState<FrameStars[]>([]);
  const scoreRef = useRef(0);

  const handleScore = useCallback((s: number) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleStats = useCallback((stats: { frame: number; frames?: FrameStars[] }) => {
    setFrame(stats.frame);
    if (stats.frames) setFrames(stats.frames);
  }, []);

  const handleGameOver = useCallback(() => {
    const final = scoreRef.current;
    const best = getBestScore();
    if (final > best) {
      trySetBestScore(final);
      setBestScore(final);
    }
    setPhase("over");
  }, []);

  const start = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setFrames([]);
    setFrame(1);
    setGameKey((k) => k + 1);
    setPhase("playing");
  }, []);

  const pick = useCallback(
    (c: Character) => {
      setCharacter(c);
      start();
    },
    [start],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase === "over" && (e.key === " " || e.key === "Enter")) start();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, start]);

  const totalStars = frames.reduce((a, f) => a + f.stars, 0);
  const crowns = frames.filter((f) => f.strike).length;

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Rainbow Strike Bowling"
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Best", value: bestScore },
            { label: "Frame", value: `${frame}/10` },
          ]}
          onRestart={() => setPhase("menu")}
          rules={
            <div>
              <h3 style={{ fontWeight: 700 }}>Rainbow Strike Bowling</h3>
              <ul>
                <li><b>Aim</b>: slide left/right (or arrow keys), then tap (or Space)</li>
                <li><b>Power</b>: tap when the bar is in the big green zone</li>
                <li><b>Swipe up</b> on the lane to throw in one go!</li>
                <li>Bumpers keep the ball out of the gutter</li>
                <li>Earn up to 3 ⭐ per frame and a 👑 for every strike</li>
              </ul>
              <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                Real bowling scoring is shown as Score. Based on the MIT-licensed{" "}
                <a href="https://github.com/freegamestore-online/bowling" style={{ color: "var(--accent)" }}>
                  freegamestore-online/bowling
                </a>.
              </p>
            </div>
          }
        />
      }
    >
      <div className="relative w-full h-full min-h-[400px]">
        {phase !== "menu" && (
          <Game key={gameKey} character={character} onScore={handleScore} onGameOver={handleGameOver} onStats={handleStats} />
        )}
        {phase === "playing" && <StarBoard frames={frames} current={frame} />}
        {phase === "menu" && <StartScreen onPick={pick} />}
        {phase === "over" && (
          <div
            data-testid="trophy-screen"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4"
            style={{ zIndex: 30, background: "linear-gradient(160deg,rgba(254,240,138,0.95),rgba(251,207,232,0.95))" }}
          >
            <div style={{ fontSize: 110, lineHeight: 1 }}>🏆</div>
            <p style={{ fontFamily: "Fraunces,serif", fontWeight: 900, fontSize: "clamp(28px,6vw,52px)", color: "#7c3aed", textAlign: "center" }}>
              You did it, {character.emoji} {character.name}!
            </p>
            <p style={{ fontFamily: "Manrope,sans-serif", fontWeight: 900, fontSize: 36, color: "#b45309" }}>
              ⭐ {totalStars} stars{crowns > 0 ? `  👑 ×${crowns}` : ""}
            </p>
            <p style={{ fontFamily: "Manrope,sans-serif", fontWeight: 700, fontSize: 18, color: "#374151" }}>
              Bowling score: {score}
            </p>
            <div className="flex gap-3">
              <button
                onClick={start}
                className="px-8 py-4 rounded-2xl font-black text-xl"
                style={{ background: "#22c55e", color: "#fff", boxShadow: "0 6px 0 #15803d" }}
              >
                Play Again!
              </button>
              <button
                onClick={() => setPhase("menu")}
                className="px-6 py-4 rounded-2xl font-black text-xl"
                style={{ background: "#8b5cf6", color: "#fff", boxShadow: "0 6px 0 #6d28d9" }}
              >
                New Hero
              </button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
