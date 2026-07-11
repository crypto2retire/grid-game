# GRID Dynasty Security Audit — 2026-07-11

## Scope

Reviewed the production-facing authentication, wallet/chain integration, currency ledger, marketplace settlement, match simulation/play calling, testing endpoints, rate limiting, Redis integration, and anti-bot/economic design.

This is an application security audit of the current repository. It is **not** a smart-contract audit; no production DYN, escrow, treasury, or asset contracts were available for review.

## Executive decision

Real-value DYN/USDG deposits, withdrawals, marketplace settlement, and withdrawable gameplay rewards must remain disabled until all launch blockers below are closed. Internal CASH gameplay may continue.

## Critical findings

### C-1 — Wallet address binding without cryptographic proof

**Risk:** Account takeover or address substitution could bind an attacker-controlled address to a victim account. A plain `0x...` address is not proof of wallet ownership.

**Status:** Mitigated immediately. `/api/solana/wallet/connect` now returns `503` and cannot link a wallet. Re-enable only after a single-use, expiring, domain-bound EIP-191/SIWE challenge is signed and recovered server-side.

**Launch gate:** Required before any deposit, withdrawal, token-gated reward, or asset transfer.

### C-2 — Concurrent match mutations could race state and rewards

**Risk:** Parallel `/play`, `/sim`, and `/complete` requests could read the same pre-update state and attempt duplicate plays, completion, development, or economic rewards.

**Status:** Mitigated immediately with a PostgreSQL-backed distributed lock keyed by match ID. Locks have ownership tokens, automatic expiration, and release on response completion. Authenticated Redis-backed per-user throttles were also added for play and lifecycle actions.

**Launch gate:** Add regression tests that issue parallel requests and prove exactly one mutation succeeds.

### C-3 — Sybil farming through unrestricted account creation

**Risk:** Registration immediately creates CASH, a team, venue, transport, players, and equipment. Email ownership is not verified. Bot operators can create many accounts through proxies and farm/sell starter value.

**Status:** Open launch blocker. Auth rate limiting slows single-IP creation but does not stop proxy or residential botnets.

**Required remediation:**

- Verified email before marketplace, rewards, or wallet activation.
- CAPTCHA/Turnstile or equivalent risk challenge at registration and suspicious login.
- Device/account graphing and duplicate-account risk scoring.
- Starter assets non-transferable or value-vested until account age and gameplay milestones are met.
- Withdrawal eligibility based on account age, verified identity level, net deposits, unique active days, and fraud score.
- Reward emissions capped per human/account cluster, not merely per account.

## High findings

### H-1 — Production testing router remains mounted

Most testing endpoints require `ADMIN`, but the QA injury route trusts disposable-looking usernames or unverified `@example.com` addresses. A user can self-register such an identity.

**Status:** Open. Route only mutates self-owned players, but it can affect quests, treatment flows, testing state, and future economic mechanics.

**Required remediation:** Do not mount `/api/testing` in production. Remove heuristic QA access entirely; require `ADMIN` and an explicit non-production environment.

### H-2 — Rate limiting is not consistently distributed or user-keyed

The global and route limiters use process memory. Many are mounted before authentication, so they key by IP rather than user. Multi-instance deployment, restarts, proxies, and botnets weaken them.

**Status:** Partially mitigated for match actions with authenticated Redis-backed throttles. Other economic routes remain open.

**Required remediation:** Use a shared Redis rate-limit store for authentication, marketplace, staking, wallet, quests, and mini-games. Apply authenticated limits after identity resolution where possible. Add account, IP, device, ASN, and wallet velocity dimensions.

### H-3 — No JWT revocation/session model

JWTs have expiration but no `jti`, issuer, audience, refresh-token rotation, session list, logout revocation, or credential-change invalidation.

**Status:** Open.

**Required remediation:** Short-lived access tokens, rotating refresh tokens stored hashed, session/device records, `jti`, `iss`, `aud`, password-change version, and server-side revocation.

### H-4 — Browser token stored in localStorage

Any successful XSS can steal the bearer token.

**Status:** Open.

**Required remediation:** Prefer Secure, HttpOnly, SameSite cookies with CSRF protection, or a hardened in-memory token plus rotating refresh cookie. Add a strict CSP and remove unsafe inline/eval dependencies.

### H-5 — On-chain reconciliation is not implemented

The database has chain wallet and transaction tables, but there is no trusted indexer/RPC reconciliation that verifies chain ID, contract address, recipient, amount, decimals, confirmation depth, log index uniqueness, and reorg handling.

**Status:** Safely disabled; no production settlement should be enabled.

**Required remediation:** Dedicated indexer worker, allowlisted contracts, confirmation/reorg policy, immutable raw event storage, idempotent crediting, and reconciliation alarms.

### H-6 — Smart contracts unaudited/not present

DYN, treasury, escrow, marketplace, reward distributor, and asset contracts are not available for review.

**Status:** Launch blocker.

**Required remediation:** Independent contract audit, invariant/property tests, multisig/timelock controls, pausable emergency path, upgrade policy, role review, supply/emission caps, and public verification on Blockscout.

### H-7 — CASH-to-DYN and withdrawal semantics create economic risk

A fixed internal CASH-to-DYN exchange and CASH withdrawal workflow can turn bot-farmed internal value into external value if enabled without strict eligibility and reserve controls.

**Status:** Open launch blocker. Do not connect these endpoints to real payouts before anti-Sybil controls and legal/economic review.

## Medium findings

### M-1 — Large global body limit

The server accepts 10 MB JSON globally. Most endpoints need only a few KB.

**Required remediation:** Reduce the default to 256 KB or less and allow larger payloads only on explicitly audited routes.

### M-2 — Production CORS includes localhost

Localhost origins are always allowlisted. This is undesirable in production when bearer tokens are used.

**Required remediation:** Add localhost only outside production and maintain an exact production origin allowlist.

### M-3 — Testing and operational information exposure

Health responses expose memory values and the server has duplicate health/static middleware. This is low sensitivity but unnecessary production detail.

**Required remediation:** Return minimal public health state; send diagnostics only to authenticated operations tooling.

### M-4 — No global idempotency-key framework

Marketplace listing claims are transactionally protected, which is good, but sensitive endpoints do not share a standard idempotency receipt mechanism.

**Required remediation:** Require `Idempotency-Key` for purchase, settlement, withdrawal, claim, stake, sim, and completion requests; persist request hash and response/result.

### M-5 — No bot/anomaly telemetry pipeline

There is no central security-event model for impossible action timing, repeated optimal play patterns, account clusters, marketplace wash trading, circular transfers, or reward extraction velocity.

**Required remediation:** Append-only security events, risk scores, review queues, automated holds, delayed withdrawals, and operational dashboards.

## Positive controls observed

- Passwords use bcrypt with cost 12.
- Login errors do not reveal whether email or password was wrong.
- Auth middleware reloads the current database user, so stale JWT role claims do not grant privileges.
- Role checks protect most administrative testing operations.
- Marketplace purchases atomically claim active listings before settlement.
- Marketplace currency movement and ownership transfer occur within database transactions.
- Ledger writes record balance-after and source metadata.
- Match participation is checked server-side.
- Input schemas use Zod on key mutation endpoints.
- Solana client-attested purchase mutation endpoints were previously removed.

## Anti-bot economy design requirements

1. **Do not make account creation equal transferable value.** Vest starter assets and make them non-withdrawable/non-transferable initially.
2. **Use diminishing rewards based on unique active days and verified progression**, not raw action count.
3. **Separate fun progression from extractable rewards.** Most play rewards should improve roster/facilities; only a limited seasonal pool should be withdrawable.
4. **Delay exits.** New accounts, newly linked wallets, changed passwords, and high-risk sales should have withdrawal cooling periods.
5. **Cluster accounts.** Device, IP/ASN, wallet funding source, behavioral timing, marketplace counterparties, and transaction graph should contribute to one risk score.
6. **Detect wash trading.** Flag reciprocal sales, circular ownership, repeated counterparties, price outliers, and zero-sum volume farming.
7. **Use server-authoritative simulation.** Clients submit intent only; all randomness, eligibility, costs, cooldowns, and rewards are calculated and committed server-side.
8. **Cap emission globally.** A seasonal reward pool should not expand because bots create more accounts.
9. **Require meaningful human decisions.** Avoid CAPTCHA on every action; use occasional adaptive challenges only when risk rises.
10. **Keep a kill switch.** Pausable withdrawals, marketplace settlement, reward claims, and contract interactions must be independently controllable.

## Immediate repository changes from this audit

- Disabled unverified Robinhood wallet linking.
- Added durable PostgreSQL action locks for match mutations.
- Added authenticated Redis-backed play/simulation throttles with safe local fallback.
- Added stricter password rules and normalized authentication input.
- Added the security action-lock migration.

## Remaining release gates

- Production testing router disabled.
- Email verification and adaptive registration challenge.
- Redis-backed limits for every economic endpoint.
- Session/revocation model and safer browser token storage.
- Idempotency receipts across all value-moving mutations.
- Bot-risk event pipeline and withdrawal holds.
- Verified Robinhood chain parameters and indexer.
- DYN/escrow/treasury contract implementation and independent audit.
- Penetration test against a staging environment.
- Load/race testing and disaster-recovery rehearsal.
