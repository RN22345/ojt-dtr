# Mode: orchestra (Opus leads, OpenCode builds)
Claude usage is the scarce resource; OpenCode usage is cheap and runs in parallel. Spend Claude tokens on planning, tests and review, not on typing code or reading logs.
Settings: .orchestra/config.json (test/typecheck/lint, testPaths, protected, maxWorkers).
Gate: `powershell -NoProfile -ExecutionPolicy Bypass -File .orchestra/gate.ps1 -Base <BASE> [-Test "<task test cmd>"]`
(prints one line on pass; per task pass its own -Test; end of milestone no -Test = full suite)

## Role
Plan, write acceptance tests, route, review. Don't write implementation code unless a task failed review twice or the edit is trivial (under ~10 lines).

## Planning
- Write PLAN.md from .orchestra/templates/plan.md. Keep each milestone's Status current.
- Write and commit acceptance tests before delegating a milestone. That commit is BASE.

## Routing (set `foreman:` per milestone). Default: flash.
- opus: first or pattern-setting milestone; protected areas; vague specs or unknowns; cross-module changes; right after a bad flash milestone.
- flash: everything else.
- The user can override routing at any time.

## Flash flow (per milestone)
1. Run in the background, output to a file: `opencode run --agent foreman --title "orchestra <milestone>" "Execute <milestone> of PLAN.md" > .orchestra/logs/<milestone>.log 2>&1`
2. Review: .orchestra/reports/<milestone>-summary.md, new lines in DECISIONS.md, `git diff --stat <BASE>`, one gate run, full diffs only of the risky files listed. Open the log only if something is wrong.
3. Escalation in .orchestra/escalations/: take over the rest of the milestone.
Independent milestones (no shared files) may run at the same time: `git worktree add ../<repo>-<m> -b m/<m>`, start the foreman from inside that folder, review, merge `m/<m>`, then `git worktree remove`.

## Opus flow (per task, in waves)
1. Write specs to .orchestra/tasks/<id>.md from the template. Test command = only that task's tests.
2. Wave = up to maxWorkers tasks that share no files and don't need each other's code (package.json/lockfile/config edits go alone).
   Start each in the background: `opencode run --agent builder --title "orchestra task <id>" "Implement .orchestra/tasks/<id>.md" > .orchestra/logs/<id>.log 2>&1`
3. When the wave is done, per task: gate with its -Test, read .orchestra/reports/<id>.md and `git diff -- <files>`.
   Good: `git add <files> .orchestra/tasks/<id>.md .orchestra/reports/<id>.md` and commit (never `git add -A` mid-wave).
   Not good: write .orchestra/tasks/<id>-fix<k>.md for the next wave. After 2 failed fixes, take the task over.
4. Once the pattern is set, hand the routine remaining tasks to the foreman.

## After every milestone
- Add a row to .orchestra/routing-log.md. Use earlier rows to route better.
- Every ~3 milestones: cleanup review for quality problems tests don't catch.

## Usage limits
Keep PLAN.md status, specs and reports on disk as you go. The user may switch to `opencode` mode at any time; the foreman resumes from those files.
