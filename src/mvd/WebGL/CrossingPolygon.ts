interface Point {
  x: number;
  y: number;
}

export function doPolygonsIntersect(polygon1: Point[], polygon2: Point[]): boolean {
  // Check if there is a separating axis using the edges of both polygons
  return !hasSeparatingAxis(polygon1, polygon2) && !hasSeparatingAxis(polygon2, polygon1);
}

function hasSeparatingAxis(polygon1: Point[], polygon2: Point[]): boolean {
  // Loop through each edge of the first polygon
  for (let i = 0; i < polygon1.length; i++) {
    const i2 = (i + 1) % polygon1.length;
    const p1 = polygon1[i];
    const p2 = polygon1[i2];

    // Get the edge vector
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };

    // Get the perpendicular axis to project onto
    const axis = { x: -edge.y, y: edge.x };

    // Normalize the axis to ensure consistent projections
    const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
    const normalizedAxis = { x: axis.x / length, y: axis.y / length };

    // Project both polygons onto the axis
    const [minA, maxA] = projectPolygon(polygon1, normalizedAxis);
    const [minB, maxB] = projectPolygon(polygon2, normalizedAxis);

    // Check if there is a gap between the projections
    if (maxA < minB || maxB < minA) {
      return true; // There is a separating axis, so no intersection
    }
  }
  return false; // No separating axis found
}

function projectPolygon(polygon: Point[], axis: Point): [number, number] {
  let min = Infinity;
  let max = -Infinity;

  for (let p of polygon) {
    const projection = p.x * axis.x + p.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }

  return [min, max];
}

export const EPSILON = 1e-9; // Small tolerance for floating-point precision

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let isInside = false;

  // Loop through each edge of the polygon
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    // Check if the point is exactly on a vertex
    if (Math.abs(point.x - xi) < EPSILON && Math.abs(point.y - yi) < EPSILON) {
      return true; // The point is exactly on a vertex
    }

    // Check if the ray from the point intersects the edge
    const intersect = doSegmentsIntersect(
      [xi, yi], [xj, yj],
      [point.x, point.y], [point.x, Infinity]
    )

    if (intersect) {
      isInside = !isInside;

    }
  }

  return isInside;
}

function scalePolygon(polygon: Point[], factor: number): Point[] {
  return polygon.map(p => ({ x: p.x * factor, y: p.y * factor }));
}

function scalePoint(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

export function isPointInPolygonWithScaling(point: Point, polygon: Point[], scaleFactor: number): boolean {
  const scaledPolygon = scalePolygon(polygon, scaleFactor);
  const scaledPoint = scalePoint(point, scaleFactor);
  return isPointInPolygon(scaledPoint, scaledPolygon);
}

function crossProduct(A: [number, number], B: [number, number], C: [number, number]): number {
  return (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
}

function doSegmentsIntersect(
  A: [number, number], B: [number, number],  // Segment 1 endpoints
  C: [number, number], D: [number, number]   // Segment 2 endpoints
): boolean {
  const cross1 = crossProduct(A, B, C);
  const cross2 = crossProduct(A, B, D);
  const cross3 = crossProduct(C, D, A);
  const cross4 = crossProduct(C, D, B);

  // Segments intersect if signs of cross products are different
  return (cross1 * cross2 < 0) && (cross3 * cross4 < 0);
}