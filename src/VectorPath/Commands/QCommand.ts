import { format, SvgCommand ,TClosestPointResult} from "./Abstract/SvgCommand";
import { CCommand } from "./CCommand";
import { IPoint } from "../Utils/IPoint";

/**
 * Represents a "Q" (quadratic Bezier curve) command.
 */
export class QCommand extends SvgCommand {
    type: 'Q' = 'Q';

    cx : number;
    cy : number;
    x  : number;
    y  : number;
 ////////////////////////////////////////
private _asCurve(): CCommand {
        const c = this.toCurveCommand();
        c.linkBefore(this.previousCommand);
        return c;
    }

    public getLength(): number { return this._asCurve().getLength(); }
    public getClosestPoint(point: IPoint): TClosestPointResult { return this._asCurve().getClosestPoint(point); }
  //////////////////////////////////////////////////
    //startingPoint : IPoint;
    //controlPoint  : IPoint;
    //endingPoint   : IPoint;

    get controlPoint(): IPoint {
        return { x: this.cx, y: this.cy };
    }

    get endingPoint(): IPoint {
        return {
          x: this.x,
          y: this.y
        };
    }

    updateEndingPoint(point: IPoint): void {
        this.x = point.x;
        this.y = point.y;
    }

    constructor(cx: number, cy: number, x: number, y: number, relative: boolean = false) {
        super(relative);
        this.cx = cx;
        this.cy = cy;
        this.x  = x;
        this.y  = y;

        // Initialize points
        //this.startingPoint = { x: 0, y: 0 };    // Should be set externally
        //this.controlPoint  = { x: cx, y: cy };
        //this.endingPoint   = { x, y };
    }

    /**
     * Sets the starting point for this command.
     */
    //setStartingPoint(point: IPoint): void {
    //    this.startingPoint = point;
    //}

    /**
     * Converts the Q command to an equivalent C (cubic Bezier) command.
     */
  toCurveCommand(): CCommand {

    // Calculate the first control point for the cubic Bézier curve
    const x1 = this.startingPoint.x + (2 / 3) * (this.controlPoint.x - this.startingPoint.x);
    const y1 = this.startingPoint.y + (2 / 3) * (this.controlPoint.y - this.startingPoint.y);

    // Calculate the second control point for the cubic Bézier curve
    const x2 = this.endingPoint.x + (2 / 3) * (this.controlPoint.x - this.endingPoint.x);
    const y2 = this.endingPoint.y + (2 / 3) * (this.controlPoint.y - this.endingPoint.y);


    // Create and return the new CCommand (cubic Bézier) instance
    const res = new CCommand(x1, y1, x2, y2, this.endingPoint.x, this.endingPoint.y, this.relative);
    //res.startingPoint = this.startingPoint;
    //res.endingPoint = this.endingPoint;
    return res;
  }

    toAbsolute(current: IPoint): { cmd: QCommand; endPoint: IPoint } {
      const absX1 = this.relative ? current.x + this.cx : this.cx;
      const absY1 = this.relative ? current.y + this.cy : this.cy;
      const absX  = this.relative ? current.x + this.x  : this.x;
      const absY  = this.relative ? current.y + this.y  : this.y;
      const res = {
        cmd: new QCommand(absX1, absY1, absX, absY, false),
        endPoint: { x: absX, y: absY }
      };
      //res.cmd.startingPoint = this.startingPoint;
      //res.cmd.endingPoint = this.endingPoint;
      //res.cmd.endingPoint.x = absX;
      //res.cmd.endingPoint.y = absY;
      return res;
    }

    toRelative(current: IPoint): { cmd: QCommand; endPoint: IPoint } {
      const abs = this.toAbsolute(current).cmd;
      const relX1 = abs.cx - current.x;
      const relY1 = abs.cy - current.y;
      const relX  = abs.x  - current.x;
      const relY  = abs.y  - current.y;
      const res = {
        cmd: new QCommand(relX1, relY1, relX, relY, true),
        endPoint: { x: abs.x, y: abs.y }
      };
      //res.cmd.startingPoint = this.startingPoint;
      //res.cmd.endingPoint = res.endPoint;
      return res;
    }
    clone(): QCommand {
      return new QCommand(this.cx, this.cy, this.x, this.y, this.relative);
    }

    rotate(origin: IPoint, angle: number) {
      const angleRad = (angle * Math.PI) / 180;

      const rotatePoint = (p: IPoint): IPoint => {
        const dx = p.x - origin.x;
        const dy = p.y - origin.y;
        return {
          x: origin.x + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
          y: origin.y + dx * Math.sin(angleRad) + dy * Math.cos(angleRad),
        };
      };

      //this.startingPoint = rotatePoint(this.startingPoint);
      const controlPoint = rotatePoint({ x: this.cx, y: this.cy });
      const endingPoint = rotatePoint({ x: this.x, y: this.y });

      this.cx = controlPoint.x;
      this.cy = controlPoint.y;
      this.x  = endingPoint.x;
      this.y  = endingPoint.y;
    }

    reverseDirection() {
      // Swap the starting and ending points
      const [startingPoint, endingPoint] = [this.endingPoint, this.startingPoint];

      // Recalculate the control point to maintain curve shape
      const controlPoint = {
        x: 2 * startingPoint.x - this.controlPoint.x,
        y: 2 * startingPoint.y - this.controlPoint.y,
      };

      // Update coordinates
      this.cx = controlPoint.x;
      this.cy = controlPoint.y;
      this.x = endingPoint.x;
      this.y = endingPoint.y;
    }

    getTotalLength(): number {
      const segments = 100; // Number of segments for approximation
      let length = 0;
      let prev = this.startingPoint;

      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const x = (1 - t) * (1 - t) * this.startingPoint.x + 2 * (1 - t) * t * this.controlPoint.x + t * t * this.endingPoint.x;
        const y = (1 - t) * (1 - t) * this.startingPoint.y + 2 * (1 - t) * t * this.controlPoint.y + t * t * this.endingPoint.y;

        length += Math.sqrt((x - prev.x) ** 2 + (y - prev.y) ** 2);
        prev = { x, y };
      }

      return length;
    }

    getPointAtLength(t: number): { x: number; y: number } {
      const totalLength = this.getTotalLength();
      const targetLength = t * totalLength;
      const segments = 100;
      let length = 0;
      let prev = this.startingPoint;

      for (let i = 1; i <= segments; i++) {
        const fraction = i / segments;
        const x = (1 - fraction) * (1 - fraction) * this.startingPoint.x + 2 * (1 - fraction) * fraction * this.controlPoint.x + fraction * fraction * this.endingPoint.x;
        const y = (1 - fraction) * (1 - fraction) * this.startingPoint.y + 2 * (1 - fraction) * fraction * this.controlPoint.y + fraction * fraction * this.endingPoint.y;

        const segmentLength = Math.sqrt((x - prev.x) ** 2 + (y - prev.y) ** 2);
        if (length + segmentLength >= targetLength) {
          const ratio = (targetLength - length) / segmentLength;
          return {
            x: prev.x + ratio * (x - prev.x),
            y: prev.y + ratio * (y - prev.y),
          };
        }
        length += segmentLength;
        prev = { x, y };
      }

      return { x: prev.x, y: prev.y };
    }

    translate(x: number, y: number) {
      this.cx += x;
      this.cy += y;
      this.x += x;
      this.y += y;
      //this.controlPoint.x = this.cx;
      //this.controlPoint.y = this.cy;
      //this.endingPoint.x = this.x;
      //this.endingPoint.y = this.y;
    }

    scale(s: number) {
      this.cx *= s;
      this.cy *= s;
      this.x *= s;
      this.y *= s;
      //this.controlPoint.x = this.cx;
      //this.controlPoint.y = this.cy;
      //this.endingPoint.x = this.x;
      //this.endingPoint.y = this.y;
    }

    split(point: IPoint, step: number = 0.01): [QCommand, QCommand] {
      let closestT = 0;
      let minDist = Infinity;

      for (let t = 0; t <= 1; t += step) {
        const p = this.getPointAtLength(t);
        const dist = Math.hypot(point.x - p.x, point.y - p.y);
        if (dist < minDist) {
          minDist = dist;
          closestT = t;
        }
      }

      const mid = this.getPointAtLength(closestT);
      const first = new QCommand(this.cx, this.cy, mid.x, mid.y, this.relative);
      const second = new QCommand(this.cx, this.cy, this.x, this.y, this.relative);

      //first.startingPoint = this.startingPoint;
      //first.endingPoint = mid;
      //second.startingPoint = mid;
      //second.endingPoint = this.endingPoint;

      return [first, second];
    }

    getNearestPoint(point: IPoint, step: number): [IPoint, number] {
      let nearestPoint: IPoint = this.startingPoint;
      let minDistance = Infinity;

      for (let t = 0; t <= 1; t += step) {
        const bezierPoint = {
          x: Math.pow(1 - t, 2) * this.startingPoint.x +
             2 * (1 - t) * t * this.controlPoint.x +
             Math.pow(t, 2) * this.endingPoint.x,
          y: Math.pow(1 - t, 2) * this.startingPoint.y +
             2 * (1 - t) * t * this.controlPoint.y +
             Math.pow(t, 2) * this.endingPoint.y,
        };

        const distance = Math.hypot(point.x - bezierPoint.x, point.y - bezierPoint.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = bezierPoint;
        }
      }

      return [nearestPoint, minDistance];
    }

    toString(): string {
      return `${this.relative ? 'q' : 'Q'} ${format(this.cx)} ${format(this.cy)}, ${format(this.x)} ${format(this.y)}`;
    }


}

