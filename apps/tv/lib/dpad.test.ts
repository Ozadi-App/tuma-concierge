import test from "node:test";
import assert from "node:assert/strict";
import { pickNext } from "./dpad.js";

const rect = (left: number, top: number, width = 100, height = 100) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
const item = (name: string, r: DOMRect) => ({ el: { name } as unknown as HTMLElement, rect: r });
const name = (el: HTMLElement | null) => (el as unknown as { name: string } | null)?.name ?? null;

// A 2 x 2 grid of cards, like the launcher or a question's answers.
const grid = [item("a", rect(0, 0)), item("b", rect(300, 0)), item("c", rect(0, 300)), item("d", rect(300, 300))];
const from = rect(0, 0);

test("dpad: arrows move to the neighbour in that direction", () => {
  assert.equal(name(pickNext(from, grid.slice(1), "right")), "b");
  assert.equal(name(pickNext(from, grid.slice(1), "down")), "c");
  assert.equal(name(pickNext(rect(300, 300), grid.filter((g) => name(g.el) !== "d"), "left")), "c");
  assert.equal(name(pickNext(rect(300, 300), grid.filter((g) => name(g.el) !== "d"), "up")), "b");
});

test("dpad: nothing that way means no move, and things in line beat things that are merely close", () => {
  assert.equal(pickNext(from, grid.slice(1), "left"), null);
  assert.equal(pickNext(from, grid.slice(1), "up"), null);
  // Pressing right from the top-left: the card in the same row wins over a nearer one that is much lower.
  const candidates = [item("sameRow", rect(500, 0)), item("lowerCloser", rect(250, 280))];
  assert.equal(name(pickNext(from, candidates, "right")), "sameRow");
});
