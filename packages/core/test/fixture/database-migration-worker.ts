import { EffectDrizzleSqlite } from "@opencode-ai/effect-drizzle-sqlite"
import { DatabaseMigration } from "@opencode-ai/core/database/migration"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { Effect } from "effect"
import fs from "fs/promises"
import path from "path"

const parsed: unknown = JSON.parse(process.argv[2])
if (
  !parsed ||
  typeof parsed !== "object" ||
  !("filename" in parsed) ||
  typeof parsed.filename !== "string" ||
  !("worker" in parsed) ||
  typeof parsed.worker !== "string" ||
  !("barrier" in parsed) ||
  typeof parsed.barrier !== "string"
) {
  throw new Error("invalid migration worker input")
}
const input = { filename: parsed.filename, worker: parsed.worker, barrier: parsed.barrier }

const database = EffectDrizzleSqlite.makeWithDefaults()

await Effect.runPromise(
  Effect.gen(function* () {
    const db = yield* database
    yield* db.run("PRAGMA busy_timeout = 5000")
    yield* DatabaseMigration.applyOnly(db, [
      {
        id: "cross-process-migration",
        up: (tx) =>
          Effect.gen(function* () {
            yield* Effect.promise(() => fs.writeFile(path.join(input.barrier, input.worker), "ready"))
            const deadline = Date.now() + 1_000
            while ((yield* Effect.promise(() => fs.readdir(input.barrier))).length < 2 && Date.now() < deadline) {
              yield* Effect.sleep("10 millis")
            }
            yield* tx.run("CREATE TABLE cross_process_migration (id TEXT PRIMARY KEY)")
          }),
      },
    ])
  }).pipe(Effect.provide(SqliteClient.layer({ filename: input.filename })), Effect.scoped),
)
