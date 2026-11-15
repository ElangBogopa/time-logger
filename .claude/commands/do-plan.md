---
description: Plan a change and save it as a brief another session can build from. Edits nothing.
argument-hint: <what you want changed>
---

Plan this change, save the plan as a file, and stop. Do not edit any code.

The request: $ARGUMENTS

**This command ends when the brief is saved.** Building is a separate step,
in a separate session, on a cheaper model. So:
- Do not start building, whatever the reply to the plan is. "Looks good",
  "approved" or "go ahead" mean the plan is accepted — answer that the
  brief is saved and that `/do-build <path>` in a new session builds it.
- Run this in Auto mode, not Plan mode. Plan mode cannot save the file, and
  its Approve button starts the build in this session on this model. If you
  find you are in Plan mode, say so, present the plan, and ask the owner to
  switch to Auto and say "save it" — then write the file and stop.
- The only file you may create or change is the brief itself.

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
   - **Who should build and review this**: a recommendation, with one line
     of reason each.
     - *Build with* **Sonnet** by default. Say **Opus** only when the work
       needs judgment the brief cannot pin down — a design with several
       reasonable shapes, a tangled bug, a change spread across code you
       could not fully specify. Say **Haiku** only for mechanical edits
       with no decisions in them.
     - *Review with* **Opus** by default. Say **Fable** when a mistake
       would be costly or hard to see: sign-in, deleting or exporting data,
       payments, reminders, anything touching the database's shape. Say
       "no review needed" for a change a person can fully judge by looking
       at the screen. (`/do-all` reviews it anyway, on Opus.)
     - *Effort*: medium unless there is a reason, which you state.
     Recommend the cheapest that will do the job well. A precise brief is
     what lets the cheaper model succeed, so if you are recommending a
     costlier builder, first ask whether the brief could be made specific
     enough not to need one.
4. Reply with the file's path, a five-line summary, the model you
   recommend for the build and for the review with the reason for each,
   and the exact next step: "Start a new session, switch to <model>, and
   run `/do-build docs/plans/<short-name>.md`." Then stop.

The brief will be built by a cheaper model with none of this conversation,
so it must stand on its own: name files and functions, not "the component
we discussed".
