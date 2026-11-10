import { describe, it, expect } from "vitest";
import { frameMarks, runningTotals } from "../scoreMarks";

describe("frameMarks", () => {
  it("marks strikes, spares, misses", () => {
    expect(frameMarks([10], false)).toEqual(["X"]);
    expect(frameMarks([7, 3], false)).toEqual(["7", "/"]);
    expect(frameMarks([0, 4], false)).toEqual(["-", "4"]);
    expect(frameMarks([5], false)).toEqual(["5"]);
    expect(frameMarks([], false)).toEqual([]);
  });
  it("handles the 10th frame", () => {
    expect(frameMarks([10, 10, 10], true)).toEqual(["X", "X", "X"]);
    expect(frameMarks([9, 1, 10], true)).toEqual(["9", "/", "X"]);
    expect(frameMarks([10, 7, 3], true)).toEqual(["X", "7", "/"]);
    expect(frameMarks([3, 4], true)).toEqual(["3", "4"]);
  });
});

describe("runningTotals", () => {
  it("waits for strike/spare bonuses", () => {
    const t = runningTotals([[10], [7, 3], [4]]);
    expect(t.slice(0, 3)).toEqual([20, 34, null]);
    expect(runningTotals([[10], [10]]).slice(0, 2)).toEqual([null, null]);
  });
  it("perfect game is 300", () => {
    const f = Array.from({ length: 9 }, () => [10]);
    f.push([10, 10, 10]);
    expect(runningTotals(f)[9]).toBe(300);
  });
  it("open frames add up", () => {
    expect(runningTotals([[3, 4], [5, 2]]).slice(0, 2)).toEqual([7, 14]);
  });
});
