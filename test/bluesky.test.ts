import { expect, test } from "bun:test";
import { splitIntoThread } from "../src/bluesky/client.ts";

const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
const glen = (s: string) => [...seg.segment(s)].length;

test("short note returns a single segment with the permalink appended", () => {
  expect(splitIntoThread("hello world", "https://theor.net/notes/1")).toEqual([
    "hello world\n\nhttps://theor.net/notes/1",
  ]);
});

test("no permalink leaves a short note as a single segment", () => {
  expect(splitIntoThread("hello", null)).toEqual(["hello"]);
});

test("a long note splits into multiple segments within the limit", () => {
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const out = splitIntoThread(words, null, { limit: 40 });
  expect(out.length).toBeGreaterThan(1);
  for (const s of out) expect(glen(s)).toBeLessThanOrEqual(40);
  // No word is broken across segments: rejoining yields the original words.
  expect(out.join(" ").split(/\s+/)).toEqual(words.split(" "));
});

test("prefers paragraph boundaries and packs whole paragraphs greedily", () => {
  const p1 = Array.from({ length: 10 }, () => "one").join(" "); // 39
  const p2 = Array.from({ length: 10 }, () => "two").join(" "); // 39
  const p3 = Array.from({ length: 10 }, () => "three").join(" "); // 59
  // limit fits p1+p2 (80) together but not p3; p3 goes to its own segment.
  const out = splitIntoThread([p1, p2, p3].join("\n\n"), null, { limit: 85 });
  expect(out).toEqual([`${p1}\n\n${p2}`, p3]);
});

test("the permalink rides on the last segment when it fits", () => {
  const words = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
  const out = splitIntoThread(words, "https://x/1", { limit: 40 });
  expect(out[out.length - 1]).toContain("https://x/1");
  for (const s of out) expect(glen(s)).toBeLessThanOrEqual(40);
});

test("the permalink becomes its own trailing post when it does not fit", () => {
  const body = "a".repeat(30) + " " + "b".repeat(30);
  const out = splitIntoThread(body, "https://x/longlonglink", { limit: 31 });
  expect(out[out.length - 1]).toBe("https://x/longlonglink");
  for (const s of out) expect(glen(s)).toBeLessThanOrEqual(31);
});

test("an oversized single token is hard-split, preserving content", () => {
  const url = "https://example.com/" + "a".repeat(80);
  const out = splitIntoThread(url, null, { limit: 30 });
  expect(out.length).toBeGreaterThan(1);
  for (const s of out) expect(glen(s)).toBeLessThanOrEqual(30);
  expect(out.join("")).toBe(url);
});

test("weighted (Twitter) counts every URL as 23", () => {
  const longUrl = "https://example.com/" + "x".repeat(100); // 120 literal, 23 weighted
  const body = `Check this out: ${longUrl} end`;
  // Weighted: 16 + 23 + 4 = 43 -> one tweet; literal: ~140 -> splits.
  expect(splitIntoThread(body, null, { limit: 50, weighted: true })).toHaveLength(1);
  expect(splitIntoThread(body, null, { limit: 50, weighted: false }).length).toBeGreaterThan(1);
});

test("splitting counts graphemes, not code points", () => {
  const family = "👨‍👩‍👧"; // a single grapheme made of multiple code points
  const out = splitIntoThread(family.repeat(5), null, { limit: 3 });
  for (const s of out) expect(glen(s)).toBeLessThanOrEqual(3);
  expect(out.join("")).toBe(family.repeat(5));
});
