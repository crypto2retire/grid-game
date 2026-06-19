# Project Principles

**Date:** 2026-06-18

## 1. Automate, Don't Delegate

When building this project, the AI assistant should handle everything that can be done in code or configuration. **Do not ask the user to perform manual steps that could be automated.** Examples of what should be automated:

- Database migrations on startup (not manual shell commands)
- Environment variable validation with defaults (not "add this to your .env")
- Seed data generation on first run (not "run the seed script")
- Health checks and self-healing (not "check if the service is up")
- Build error fixes (not "you need to fix these TypeScript errors")
- Deployment configuration (not "go to the dashboard and click this")

**Rule of thumb:** If it can be done in code, config, or a script, do it there. Only ask the user for things that genuinely require their input (decisions, credentials they must provide, domain names they own, etc.).

## 2. Fix Forward, Don't Explain Backward

When the build breaks or something fails, **fix the code and push the fix** rather than explaining what the user needs to do. The user hired an engineer, not a consultant. If the TypeScript build fails, fix the imports. If the Docker build fails, fix the Dockerfile. If the deploy fails, fix the config.

## 3. Zero-Touch Deployment

The goal is that a user can push code and the deployment handles everything else. No manual migrations, no manual seeding, no manual environment variable setup beyond the absolute minimum (secrets they must provide like API keys, tokens, passwords).

## 4. Idempotent Operations

All setup operations should be idempotent — running them twice produces the same result. This means:
- Migrations only apply pending changes
- Seeding checks if data exists before creating
- Configuration scripts are safe to re-run

## 5. Self-Documenting Errors

If something must fail (e.g., missing required secret), the error message should tell the user exactly what to do, not just what went wrong. Include the variable name, where to set it, and how to generate it if applicable.

---

These principles exist because the user is a business owner, not a DevOps engineer. Every manual step is friction. Every automated step is value.
