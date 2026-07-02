export const TN_CLAW_SESSION_ID_ENV = "TN_CLAW_SESSION_ID"
export const TN_CLAW_INSTANCE_ID_ENV = "TN_CLAW_INSTANCE_ID"
export const TN_CLAW_LOOPBACK_TOKEN_ENV = "TN_CLAW_LOOPBACK_TOKEN"
export const TN_CLAW_OPENCODE_SHARED_SERVER_ENV = "TN_CLAW_OPENCODE_SHARED_SERVER"

export function applyTnClawSessionEnv<T extends Record<string, string | undefined>>(
  env: T,
  sessionID: string,
): T & Record<typeof TN_CLAW_SESSION_ID_ENV, string> {
  return {
    ...env,
    [TN_CLAW_SESSION_ID_ENV]: sessionID,
  }
}

export function protectSessionlessSharedEnv(
  env: Record<string, string>,
  shared: boolean,
): Record<string, string> {
  if (!shared) return env
  const protectedEnv = { ...env }
  delete protectedEnv[TN_CLAW_LOOPBACK_TOKEN_ENV]
  delete protectedEnv[TN_CLAW_SESSION_ID_ENV]
  delete protectedEnv[TN_CLAW_INSTANCE_ID_ENV]
  protectedEnv[TN_CLAW_OPENCODE_SHARED_SERVER_ENV] = "1"
  return protectedEnv
}
