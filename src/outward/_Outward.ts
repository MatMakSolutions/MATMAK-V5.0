import { Point } from "../mvd/RawVector/RawVector";

export function createExternalOutwardPolygon(vector: string, distance: number, precision: number = 15) {



  const poly = syncCreatePolygonFromSVGPaths(vector, precision); // Create a polygon based on the PATH definition

  //convert the poly into a path
  const polyPath = poly.map((p) => "M" + p.map(_ => _.join(" ")).join("L")).join("Z") + "Z";



  const out = offsetPolygon(poly[0].map(_ => new Point(_[0], _[1])), distance, !true); // Offseting the polygon


  const outward = checkIntersect(out) // Calculate the intersections
  
 // From the Point[] we need to create a string a svg path with Lineto and MoveTo
 outward[0] = outward[outward.length - 1];
  let path = "Z M" + outward[0].x + " " + outward[0].y + " ";
  for (let i = 1; i < outward.length; i++) {
    path += "L" + outward[i].x + " " + outward[i].y + " ";
  }
  path += "Z";


  return path;
  //this._mainRawVector.rebuild(path);
  //this.rebuildStage();
}

export function syncCreatePolygonFromSVGPaths(vecDoc: string, precision: number = 15): Array<[number, number][]> {
  if (precision < 0 || precision > 100) {
      throw new Error('Precision should be between 0 and 100.');
  }

  const allPolygons = [] as Array<[number, number][]>;
  // Get all standalone path strings from the vector document
  //vecDoc.vdocs.forEach(_ => _.setRelative(false));
  const svgPathStrings = [vecDoc]; //.vdocs.map(_ => _.paths.map(__ => __.asString()).join(" "));

  for (const standalonePathString of svgPathStrings) {
      try {
        handlePoly(allPolygons, standalonePathString, precision,0, 0,  true);
      } catch (ex) {}
  }

  return allPolygons;
}



/**
 * Offsets a polygon either outward or inward by a specified distance.
 * @param points - The vertices of the polygon.
 * @param distance - The distance to offset the polygon.
 * @param outward - Flag to determine outward/inward direction (default is outward).
 * @returns The offset polygon.
 */
export function offsetPolygon(points: Point[], distance: number, outward: boolean = true): Point[] {
  const offseted: Point[] = [];
  const n = points.length;

  // Iterate through each vertex of the polygon.
  for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const current = points[i];
      const next = points[(i + 1) % n];

      // Offset each vertex and add to the new polygon.
      offseted.push(offsetPoint(prev, current, next, distance, outward));
  }

  return offseted;
}

export function checkIntersect(polygon: Point[]) {
  const n = polygon.length;
  const allIntersections: Point[] = [];

  // Iterate through each edge of the polygon.
  for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];

      // Iterate through each edge of the polygon.
      for (let j = 0; j < n; j++) {
          const p3 = polygon[j];
          const p4 = polygon[(j + 1) % n];

          if (i === j || i === (j + 1) % n || (i + 1) % n === j) continue;

          // Check if the edges intersect.
          if (intersect(p1, p2, p3, p4) !== null) {
              const intersectPoint = intersect(p1, p2, p3, p4)!;
              // Add the intersection point in the original poligon after p1.
              //polygon.splice(i + 1, j - i - 1, intersectPoint);
              // then remove all point from from p2 to p4
              polygon.splice(i + 1, j - i, intersectPoint); // remove all points from p2 to p4
              // then call the function again with the new polygon
              return checkIntersect(polygon);
          }
      }
  }

  return polygon;
}

/**
 * Computes the intersection point between two line segments.
 * @param p1 - Starting point of the first line segment.
 * @param p2 - Ending point of the first line segment.
 * @param p3 - Starting point of the second line segment.
 * @param p4 - Ending point of the second line segment.
 * @returns The intersection point if it exists, null otherwise.
 */
function intersect(A: Point, B: Point, C: Point, D: Point): Point | null {
  // Line AB represented as a1x + b1y = c1
  const a1 = B.y - A.y;
  const b1 = A.x - B.x;
  const c1 = a1 * A.x + b1 * A.y;

  // Line CD represented as a2x + b2y = c2
  const a2 = D.y - C.y;
  const b2 = C.x - D.x;
  const c2 = a2 * C.x + b2 * C.y;

  const determinant = a1 * b2 - a2 * b1;

  if (determinant === 0) {
      // Lines are parallel, might be coincident!
      return null;
  } else {
      const x = (b2 * c1 - b1 * c2) / determinant;
      const y = (a1 * c2 - a2 * c1) / determinant;

      if ((Math.min(A.x, B.x) <= x && x <= Math.max(A.x, B.x)) &&
          (Math.min(A.y, B.y) <= y && y <= Math.max(A.y, B.y)) &&
          (Math.min(C.x, D.x) <= x && x <= Math.max(C.x, D.x)) &&
          (Math.min(C.y, D.y) <= y && y <= Math.max(C.y, D.y))) {
          return { x, y };
      }
  }

  return null;
}

function handlePoly(allPolygons: Array<[number, number][]>, standalonePathString: string, precision: number, maxidx: number, idx: number, withInfo = false) {
  let allPolygonPoints: [number, number][] = [];

  // If it's not the first path, remove the last point of the previous path to prevent overlap
  allPolygonPoints = [];

  // Create SVG path element for the current standalone path string
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><path d='${standalonePathString}' /></svg>`, 'image/svg+xml');
  const pathElement = svgDoc.querySelector('path');


  const pathLength = pathElement.getTotalLength();

  // Calculate the number of points required for the segment based on precision and path length
  const numberOfPoints = Math.max(2, Math.ceil((precision / 100) * pathLength));

  // Ensure the first point is added
  let point = pathElement.getPointAtLength(0);
  //allPolygonPoints.push([point.x, point.y]);

  // Calculate intermediate points for the segment based on the precision
  for (let i = 1; i < numberOfPoints - 1; i++) {
    point = pathElement.getPointAtLength((pathLength / (numberOfPoints - 1)) * i);
    allPolygonPoints.push([point.x, point.y]);
  }

  // Ensure the last point is added
  point = pathElement.getPointAtLength(pathLength);
  allPolygonPoints.push([point.x, point.y]);
  allPolygonPoints.push(allPolygonPoints[0]);

  //allPolygonPoints = simplifyPolygon(allPolygonPoints, 3);
  allPolygons.push(allPolygonPoints);
  //withInfo && mmProgress(`${Math.floor((100/maxidx) * idx)}`);
}

/**
 * Computes the new position of a point after offsetting it perpendicular to its adjacent points.
 * @param prev - The point before the main point.
 * @param p - The main point to offset.
 * @param next - The point after the main point.
 * @param distance - The distance to offset the point.
 * @param outward - Flag to determine outward/inward direction.
 * @returns The new position of the point.
 */
function offsetPoint(prev: Point, p: Point, next: Point, distance: number, outward: boolean = true): Point {
  const perp = perpendicular(prev, p, next, outward);
  // Offset the point by the specified distance in the direction of the perpendicular vector.
  return {
      x: p.x + perp.x * distance,
      y: p.y + perp.y * distance,
  };
}

/**
 * Computes the perpendicular vector for a point relative to its adjacent points.
 * @param p1 - The point before the main point.
 * @param p2 - The main point to compute the perpendicular for.
 * @param p3 - The point after the main point.
 * @param outward - Flag to determine outward/inward direction.
 * @returns The normalized perpendicular vector.
 */
function perpendicular(p1: Point, p2: Point, p3: Point, outward: boolean = true): Point {
  // Get the direction between the first and third points.
  const d = direction(p1, p3);

  // Compute the perpendicular vector by swapping x and y and negating y.
  let perp = {
      x: -d.y,
      y: d.x,
  };

  // Calculate the dot product to check the direction of the perpendicular vector.
  const dot = d.x * (p2.x - p1.x) + d.y * (p2.y - p1.y);

  // Adjust the direction of the perpendicular vector based on the orientation and outward flag.
  if ((dot < 0 && outward) || (dot > 0 && !outward)) {
      perp.x = -perp.x;
      perp.y = -perp.y;
  }

  // Normalize the perpendicular vector to make it unit length.
  const magnitude = Math.sqrt(perp.x ** 2 + perp.y ** 2);
  return {
      x: perp.x / magnitude,
      y: perp.y / magnitude,
  };
}

/**
 * Computes the direction vector between two points.
 * @param p1 - Starting point.
 * @param p2 - Ending point.
 * @returns The direction vector from p1 to p2.
 */
function direction(p1: Point, p2: Point): Point {
  // Compute the difference in x and y coordinates to get the direction.
  return {
      x: p2.x - p1.x,
      y: p2.y - p1.y,
  };
}


