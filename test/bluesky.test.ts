import { expect, test } from "bun:test";
import { buildBlueskyText } from "../src/bluesky/client.ts";

test("short note keeps text and appends the permalink", () => {
  expect(buildBlueskyText("hello world", "https://theor.net/notes/1")).toBe(
    "hello world\n\nhttps://theor.net/notes/1",
  );
});

test("no permalink leaves the text untouched", () => {
  expect(buildBlueskyText("hello", null)).toBe("hello");
});

test("long note is truncated to fit the limit including the permalink", () => {
  const out = buildBlueskyText("a".repeat(400), "https://theor.net/notes/1");
  expect(Array.from(out).length).toBeLessThanOrEqual(300);
  expect(out.endsWith("https://theor.net/notes/1")).toBe(true);
  expect(out).toContain("…");
});
