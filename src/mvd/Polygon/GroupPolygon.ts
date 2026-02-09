type Point = {
  x: number;
  y: number;
};

type Polygon = Array<Point>;

type PolyGroup = {
  index: number;
  polygon: Polygon;
  children: Array<PolyGroup>;
};

/**
 * Determines if a point is inside a polygon using the Ray Casting algorithm.
 *
 * @param point - The point to check.
 * @param polygon - The polygon to check against.
 * @returns true if the point is inside the polygon, false otherwise.
 */
function isPointInsidePolygon(point: Point, polygon: Polygon): boolean {
  let count = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) count++;
  }

  // If the count is odd, the point is inside the polygon.
  return count % 2 !== 0;
}

/**
 * Determines if all points of `polygonA` are inside `polygonB`.
 *
 * @param polygonA - The first polygon.
 * @param polygonB - The second polygon.
 * @returns true if all points of `polygonA` are inside `polygonB`, false otherwise.
 */
function isPolygonInsidePolygon(polygonA: Polygon, polygonB: Polygon): boolean {
  for (const point of polygonA) {
    if (!isPointInsidePolygon(point, polygonB)) {
      return false;
    }
  }
  return true;
}

/**
 * Creates the hierarchical structure of `PolyGroup` by iterating over each
 * polygon and determining its relationship with every other polygon.
 *
 * @param polygons - An array of polygons to group.
 * @returns An array of PolyGroup where all polygons are used.
 */
export function groupPolygons(polygons: Polygon[]): PolyGroup[] {
  const groups: PolyGroup[] = [];

  for (let i = 0; i < polygons.length; i++) {
    let isChildOfAnother = false;
    for (let j = 0; j < polygons.length; j++) {
      if (i === j) continue;

      if (isPolygonInsidePolygon(polygons[i], polygons[j])) {
        const parentGroup = groups.find(group => group.polygon === polygons[j]);
        if (parentGroup) {
          parentGroup.children.push({
            index: i,
            polygon: polygons[i],
            children: [],
          });
        } else {
          groups.push({
            index: j,
            polygon: polygons[j],
            children: [{
              index: i,
              polygon: polygons[i],
              children: [],
            }],
          });
        }
        isChildOfAnother = true;
        break;
      }
    }

    // If the polygon is not a child of any other polygon and hasn't been added to groups
    if (!isChildOfAnother && !groups.some(group => group.polygon === polygons[i])) {
      groups.push({
        index: i,
        polygon: polygons[i],
        children: [],
      });
    }
  }

  return groups;
}
