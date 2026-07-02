import { expect, test } from "bun:test"
import {
  applyTnClawSessionEnv,
  protectSessionlessSharedEnv,
  TN_CLAW_INSTANCE_ID_ENV,
  TN_CLAW_LOOPBACK_TOKEN_ENV,
  TN_CLAW_OPENCODE_SHARED_SERVER_ENV,
  TN_CLAW_SESSION_ID_ENV,
} from "../../src/tn-claw/session-env"

test("trusted session env overwrites stale plugin output", () => {
  const env = applyTnClawSessionEnv(
    {
      [TN_CLAW_SESSION_ID_ENV]: "ses_plugin_stale",
      OTHER_ENV: "kept",
    },
    "ses_current",
  )

  expect(env[TN_CLAW_SESSION_ID_ENV]).toBe("ses_current")
  expect(env.OTHER_ENV).toBe("kept")
})

test("sessionless shared env cannot inherit loopback credentials", () => {
  const env = protectSessionlessSharedEnv({
    [TN_CLAW_OPENCODE_SHARED_SERVER_ENV]: "1",
    [TN_CLAW_LOOPBACK_TOKEN_ENV]: "loopback-token",
    [TN_CLAW_SESSION_ID_ENV]: "ses_stale",
    [TN_CLAW_INSTANCE_ID_ENV]: "inst-stale",
    OTHER_ENV: "kept",
  })

  expect(env[TN_CLAW_LOOPBACK_TOKEN_ENV]).toBeUndefined()
  expect(env[TN_CLAW_SESSION_ID_ENV]).toBeUndefined()
  expect(env[TN_CLAW_INSTANCE_ID_ENV]).toBeUndefined()
  expect(env.OTHER_ENV).toBe("kept")
})

test("sessionless non-shared env keeps legacy loopback credentials", () => {
  const env = protectSessionlessSharedEnv({
    [TN_CLAW_LOOPBACK_TOKEN_ENV]: "loopback-token",
    [TN_CLAW_INSTANCE_ID_ENV]: "inst-current",
  })

  expect(env[TN_CLAW_LOOPBACK_TOKEN_ENV]).toBe("loopback-token")
  expect(env[TN_CLAW_INSTANCE_ID_ENV]).toBe("inst-current")
})
