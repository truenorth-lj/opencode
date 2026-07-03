import * as pty from "@lydell/node-pty"
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
  const proc = withoutTnClawSessionlessEnv(() => pty.spawn(file, args, opts))
  return {
    pid: proc.pid,
    onData(listener) {
      return proc.onData(listener)
    },
    onExit(listener) {
      return proc.onExit(listener)
    },
    write(data) {
      proc.write(data)
    },
    resize(cols, rows) {
      proc.resize(cols, rows)
    },
    kill(signal) {
      proc.kill(signal)
    },
  }
}
