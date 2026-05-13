import { Feature, Polygon } from 'geojson';

export function parsePolygonFeature(raw: string): Feature<Polygon> {
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

    if (obj.type === 'Feature' && obj.geometry && obj.geometry.type === 'Polygon' && Array.isArray(obj.geometry.coordinates)) {
        return parsed as Feature<Polygon>;
    }
    if (obj.type === 'Polygon' && Array.isArray((obj as any).coordinates)) {
        return { type: 'Feature', properties: {}, geometry: parsed as Polygon };
    }

    throw new Error('Invalid GeoJSON: expected a Polygon or a Feature<Polygon>');
}
