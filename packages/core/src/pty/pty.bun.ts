import { spawn as create } from "bun-pty"
import type { Opts, Proc } from "./pty"

export type { Disp, Exit, Opts, Proc } from "./pty"

const TN_CLAW_SESSIONLESS_PROTECTED_ENV_KEYS = [
  "TN_CLAW_LOOPBACK_TOKEN",
  "TN_CLAW_SESSION_ID",
  "TN_CLAW_INSTANCE_ID",
] as const

function withoutTnClawSessionlessEnv<T>(fn: () => T): T {
  const previous: Partial<Record<(typeof TN_CLAW_SESSIONLESS_PROTECTED_ENV_KEYS)[number], string>> = {}
  for (const key of TN_CLAW_SESSIONLESS_PROTECTED_ENV_KEYS) {
    previous[key] = process.env[key]
    delete process.env[key]
  }
  try {
    return fn()
  } finally {
    for (const key of TN_CLAW_SESSIONLESS_PROTECTED_ENV_KEYS) {
      const value = previous[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

export function spawn(file: string, args: string[], opts: Opts): Proc {
  const pty = withoutTnClawSessionlessEnv(() => create(file, args, opts))
  return {
    pid: pty.pid,
    onData(listener) {
      return pty.onData(listener)
    },
    onExit(listener) {
      return pty.onExit(listener)
    },
    write(data) {
      pty.write(data)
    },
    resize(cols, rows) {
      pty.resize(cols, rows)
    },
    kill(signal) {
      pty.kill(signal)
    },
  }
}
