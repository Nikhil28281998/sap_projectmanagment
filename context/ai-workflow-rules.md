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
2. Is the AI change going through `ai-client.js` and not hardcoding Claude?
3. Are all backend calls going through `frontend/src/services/api.ts`?
4. Does any new endpoint need a CDS action definition before the implementation?
5. Are CSV files still semicolon-delimited after any schema seed changes?
6. Is `this._e` used instead of `this.entities` in transport-service.js?

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
6. No TypeScript errors in frontend (`npm run lint` passes)
7. Backend tests still pass (`npm test` in root)
