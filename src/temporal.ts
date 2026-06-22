import { Temporal as TemporalImpl } from "@js-temporal/polyfill";

// `@types/bun` declares a global `Temporal` namespace that Fedify's vocab types
// rely on, but this Bun runtime does not implement it yet. Install the polyfill
// as the global implementation so `Temporal.Instant` values work at runtime.
// Import this module for its side effect before constructing any vocab objects.
const globalWithTemporal = globalThis as { Temporal?: unknown };
globalWithTemporal.Temporal ??= TemporalImpl;
