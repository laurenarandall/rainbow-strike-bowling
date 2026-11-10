// Bowling scoresheet helpers: the little marks in each frame box (X, /, -,
// numbers) and the running total under each frame once it can be known.

/** Marks for one frame's throws. Frame 10 can have up to three marks. */
export function frameMarks(throws: number[], tenth: boolean): string[] {
  const out: string[] = [];
  if (!tenth) {
    const [a, b] = throws;
    if (a === undefined) return out;
    if (a === 10) return ["X"];
    out.push(a === 0 ? "-" : String(a));
    if (b !== undefined) out.push(a + b >= 10 ? "/" : b === 0 ? "-" : String(b));
    return out;
  }
  // 10th frame: the rack resets after a strike or a spare.
  let standing = 10;
  for (let i = 0; i < throws.length; i++) {
    const t = throws[i]!;
    if (standing === 10 && t === 10) { out.push("X"); standing = 10; continue; }
    if (standing < 10 && t === standing) { out.push("/"); standing = 10; continue; }
    out.push(t === 0 ? "-" : String(t));
    standing = standing - t;
    if (standing <= 0) standing = 10;
  }
  return out;
}

/** Running total after each frame, or null while bonus balls are still to come. */
export function runningTotals(frames: number[][]): (number | null)[] {
  const all: number[] = [];
  const starts: number[] = [];
  for (const f of frames) { starts.push(all.length); all.push(...f); }
  const out: (number | null)[] = [];
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const f = frames[i];
    if (!f || f.length === 0) { out.push(null); continue; }
    const s = starts[i]!;
    let v: number | null;
    if (i < 9) {
      if (f[0] === 10) v = all[s + 1] !== undefined && all[s + 2] !== undefined ? 10 + all[s + 1]! + all[s + 2]! : null;
      else if (f.length < 2) v = null;
      else if (f[0]! + f[1]! >= 10) v = all[s + 2] !== undefined ? 10 + all[s + 2]! : null;
      else v = f[0]! + f[1]!;
    } else {
      const needThree = f[0] === 10 || (f[0] ?? 0) + (f[1] ?? 0) >= 10;
      v = f.length >= (needThree ? 3 : 2) ? f.reduce((a, b) => a + b, 0) : null;
    }
    if (v === null || out.some((x, j) => j < i && x === null)) { out.push(null); continue; }
    total += v;
    out.push(total);
  }
  return out;
}
