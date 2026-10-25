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
