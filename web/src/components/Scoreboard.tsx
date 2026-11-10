import type { CSSProperties } from "react";
import type { FrameStars } from "./Game";
import type { BoardStyleId } from "../boardStyles";
import type { ThemeDef } from "../themes";
import { frameMarks } from "../scoreMarks";
import "./scoreboard.css";

const RAINBOW10 = ["#ff3b3b", "#ff7a1a", "#ffc400", "#7ed321", "#22c55e", "#14b8a6", "#1fb6ff", "#4c5cff", "#8b5cf6", "#e040fb"];
const NEON10 = ["#ff2bd6", "#00e5ff", "#39ff14", "#ffe600", "#ff6b00", "#a855f7", "#00e5ff", "#ff2b6b", "#39ff14", "#ffe600"];

function frameColor(style: BoardStyleId, theme: ThemeDef, i: number): string {
  if (style === "rainbow") return RAINBOW10[i]!;
  if (style === "neon") return NEON10[i]!;
  return theme.lane[i % theme.lane.length]!;
}

export function Scoreboard({ frames, current, score, style, alpha, theme }: {
  frames: FrameStars[]; current: number; score: number; style: BoardStyleId; alpha: number; theme: ThemeDef;
}) {
  const stars = frames.reduce((a, f) => a + (f.done || f.pins > 0 ? f.stars : 0), 0);
  const sc = theme.castle.signColors;
  const vars = {
    "--bga": alpha,
    "--w1": sc[0] ?? "#fbbf24",
    "--w2": sc[1 % sc.length] ?? "#ef4444",
    "--w3": sc[2 % sc.length] ?? "#7c3aed",
  } as CSSProperties;
  return (
    <div data-testid="starboard" data-board-style={style} className={`sb sb-${style}`} style={vars}>
      {Array.from({ length: 10 }, (_, i) => {
        const f = frames[i];
        const active = i === current - 1;
        const throws = f?.throws ?? [];
        const marks = frameMarks(throws, i === 9);
        const shown = !!f && (f.done || throws.length > 0);
        return (
          <div
            key={i}
            data-testid={`frame-${i + 1}`}
            className={`sb-frame${active ? " sb-cur" : ""}${shown ? " sb-played" : ""}${f?.strike ? " sb-strike" : f?.spare ? " sb-spare" : ""}`}
            style={{ "--fc": frameColor(style, theme, i), "--i": i } as CSSProperties}
          >
            <div className="sb-num">{i + 1}</div>
            <div className="sb-marks">
              {marks.map((m, k) => (
                <span key={`${k}${m}`} className={`sb-mark${m === "X" ? " sb-x" : m === "/" ? " sb-slash" : ""}`}>{m}</span>
              ))}
            </div>
            <div className="sb-total">
              {f?.total != null ? <span key={f.total}>{f.total}</span> : <span className="sb-empty">&nbsp;</span>}
            </div>
            <div className="sb-stars" aria-label={`${shown ? f!.stars : 0} stars`}>
              {[0, 1, 2].map((k) => <i key={k} className={shown && k < f!.stars ? "on" : ""}>★</i>)}
            </div>
          </div>
        );
      })}
      <div className="sb-frame sb-sum">
        <div className="sb-num">SCORE</div>
        <div className="sb-sum-val"><span key={score}>{score}</span></div>
        <div className="sb-sum-stars">⭐{stars}</div>
      </div>
    </div>
  );
}
