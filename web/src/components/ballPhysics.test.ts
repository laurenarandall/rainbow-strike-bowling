import { describe, it, expect } from "vitest";
import { applyContactFriction, releaseState, predictPath, laneFriction, BALL_R, OIL_END_Z, MU_OIL, MU_DRY } from "./ballPhysics";
import { BALLS, ballFeel } from "../characters";
import { PIN_STYLES, ballMassKg, PIN_MASS_KG } from "../gear";

describe("ball physics", () => {
  it("oil near the foul line, dry near the pins", () => {
    expect(laneFriction(0)).toBe(MU_OIL);
    expect(laneFriction(OIL_END_Z - 1)).toBe(MU_DRY);
  });
  it("skid turns into roll (no slip at the end)", () => {
    const { v, w } = releaseState(36, 0, 0, 1);
    let slip = 1;
    for (let i = 0; i < 2000; i++) slip = applyContactFriction(v, w, MU_DRY, 1 / 240);
    expect(slip).toBeLessThan(0.01);
    expect(Math.abs(v.z - w.x * BALL_R)).toBeLessThan(0.05);
    expect(v.z).toBeLessThan(-20); // keeps most of its speed
  });
  it("positive spin hooks to -X, negative to +X, none goes straight", () => {
    const end = (spin: number) => predictPath(0, 36, 0, spin, 1, 99).at(-1)!.x;
    expect(Math.abs(end(0))).toBeLessThan(1e-6);
    expect(end(1)).toBeLessThan(-0.5);
    expect(end(-1)).toBeGreaterThan(0.5);
  });
  it("bigger hook balls hook more", () => {
    const end = (hook: number) => predictPath(0, 36, 0, 1, hook, 99).at(-1)!.x;
    expect(end(1.6)).toBeLessThan(end(0.6));
  });
});

describe("gear", () => {
  it("every ball has a weight between 6 and 16 lb and a hook", () => {
    expect(BALLS.length).toBeGreaterThanOrEqual(6);
    for (const b of BALLS) {
      const f = ballFeel(b);
      expect(f.pounds).toBeGreaterThanOrEqual(6);
      expect(f.pounds).toBeLessThanOrEqual(16);
      expect(f.hook).toBeGreaterThan(0);
    }
  });
  it("a 16 lb ball is ~4.5x a pin", () => {
    expect(ballMassKg(16) / PIN_MASS_KG).toBeGreaterThan(4);
  });
  it("has 5 pin styles", () => {
    expect(PIN_STYLES.map((p) => p.id)).toEqual(["classic", "rainbow", "lego", "gold", "neon", "mushroom"]);
  });
});
