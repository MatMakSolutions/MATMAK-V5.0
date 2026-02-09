import { IPoint } from "../Utils/IPoint";
import { format, SvgCommand, TCommandLetter ,TClosestPointResult} from "./Abstract/SvgCommand";

/**
 * Represents a "C" (cubic Bezier curve) command.
 */

export class CCommand extends SvgCommand {
  type: 'C' = 'C';
/////////////////////////////////////////////////////
public getLength(): number {
    return this.getLookupTable()[this.getLookupTable().length - 1].length;
  }

  // Corrected Method
  public getClosestPoint(point: IPoint): TClosestPointResult {
    const table = this.getLookupTable();
    let nearestPoint: IPoint = { x: 0, y: 0 };
    let minDistance = Infinity;
    let distanceOnSegment = 0;
    let t = 0;

    for (const sample of table) {
      const dist = Math.hypot(point.x - sample.x, point.y - sample.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearestPoint = { x: sample.x, y: sample.y };
        distanceOnSegment = sample.length;
        t = sample.t;
      }
    }
    return { t, point: nearestPoint, distance: minDistance, distanceOnSegment };
  }
////////////////////////////////////////////////////////
  //startingPoint: { x: number, y: number } = { x: 0, y: 0 };
  //endingPoint: { x: number, y: number } = { x: 0, y: 0 };

  get endingPoint(): IPoint {
    return {
      x: this.x,
      y: this.y,
    } as IPoint;
  }

  updateEndingPoint(point: IPoint): void {
    this.x = point.x;
    this.y = point.y;
  }

  //controlPoint1: { x: number, y: number } = { x: 0, y: 0 };
  //controlPoint2: { x: number, y: number } = { x: 0, y: 0 };

  get controlPoint1(): IPoint {
    return {
      x: this.x1,
      y: this.y1,
    } as IPoint;
  }

  get controlPoint2(): IPoint {
    return {
      x: this.x2,
      y: this.y2,
    } as IPoint;
  }


  constructor(
    public x1: number, public y1: number,
    public x2: number, public y2: number,
    public x: number, public y: number,
    relative: boolean = false
  ) {
    super(relative);
    //this.controlPoint1  = { x: x1, y: y1 };
    //this.controlPoint2  = { x: x2, y: y2 };
  }

  /**
     * Instead of "getPreviousControlPoint()", we define a helper to get
     * the correct start anchor (the previous command’s end anchor).
     */
  private getStartAnchor(): IPoint {
    // If there's a previous command, use its end anchor:
    if (this.previousCommand) {
      return this.previousCommand.endingPoint;
    }
    // Otherwise, fallback (e.g., first command in path). Adjust as needed.
    return { x: 0, y: 0 };
  }

  /**
   * Returns the arc length of this cubic segment by sampling.
   */
  getTotalLength(): number {
    const table = this.getLookupTable();
    // The total length is the last sample's length.
    return table[table.length - 1].length;
  }


  /**
   * Returns the point on the curve at a specified distance along the arc.
   */
  getPointAtLength(length: number): IPoint {
    const totalLength = this.getTotalLength();

    let lengthToNearest = 0;
    const table = this.getLookupTable();

    // Find the two points that the distance lies between.
    let prev = table[0];
    for (let i = 1; i < table.length; i++) {
      const current = table[i];
      if (current.length >= length) {
        const ratio = (length - lengthToNearest) / (current.length - prev.length);
        return {
          x: prev.x + ratio * (current.x - prev.x),
          y: prev.y + ratio * (current.y - prev.y),
        };
      }
      lengthToNearest = current.length;
      prev = current;
    }

    // Fallback if we somehow missed the endpoint:
    return { x: this.x, y: this.y };


    /*return;

    // Identify the four points again:
    const P0 = this.getStartAnchor();
    const P1 = { x: this.x1, y: this.y1 };
    const P2 = { x: this.x2, y: this.y2 };
    const P3 = { x: this.x,  y: this.y  };

    if (distance <= 0) return P0;
    if (distance >= totalLength) return P3;

    const steps = 1000;
    let cumulative = 0;
    let prev = P0;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const current = {
        x: (1 - t)**3 * P0.x
           + 3 * (1 - t)**2 * t * P1.x
           + 3 * (1 - t) * t**2 * P2.x
           + t**3 * P3.x,
        y: (1 - t)**3 * P0.y
           + 3 * (1 - t)**2 * t * P1.y
           + 3 * (1 - t) * t**2 * P2.y
           + t**3 * P3.y,
      };

      const segmentLen = Math.hypot(
        current.x - prev.x,
        current.y - prev.y
      );
      if (cumulative + segmentLen >= distance) {
        const remain = distance - cumulative;
        const ratio = remain / segmentLen;
        return {
          x: prev.x + ratio * (current.x - prev.x),
          y: prev.y + ratio * (current.y - prev.y),
        };
      }
      cumulative += segmentLen;
      prev = current;
    }

    // Fallback if floating‑point steps miss the endpoint:
    return P3;*/
  }

  /**
   * Example "nearest point" approach: sample along arc length.
   */
  getNearestPoint(point: IPoint, step?: number): [IPoint, number, number] {
    // We ignore the step parameter now since our lookup table provides fixed samples.
    let lengthToNearest = 0;
    const table = this.getLookupTable();
    let nearestPoint = { x: table[0].x, y: table[0].y };
    let minDistance = Infinity;

    for (const sample of table) {
      const dx = point.x - sample.x;
      const dy = point.y - sample.y;
      const distance = Math.hypot(dx, dy);
      if (distance < minDistance) {
        lengthToNearest = sample.length;
        minDistance = distance;
        nearestPoint = { x: sample.x, y: sample.y };
      }
    }
    return [nearestPoint, minDistance, lengthToNearest];
  }



  toAbsolute(current: IPoint): { cmd: CCommand; endPoint: IPoint } {
    const absX1 = this.relative ? current.x + this.x1 : this.x1;
    const absY1 = this.relative ? current.y + this.y1 : this.y1;
    const absX2 = this.relative ? current.x + this.x2 : this.x2;
    const absY2 = this.relative ? current.y + this.y2 : this.y2;
    const absX = this.relative ? current.x + this.x : this.x;
    const absY = this.relative ? current.y + this.y : this.y;
    const res = {
      cmd: new CCommand(absX1, absY1, absX2, absY2, absX, absY, false),
      endPoint: { x: absX, y: absY }
    };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //res.cmd.endingPoint.x = absX;
    //res.cmd.endingPoint.y = absY;
    return res;
  }

  toRelative(current: IPoint): { cmd: CCommand; endPoint: IPoint } {
    // Convert to absolute first, then compute relative differences.
    const abs = this.toAbsolute(current).cmd;
    const relX1 = abs.x1 - current.x;
    const relY1 = abs.y1 - current.y;
    const relX2 = abs.x2 - current.x;
    const relY2 = abs.y2 - current.y;
    const relX = abs.x - current.x;
    const relY = abs.y - current.y;
    const res = {
      cmd: new CCommand(relX1, relY1, relX2, relY2, relX, relY, true),
      endPoint: { x: abs.x, y: abs.y }
    };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint.x = abs.x;
    //res.cmd.endingPoint.y = abs.y;
    return res;
  }
  clone(): CCommand {
    return new CCommand(this.x1, this.y1, this.x2, this.y2, this.x, this.y, this.relative);
  }


  rotate(origin: IPoint, angle: number) {
    const angleRad = (angle * Math.PI) / 180; // Convert degrees to radians

    const rotatePoint = (p: IPoint): IPoint => {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      return {
        x: origin.x + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: origin.y + dx * Math.sin(angleRad) + dy * Math.cos(angleRad),
      };
    };

    //this.startingPoint = rotatePoint(this.startingPoint);
    const newPoint = rotatePoint(this.endingPoint);
    //this.endingPoint.x = newPoint.x;
    //this.endingPoint.y = newPoint.y;
    const newControlPoint1 = rotatePoint(this.controlPoint1);
    const newControlPoint2 = rotatePoint(this.controlPoint2);

    this.x1 = newControlPoint1.x;
    this.y1 = newControlPoint1.y;
    this.x2 = newControlPoint2.x;
    this.y2 = newControlPoint2.y;
    this.x = newPoint.x;
    this.y = newPoint.y;
  }

  reverseDirection() {
    // Swap the start and end points
    //[this.startingPoint, this.endingPoint] = [this.endingPoint, this.startingPoint];
    //const intermediate = this.startingPoint;
    //this.startingPoint = this.endingPoint;
    //this.endingPoint.x = intermediate.x;
    //this.endingPoint.y = intermediate.y;

    // Swap the control points
    const [controlPoint1, controlPoint2] = [this.controlPoint2, this.controlPoint1];

    // Update coordinates
    this.x1 = controlPoint1.x;
    this.y1 = controlPoint1.y;
    this.x2 = controlPoint2.x;
    this.y2 = controlPoint2.y;
    //this.x = this.endingPoint.x;
    //this.y = this.endingPoint.y;
  }

  split(length: number): { left: CCommand; right: CCommand } {
    // Get the lookup table (which maps parameter t to cumulative arc length)
    const table = this.getLookupTable();
    const totalLength = table[table.length - 1].length;

    // If the requested length is at or beyond the end, just return the entire curve as left,
    // and an empty right segment (or handle as you see fit)
    if (length >= totalLength) {
      // Here, right segment is just a degenerate curve at the end point.
      const left = this.clone();
      const right = new CCommand(0, 0, 0, 0, this.x, this.y, this.relative);
      return { left, right };
    }

    // Find the correct parameter t by interpolating in the lookup table
    let tValue = 0;
    for (let i = 1; i < table.length; i++) {
      if (table[i].length >= length) {
        const tPrev = table[i - 1].t;
        const tCurr = table[i].t;
        const lenPrev = table[i - 1].length;
        const lenCurr = table[i].length;
        const ratio = (length - lenPrev) / (lenCurr - lenPrev);
        tValue = tPrev + ratio * (tCurr - tPrev);
        break;
      }
    }

    // Use the correct start anchor instead of "this.startingPoint"
    const p0 = this.getStartAnchor();
    const p1 = { x: this.x1, y: this.y1 };
    const p2 = { x: this.x2, y: this.y2 };
    const p3 = this.endingPoint;

    // Helper for linear interpolation between two points.
    const splitPoint = (pA: IPoint, pB: IPoint, t: number): IPoint => ({
      x: pA.x + (pB.x - pA.x) * t,
      y: pA.y + (pB.y - pA.y) * t,
    });

    // De Casteljau's algorithm using the computed tValue:
    const p01 = splitPoint(p0, p1, tValue);
    const p12 = splitPoint(p1, p2, tValue);
    const p23 = splitPoint(p2, p3, tValue);

    const p012 = splitPoint(p01, p12, tValue);
    const p123 = splitPoint(p12, p23, tValue);

    const p0123 = splitPoint(p012, p123, tValue); // This is the split point

    // Create left segment from p0 to p0123.
    const left = new CCommand(
      p01.x, p01.y,
      p012.x, p012.y,
      p0123.x, p0123.y,
      this.relative
    );

    // Create right segment from p0123 to p3.
    const right = new CCommand(
      p123.x, p123.y,
      p23.x, p23.y,
      p3.x, p3.y,
      this.relative
    );

    return { left, right };
  }




  translate(x: number, y: number) {
    this.x1 += x;
    this.y1 += y;
    this.x2 += x;
    this.y2 += y;
    this.x += x;
    this.y += y;
    //this.controlPoint1.x = this.x1;
    //this.controlPoint1.y = this.y1;
    //this.controlPoint2.x = this.x2;
    //this.controlPoint2.y = this.y2;
    //this.endingPoint.x = this.x;
    //this.endingPoint.y = this.y;
    //if (this._previousCommand?.endingPoint?.x  !== this.startingPoint.x ) {
    //}
  }

  scale(s: number): void {
    this.x1 *= s;
    this.y1 *= s;
    this.x2 *= s;
    this.y2 *= s;
    this.x *= s;
    this.y *= s;
    //this.controlPoint1.x = this.x1;
    //this.controlPoint1.y = this.y1;
    //this.controlPoint2.x = this.x2;
    //this.controlPoint2.y = this.y2;
    //this.endingPoint.x = this.x;
    //this.endingPoint.y = this.y;
  }
  
  scaleXY(sx: number, sy: number): void {
    this.x1 *= sx;
    this.y1 *= sy;
    this.x2 *= sx;
    this.y2 *= sy;
    this.x *= sx;
    this.y *= sy;
  }

  toString(): string {
    return `${this.relative ? 'c' : 'C'} ${format(this.x1)} ${format(this.y1)}, ${format(this.x2)} ${format(this.y2)}, ${format(this.x)} ${format(this.y)}`;
  }

  private _lookupTable: { t: number; x: number; y: number; length: number }[] | null = null;

  private buildLookupTable(steps: number = 1000): { t: number; x: number; y: number; length: number }[] {
    const table = [] as { t: number; x: number; y: number; length: number }[];
    let cumulativeLength = 0;
    const P0 = this.getStartAnchor();         // starting point
    const P1 = { x: this.x1, y: this.y1 };    // control point 1
    const P2 = { x: this.x2, y: this.y2 };    // control point 2
    const P3 = { x: this.x, y: this.y };      // ending point

    // Start with the first sample.
    table.push({ t: 0, x: P0.x, y: P0.y, length: 0 });
    let prev = P0;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const current = {
        x: (1 - t) ** 3 * P0.x +           // cubic Bezier formula
          3 * (1 - t) ** 2 * t * P1.x +    // (see https://en.wikipedia.org/wiki/B%C3%A9zier_curve)
          3 * (1 - t) * t ** 2 * P2.x +
          t ** 3 * P3.x,
        y: (1 - t) ** 3 * P0.y +
          3 * (1 - t) ** 2 * t * P1.y +
          3 * (1 - t) * t ** 2 * P2.y +
          t ** 3 * P3.y,
      };
      cumulativeLength += Math.hypot(current.x - prev.x, current.y - prev.y);
      table.push({ t, x: current.x, y: current.y, length: cumulativeLength });
      prev = current;
    }
    this._lookupTable = table;
    return table;
  }

  private getLookupTable(): { t: number; x: number; y: number; length: number }[] {
    // Build table if not yet built.
    return this._lookupTable || this.buildLookupTable();
  }
}
