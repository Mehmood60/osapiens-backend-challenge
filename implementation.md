# Implementation Notes & Tested Features

This document covers what was implemented for the six tasks in
"Coding Challenge Tasks for the Interviewee" in the README, the resulting
API surface, and the design decisions worth flagging for a reviewer.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm run start
```

3. For local development with auto-reload:

```bash
npm run dev
```

4. Open the API at:

```bash
http://localhost:3000
```

5. To test from a clean state, remove the SQLite database file before
   restarting the server:

```bash
rm -f data/database.sqlite
```

6. Use the workflow YAML under `src/workflows/example_workflow.yml` and
   submit workflows with the sample curl commands shown in `Readme.md`.

## Summary

The work was sequenced as **10 incremental steps**. Steps 1–4 are
prerequisite fixes to pre-existing bugs that blocked correct implementation
of the six required features; Steps 5–10 implement the six tasks themselves.

### Prerequisite fixes (Steps 1–4)

These were found during the investigation phase and fixed before any
feature work, because each one blocks one or more of the six README tasks
from being implementable correctly.

1. **Disable `dropSchema: true`** — workflow IDs now survive a restart.
   Required for the `/status` and `/results` endpoints (Steps 6 and 8) to
   be meaningful across restarts.
2. **Order task fetch by `stepNumber ASC`** — tasks now execute in the
   declared order. Prerequisite for the dependency engine (Step 9) and the
   report job (Step 10), neither of which works correctly when the worker
   picks tasks in arbitrary order.
3. **Refactor `TaskRunner.run` with `finally`-based workflow rollup** —
   failed tasks now correctly update workflow status, and unknown
   `taskType`s now mark the task `failed` instead of stranding it
   `in_progress`. Required for `finalResult` aggregation (Step 7) and the
   `/status` and `/results` endpoints to reflect failure honestly.
4. **Harden `DataAnalysisJob` input parsing** — extracted a shared
   `parsePolygonFeature` helper that throws clean `Invalid GeoJSON: ...`
   errors. Establishes the input-validation pattern that `PolygonAreaJob`
   (Step 5) reuses, matching the README's explicit "handle invalid GeoJSON
   gracefully" requirement.

### README tasks (Steps 5–10)

5. **`PolygonAreaJob`** — README task #1 — `src/jobs/PolygonAreaJob.ts`.
6. **`GET /workflow/:id/status`** — README task #5.
7. **`Workflow.finalResult` aggregation** — README task #4.
8. **`GET /workflow/:id/results`** — README task #6.
9. **`dependsOn` task dependencies** (with cascade-fail) — README task #3.
10. **`ReportGenerationJob`** — README task #2 — `src/jobs/ReportGenerationJob.ts`.

The implementation order intentionally differs from the README's task
numbering: each step is chosen to be independently testable, with later
steps building on earlier ones (e.g. the report job in Step 10 leans on the
dependency engine introduced in Step 9, which leans on the deterministic
task ordering from Step 2).

The Brazil-polygon sample curl in the README walks the final 4-step example
workflow: `analysis → polygonArea → report → notification`.

## New API Endpoints

### `GET /workflow/:id/status`

```bash
curl http://localhost:3000/workflow/<workflowId>/status
```

`200` response:

```json
{
  "workflowId": "...",
  "status": "in_progress",
  "completedTasks": 2,
  "totalTasks": 4
}
```

Status values: `initial`, `in_progress`, `completed`, `failed`. The status is
**derived from current task states**, not the persisted `Workflow.status`
column — this ensures the response reflects reality even during the brief
window between a task starting and the workflow rollup running.

- `400 Invalid workflow id` — `id` is not a UUID.
- `404 Workflow not found` — id is a valid UUID but doesn't exist.

### `GET /workflow/:id/results`

```bash
curl http://localhost:3000/workflow/<workflowId>/results
```

`200` response (completed workflow):

```json
{
  "workflowId": "...",
  "status": "completed",
  "finalResult": {
    "workflowId": "...",
    "summary": { "total": 4, "completed": 4, "failed": 0 },
    "tasks": [
      {
        "taskId": "...",
        "stepNumber": 1,
        "type": "analysis",
        "status": "completed",
        "output": "Brazil"
      },
      {
        "taskId": "...",
        "stepNumber": 2,
        "type": "polygonArea",
        "status": "completed",
        "output": { "areaSquareMeters": 8363324.27 }
      },
      {
        "taskId": "...",
        "stepNumber": 3,
        "type": "report",
        "status": "completed",
        "output": { "workflowId": "...", "tasks": [], "finalReport": "..." }
      },
      {
        "taskId": "...",
        "stepNumber": 4,
        "type": "notification",
        "status": "completed",
        "output": {}
      }
    ]
  }
}
```

- `400 Invalid workflow id` — `id` is not a UUID.
- `404 Workflow not found`.
- `400 Workflow is not yet completed` — workflow exists but is `initial`,
  `in_progress`, or `failed`. The body includes the current `status` so the
  client can branch on it. Strict reading of the brief: only `completed`
  workflows return results; failed workflows return 400 even though their
  `finalResult` is populated.

## Workflow Definition (YAML)

`src/workflows/example_workflow.yml`:

```yaml
name: "example_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "polygonArea"
    stepNumber: 2
    dependsOn: [1]
  - taskType: "report"
    stepNumber: 3
    dependsOn: [1, 2]
  - taskType: "notification"
    stepNumber: 4
    dependsOn: [3]
```

- `stepNumber` — ordinal within the workflow; tasks run in `stepNumber` ASC.
- `dependsOn` — optional; single number or array of numbers (step references
  within the same workflow). A task only runs when **all** its dependencies
  are `completed`. If any dependency is `failed`, the dependent task is
  **cascade-failed** (marked `failed` without running its job). This
  propagates through the chain.

## Job Types

- `analysis` — `DataAnalysisJob` — returns a country name string (e.g. `"Brazil"`) or `"No country found"`.
- `polygonArea` — `PolygonAreaJob` — returns `{ "areaSquareMeters": <number> }`.
- `report` — `ReportGenerationJob` — returns `{ workflowId, tasks: [...], finalReport }`.
- `notification` — `EmailNotificationJob` — returns `{}` (no return value).

`DataAnalysisJob` and `PolygonAreaJob` share a `parsePolygonFeature` helper
(`src/jobs/geoJson.ts`) that validates the input GeoJSON and throws a clear
`Invalid GeoJSON: ...` error on malformed input. The task is then marked
`failed` and the workflow rolls up accordingly.

## Design Decisions Worth Flagging

- **`dropSchema: true` was removed.** Without it, `workflowId`s would not
  survive a restart and the status/results endpoints would be unusable.
- **Workflow status is derived from task counts in `/status`.** The persisted
  `Workflow.status` is rolled up only on terminal task transitions, so it can
  lag during the first task's run. Derivation closes that gap without
  mutating on read.
- **Cascade-fail vs. report-runs-anyway.** With cascade-fail, the report job
  never runs when an upstream task fails — failure information surfaces at
  the workflow level (`finalResult.summary` shows failure counts and the
  cascade chain). An alternative would be a per-task `runOnFailure` flag;
  that's bigger scope than warranted.
- **Step numbers, not task IDs, in `dependsOn`.** Step numbers reference
  tasks within the same workflow. Keeps the YAML clean and avoids two-pass
  writes in `WorkflowFactory`.

## Pre-existing Bugs (Details)

This is the per-bug breakdown of the prerequisite fixes summarized in
Steps 1–4 above. Each was reproduced before being fixed.

1. **Tasks ran out of order** (fixed in Step 2) — `taskWorker` had no
   `ORDER BY` on its `findOne`. Empirically reproducible: two POSTs of the
   same workflow produced different execution orders. Fixed by adding
   `order: { stepNumber: 'ASC' }`.
2. **Workflow status rollup never ran on task failure** (fixed in Step 3) —
   `TaskRunner.run` placed the rollup after `catch { throw }`, so failed
   tasks could leave the workflow stuck. Fixed by moving the rollup into a
   `finally` block.
3. **Unknown `taskType` stranded the task `in_progress`** (fixed in Step 3) —
   `getJobForTaskType` was called before the `try`, after the task was
   already marked `in_progress`. Fixed by moving the call inside the `try`.
4. **`DataAnalysisJob` threw raw `turf` errors on malformed input**
   (fixed in Step 4) — replaced with the `parsePolygonFeature` helper, now
   shared with `PolygonAreaJob`.
5. **`dropSchema: true` wiped the DB on each restart** (fixed in Step 1) —
   removed the flag; `synchronize: true` is enough to keep the schema in
   sync with the entity decorators across restarts.

## Not Addressed in This PR

The following observations were made but deliberately left out of scope:

- `defaultRoute.ts` reads `README.md` (uppercase) while the file is
  `Readme.md` on disk. Works on Windows (case-insensitive) but would 500 on
  Linux/macOS.
- `ormconfig.json` at the repo root is dead — not loaded by the app.
- `bcrypt` and `jsonwebtoken` are listed in `package.json` but never
  imported.
- `@types/express` is pinned to `^5.0.0` while `express` is `^4.21.2`. Type
  declarations are v5, runtime is v4 — that's why all route handlers use
  statement-form `res.status(...).json(...); return;` rather than
  `return res.status(...)`.
- The background worker has no graceful shutdown — `while (true)` never
  exits.
- No transactions wrap the multi-row writes in `TaskRunner.run` and
  `updateWorkflowStatus`.
- No retries / max-attempts on transient job failures.
- Per-task error messages are not persisted — a failed task has
  `resultId: null` and no `Result` row. The `finalResult` shows
  `status: "failed", output: null` but not the actual error text.
- Cycle detection in `WorkflowFactory` — a YAML declaring a `dependsOn`
  cycle would have both tasks wait forever.

## Manual Test Plan

After `npm install` and `npm start`:

```bash
# 1. Submit a happy-path workflow (Brazil polygon).
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client123",
    "geoJson": { "type": "Polygon", "coordinates": [[
      [-63.624885020050996, -10.311050368263523],
      [-63.624885020050996, -10.367865108370523],
      [-63.61278302732815,  -10.367865108370523],
      [-63.61278302732815,  -10.311050368263523],
      [-63.624885020050996, -10.311050368263523]
    ]] }
  }'

# 2. Poll status until completed (~25s, 4 tasks × 5s poll).
curl http://localhost:3000/workflow/<workflowId>/status

# 3. Fetch results.
curl http://localhost:3000/workflow/<workflowId>/results

# 4. Submit a failure-path workflow (malformed GeoJSON).
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{ "clientId": "badclient", "geoJson": {} }'
# Expected: analysis fails, the remaining 3 tasks cascade-fail.
```
