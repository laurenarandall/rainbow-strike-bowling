import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf-8");

describe("Rainbow Strike Bowling setup", () => {
  it("uses the GitHub Pages base path", () => {
    expect(read("vite.config.ts")).toContain('base: "/rainbow-strike-bowling/"');
  });
  it("has no third-party analytics script", () => {
    expect(read("index.html")).not.toContain("analytics");
  });
  it("is titled Rainbow Strike Bowling", () => {
    expect(read("index.html")).toContain("Rainbow Strike Bowling");
  });
});

import { starsForFrame } from "../components/Game";

describe("star scoring", () => {
  it("gives 3 stars for a strike or spare", () => {
    expect(starsForFrame([10])).toBe(3);
    expect(starsForFrame([7, 3])).toBe(3);
  });
  it("gives 2 stars for 6-9 pins, 1 for 1-5, 0 for none", () => {
    expect(starsForFrame([5, 3])).toBe(2);
    expect(starsForFrame([2, 1])).toBe(1);
    expect(starsForFrame([0, 0])).toBe(0);
  });
});

import { earnedAwards } from "../profile";

describe("awards", () => {
  const base = { score: 0, stars: 0, throwsSeq: [], strikesInRow: 0, maxStrikesInRow: 0, strikes: 0, spares: 0, gutters: 0, finished: false };
  it("awards first strike and turkey", () => {
    const a = earnedAwards({ ...base, strikes: 3, maxStrikesInRow: 3 }, 0);
    expect(a).toContain("first-strike");
    expect(a).toContain("turkey");
  });
  it("awards 100 club only at 100+", () => {
    expect(earnedAwards({ ...base, score: 99 }, 0)).not.toContain("score-100");
    expect(earnedAwards({ ...base, score: 100, finished: true }, 1)).toContain("score-100");
  });
});
