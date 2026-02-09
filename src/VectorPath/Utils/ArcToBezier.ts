/**
 * Based on the JS version from Colin Meinke's
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
 * OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Ported to TypeScript by: Ampla Network
 */
const TAU = Math.PI * 2;

interface Point {
  x : number;
  y : number;
}

/**
 * Arc parameters.
 */
interface ArcParams {
  px             : number; // Start point x
  py             : number; // Start point y
  cx             : number; // Center point x
  cy             : number; // Center point y
  rx             : number; // Radius x
  ry             : number; // Radius y
  xAxisRotation ?: number; // Rotation angle - 0 to 360 degrees
  largeArcFlag  ?: number; // Large arc flag - 0 or 1
  sweepFlag     ?: number; // Sweep flag - 0 or 1
}

/**
 * Cubic Bézier segment.
 */
interface CubicBezierSegment {
  x1 : number; // Control point 1 x
  y1 : number; // Control point 1 y
  x2 : number; // Control point 2 x
  y2 : number; // Control point 2 y
  x  : number; // End point x
  y  : number; // End point y
}

/**
 * Maps a unit circle point to an ellipse.
 */
const mapToEllipse = (
  point   : Point,  // Point to map
  rx      : number, // Radius x
  ry      : number, // Radius y
  cosphi  : number, // Cosine of rotation angle - 0 to 1
  sinphi  : number, // Sine of rotation angle - 0 to 1
  centerx : number, // Center point x
  centery : number  // Center point y
): Point => {
  return {
    x: cosphi * (point.x * rx) - sinphi * (point.y * ry) + centerx,
    y: sinphi * (point.x * rx) + cosphi * (point.y * ry) + centery,
  };
};

/**
 * Approximates a unit arc segment using a cubic Bézier curve.
 */
const approxUnitArc = (ang1: number, ang2: number): [Point, Point, Point] => {
  const a = (4 / 3) * Math.tan(ang2 / 4);

  return [
    // Formula - Cos(ang1) - Sin(ang1) * a, Sin(ang1) + Cos(ang1) * a
    { x: Math.cos(ang1) - Math.sin(ang1) * a, y: Math.sin(ang1) + Math.cos(ang1) * a },
    // Formula - Cos(ang1 + ang2) + Sin(ang1 + ang2) * a, Sin(ang1 + ang2) - Cos(ang1 + ang2) * a
    { x: Math.cos(ang1 + ang2) + Math.sin(ang1 + ang2) * a, y: Math.sin(ang1 + ang2) - Math.cos(ang1 + ang2) * a },
    // Formula - Cos(ang1 + ang2), Sin(ang1 + ang2)
    { x: Math.cos(ang1 + ang2), y: Math.sin(ang1 + ang2) },
  ];
};

/**
 * Computes the angle between two vectors.
 */
const vectorAngle = (ux: number, uy: number, vx: number, vy: number): number => {
  // Formula - ux * vy - uy * vx < 0 ? -1 : 1
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  // Formula - Max(-1, Min(1, ux * vx + uy * vy))
  let dot = Math.max(-1, Math.min(1, ux * vx + uy * vy)); // Clamp to [-1, 1]
  return sign * Math.acos(dot);
};

/**
 * Computes the center and angles of an arc.
 */
const getArcCenter = (
  px           : number, // Start point x
  py           : number, // Start point y
  cx           : number, // Center point x
  cy           : number, // Center point y
  rx           : number, // Radius x
  ry           : number, // Radius y
  largeArcFlag : number, // Large arc flag - 0 or 1
  sweepFlag    : number, // Sweep flag - 0 or 1
  sinphi       : number, // Sine of rotation angle - 0 to 1
  cosphi       : number, // Cosine of rotation angle - 0 to 1
  pxp          : number, // Start point x relative to center
  pyp          : number // Start point y relative to center
): [number, number, number, number] => {
  const rxsq  = rx  ** 2;
  const rysq  = ry  ** 2;
  const pxpsq = pxp ** 2;
  const pypsq = pyp ** 2;

  // Formula : Radicant = (Rx^2 * Ry^2 - Rx^2 * Py'^2 - Ry^2 * Px'^2) / (Rx^2 * Py'^2 + Ry^2 * Px'^2)
  let radicant = rxsq * rysq - rxsq * pypsq - rysq * pxpsq;
  // Frmula : Radicant = Radicant / (Rx^2 * Py'^2 + Ry^2 * Px'^2)
  radicant = radicant < 0 ? 0 : Math.sqrt(radicant / (rxsq * pypsq + rysq * pxpsq)) * (largeArcFlag === sweepFlag ? -1 : 1);

  const centerxp = (radicant * rx * pyp) / ry;  // Center x relative to start point
  const centeryp = (radicant * -ry * pxp) / rx; // Center y relative to start point

  const centerx = cosphi * centerxp - sinphi * centeryp + (px + cx) / 2; // Center x
  const centery = sinphi * centerxp + cosphi * centeryp + (py + cy) / 2; // Center y

  const vx1 = (pxp - centerxp) / rx;  // Start point x relative to center
  const vy1 = (pyp - centeryp) / ry;  // Start point y relative to center
  const vx2 = (-pxp - centerxp) / rx; // End point x relative to center
  const vy2 = (-pyp - centeryp) / ry; // End point y relative to center

  let ang1 = vectorAngle(1, 0, vx1, vy1);       // Angle 1
  let ang2 = vectorAngle(vx1, vy1, vx2, vy2);   // Angle 2

  if (sweepFlag === 0 && ang2 > 0) ang2 -= TAU; // If sweep flag is 0 and angle 2 is greater than 0
  if (sweepFlag === 1 && ang2 < 0) ang2 += TAU; // If sweep flag is 1 and angle 2 is less than 0

  return [centerx, centery, ang1, ang2];
};

/**
 * Converts an arc to Bézier curves.
 */
const arcToBezier = (params: ArcParams): CubicBezierSegment[] => {
  let { px, py, cx, cy, rx, ry, xAxisRotation = 0, largeArcFlag = 0, sweepFlag = 0 } = params;
  const curves: CubicBezierSegment[] = [];

  if (rx === 0 || ry === 0) return [];

  const sinphi = Math.sin((xAxisRotation * TAU) / 360); // Sin of rotation angle - 0 to 1
  const cosphi = Math.cos((xAxisRotation * TAU) / 360); // Cos of rotation angle - 0 to 1

  const pxp = (cosphi * (px - cx)) / 2 + (sinphi * (py - cy)) / 2; // Start point x relative to center
  const pyp = (-sinphi * (px - cx)) / 2 + (cosphi * (py - cy)) / 2; // Start point y relative to center

  if (pxp === 0 && pyp === 0) return []; // No curves

  rx = Math.abs(rx); // Absolute radius x
  ry = Math.abs(ry); // Absolute radius y

  const lambda = (pxp ** 2) / (rx ** 2) + (pyp ** 2) / (ry ** 2); // Lambda
  if (lambda > 1) { // If lambda is greater than 1
    rx *= Math.sqrt(lambda); // Multiply radius x by square root of lambda
    ry *= Math.sqrt(lambda); // Multiply radius y by square root of lambda
  }

  // Get the center and angles of the arc
  let [centerx, centery, ang1, ang2] = getArcCenter(px, py, cx, cy, rx, ry, largeArcFlag, sweepFlag, sinphi, cosphi, pxp, pyp);

  // Approximate the arc using cubic Bézier curves
  let ratio = Math.abs(ang2) / (TAU / 4);
  if (Math.abs(1.0 - ratio) < 0.0000001) { // If the ratio is close to 1
    ratio = 1.0;
  }

  const segments = Math.max(Math.ceil(ratio), 1); // Number of segments for approximation
  ang2 /= segments; // Divide the angle by the number of segments

  for (let i = 0; i < segments; i++) {
    const [p1, p2, p3] = approxUnitArc(ang1, ang2); // Approximate the unit arc
    ang1 += ang2;

    // Convert to actual ellipse coordinates
    const { x: x1, y: y1 } = mapToEllipse(p1, rx, ry, cosphi, sinphi, centerx, centery); // Control point 1
    const { x: x2, y: y2 } = mapToEllipse(p2, rx, ry, cosphi, sinphi, centerx, centery); // Control point 2
    const { x, y }         = mapToEllipse(p3, rx, ry, cosphi, sinphi, centerx, centery); // End point

    // Correctly assign to a CubicBezierSegment object
    curves.push({ x1, y1, x2, y2, x, y });
  }

  return curves;
};

export default arcToBezier;
