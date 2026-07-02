export const TN_CLAW_SESSION_ID_ENV = "TN_CLAW_SESSION_ID"

export function applyTnClawSessionEnv<T extends Record<string, string | undefined>>(
  env: T,
  sessionID: string,
): T & Record<typeof TN_CLAW_SESSION_ID_ENV, string> {
  return {
    ...env,
    [TN_CLAW_SESSION_ID_ENV]: sessionID,
  }
}
