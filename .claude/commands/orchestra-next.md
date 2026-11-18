---
description: Run the OpenCode foreman on the first unfinished milestone in PLAN.md, then review it
---
Run `orchestra next -Quiet` in the background (output goes to .orchestra/logs/). When it finishes:
1. If it says a milestone is escalated, read that escalation file and tell me the question and your recommendation.
2. Otherwise review the milestone the orchestra-mode way: its summary in .orchestra/reports/, new lines in .orchestra/DECISIONS.md, `git diff --stat` since the milestone's first commit, and full diffs only of the risky files it lists.
3. Add a row to .orchestra/routing-log.md and tell me the result in a few lines.
