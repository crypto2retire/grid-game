-- Security hardening: durable lock for economically sensitive actions.
-- Prevents concurrent play/sim/finalize requests from racing game state or rewards.
CREATE TABLE IF NOT EXISTS "SecurityActionLock" (
  "key" TEXT PRIMARY KEY,
  "ownerToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "SecurityActionLock_expiresAt_idx"
  ON "SecurityActionLock"("expiresAt");
