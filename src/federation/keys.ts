import { exportJwk, generateCryptoKeyPair, importJwk } from "@fedify/fedify";
import type { Database } from "../db/client.ts";
import { keys } from "../db/schema.ts";

const KEY_ALGORITHMS = {
  rsa: "RSASSA-PKCS1-v1_5",
  ed25519: "Ed25519",
} as const;

// RSA first: it backs HTTP Signatures and is the key most peers expect in the
// actor's `publicKey`. Ed25519 follows for Object Integrity Proofs.
const KEY_ORDER = ["rsa", "ed25519"] as const;

/** Generate and persist any actor keypairs that do not yet exist. */
export async function ensureActorKeys(database: Database): Promise<void> {
  const existing = await database.db.select({ type: keys.type }).from(keys);
  const have = new Set(existing.map((row) => row.type));
  for (const type of KEY_ORDER) {
    if (have.has(type)) continue;
    const pair = await generateCryptoKeyPair(KEY_ALGORITHMS[type]);
    await database.db
      .insert(keys)
      .values({
        type,
        privateJwk: await exportJwk(pair.privateKey),
        publicJwk: await exportJwk(pair.publicKey),
      })
      .onConflictDoNothing();
  }
}

/** Load the actor keypairs in canonical order (RSA, then Ed25519). */
export async function loadActorKeyPairs(
  database: Database,
): Promise<CryptoKeyPair[]> {
  const rows = await database.db.select().from(keys);
  const order = KEY_ORDER as readonly string[];
  rows.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  const pairs: CryptoKeyPair[] = [];
  for (const row of rows) {
    pairs.push({
      privateKey: await importJwk(row.privateJwk, "private"),
      publicKey: await importJwk(row.publicJwk, "public"),
    });
  }
  return pairs;
}
