import { In, Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import {WorkflowStatus} from "../workflows/WorkflowFactory";
import {Workflow} from "../models/Workflow";
import {Result} from "../models/Result";

export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

export class TaskRunner {
    constructor(
        private taskRepository: Repository<Task>,
    ) {}

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);

        try {
            // Inside try so an unknown taskType marks the task Failed
            // rather than stranding it InProgress.
            const job = getJobForTaskType(task.taskType);
            const resultRepository = this.taskRepository.manager.getRepository(Result);

            console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);
            const taskResult = await job.run(task);
            console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);

            const result = new Result();
            result.taskId = task.taskId!;
            result.data = JSON.stringify(taskResult ?? {});
            await resultRepository.save(result);

            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);
        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);
            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);
            // Intentionally not rethrowing — the finally block must run the
            // workflow rollup regardless of success or failure.
        } finally {
            await this.updateWorkflowStatus(task.workflow.workflowId);
        }
    }

    private async updateWorkflowStatus(workflowId: string): Promise<void> {
        const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId },
            relations: ['tasks'],
        });
        if (!workflow) return;

        const tasks = workflow.tasks;
        const anyFailed = tasks.some(t => t.status === TaskStatus.Failed);
        const allCompleted = tasks.every(t => t.status === TaskStatus.Completed);
        const anyPending = tasks.some(
            t => t.status === TaskStatus.Queued || t.status === TaskStatus.InProgress
        );

        if (allCompleted) {
            workflow.status = WorkflowStatus.Completed;
        } else if (anyFailed && !anyPending) {
            workflow.status = WorkflowStatus.Failed;
        } else if (anyPending || anyFailed) {
            workflow.status = WorkflowStatus.InProgress;
        }
        // else: all queued, leave at Initial

        const terminal =
            workflow.status === WorkflowStatus.Completed ||
            workflow.status === WorkflowStatus.Failed;

        if (terminal) {
            workflow.finalResult = await this.buildFinalResult(workflow, tasks);
        }

        await workflowRepository.save(workflow);
    }

    private async buildFinalResult(workflow: Workflow, tasks: Task[]): Promise<string> {
        const resultRepository = this.taskRepository.manager.getRepository(Result);
        const resultIds = tasks
            .map(t => t.resultId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);

        const results = resultIds.length > 0
            ? await resultRepository.findBy({ resultId: In(resultIds) })
            : [];
        const resultById = new Map(results.map(r => [r.resultId, r]));

        const orderedTasks = [...tasks].sort((a, b) => a.stepNumber - b.stepNumber);

        const aggregate = {
            workflowId: workflow.workflowId,
            summary: {
                total: tasks.length,
                completed: tasks.filter(t => t.status === TaskStatus.Completed).length,
                failed: tasks.filter(t => t.status === TaskStatus.Failed).length,
            },
            tasks: orderedTasks.map(t => {
                const result = t.resultId ? resultById.get(t.resultId) : undefined;
                let output: unknown = null;
                if (result && result.data) {
                    try { output = JSON.parse(result.data); } catch { output = result.data; }
                }
                return {
                    taskId: t.taskId,
                    stepNumber: t.stepNumber,
                    type: t.taskType,
                    status: t.status,
                    output,
                };
            }),
        };

        return JSON.stringify(aggregate);
    }
}