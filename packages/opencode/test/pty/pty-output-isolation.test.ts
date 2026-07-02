import { describe, expect, test } from "bun:test"
import { AppRuntime } from "../../src/effect/app-runtime"
import { Effect } from "effect"
import { Instance } from "../../src/project/instance"
import { WithInstance } from "../../src/project/with-instance"
import { Pty } from "../../src/pty"
import { tmpdir } from "../fixture/fixture"
import { setTimeout as sleep } from "node:timers/promises"
import { SessionID } from "../../src/session/schema"

describe("pty", () => {
  test("forces internal session env after caller env", async () => {
    await using dir = await tmpdir({ git: true })

    await WithInstance.provide({
      directory: dir.path,
      fn: () =>
        AppRuntime.runPromise(
          Effect.gen(function* () {
            const pty = yield* Pty.Service
            const sessionID = SessionID.make("ses_pty_current")
            const script = "console.log(process.env.TN_CLAW_SESSION_ID || ''); setTimeout(() => {}, 200)"
            const active = yield* pty.create({
              command: process.execPath,
              args: ["-e", script],
              title: "session env",
              env: { TN_CLAW_SESSION_ID: "ses_input_stale" },
              sessionID,
            })
            try {
              const out: string[] = []
              const ws = {
                readyState: 1,
                data: { events: { connection: "session-env" } },
                send: (data: unknown) => {
                  out.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
                },
                close: () => {
                  // no-op
                },
              }

              yield* pty.connect(active.id, ws as any)
              yield* Effect.promise(() => sleep(150))

              expect(out.join("")).toContain(sessionID)
              expect(out.join("")).not.toContain("ses_input_stale")
            } finally {
              yield* pty.remove(active.id)
            }
          }),
        ),
    })
  })

  test("removes loopback credentials from sessionless shared PTY env", async () => {
    await using dir = await tmpdir({ git: true })
    const originalShared = process.env.TN_CLAW_OPENCODE_SHARED_SERVER
    process.env.TN_CLAW_OPENCODE_SHARED_SERVER = "1"

    try {
      await WithInstance.provide({
        directory: dir.path,
        fn: () =>
          AppRuntime.runPromise(
            Effect.gen(function* () {
              const pty = yield* Pty.Service
              const script = [
                "console.log(process.env.TN_CLAW_LOOPBACK_TOKEN || 'NO_LOOPBACK_TOKEN')",
                "console.log(process.env.TN_CLAW_SESSION_ID || 'NO_SESSION_ID')",
                "console.log(process.env.TN_CLAW_INSTANCE_ID || 'NO_INSTANCE_ID')",
                "console.log(process.env.TN_CLAW_OPENCODE_SHARED_SERVER || 'NO_SHARED_MARKER')",
                "setTimeout(() => {}, 200)",
              ].join(";")
              const active = yield* pty.create({
                command: process.execPath,
                args: ["-e", script],
                title: "sessionless shared env",
                env: {
                  TN_CLAW_OPENCODE_SHARED_SERVER: "0",
                  TN_CLAW_LOOPBACK_TOKEN: "loopback-token",
                  TN_CLAW_SESSION_ID: "ses_stale",
                  TN_CLAW_INSTANCE_ID: "inst-stale",
                },
              })
              try {
                const out: string[] = []
                const ws = {
                  readyState: 1,
                  data: { events: { connection: "sessionless-shared-env" } },
                  send: (data: unknown) => {
                    out.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
                  },
                  close: () => {
                    // no-op
                  },
                }

                yield* pty.connect(active.id, ws as any)
                yield* Effect.promise(() => sleep(150))

                const output = out.join("")
                expect(output).toContain("NO_LOOPBACK_TOKEN")
                expect(output).toContain("NO_SESSION_ID")
                expect(output).toContain("NO_INSTANCE_ID")
                expect(output).toContain("1")
                expect(output).not.toContain("loopback-token")
                expect(output).not.toContain("ses_stale")
                expect(output).not.toContain("inst-stale")
              } finally {
                yield* pty.remove(active.id)
              }
            }),
          ),
      })
    } finally {
      if (originalShared === undefined) delete process.env.TN_CLAW_OPENCODE_SHARED_SERVER
      else process.env.TN_CLAW_OPENCODE_SHARED_SERVER = originalShared
    }
  })

  test("does not leak output when websocket objects are reused", async () => {
    await using dir = await tmpdir({ git: true })

    await WithInstance.provide({
      directory: dir.path,
      fn: () =>
        AppRuntime.runPromise(
          Effect.gen(function* () {
            const pty = yield* Pty.Service
            const a = yield* pty.create({ command: "cat", title: "a" })
            const b = yield* pty.create({ command: "cat", title: "b" })
            try {
              const outA: string[] = []
              const outB: string[] = []

              const ws = {
                readyState: 1,
                data: { events: { connection: "a" } },
                send: (data: unknown) => {
                  outA.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
                },
                close: () => {
                  // no-op (simulate abrupt drop)
                },
              }

              yield* pty.connect(a.id, ws as any)

              ws.data = { events: { connection: "b" } }
              ws.send = (data: unknown) => {
                outB.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
              }
              yield* pty.connect(b.id, ws as any)

              outA.length = 0
              outB.length = 0

              yield* pty.write(a.id, "AAA\n")
              yield* Effect.promise(() => sleep(100))

              expect(outB.join("")).not.toContain("AAA")
            } finally {
              yield* pty.remove(a.id)
              yield* pty.remove(b.id)
            }
          }),
        ),
    })
  })

  test("does not leak output when Bun recycles websocket objects before re-connect", async () => {
    await using dir = await tmpdir({ git: true })

    await WithInstance.provide({
      directory: dir.path,
      fn: () =>
        AppRuntime.runPromise(
          Effect.gen(function* () {
            const pty = yield* Pty.Service
            const a = yield* pty.create({ command: "cat", title: "a" })
            try {
              const outA: string[] = []
              const outB: string[] = []

              const ws = {
                readyState: 1,
                data: { events: { connection: "a" } },
                send: (data: unknown) => {
                  outA.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
                },
                close: () => {
                  // no-op (simulate abrupt drop)
                },
              }

              yield* pty.connect(a.id, ws as any)
              outA.length = 0

              ws.data = { events: { connection: "b" } }
              ws.send = (data: unknown) => {
                outB.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
              }

              yield* pty.write(a.id, "AAA\n")
              yield* Effect.promise(() => sleep(100))

              expect(outB.join("")).not.toContain("AAA")
            } finally {
              yield* pty.remove(a.id)
            }
          }),
        ),
    })
  })

  test("treats in-place socket data mutation as the same connection", async () => {
    await using dir = await tmpdir({ git: true })

    await WithInstance.provide({
      directory: dir.path,
      fn: () =>
        AppRuntime.runPromise(
          Effect.gen(function* () {
            const pty = yield* Pty.Service
            const a = yield* pty.create({ command: "cat", title: "a" })
            try {
              const out: string[] = []

              const ctx = { connId: 1 }
              const ws = {
                readyState: 1,
                data: ctx,
                send: (data: unknown) => {
                  out.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
                },
                close: () => {
                  // no-op
                },
              }

              yield* pty.connect(a.id, ws as any)
              out.length = 0

              ctx.connId = 2

              yield* pty.write(a.id, "AAA\n")
              yield* Effect.promise(() => sleep(100))

              expect(out.join("")).toContain("AAA")
            } finally {
              yield* pty.remove(a.id)
            }
          }),
        ),
    })
  })
})
