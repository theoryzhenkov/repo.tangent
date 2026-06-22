import { afterAll, expect, test } from "bun:test";
import { createDatabase } from "../src/db/client.ts";
import {
  addFollower,
  countFollowers,
  listFollowers,
  removeFollower,
} from "../src/store/followers.ts";

const database = createDatabase(process.env.DATABASE_URL ?? "");

const alice = {
  uri: "https://remote.example/users/alice",
  handle: "alice",
  name: "Alice",
  inboxUrl: "https://remote.example/users/alice/inbox",
  sharedInboxUrl: "https://remote.example/inbox",
};

test("add, list, dedupe, and remove a follower", async () => {
  await addFollower(database, alice);

  const list = await listFollowers(database);
  expect(list).toHaveLength(1);
  expect(list[0]?.inboxUrl).toBe(alice.inboxUrl);
  expect(list[0]?.sharedInboxUrl).toBe(alice.sharedInboxUrl);
  expect(await countFollowers(database)).toBe(1);

  // Re-following is idempotent.
  await addFollower(database, { ...alice, name: "Alice Updated" });
  expect(await countFollowers(database)).toBe(1);

  await removeFollower(database, alice.uri);
  expect(await countFollowers(database)).toBe(0);
});

afterAll(async () => {
  await database.sql.end();
});
