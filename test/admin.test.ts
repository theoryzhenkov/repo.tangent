import { describe, expect, test } from "bun:test";
import { adminPage } from "../src/http/admin.ts";

describe("adminPage", () => {
  test("renders admin polish affordances and valid inline JavaScript", () => {
    const html = adminPage("theor", "theor.net", "https://theor.net/notes");

    expect(html).toContain('data-public-note-base="https://theor.net/notes"');
    expect(html).toContain('id="notice"');
    expect(html).toContain('id="help"');
    expect(html).toContain("tangent:admin:draft:v1");
    expect(html).toContain("open Bluesky");

    const script = html.match(/<script type="module">([\s\S]*)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script)).not.toThrow();
  });
});
