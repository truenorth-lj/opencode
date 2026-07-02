import { expect, test } from "bun:test"
import { applyTnClawSessionEnv, TN_CLAW_SESSION_ID_ENV } from "../../src/tn-claw/session-env"

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
