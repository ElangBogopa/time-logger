# Remove the unused ghost-events hook

> **BUILT - do not run again.** Built on 2026-11-14 in the commit titled "chore: remove the unused ghost-events hook; calendar blocks are tap-only". It stays as the record of what was asked.

## Goal

Delete `src/hooks/useGhostEvents.ts`, which nothing imports, so the
"Escape may not cancel a ghost-entry drag" bug goes with the dead code it
lives in. Say plainly in CLAUDE.md that a calendar block opens its confirm
sheet on a tap or click and cannot be dragged. The running app behaves
exactly as before.

## Files

- `src/hooks/useGhostEvents.ts` — **delete**. It is imported by nothing
  (checked: no file under `src/` imports `useGhostEvents`,
  `UseGhostEventsParams` or `UseGhostEventsReturn`). It holds the
  ref-dependent Escape listener and the
  `// eslint-disable-next-line react-hooks/refs, react-hooks/exhaustive-deps`
  comment that hides it; both go with the file.
  Nothing exists only to serve it: its imports (`timeToMinutes`,
  `minutesToTime` from `@/lib/time-utils`, `CalendarEvent` from
  `@/components/TimelineView`) are used elsewhere, and its own
  `DragCreateData` interface is a duplicate — the one the app uses comes
  from `src/hooks/useTimelineMouseCreate.ts`, re-exported by
  `src/components/TimelineView.tsx`. So nothing else is deleted.
- `CLAUDE.md` — under "### Timeline Component", replace the whole bullet
  that starts `- **Known bug, not fixed:** Escape may not cancel a
  ghost-entry drag.` (six lines, ending `which touches the drag code.`)
  with exactly this one line:
  `- A calendar block opens its confirm sheet on a tap or click and cannot be dragged.`
- `src/__tests__/timeline-mouse.test.tsx` — **create**. One small test
  file pinning that Escape cancels a mouse drag-to-create on the empty grid
  (`useTimelineMouseCreate`), which no existing test covers (the only
  timeline test, `src/__tests__/timeline-touch.test.tsx`, is touch only and
  never presses Escape).

## Steps

1. `git branch --show-current` must say `dev`; if it says `main`, run
   `git switch dev`.
2. Confirm the hook is still unused:
   `grep -rn "useGhostEvents\|UseGhostEvents" src` must list only
   `src/hooks/useGhostEvents.ts` itself. If anything else appears, stop
   and report it — do not delete.
3. `git rm src/hooks/useGhostEvents.ts`.
4. Edit `CLAUDE.md` as described under Files.
5. Create `src/__tests__/timeline-mouse.test.tsx`. Model the setup on
   `src/__tests__/timeline-touch.test.tsx` (same imports, same
   `renderTimeline` with `entries={[]}`, `calendarEvents={[]}`,
   `isLoading={false}`, `onEntryDeleted`, `onDragCreate`, `isToday={true}`;
   the grid is `container.querySelector('.cursor-crosshair')`, which is
   where `TimelineGrid` puts `onMouseDown`). Two tests:
   - **control:** `fireEvent.mouseDown(grid, { button: 0, clientY: 200 })`,
     then `fireEvent.mouseUp(window)` → `onDragCreate` called once.
   - **Escape cancels:** `fireEvent.mouseDown(grid, { button: 0, clientY: 200 })`,
     `fireEvent.keyDown(window, { key: 'Escape' })`, then
     `fireEvent.mouseUp(window)` → `onDragCreate` not called.
   The window listeners are attached in an effect after `isDragging`
   turns true; `fireEvent` from Testing Library flushes it, but if the
   control test fails because the listener is not attached yet, wrap the
   mouseDown in `act(() => { ... })`. The control test must pass, or the
   Escape test proves nothing. Both pass on today's code — no source
   change is needed for them, and none may be made.
6. Run the checks under "Done when".
7. Commit to `dev` (as `/do-build` does). Message, e.g.
   `chore: remove the unused ghost-events hook; calendar blocks are tap-only`.

## Rules that apply

- CLAUDE.md "Branches": work on `dev`; never commit to, push to or merge
  into `main`.
- CLAUDE.md "Timeline Component": the timeline's behaviour is unchanged —
  24 hours, touch hold-to-create, current-time line on today.
- CLAUDE.md design principle 1 (mobile only, hold-to-drag): untouched,
  because no live code changes.

## Do not

- Do not make calendar blocks (`TimelineGhost`) draggable, and do not
  change `handleGhostMouseDown`, `handleGhostTouchStart` or
  `handleGhostTouchEnd` in `src/components/TimelineView.tsx` — including
  its comment "In the future, this could integrate with the drag creation
  hooks"; leave it.
- Do not change `src/hooks/useTimelineMouseCreate.ts`,
  `src/hooks/useTimelineTouchCreate.ts`, `src/hooks/useEntryAdjustment.ts`
  or any component.
- Do not edit `REFACTOR-PLAN.md` or `QA-REPORT.md`, which mention the hook
  as history.
- Do not touch `docs/reviews/open.md` (it has uncommitted changes of its
  own), `docs/BUSINESS-CONTEXT.md` or `main`.

## Done when

- `grep -rn "useGhostEvents\|ghostInteractionRef" src CLAUDE.md` finds
  nothing.
- `npx tsc --noEmit` passes.
- `npm test` passes, including both new tests in
  `src/__tests__/timeline-mouse.test.tsx`.
- `npm run test:tz` passes.
- `npm run lint` shows 0 errors and **54 warnings or fewer** (54 before
  this change; the deleted file had none of its own, so expect 54).
- `npm run build` passes.
- In the app (preview after push): on Plan, a calendar block still opens
  its confirm sheet on a tap or click; dragging on an empty part of the
  timeline still opens Quick Log, and pressing Escape mid-drag on a
  desktop browser still cancels it.
- The owner's "done" also includes `dev` pushed to `origin dev`.
  `/do-build` does not push; `/do-all` pushes at the end of a clean run.
  If this brief is built with `/do-build` alone, push only when the owner
  asks.

## Not decided

Nothing.

## Who should build and review this

- *Build with* **Sonnet**, effort **low** — a file deletion, a one-line doc
  edit and a two-case test modelled on an existing file; nothing to decide.
- *Review with* **Opus**, effort **low** — the default reviewer; low
  because the diff is a deletion plus one small test, and the only things
  to check are that nothing imported the file and that the test really
  exercises Escape.
