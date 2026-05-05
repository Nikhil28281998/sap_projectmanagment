# AI Workflow Rules

## Approach

Build and maintain this project incrementally using a spec-driven workflow.
Context files define what to build, how to build it, and the current state of
progress. Always implement against these specs — do not infer or invent behavior.
This is a two-layer project: backend (CAP/Node.js) and frontend (React). Always
identify which layer a change belongs to before starting implementation.

## Scoping Rules

- Work on one feature unit at a time
- Clearly state upfront whether a change affects: CAP backend, React frontend, or both
- Do not combine backend and frontend changes in a single implementation step
  unless they are trivially small and tightly coupled
- Prefer small, verifiable increments over large speculative changes
- Do not add Fiori Elements — this is a pure React app (Fiori removed in session 9)

## When to Split Work

Split an implementation step if it combines:

- Backend (CAP service or lib/) changes and frontend (React) changes simultaneously
- CDS schema changes and frontend type changes simultaneously
- More than one integration client or external system at a time
- AI feature changes that touch both ai-client.js and the UI settings flow
- Behavior not clearly defined in the context files

## Layer Checklist (Run Before Every Change)

Before implementing any change, confirm:

1. Which layer is affected? (CAP backend / React frontend / both)
2. Is the AI change going through `ai-client.js` and not hardcoding a provider?
3. Are all backend calls going through `frontend/src/services/api.ts`?
4. Does any new endpoint need a CDS action definition before the implementation?
5. Are CSV files still semicolon-delimited after any schema seed changes?
6. Is `this._e` used instead of `this.entities` in transport-service.js?
7. Does any new AI call use `max_completion_tokens` (not `max_tokens`)?

## AI Integration Rules

- **All AI calls go through `AIClient.create(db, entities)`** — never import a direct
  HTTP client or call the AI Core endpoint from service handlers
- **Never hardcode the destination name, deployment ID, or model name** in code —
  all come from AppConfig (destination name and deployment ID) and BTP Destination
  (resource group via `URL.headers.AI-Resource-Group`)
- **Never add API key fields** for Claude, Gemini, OpenAI, or OpenRouter — these
  providers are removed. If a user asks about them, redirect to SAP AI Core setup
- **Three auth strategies must all be preserved** in `_callAICore()` — do not remove
  any of the three fallback strategies even if one works in isolation
- **Use `max_completion_tokens`** in the body, not `max_tokens`. The AI Core endpoint
  for GPT-5 and gpt-4.1 rejects `max_tokens` with a 400 error
- **Default to `gpt-4.1`** when recommending a deployment model. Reasoning models
  (gpt-5, o3, o4-mini) use 10–20× tokens for this app's prompt patterns

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files
- If a requirement is ambiguous, resolve it in the relevant context file
  before implementing
- If a requirement is missing, add it as an open question in
  `context/progress-tracker.md` before continuing

## Protected Files

Do not modify the following unless explicitly instructed:

- `srv/lib/claude-client.js` — legacy file, do not delete (tests reference it)
- `xs-security.json` — XSUAA security configuration for BTP deployment
- `mta.yaml` — MTA deployment descriptor
- Any file under `node_modules/`
- `approuter/` configuration files

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- Architecture or system boundaries → `context/architecture.md`
- Code patterns or standards → `context/code-standards.md`
- Feature scope or out-of-scope decisions → `context/project-overview.md`
- Progress or decisions → `context/progress-tracker.md`

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `context/architecture.md` was violated
3. Backend: `npm run dev` starts without errors on port 4004
4. Frontend: `npm run dev` in frontend/ starts without errors on port 3000
5. `context/progress-tracker.md` reflects the completed work
6. No TypeScript errors in frontend (`npx tsc --noEmit` passes)
7. Backend tests still pass (`npm test` in root)
