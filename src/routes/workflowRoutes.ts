import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from '../workflows/WorkflowFactory';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = Router();

router.get('/:id/status', async (req, res) => {
    const { id } = req.params;

    if (!UUID_RE.test(id)) {
        res.status(400).json({ message: 'Invalid workflow id' });
        return;
    }

    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: id },
            relations: ['tasks'],
        });

        if (!workflow) {
            res.status(404).json({ message: 'Workflow not found' });
            return;
        }

        const tasks = workflow.tasks;
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === TaskStatus.Completed).length;
        const status = deriveStatus(tasks, workflow.status);

        res.status(200).json({
            workflowId: workflow.workflowId,
            status,
            completedTasks,
            totalTasks,
        });
    } catch (error: any) {
        console.error(`Error fetching workflow ${id} status:`, error);
        res.status(500).json({ message: 'Failed to fetch workflow status' });
    }
});

// Read-only mirror of TaskRunner.updateWorkflowStatus. The persisted
// workflow.status lags during the first task's run (rollup happens in
// the runner's finally, after a terminal task transition) — deriving
// from current task states closes that gap.
function deriveStatus(tasks: Task[], persisted: WorkflowStatus): WorkflowStatus {
    if (tasks.length === 0) return persisted;
    const allCompleted = tasks.every(t => t.status === TaskStatus.Completed);
    const anyFailed = tasks.some(t => t.status === TaskStatus.Failed);
    const anyPending = tasks.some(
        t => t.status === TaskStatus.Queued || t.status === TaskStatus.InProgress
    );
    if (allCompleted) return WorkflowStatus.Completed;
    if (anyFailed && !anyPending) return WorkflowStatus.Failed;
    if (anyPending || anyFailed) return WorkflowStatus.InProgress;
    return persisted;
}

export default router;
