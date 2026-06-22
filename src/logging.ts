import { configure, getConsoleSink, type LogLevel } from "@logtape/logtape";

// Configure LogTape so Fedify's internal logs (and our own) have a sink.
// Import this module for its side effect before creating the federation.
let configured = false;

export async function setupLogging(): Promise<void> {
  if (configured) return;
  configured = true;
  const level = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [
      { category: ["tangent"], lowestLevel: level, sinks: ["console"] },
      { category: ["fedify"], lowestLevel: "warning", sinks: ["console"] },
      { category: ["logtape", "meta"], lowestLevel: "error", sinks: ["console"] },
    ],
  });
}
