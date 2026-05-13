import { Job } from './Job';
import { Task } from '../models/Task';
import booleanWithin from '@turf/boolean-within';
import { Feature, Polygon } from 'geojson';
import countryMapping from '../data/world_data.json';

export class DataAnalysisJob implements Job {
    async run(task: Task): Promise<string> {
        console.log(`Running data analysis for task ${task.taskId}...`);

        const inputGeometry = parsePolygonFeature(task.geoJson);

        for (const countryFeature of countryMapping.features) {
            if (countryFeature.geometry.type === 'Polygon' || countryFeature.geometry.type === 'MultiPolygon') {
                const isWithin = booleanWithin(inputGeometry, countryFeature as Feature<Polygon>);
                if (isWithin) {
                    console.log(`The polygon is within ${countryFeature.properties?.name}`);
                    return countryFeature.properties?.name;
                }
            }
        }
        return 'No country found';
    }
}

function parsePolygonFeature(raw: string): Feature<Polygon> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid GeoJSON: not valid JSON');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid GeoJSON: expected an object');
    }

    const obj = parsed as { type?: unknown; geometry?: { type?: unknown; coordinates?: unknown } };

    // Accept either a bare Polygon geometry or a Feature wrapping one.
    if (obj.type === 'Feature' && obj.geometry && obj.geometry.type === 'Polygon' && Array.isArray(obj.geometry.coordinates)) {
        return parsed as Feature<Polygon>;
    }
    if (obj.type === 'Polygon' && Array.isArray((obj as any).coordinates)) {
        return { type: 'Feature', properties: {}, geometry: parsed as Polygon };
    }

    throw new Error('Invalid GeoJSON: expected a Polygon or a Feature<Polygon>');
}
