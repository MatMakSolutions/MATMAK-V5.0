import { SvgCommand } from "./SvgCommand";

/**
 * Represents a "C" (cubic Bezier curve) command.
 */

export class CurveCommand extends SvgCommand {
  constructor(
    public x1: number, public y1: number,
    public x2: number, public y2: number,
    public x: number, public y: number,
    relative: boolean = false
  ) {
    super('C', relative);
  }

  previous: { x: number, y: number } = { x: 0, y: 0 };

  getTotalLength(): number {
    // Calculate the length of the curve from teh previous point to the next one with the 2 control points
    // This is an approximation, but it's good enough for our purposes
    const steps = 1000;
    let length = 0;
    let previous = this.previous;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = this.x1 * t * t * t + this.x2 * 3 * t * t * (1 - t) + this.x * (1 - t) * (1 - t) * t;
      const y = this.y1 * t * t * t + this.y2 * 3 * t * t * (1 - t) + this.y * (1 - t) * (1 - t) * t;
      length += Math.sqrt((x - previous.x) * (x - previous.x) + (y - previous.y) * (y - previous.y));
      previous = { x, y };
    }
    return length;
  }

  getPointAtLength(t: number): { x: number; y: number } {
    // Get the total length of the curve.
    const totalLength = this.getTotalLength();

    // Clamp t to the valid range.
    if (t <= 0) {
      return { x: this.previous.x, y: this.previous.y };
    }
    if (t >= totalLength) {
      // Compute the endpoint (u = 1) using the standard Bézier formula.
      return {
        x:
          Math.pow(1 - 1, 3) * this.previous.x +
          3 * Math.pow(1 - 1, 2) * 1 * this.x1 +
          3 * (1 - 1) * Math.pow(1, 2) * this.x2 +
          Math.pow(1, 3) * this.x,
        y:
          Math.pow(1 - 1, 3) * this.previous.y +
          3 * Math.pow(1 - 1, 2) * 1 * this.y1 +
          3 * (1 - 1) * Math.pow(1, 2) * this.y2 +
          Math.pow(1, 3) * this.y,
      };
    }

    const steps = 1000;
    let cumulativeLength = 0;
    let previousPoint = { ...this.previous };
    let currentPoint = previousPoint;

    // Iterate over the curve (from u=0 to u=1) in small steps.
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      // Compute the point on the curve at parameter u.
      currentPoint = {
        x:
          Math.pow(1 - u, 3) * this.previous.x +
          3 * Math.pow(1 - u, 2) * u * this.x1 +
          3 * (1 - u) * Math.pow(u, 2) * this.x2 +
          Math.pow(u, 3) * this.x,
        y:
          Math.pow(1 - u, 3) * this.previous.y +
          3 * Math.pow(1 - u, 2) * u * this.y1 +
          3 * (1 - u) * Math.pow(u, 2) * this.y2 +
          Math.pow(u, 3) * this.y,
      };

      // Calculate the distance from the previous sample point.
      const segmentLength = Math.hypot(
        currentPoint.x - previousPoint.x,
        currentPoint.y - previousPoint.y
      );

      // If the cumulative distance including this segment meets or exceeds t...
      if (cumulativeLength + segmentLength >= t) {
        // Determine how far into this segment our desired point lies.
        const remaining = t - cumulativeLength;
        const segmentFraction = remaining / segmentLength;
        // Linearly interpolate between the previous point and the current point.
        return {
          x: previousPoint.x + segmentFraction * (currentPoint.x - previousPoint.x),
          y: previousPoint.y + segmentFraction * (currentPoint.y - previousPoint.y),
        };
      }
      cumulativeLength += segmentLength;
      previousPoint = currentPoint;
    }

    // In case of rounding errors, return the endpoint.
    return currentPoint;
  }

}
