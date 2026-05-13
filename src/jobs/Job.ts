import { Task } from "../models/Task";

export interface DependencyResult {
    taskId: string;
    stepNumber: number;
    type: string;
    output: unknown;
}

export interface TaskContext {
    dependencies: DependencyResult[];
}

export interface Job {
    run(task: Task, context?: TaskContext): Promise<any>;
}
