#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractHashtags } from "../notes/render.ts";

const COMMENT_PREFIX = ";;";
const TEMPLATE = `\n${COMMENT_PREFIX} Write your note above. Lines starting with ${COMMENT_PREFIX} are ignored.\n${COMMENT_PREFIX} #hashtags become tags. Save and close the editor to continue.\n`;

interface Args {
  message: string | null;
  reply: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { message: null, reply: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === "-m" || arg === "--message") && i + 1 < argv.length) {
      args.message = argv[++i] ?? null;
    } else if (arg === "--reply" && i + 1 < argv.length) {
      args.reply = argv[++i] ?? null;
    } else if (arg === "-h" || arg === "--help") {
      console.log(
        "Usage: tangent compose [-m <text>] [--reply <note-uri>]\n\n" +
          "Environment:\n" +
          "  TANGENT_API_URL         e.g. https://ap.theor.net\n" +
          "  TANGENT_COMPOSE_TOKEN   bearer token for the compose endpoint\n" +
          "  EDITOR                  editor used to compose (default: vi)",
      );
      process.exit(0);
    }
  }
  return args;
}

async function composeInEditor(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "tangent-note-"));
  const file = join(dir, "NOTE.txt");
  writeFileSync(file, TEMPLATE);
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(editor, [file], { stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`editor exited with ${code}`)),
      );
    });
    return readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => !line.startsWith(COMMENT_PREFIX))
      .join("\n")
      .trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function previewBox(text: string, tags: string[], reply: string | null): void {
  const width = 64;
  const top = `\u250c${"\u2500".repeat(width)}\u2510`;
  const bottom = `\u2514${"\u2500".repeat(width)}\u2518`;
  const lines = text.split("\n").flatMap((line) => {
    const wrapped: string[] = [];
    let remaining = line;
    do {
      wrapped.push(remaining.slice(0, width - 2));
      remaining = remaining.slice(width - 2);
    } while (remaining.length > 0);
    return wrapped;
  });
  console.log(`\n${top}`);
  for (const line of lines) {
    console.log(`\u2502 ${line.padEnd(width - 2)} \u2502`);
  }
  console.log(bottom);
  console.log(`  ${text.length} chars` + (tags.length ? `  ·  tags: ${tags.map((t) => `#${t}`).join(" ")}` : ""));
  if (reply != null) console.log(`  reply to: ${reply}`);
}

async function main(): Promise<void> {
  const args = parseArgs(Bun.argv.slice(2));
  const apiBase = process.env.TANGENT_API_URL?.replace(/\/$/, "");
  const token = process.env.TANGENT_COMPOSE_TOKEN;
  if (!apiBase || !token) {
    console.error("Set TANGENT_API_URL and TANGENT_COMPOSE_TOKEN.");
    process.exit(1);
  }

  const text = (args.message ?? (await composeInEditor())).trim();
  if (text === "") {
    console.error("Empty note; aborting.");
    process.exit(1);
  }

  previewBox(text, extractHashtags(text), args.reply);
  if (!confirm("Post this note?")) {
    console.log("Aborted.");
    process.exit(0);
  }

  const response = await fetch(`${apiBase}/api/compose`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, inReplyTo: args.reply }),
  });

  if (!response.ok) {
    console.error(`Failed: ${response.status} ${await response.text()}`);
    process.exit(1);
  }

  const data = (await response.json()) as { uri: string };
  console.log(`\nPosted: ${data.uri}`);
}

await main();
