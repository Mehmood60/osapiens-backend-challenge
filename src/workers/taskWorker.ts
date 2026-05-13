import { In, Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Task } from '../models/Task';
import { TaskRunner, TaskStatus } from './taskRunner';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        const next = await findNextActionableTask(taskRepository);

        if (next) {
            try {
                if (next.action === 'run') {
                    await taskRunner.run(next.task);
                } else {
                    await taskRunner.cascadeFail(next.task);
                }
            } catch (error) {
                console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                console.error(error);
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

type Actionable = { task: Task; action: 'run' | 'cascade-fail' };

async function findNextActionableTask(repo: Repository<Task>): Promise<Actionable | null> {
    const queued = await repo.find({
        where: { status: TaskStatus.Queued },
        order: { stepNumber: 'ASC' },
        relations: ['workflow'],
    });

    for (const task of queued) {
        const state = await dependencyState(repo, task);
        if (state === 'ready') return { task, action: 'run' };
        if (state === 'cascade-fail') return { task, action: 'cascade-fail' };
    }
    return null;
}

async function dependencyState(
    repo: Repository<Task>,
    task: Task,
): Promise<'ready' | 'wait' | 'cascade-fail'> {
    if (!task.dependsOn || task.dependsOn.length === 0) return 'ready';
    const depStepNumbers = task.dependsOn.map(n => Number(n)).filter(Number.isFinite);
    if (depStepNumbers.length === 0) return 'ready';

    const deps = await repo.find({
        where: {
            workflow: { workflowId: task.workflow.workflowId },
            stepNumber: In(depStepNumbers),
        },
    });

    if (deps.some(d => d.status === TaskStatus.Failed)) return 'cascade-fail';
    if (deps.length === depStepNumbers.length && deps.every(d => d.status === TaskStatus.Completed)) {
        return 'ready';
    }
    return 'wait';
}
