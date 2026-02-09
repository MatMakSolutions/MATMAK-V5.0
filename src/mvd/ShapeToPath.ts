type SVGShapeAttributes = {
  [key: string]: string | number;
};

export function convertToPath(shape: "rect" | "circle" | "ellipse" | "line" | "polyline" | "path",attributes: SVGShapeAttributes): string | null {
  switch (shape) {
    case 'rect':
      let x      = Number(attributes['x'] || 0);
      let y      = Number(attributes['y'] || 0);
      let width  = Number(attributes['width'] || 0);
      let height = Number(attributes['height'] || 0);
      let rx     = Number(attributes['rx'] || 0);
      let ry     = Number(attributes['ry'] || rx);     // If ry is not provided, use rx

      if (rx || ry) { // Rounded rectangle
        return [
          `M${x + rx},${y}`,
          `h${width - 2 * rx}`,
          `a${rx},${ry} 0 0 1 ${rx},${ry}`,
          `v${height - 2 * ry}`,
          `a${rx},${ry} 0 0 1 -${rx},${ry}`,
          `h-${width - 2 * rx}`,
          `a${rx},${ry} 0 0 1 -${rx},-${ry}`,
          `v-${height - 2 * ry}`,
          `a${rx},${ry} 0 0 1 ${rx},-${ry}`,
          'Z'
        ].join(' ');
      } else { // Regular rectangle
        return `M${x},${y} h${width} v${height} h-${width} Z`;
      }

      case 'circle':
      let cx = Number(attributes['cx'] || 0);
      let cy = Number(attributes['cy'] || 0);
      let r = Number(attributes['r'] || 0);
      let controlPoint = Number((r * 0.5523).toFixed(5));

      return [
        `M${(cx + r).toFixed(5)},${cy.toFixed(5)}`,
        `C${(cx + r).toFixed(5)},${(cy - controlPoint).toFixed(5)} ${(cx + controlPoint).toFixed(5)},${(cy - r).toFixed(5)} ${cx.toFixed(5)},${(cy - r).toFixed(5)}`,
        `C${(cx - controlPoint).toFixed(5)},${(cy - r).toFixed(5)} ${(cx - r).toFixed(5)},${(cy - controlPoint).toFixed(5)} ${(cx - r).toFixed(5)},${cy.toFixed(5)}`,
        `C${(cx - r).toFixed(5)},${(cy + controlPoint).toFixed(5)} ${(cx - controlPoint).toFixed(5)},${(cy + r).toFixed(5)} ${cx.toFixed(5)},${(cy + r).toFixed(5)}`,
        `C${(cx + controlPoint).toFixed(5)},${(cy + r).toFixed(5)} ${(cx + r).toFixed(5)},${(cy + controlPoint).toFixed(5)} ${(cx + r).toFixed(5)},${cy.toFixed(5)}`
      ].join(' ') + 'Z';

      case 'ellipse':
        let ecx = Number(attributes['cx'] || 0);
        let ecy = Number(attributes['cy'] || 0);
        let rxe = Number(attributes['rx'] || 0);
        let rye = Number(attributes['ry'] || 0);
        return [
          `M${ecx + rxe},${ecy}`,
          `C${ecx + rxe},${ecy - (rye * 0.5523)} ${ecx + (rxe * 0.5523)},${ecy - rye} ${ecx},${ecy - rye}`,
          `C${ecx - (rxe * 0.5523)},${ecy - rye} ${ecx - rxe},${ecy - (rye * 0.5523)} ${ecx - rxe},${ecy}`,
          `C${ecx - rxe},${ecy + (rye * 0.5523)} ${ecx - (rxe * 0.5523)},${ecy + rye} ${ecx},${ecy + rye}`,
          `C${ecx + (rxe * 0.5523)},${ecy + rye} ${ecx + rxe},${ecy + (rye * 0.5523)} ${ecx + rxe},${ecy}`
        ].join(' ') + 'Z';
    case 'polyline':
        const points = (attributes['points'] as string || "").trim().split(/\s+|,/).map(Number);

        if (points.length < 4 || points.length % 2 !== 0) {
            console.warn("Invalid points data for polyline");
            return null;
        }

        let pathData = `M${points[0]},${points[1]}`;
        for (let i = 2; i < points.length; i += 2) {
            pathData += ` L${points[i]},${points[i + 1]}`;
        }

        return `${pathData}Z`;
    case 'line':
      let x1 = Number(attributes['x1'] || 0);
      let y1 = Number(attributes['y1'] || 0);
      let x2 = Number(attributes['x2'] || 0);
      let y2 = Number(attributes['y2'] || 0);
      return `M${x1},${y1} L${x2},${y2}Z`;

    case 'path':
      return attributes['d'] as string || null;

    default:
      console.warn(`Unsupported shape type: ${shape}`);
      return null;
  }
}

type Point = { x: number; y: number; };

function quadraticToCubicBezier(p0: Point, p1: Point, p2: Point): [Point, Point, Point, Point] {
    const q0: Point = {
        x: p0.x + (2/3) * (p1.x - p0.x),
        y: p0.y + (2/3) * (p1.y - p0.y)
    };

    const q1: Point = { //
        x: p2.x + (2/3) * (p1.x - p2.x),
        y: p2.y + (2/3) * (p1.y - p2.y)
    };

    return [p0, q0, q1, p2]; // Cubic bezier curve
}

function getLengthAtPoint(path: SVGPathElement, point: SVGPoint, precision: number = 1): number | null {
  const totalLength = path.getTotalLength();
  let closestLength = 0;
  let closestDistance = Infinity;

  for (let len = 0; len <= totalLength; len += precision) {
      const currentPoint = path.getPointAtLength(len);
      const distance = Math.sqrt(Math.pow(currentPoint.x - point.x, 2) + Math.pow(currentPoint.y - point.y, 2));

      if (distance < closestDistance) {
          closestDistance = distance;
          closestLength = len;
      }
  }

  return closestDistance < precision ? closestLength : null;
}
