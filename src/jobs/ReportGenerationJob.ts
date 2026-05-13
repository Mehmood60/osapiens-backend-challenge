import { Job, TaskContext } from './Job';
import { Task } from '../models/Task';

interface ReportTaskEntry {
    taskId: string;
    stepNumber: number;
    type: string;
    output: unknown;
}

export interface Report {
    workflowId: string;
    tasks: ReportTaskEntry[];
    finalReport: string;
}

export class ReportGenerationJob implements Job {
    async run(task: Task, context?: TaskContext): Promise<Report> {
        console.log(`Generating report for task ${task.taskId}...`);

        const dependencies = context?.dependencies ?? [];
        const workflowId = task.workflow?.workflowId ?? '';

        const tasks: ReportTaskEntry[] = dependencies.map(d => ({
            taskId: d.taskId,
            stepNumber: d.stepNumber,
            type: d.type,
            output: d.output,
        }));

        const hasMissingOutput = tasks.some(t => t.output === null || t.output === undefined);
        const finalReport = hasMissingOutput
            ? `Report generated from ${tasks.length} preceding task(s) in workflow ${workflowId}; some outputs were missing.`
            : `Report generated from ${tasks.length} preceding task(s) in workflow ${workflowId}.`;

        return { workflowId, tasks, finalReport };
    }
}
