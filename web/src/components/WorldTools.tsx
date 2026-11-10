import type { CSSProperties } from "react";
import { THEMES } from "../themes";
import type { ThemeId, ThemeDef } from "../themes";
import { BOARD_STYLES, BOARD_ALPHAS } from "../boardStyles";
import type { BoardStyleId } from "../boardStyles";

export type ToolMenu = "world" | "board" | null;

const MINI_RAINBOW = ["#ff3b3b", "#ffc400", "#1fb6ff"];
const MINI_NEON = ["#ff2bd6", "#00e5ff", "#39ff14"];

function MiniBoard({ id, theme }: { id: BoardStyleId; theme: ThemeDef }) {
  const cols = id === "rainbow" ? MINI_RAINBOW : id === "neon" ? MINI_NEON : [theme.lane[0]!, theme.lane[3]!, theme.lane[5]!];
  const sc = theme.castle.signColors;
  return (
    <span className={`sb sb-${id} rsb-mini`} style={{ "--w1": sc[0], "--w2": sc[1 % sc.length], "--w3": sc[2 % sc.length] } as CSSProperties}>
      {["X", "7", "/"].map((m, i) => (
        <span key={i} className="sb-frame" style={{ "--fc": cols[i], "--i": i } as CSSProperties}>
          <span className={`sb-mark${m === "X" ? " sb-x" : m === "/" ? " sb-slash" : ""}`} style={{ fontSize: 10, animation: "none" }}>{m}</span>
        </span>
      ))}
    </span>
  );
}

export function WorldTools({ open, setOpen, theme, setTheme, board, setBoard, alpha, setAlpha, themeDef }: {
  open: ToolMenu; setOpen: (m: ToolMenu) => void;
  theme: ThemeId; setTheme: (t: ThemeId) => void; themeDef: ThemeDef;
  board: BoardStyleId; setBoard: (b: BoardStyleId) => void;
  alpha: number; setAlpha: (a: number) => void;
}) {
  return (
    <>
      {open && <div className="rsb-scrim" data-rsb-ui onPointerDown={() => setOpen(null)} />}
      <div className="rsb-tools" data-rsb-ui>
        <button
          data-testid="globe-button" aria-label="Change world" title="Change world"
          className={`rsb-tool globe${open === "world" ? " open" : ""}`}
          onClick={() => setOpen(open === "world" ? null : "world")}
        >🌍</button>
        <button
          data-testid="palette-button" aria-label="Scoreboard colors" title="Scoreboard colors"
          className={`rsb-tool palette${open === "board" ? " open" : ""}`}
          onClick={() => setOpen(open === "board" ? null : "board")}
        >🎨</button>
        {open === "world" && (
          <div className="rsb-menu" data-testid="world-menu" role="menu">
            <h3>🌍 Pick a world!</h3>
            {THEMES.map((t) => (
              <button
                key={t.id} role="menuitemradio" aria-checked={t.id === theme} data-testid={`world-${t.id}`}
                className={`rsb-row${t.id === theme ? " on" : ""}`}
                onClick={() => { setTheme(t.id); setOpen(null); }}
              >
                <span className="rsb-swatch" style={{ background: t.preview }}>{t.emoji}</span>
                <span>{t.name}</span>
                {t.id === theme && <span className="rsb-check">✅</span>}
              </button>
            ))}
            <p className="rsb-note">Your score stays! A new world brings its own ball and pins.</p>
          </div>
        )}
        {open === "board" && (
          <div className="rsb-menu" data-testid="board-menu" role="menu">
            <h3>🎨 Scoreboard style</h3>
            {BOARD_STYLES.map((b) => (
              <button
                key={b.id} role="menuitemradio" aria-checked={b.id === board} data-testid={`board-${b.id}`}
                className={`rsb-row${b.id === board ? " on" : ""}`}
                onClick={() => setBoard(b.id)}
              >
                <MiniBoard id={b.id} theme={themeDef} />
                <span>{b.emoji} {b.name}</span>
                {b.id === board && <span className="rsb-check">✅</span>}
              </button>
            ))}
            <h3 style={{ fontSize: 16, marginTop: 6 }}>See-through</h3>
            <div className="rsb-alpha">
              {BOARD_ALPHAS.map((a) => (
                <button key={a.value} data-testid={`alpha-${a.value}`} className={a.value === alpha ? "on" : ""} onClick={() => setAlpha(a.value)}>
                  {a.emoji} {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
