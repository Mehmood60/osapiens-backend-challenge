# Backend Coding Challenge

This repository demonstrates a backend architecture that handles asynchronous tasks, workflows, and job execution using TypeScript, Express.js, and TypeORM. The project showcases how to:

- Define and manage entities such as `Task` and `Workflow`.
- Use a `WorkflowFactory` to create workflows from YAML configurations.
- Implement a `TaskRunner` that executes jobs associated with tasks and manages task and workflow states.
- Run tasks asynchronously using a background worker.

## Key Features

1. **Entity Modeling with TypeORM**  
   - **Task Entity:** Represents an individual unit of work with attributes like `taskType`, `status`, `progress`, and references to a `Workflow`.
   - **Workflow Entity:** Groups multiple tasks into a defined sequence or steps, allowing complex multi-step processes.

2. **Workflow Creation from YAML**  
   - Use `WorkflowFactory` to load workflow definitions from a YAML file.
   - Dynamically create workflows and tasks without code changes by updating YAML files.

3. **Asynchronous Task Execution**  
   - A background worker (`taskWorker`) continuously polls for `queued` tasks.
   - The `TaskRunner` runs the appropriate job based on a task’s `taskType`.

4. **Robust Status Management**  
   - `TaskRunner` updates the status of tasks (from `queued` to `in_progress`, `completed`, or `failed`).
   - Workflow status is evaluated after each task completes, ensuring you know when the entire workflow is `completed` or `failed`.

5. **Dependency Injection and Decoupling**  
   - `TaskRunner` takes in only the `Task` and determines the correct job internally.
   - `TaskRunner` handles task state transitions, leaving the background worker clean and focused on orchestration.

## Project Structure

```
src
├─ models/
│   ├─ world_data.json  # Contains world data for analysis
│   
├─ models/
│   ├─ Result.ts        # Defines the Result entity
│   ├─ Task.ts          # Defines the Task entity
│   ├─ Workflow.ts      # Defines the Workflow entity
│   
├─ jobs/
│   ├─ Job.ts           # Job interface
│   ├─ JobFactory.ts    # getJobForTaskType function for mapping taskType to a Job
│   ├─ TaskRunner.ts    # Handles job execution & task/workflow state transitions
│   ├─ DataAnalysisJob.ts (example)
│   ├─ EmailNotificationJob.ts (example)
│
├─ workflows/
│   ├─ WorkflowFactory.ts  # Creates workflows & tasks from a YAML definition
│
├─ workers/
│   ├─ taskWorker.ts    # Background worker that fetches queued tasks & runs them
│
├─ routes/
│   ├─ analysisRoutes.ts # POST /analysis endpoint to create workflows
│
├─ data-source.ts       # TypeORM DataSource configuration
└─ index.ts             # Express.js server initialization & starting the worker
```

## Getting Started

### Prerequisites
- Node.js (LTS recommended)
- npm or yarn
- SQLite or another supported database

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/backend-coding-challenge.git
   cd backend-coding-challenge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure TypeORM:**
    - Edit `data-source.ts` to ensure the `entities` array includes `Task` and `Workflow` entities.
    - Confirm database settings (e.g. SQLite file path).

4. **Create or Update the Workflow YAML:**
    - Place a YAML file (e.g. `example_workflow.yml`) in a `workflows/` directory.
    - Define steps, for example:
      ```yaml
      name: "example_workflow"
      steps:
        - taskType: "analysis"
          stepNumber: 1
        - taskType: "notification"
          stepNumber: 2
      ```

### Running the Application

1. **Compile TypeScript (optional if using `ts-node`):**
   ```bash
   npx tsc
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

   If using `ts-node`, this will start the Express.js server and the background worker after database initialization.

3. **Create a Workflow (e.g. via `/analysis`):**
   ```bash
   curl -X POST http://localhost:3000/analysis \
   -H "Content-Type: application/json" \
   -d '{
    "clientId": "client123",
    "geoJson": {
        "type": "Polygon",
        "coordinates": [
            [
                [
                    -63.624885020050996,
                    -10.311050368263523
                ],
                [
                    -63.624885020050996,
                    -10.367865108370523
                ],
                [
                    -63.61278302732815,
                    -10.367865108370523
                ],
                [
                    -63.61278302732815,
                    -10.311050368263523
                ],
                [
                    -63.624885020050996,
                    -10.311050368263523
                ]
            ]
        ]
    }
    }'
   ```

   This will read the configured workflow YAML, create a workflow and tasks, and queue them for processing.

4. **Check Logs:**
    - The worker picks up tasks from `queued` state.
    - `TaskRunner` runs the corresponding job (e.g., data analysis, email notification) and updates states.
    - Once tasks are done, the workflow is marked as `completed`.


### **Coding Challenge Tasks for the Interviewee**

The following tasks must be completed to enhance the backend system:

---

### **1. Add a New Job to Calculate Polygon Area**
**Objective:**  
Create a new job class to calculate the area of a polygon from the GeoJSON provided in the task.

#### **Steps:**
1. Create a new job file `PolygonAreaJob.ts` in the `src/jobs/` directory.
2. Implement the `Job` interface in this new class.
3. Use `@turf/area` to calculate the polygon area from the `geoJson` field in the task.
4. Save the result in the `output` field of the task.

#### **Requirements:**
- The `output` should include the calculated area in square meters.
- Ensure that the job handles invalid GeoJSON gracefully and marks the task as failed.

---

### **2. Add a Job to Generate a Report**
**Objective:**  
Create a new job class to generate a report by aggregating the outputs of multiple tasks in the workflow.

#### **Steps:**
1. Create a new job file `ReportGenerationJob.ts` in the `src/jobs/` directory.
2. Implement the `Job` interface in this new class.
3. Aggregate outputs from all preceding tasks in the workflow into a JSON report. For example:
   ```json
   {
       "workflowId": "<workflow-id>",
       "tasks": [
           { "taskId": "<task-1-id>", "type": "polygonArea", "output": "<area>" },
           { "taskId": "<task-2-id>", "type": "dataAnalysis", "output": "<analysis result>" }
       ],
       "finalReport": "Aggregated data and results"
   }
   ```
4. Save the report as the `output` of the `ReportGenerationJob`.

#### **Requirements:**
- Ensure the job runs only after all preceding tasks are complete.
- Handle cases where tasks fail, and include error information in the report.

---

### **3. Support Interdependent Tasks in Workflows**
**Objective:**  
Modify the system to support workflows with tasks that depend on the outputs of earlier tasks.

#### **Steps:**
1. Update the `Task` entity to include a `dependency` field that references another task
2. Modify the `TaskRunner` to wait for dependent tasks to complete and pass their outputs as inputs to the current task.
3. Extend the workflow YAML format to specify task dependencies (e.g., `dependsOn`).
4. Update the `WorkflowFactory` to parse dependencies and create tasks accordingly.

#### **Requirements:**
- Ensure dependent tasks do not execute until their dependencies are completed.
- Test workflows where tasks are chained through dependencies.

---

### **4. Ensure Final Workflow Results Are Properly Saved**
**Objective:**  
Save the aggregated results of all tasks in the workflow as the `finalResult` field of the `Workflow` entity.

#### **Steps:**
1. Modify the `Workflow` entity to include a `finalResult` field:
2. Aggregate the outputs of all tasks in the workflow after the last task completes.
3. Save the aggregated results in the `finalResult` field.

#### **Requirements:**
- The `finalResult` must include outputs from all completed tasks.
- Handle cases where tasks fail, and include failure information in the final result.

---

### **5. Create an Endpoint for Getting Workflow Status**
**Objective:**  
Implement an API endpoint to retrieve the current status of a workflow.

#### **Endpoint Specification:**
- **URL:** `/workflow/:id/status`
- **Method:** `GET`
- **Response Example:**
   ```json
   {
       "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
       "status": "in_progress",
       "completedTasks": 3,
       "totalTasks": 5
   }
   ```

#### **Requirements:**
- Include the number of completed tasks and the total number of tasks in the workflow.
- Return a `404` response if the workflow ID does not exist.

---

### **6. Create an Endpoint for Retrieving Workflow Results**
**Objective:**  
Implement an API endpoint to retrieve the final results of a completed workflow.

#### **Endpoint Specification:**
- **URL:** `/workflow/:id/results`
- **Method:** `GET`
- **Response Example:**
   ```json
   {
       "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
       "status": "completed",
       "finalResult": "Aggregated workflow results go here"
   }
   ```

#### **Requirements:**
- Return the `finalResult` field of the workflow if it is completed.
- Return a `404` response if the workflow ID does not exist.
- Return a `400` response if the workflow is not yet completed.

---

### **Deliverables**
- **Code Implementation:**
   - New jobs: `PolygonAreaJob` and `ReportGenerationJob`.
   - Enhanced workflow support for interdependent tasks.
   - Workflow final results aggregation.
   - New API endpoints for workflow status and results.

- **Documentation:**
   - Update the README file to include instructions for testing the new features.
   - Document the API endpoints with request and response examples.

---

## Implementation Notes & Tested Features

This section documents what was implemented for the six tasks in
"Coding Challenge Tasks for the Interviewee" above, the resulting API
surface, and the design decisions worth flagging for a reviewer.

### Summary

All six tasks are functional end-to-end:

- **Task #1** — `PolygonAreaJob` (`src/jobs/PolygonAreaJob.ts`)
- **Task #2** — `ReportGenerationJob` (`src/jobs/ReportGenerationJob.ts`)
- **Task #3** — `dependsOn` task dependencies, including cascade-fail
- **Task #4** — `Workflow.finalResult` aggregated on terminal state
- **Task #5** — `GET /workflow/:id/status`
- **Task #6** — `GET /workflow/:id/results`

The Brazil-polygon sample curl above walks the new 4-step example workflow:
`analysis → polygonArea → report → notification`.

### New API Endpoints

#### `GET /workflow/:id/status`

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

#### `GET /workflow/:id/results`

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
      { "taskId": "...", "stepNumber": 1, "type": "analysis",    "status": "completed", "output": "Brazil" },
      { "taskId": "...", "stepNumber": 2, "type": "polygonArea", "status": "completed", "output": { "areaSquareMeters": 8363324.27 } },
      { "taskId": "...", "stepNumber": 3, "type": "report",      "status": "completed", "output": { /* nested report object */ } },
      { "taskId": "...", "stepNumber": 4, "type": "notification","status": "completed", "output": {} }
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

### Workflow Definition (YAML)

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

### Job Types

| `taskType`     | Job class              | Output shape |
|----------------|------------------------|--------------|
| `analysis`     | `DataAnalysisJob`      | Country name string (e.g. `"Brazil"`) or `"No country found"` |
| `polygonArea`  | `PolygonAreaJob`       | `{ "areaSquareMeters": <number> }` |
| `report`       | `ReportGenerationJob`  | `{ workflowId, tasks: [...], finalReport }` |
| `notification` | `EmailNotificationJob` | `{}` (no return value) |

`DataAnalysisJob` and `PolygonAreaJob` share a `parsePolygonFeature` helper
(`src/jobs/geoJson.ts`) that validates the input GeoJSON and throws a clear
`Invalid GeoJSON: ...` error on malformed input. The task is then marked
`failed` and the workflow rolls up accordingly.

### Design Decisions Worth Flagging

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

### Bugs Fixed Beyond the Six Tasks

While implementing the features, the following pre-existing bugs were fixed
because they blocked correct behavior of the required features:

1. **Tasks ran out of order** — `taskWorker` had no `ORDER BY` on its
   `findOne`. Empirically reproducible: two POSTs of the same workflow
   produced different execution orders. Fixed by adding
   `order: { stepNumber: 'ASC' }`.
2. **Workflow status rollup never ran on task failure** — `TaskRunner.run`
   placed the rollup after `catch { throw }`, so failed tasks could leave
   the workflow stuck. Fixed by moving the rollup into a `finally` block.
3. **Unknown `taskType` stranded the task `in_progress`** —
   `getJobForTaskType` was called before the `try`, after the task was
   already marked `in_progress`. Fixed by moving the call inside the `try`.
4. **`DataAnalysisJob` threw raw `turf` errors on malformed input** —
   replaced with the `parsePolygonFeature` helper.
5. **`dropSchema: true` wiped the DB on each restart** — fixed.

### Not Addressed in This PR

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

### Manual Test Plan

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
