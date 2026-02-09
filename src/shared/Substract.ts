import paper from 'paper';
import {Pattern} from "../Pattern/Pattern";
import { IPoint } from "src/VectorPath/Utils/IPoint";
                                                                                                                                                                                                                                                              // Create and append a canvas to the document so you can see the results.
                                                                                                                                                                                                                                                              const canvas = document.createElement('canvas');
                                                                                                                                                                                                                                                              canvas.width = 500;
                                                                                                                                                                                                                                                              canvas.height = 500;
                                                                                                                                                                                                                                                              document.body.appendChild(canvas);
                                                                                                                                                                                                                                                              paper.setup(canvas);

/**
 * Converts a line segment into a closed rectangular path with a given thickness.
 * This allows the line to be used in boolean operations.
 * @param start - The starting point of the line.
 * @param end - The ending point of the line.
 * @param thickness - The desired thickness of the line.
 * @returns A Paper.js Path representing a thin rectangle.
 */
export function createLineRectangle(start: paper.Point, end: paper.Point, thickness: number): paper.Path {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) {
    throw new Error("Zero length line");
  }
  // Compute a perpendicular offset based on thickness.
  const offsetX = (-dy / length) * (thickness / 2);
  const offsetY = (dx / length) * (thickness / 2);

  // Define the four corners of the rectangle.
  const p1 = new paper.Point(start.x + offsetX, start.y + offsetY);
  const p2 = new paper.Point(end.x + offsetX, end.y + offsetY);
  const p3 = new paper.Point(end.x - offsetX, end.y - offsetY);
  const p4 = new paper.Point(start.x - offsetX, start.y - offsetY);

  const rect = new paper.Path([p1, p2, p3, p4]);
  rect.closed = true;
  //rect.strokeColor = 'red';
  //rect.fillColor = 'rgba(255,0,0,0.3)';
  return rect;
}

/**
 * Converts a curved path (quadratic bezier) into a closed path with a given thickness.
 * This allows the curve to be used in boolean operations.
 * @param start - The starting point of the curve.
 * @param control - The control point of the quadratic bezier curve.
 * @param end - The ending point of the curve.
 * @param thickness - The desired thickness of the curve.
 * @returns A Paper.js Path representing a thin curved shape.
 */
export function createCurvedRectangle(start: paper.Point, control: paper.Point, end: paper.Point, thickness: number): paper.Path {
  // Create the main curve
  const curve = new paper.Path();
  curve.moveTo(start);
  curve.quadraticCurveTo(control, end);
  
  // Sample points along the curve to create parallel curves
  const numSamples = 50; // Number of points to sample along the curve
  const topPoints: paper.Point[] = [];
  const bottomPoints: paper.Point[] = [];
  
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const point = curve.getPointAt(curve.length * t);
    
    // Calculate tangent at this point
    const tangent = curve.getTangentAt(curve.length * t);
    const normal = new paper.Point(-tangent.y, tangent.x);
    normal.length = thickness / 2;
    
    topPoints.push(point.add(normal));
    bottomPoints.push(point.subtract(normal));
  }
  
  // Create closed path from the sampled points
  const path = new paper.Path();
  path.moveTo(topPoints[0]);
  for (let i = 1; i < topPoints.length; i++) {
    path.lineTo(topPoints[i]);
  }
  for (let i = bottomPoints.length - 1; i >= 0; i--) {
    path.lineTo(bottomPoints[i]);
  }
  path.closePath();
  
  return path;
}

export function splitPattern(pattern: typeof Pattern, point1: IPoint, point2: IPoint, isNested = false, parent: typeof Pattern = null, isCurved: boolean = false, curveDepth: number = 0): string[] {
  (window as any).noAction = false;
  // get the path
  const path = pattern._vector.generatePathString();
  // put back points to local measure
  const splitPoint1  = {
    x: pattern.unZoomed(point1.x - (isNested ? parent.x : pattern.x)),
    y: pattern.unZoomed(point1.y - (isNested ? parent.y : pattern.y))
  };

  const splitPoint2  = {
    x: pattern.unZoomed(point2.x - (isNested ? parent.x : pattern.x)),
    y: pattern.unZoomed(point2.y - (isNested ? parent.y : pattern.y))
  };


    const importedItem = new paper.Path(path);
    if (!(importedItem instanceof paper.Path)) {
      console.error('Imported SVG is not a path');
    }
    const svgPath = importedItem as paper.Path;

    const lineStart = new paper.Point(splitPoint1.x, splitPoint1.y);
    const lineEnd = new paper.Point(splitPoint2.x, splitPoint2.y);
    const lineThickness = 0.01;

    // Create the rectangle that represents the line or curve
    let cutPath: paper.Path;
    if (isCurved && curveDepth !== 0) {
      // Create curved path
      const midX = (lineStart.x + lineEnd.x) / 2;
      const midY = (lineStart.y + lineEnd.y) / 2;
      // curveDepth is in pattern space (mm), convert from screen pixels if needed
      // Since curveDepth comes from config and should be in mm, we use it directly
      // (The preview scales it with zoom, so here we work with the mm value)
      const controlPoint = new paper.Point(midX, midY + curveDepth);
      cutPath = createCurvedRectangle(lineStart, controlPoint, lineEnd, lineThickness);
    } else {
      // Create straight line rectangle
      cutPath = createLineRectangle(lineStart, lineEnd, lineThickness);
    }

    const subtracted = svgPath.subtract(cutPath);
    if (!subtracted) {
      console.error('Subtraction failed or resulted in null');
    }

    let pieces: paper.Path[];
      if (subtracted instanceof paper.CompoundPath) {
      pieces = subtracted.children as paper.Path[];
    } else if (subtracted instanceof paper.Path) {
      pieces = [subtracted];
    } else {
      pieces = [];
    }

    console.log("Original path data:", pieces);

    return pieces.map((piece, index) => {
      return piece.pathData;
    });
}

export function getPolygonDefinition(path: string, precision = true) {
  const pPath = new paper.Path(path);
  const points = [] as { x: number, y: number }[];

  pPath.curves.forEach(curve => {
    points.push(curve.getPointAtTime(0));
    precision && points.push(curve.getPointAtTime(0.5));
    points.push(curve.getPointAtTime(1));
  });

  points.push(pPath.lastSegment.point);
  return points;
}


function main() {
  // Define your original SVG path data (it must be a closed shape)
  const svgPathData = 'M314.144 208.533 250 50 450 100C517.39 178.541 353.709 163.545 393.592 221.934L273.942 285.109 474.954 245.545 250 450 52.829 165.14 214.596 292.129C151.2073 138.551 208.852 79.949 258.308 155.568Z';
  const importedItem = new paper.Path(svgPathData);
  if (!(importedItem instanceof paper.Path)) {
    console.error('Imported SVG is not a path');
  }
  const svgPath = importedItem as paper.Path;
  //svgPath.strokeColor = 'black';
  //svgPath.fillColor = 'rgba(200,200,200,0.5)';

  // Define the line endpoints and thickness.
  const lineStart = new paper.Point(0, 500);
  const lineEnd = new paper.Point(500, 0);
  const lineThickness = 0.01;

  // Create the rectangle that represents the line.
  const lineRect = createLineRectangle(lineStart, lineEnd, lineThickness);
  //lineRect.strokeColor = 'blue';
  //lineRect.fillColor = 'rgba(0,255,0,0.3)';

  // Subtract the line rectangle from the original SVG shape.
  const subtracted = svgPath.subtract(lineRect);
  if (!subtracted) {
    console.error('Subtraction failed or resulted in null');
  }

  // Extract individual pieces from the result.
  // If the result is a CompoundPath, its children represent separate cut pieces.
  let pieces: paper.Path[];
  if (subtracted instanceof paper.CompoundPath) {
  pieces = subtracted.children as paper.Path[];
} else if (subtracted instanceof paper.Path) {
  pieces = [subtracted];
} else {
  pieces = [];
}

// Optional: Style each resulting piece with random colors for clarity.
pieces.forEach((piece, index) => {
  piece.strokeColor = new paper.Color(Math.random(), Math.random(), Math.random());
  piece.fillColor = new paper.Color(Math.random(), Math.random(), Math.random(), 0.5);
});

console.log("Original path data:", svgPathData);

// Log each resulting piece's SVG string if needed.
pieces.forEach((piece, index) => {
  console.log(`Piece ${index}:`, piece.pathData);
});

}