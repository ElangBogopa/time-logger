---
description: Plan a change and save it as a brief another session can build from. Edits nothing.
argument-hint: <what you want changed>
---

Plan this change. Do not edit any code.

The request: $ARGUMENTS

1. Read CLAUDE.md, then only the files this change touches. Do not explore
   the whole project.
2. If something the owner must decide is unclear, ask it now, in plain
   language, and stop until answered.
3. Write the plan to `docs/plans/<short-name>.md` with exactly these parts:
   - **Goal**: one or two sentences, in the owner's terms.
   - **Files**: each file to change or create, and what changes in it.
   - **Steps**: in order, each small enough to check.
   - **Rules that apply**: the CLAUDE.md principles this touches.
   - **Do not**: what is out of scope or must not be touched.
   - **Done when**: checks the builder can run itself (tests to add,
     `npx tsc --noEmit`, `npm test`, `npm run lint` staying at its current
     count, `npm run build`), and what to look at in the app.
   - **Not decided**: anything left open, or "nothing".
4. Reply with the file's path and a five-line summary. Nothing else.

The brief will be built by a cheaper model with none of this conversation,
so it must stand on its own: name files and functions, not "the component
we discussed".
