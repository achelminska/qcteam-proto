import { describe, expect, it } from "vitest";
import { matchesText } from "./search.js";

describe("matchesText", () => {
  it("finds Dutch Bananen from banana / banan / a typo", () => {
    const name = "Chiquita Bananen 1 kilo";
    expect(matchesText(name, "banana")).toBe(true);
    expect(matchesText(name, "banan")).toBe(true);
    expect(matchesText(name, "bananna")).toBe(true);
    expect(matchesText(name, "Bananen")).toBe(true);
    expect(matchesText(name, "chiquita")).toBe(true);
  });
  it("does not match unrelated produce", () => {
    expect(matchesText("Merkloos komkommer (1 st)", "banana")).toBe(false);
    expect(matchesText("Merkloos avocado eetrijp", "banana")).toBe(false);
  });
  it("still matches article ids and exact fragments", () => {
    expect(matchesText("Chiquita Bananen 1 kilo 90006137", "90006137")).toBe(true);
    expect(matchesText("Chiquita Bananen 1 kilo", "")).toBe(true);
  });
});
