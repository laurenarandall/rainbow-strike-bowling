import { useState, useCallback, useEffect, useRef } from "react";
import { GameShell, GameTopbar, useSound } from "@freegamestore/games";
import { SoundFX } from "./sound";
import { AWARDS, loadProfile, saveProfile, earnedAwards } from "./profile";
import type { Profile, LiveStats } from "./profile";
import { badgeToast, fireworks, PLAYER_NAME } from "./fx";
import { Game } from "./components/Game";
import type { FrameStars } from "./components/Game";
import { CHARACTERS, BALLS } from "./characters";
import type { Character, BallSkin } from "./characters";
import type { GamePhase } from "./types";

const BEST_SCORE_KEY = "rainbow-strike-bowling-best";
const BUMPERS_KEY = "rainbow-strike-bowling-bumpers";
const BALL_KEY = "rainbow-strike-bowling-ball";

// Keeps an app-level SoundFX in sync with the topbar mute button.
function SoundSync({ sfx }: { sfx: SoundFX }) {
  const { muted } = useSound();
  useEffect(() => {
    sfx.setMuted(muted);
  }, [muted, sfx]);
  return null;
}

function TrophyRoom({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  return (
    <div
      data-testid="trophy-room"
      className="absolute inset-0 flex flex-col items-center gap-3 p-4 overflow-y-auto"
      style={{ touchAction: "pan-y", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", zIndex: 35, background: "linear-gradient(160deg,#fef9c3,#e9d5ff)", fontFamily: "Fredoka,Manrope,sans-serif" }}
    >
      <h2 style={{ fontFamily: "'Luckiest Guy',Fraunces,serif", fontSize: 40, color: "#7c3aed", marginTop: 8 }}>
        🏆 {PLAYER_NAME}'s Trophy Room
      </h2>
      <div className="flex gap-4 flex-wrap justify-center" style={{ fontWeight: 800, fontSize: 20, color: "#92400e" }}>
        <span>🥇 Best score: {profile.best}</span>
        <span>🎳 Games played: {profile.games}</span>
        <span>🏅 Awards: {Object.keys(profile.awards).length}/{AWARDS.length}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ maxWidth: 900 }}>
        {AWARDS.map((a) => {
          const got = !!profile.awards[a.id];
          return (
            <div
              key={a.id}
              style={{
                background: got ? "#fff" : "rgba(255,255,255,0.45)", borderRadius: 18, padding: 10,
                textAlign: "center", border: got ? "4px solid #fbbf24" : "4px dashed #c4b5fd",
                opacity: got ? 1 : 0.6,
              }}
            >
              <div style={{ fontSize: 40, filter: got ? "none" : "grayscale(1)" }}>{got ? a.icon : "🔒"}</div>
              <div style={{ fontWeight: 800, color: "#4c1d95" }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{a.desc}</div>
            </div>
          );
        })}
      </div>
      {profile.history.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 12, minWidth: 300 }}>
          <div style={{ fontWeight: 800, color: "#7c3aed", marginBottom: 4 }}>Recent games</div>
          {profile.history.slice(0, 8).map((g, i) => (
            <div key={i} className="flex justify-between gap-4" style={{ fontSize: 14, color: "#374151" }}>
              <span>{new Date(g.date).toLocaleDateString()} {g.hero}</span>
              <span>⭐ {g.stars} · {g.score} pts{g.strikes ? ` · 👑${g.strikes}` : ""}</span>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onClose}
        className="px-8 py-3 rounded-2xl font-black text-xl"
        style={{ background: "#22c55e", color: "#fff", boxShadow: "0 6px 0 #15803d", marginBottom: 12 }}
      >
        Back
      </button>
    </div>
  );
}
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

function StartScreen({
  onPick, bumpers, setBumpers, onTrophies, best, ball, setBall,
}: {
  onPick: (c: Character) => void; bumpers: boolean; setBumpers: (b: boolean) => void; onTrophies: () => void; best: number;
  ball: BallSkin; setBall: (b: BallSkin) => void;
}) {
  return (
    <div
      data-testid="start-screen"
      className="absolute inset-0 flex flex-col items-center gap-6 p-4 overflow-y-auto"
      style={{ zIndex: 30, background: "linear-gradient(160deg,#a5f3fc,#fbcfe8 50%,#fef08a)", justifyContent: "safe center", touchAction: "pan-y", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
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
        Who do you want to be, {PLAYER_NAME}?
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
      <div className="flex flex-col items-center gap-2" style={{ fontFamily: "Manrope,sans-serif", maxWidth: 760 }}>
        <p style={{ fontWeight: 900, fontSize: 20, color: "#6d28d9", margin: 0 }}>Pick your ball: {ball.name}</p>
        <div className="flex gap-2 flex-wrap justify-center">
          {BALLS.map((b) => {
            const studs = b.studColors ?? [b.studColor];
            const bg = b.id === "hero"
              ? "conic-gradient(#1fb6ff 0 25%,#22c55e 0 50%,#ff4fb8 0 75%,#b14cff 0)"
              : `radial-gradient(circle at 30% 30%, ${studs[0]} 0 14%, transparent 15%), radial-gradient(circle at 68% 55%, ${studs[1 % studs.length]} 0 13%, transparent 14%), radial-gradient(circle at 38% 74%, ${studs[2 % studs.length]} 0 12%, transparent 13%), ${b.ballColor}`;
            const on = b.id === ball.id;
            return (
              <button
                key={b.id}
                data-testid={`ball-${b.id}`}
                onClick={() => setBall(b)}
                title={b.name}
                aria-label={`${b.name} ball`}
                aria-pressed={on}
                style={{
                  width: 52, height: 52, borderRadius: "50%", background: bg, cursor: "pointer",
                  border: on ? "4px solid #7c3aed" : "4px solid #fff",
                  boxShadow: on ? "0 0 0 4px #fde047, inset -6px -6px 0 rgba(0,0,0,0.18)" : "inset -6px -6px 0 rgba(0,0,0,0.18), 0 4px 0 rgba(0,0,0,0.12)",
                  transform: on ? "scale(1.12)" : "none", transition: "transform .15s",
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 flex-wrap justify-center" style={{ fontFamily: "Manrope,sans-serif", paddingBottom: 8 }}>
        <button
          data-testid="bumpers-toggle"
          onClick={() => setBumpers(!bumpers)}
          className="px-5 py-3 rounded-2xl font-black text-lg"
          style={{ background: bumpers ? "#22c55e" : "#fff", color: bumpers ? "#fff" : "#6d28d9", border: "4px solid #22c55e" }}
        >
          {bumpers ? "🛡️ Bumpers: ON" : "🎯 Bumpers: OFF"}
        </button>
        <button
          data-testid="trophies-button"
          onClick={onTrophies}
          className="px-5 py-3 rounded-2xl font-black text-lg"
          style={{ background: "#fbbf24", color: "#7c2d12", border: "4px solid #f59e0b" }}
        >
          🏆 Trophies (best {best})
        </button>
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
  const [profile, setProfile] = useState<Profile>(() => {
    const p = loadProfile();
    p.best = Math.max(p.best, getBestScore());
    return p;
  });
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [bumpers, setBumpersState] = useState<boolean>(() => {
    try { return localStorage.getItem(BUMPERS_KEY) === "1"; } catch { return false; }
  });
  const setBumpers = useCallback((b: boolean) => {
    setBumpersState(b);
    try { localStorage.setItem(BUMPERS_KEY, b ? "1" : "0"); } catch { /* ignore */ }
  }, []);
  const [ball, setBallState] = useState<BallSkin>(() => {
    try { return BALLS.find((b) => b.id === localStorage.getItem(BALL_KEY)) ?? BALLS[0]!; } catch { return BALLS[0]!; }
  });
  const setBall = useCallback((b: BallSkin) => {
    setBallState(b);
    try { localStorage.setItem(BALL_KEY, b.id); } catch { /* ignore */ }
  }, []);
  const [showTrophies, setShowTrophies] = useState(false);
  const [newAwards, setNewAwards] = useState<string[]>([]);
  const fxRef = useRef<HTMLDivElement>(null);
  const [appSfx] = useState(() => new SoundFX());
  const live = useRef<LiveStats>({ score: 0, stars: 0, throwsSeq: [], strikesInRow: 0, maxStrikesInRow: 0, strikes: 0, spares: 0, gutters: 0, finished: false });
  const gameAwards = useRef<string[]>([]);

  const grantAwards = useCallback((final: boolean) => {
    const p = { ...profileRef.current, awards: { ...profileRef.current.awards } };
    const ids = earnedAwards(live.current, p.games + (final ? 1 : 0));
    let delay = 0;
    let changed = false;
    for (const id of ids) {
      if (p.awards[id]) continue;
      p.awards[id] = new Date().toISOString();
      changed = true;
      gameAwards.current.push(id);
      const a = AWARDS.find((x) => x.id === id);
      if (a && fxRef.current) {
        badgeToast(fxRef.current, a.icon, a.title, delay);
        setTimeout(() => appSfx.award(), delay + 100);
        delay += 1400;
      }
    }
    if (changed) {
      profileRef.current = p;
      setProfile(p);
      saveProfile(p);
    }
  }, [appSfx]);

  const handleThrow = useCallback((t: { pins: number; strike: boolean; spare: boolean; gutter: boolean }) => {
    const l = live.current;
    l.throwsSeq.push(t.pins);
    if (t.strike) { l.strikes++; l.strikesInRow++; l.maxStrikesInRow = Math.max(l.maxStrikesInRow, l.strikesInRow); }
    else l.strikesInRow = 0;
    if (t.spare) l.spares++;
    if (t.gutter) l.gutters++;
    l.score = scoreRef.current;
    // Defer so the latest score/stars have been reported.
    setTimeout(() => grantAwards(false), 50);
  }, [grantAwards]);

  const handleScore = useCallback((s: number) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleStats = useCallback((stats: { frame: number; frames?: FrameStars[] }) => {
    setFrame(stats.frame);
    if (stats.frames) {
      setFrames(stats.frames);
      live.current.stars = stats.frames.reduce((a, f) => a + f.stars, 0);
    }
  }, []);

  const handleGameOver = useCallback(() => {
    const final = scoreRef.current;
    const best = Math.max(getBestScore(), profileRef.current.best);
    const isBest = final > best;
    if (isBest) {
      trySetBestScore(final);
      setBestScore(final);
    }
    live.current.finished = true;
    live.current.score = final;
    grantAwards(true);
    const p: Profile = {
      ...profileRef.current,
      best: Math.max(profileRef.current.best, final),
      games: profileRef.current.games + 1,
      history: [
        { date: new Date().toISOString(), score: final, stars: live.current.stars, strikes: live.current.strikes, hero: characterRef.current.emoji },
        ...profileRef.current.history,
      ].slice(0, 50),
    };
    profileRef.current = p;
    setProfile(p);
    saveProfile(p);
    setNewAwards([...gameAwards.current]);
    setPhase("over");
    if (fxRef.current && (isBest || final >= 100 || live.current.strikes >= 2)) fireworks(fxRef.current, 14, 3500);
  }, [grantAwards]);

  const characterRef = useRef(character);
  characterRef.current = character;

  const start = useCallback(() => {
    live.current = { score: 0, stars: 0, throwsSeq: [], strikesInRow: 0, maxStrikesInRow: 0, strikes: 0, spares: 0, gutters: 0, finished: false };
    gameAwards.current = [];
    setNewAwards([]);
    setShowTrophies(false);
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
            { label: "Best", value: Math.max(bestScore, profile.best) },
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
                <li>Bumpers are off by default: turn them on from the start screen to block gutters</li><li>The ball hooks a little to the left down the lane and drifts more if the power is off the green</li>
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
          <Game key={gameKey} character={character} ballSkin={ball} bumpers={bumpers} onThrow={handleThrow} onScore={handleScore} onGameOver={handleGameOver} onStats={handleStats} />
        )}
        {phase === "playing" && <StarBoard frames={frames} current={frame} />}
        <SoundSync sfx={appSfx} />
        {phase === "menu" && (
          <StartScreen onPick={pick} bumpers={bumpers} setBumpers={setBumpers} onTrophies={() => setShowTrophies(true)} best={profile.best} ball={ball} setBall={setBall} />
        )}
        {showTrophies && <TrophyRoom profile={profile} onClose={() => setShowTrophies(false)} />}
        {phase === "over" && (
          <div
            data-testid="trophy-screen"
            className="absolute inset-0 flex flex-col items-center gap-4 p-4 overflow-y-auto"
            style={{ zIndex: 30, background: "linear-gradient(160deg,rgba(254,240,138,0.95),rgba(251,207,232,0.95))", justifyContent: "safe center", touchAction: "pan-y", overscrollBehavior: "contain" }}
          >
            <div style={{ fontSize: 110, lineHeight: 1 }}>🏆</div>
            <p style={{ fontFamily: "Fraunces,serif", fontWeight: 900, fontSize: "clamp(28px,6vw,52px)", color: "#7c3aed", textAlign: "center" }}>
              You did it, {PLAYER_NAME} the {character.emoji} {character.name}!
            </p>
            <p style={{ fontFamily: "Manrope,sans-serif", fontWeight: 900, fontSize: 36, color: "#b45309" }}>
              ⭐ {totalStars} stars{crowns > 0 ? `  👑 ×${crowns}` : ""}
            </p>
            <p style={{ fontFamily: "Manrope,sans-serif", fontWeight: 700, fontSize: 18, color: "#374151" }}>
              Bowling score: {score} {score >= profile.best && score > 0 ? "🎉 NEW BEST!" : `(best ${profile.best})`}
            </p>
            {newAwards.length > 0 && (
              <div className="flex gap-2 flex-wrap justify-center">
                {newAwards.map((id) => {
                  const a = AWARDS.find((x) => x.id === id);
                  return a ? (
                    <span key={id} style={{ background: "#fff", borderRadius: 14, padding: "6px 12px", border: "3px solid #fbbf24", fontWeight: 800, color: "#6d28d9" }}>
                      {a.icon} {a.title}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={start}
                className="px-8 py-4 rounded-2xl font-black text-xl"
                style={{ background: "#22c55e", color: "#fff", boxShadow: "0 6px 0 #15803d" }}
              >
                Play Again!
              </button>
              <button
                onClick={() => setShowTrophies(true)}
                className="px-6 py-4 rounded-2xl font-black text-xl"
                style={{ background: "#fbbf24", color: "#7c2d12", boxShadow: "0 6px 0 #b45309" }}
              >
                🏆 Trophies
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
        <div ref={fxRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 45, overflow: "hidden" }} />
      </div>
    </GameShell>
  );
}
