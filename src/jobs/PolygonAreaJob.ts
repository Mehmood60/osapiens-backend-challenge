import area from '@turf/area';
import { Job } from './Job';
import { Task } from '../models/Task';
import { parsePolygonFeature } from './geoJson';

export interface PolygonAreaResult {
    areaSquareMeters: number;
}

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<PolygonAreaResult> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        const feature = parsePolygonFeature(task.geoJson);
        const areaSquareMeters = area(feature);

        console.log(`Polygon area for task ${task.taskId}: ${areaSquareMeters} m²`);
        return { areaSquareMeters };
    }
}
