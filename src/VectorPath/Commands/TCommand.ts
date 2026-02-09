import { format, SvgCommand,TClosestPointResult } from "./Abstract/SvgCommand";
import { QCommand } from "./QCommand";
import { IPoint } from "../Utils/IPoint";
import { CCommand } from "./CCommand";

/**
 * Represents a "T" (smooth quadratic Bézier curve) command.
 */
export class TCommand extends SvgCommand {
  type: 'T' = 'T';

  x: number;
  y: number;
  x1: number;
  y1: number;
 ////////////////////////////////////////
private _asCurve(): CCommand {
      const quad = this.toQuadCurveCommand();
      quad.linkBefore(this.previousCommand);
      const curve = quad.toCurveCommand();
      curve.linkBefore(this.previousCommand);
      return curve;
  }

  public getLength(): number {
    return this._asCurve().getLength();
  }

  public getClosestPoint(point: IPoint): TClosestPointResult {
    return this._asCurve().getClosestPoint(point);
  }
  //////////////////////////////////////////////////
  //startingPoint: IPoint = { x: 0, y: 0 };
  //controlPoint: IPoint = { x: 0, y: 0 }; // Automatically calculated as the reflection of the previous control point.
  //endingPoint: IPoint = { x: 0, y: 0 };
  get previousControlPoint(): IPoint {
    return this.getPreviousControlPoint();
  }

  get endingPoint(): IPoint {
    return { x: this.x, y: this.y };
  }

  updateEndingPoint(point: IPoint): void {
    this.x = point.x;
    this.y = point.y;
  }

  get controlPoint(): IPoint {
    return this.controlPoint;
  }

  constructor(x: number, y: number, relative: boolean = false, previousCommand?: SvgCommand) {
    super(relative);
    this.x = x;
    this.y = y;
    this.x1 = x; // Not sure if this is correct
    this.y1 = y;
    if (previousCommand instanceof QCommand || previousCommand instanceof TCommand) {
      //this.startingPoint = previousCommand.endingPoint;
      this.x = x;
      this.y = y;
      //this.previousControlPoint = {
       // x: previousCommand.controlPoint.x,
       // y: previousCommand.controlPoint.y,
      //}
    }
    this.calculateReflectedControlPoint();
  }

  /**
   * Sets the starting point for the command.
   * This is required to calculate the reflected control point.
   */
  //setStartingPoint(point: IPoint): void {
  //  this.startingPoint = point;
  //}

  /**
   * Calculates the reflected control point from the previous control point.
   * If there is no previous control point, it uses the starting point as the reflection.
   */
  calculateReflectedControlPoint(): void {
    if (this.previousControlPoint) {
      const controlPoint = {
        x: 2 * this.startingPoint.x - this.previousControlPoint.x,
        y: 2 * this.startingPoint.y - this.previousControlPoint.y,
      };
      this.x1 = controlPoint.x;
      this.y1 = controlPoint.y;
    } else {
      this.x1 = this.startingPoint.x;
      this.y1 = this.startingPoint.y;
    }
  }

  /**
   * Converts the T command to an equivalent Q (quadratic Bézier) command.
   */
  toQuadCurveCommand(): QCommand {
    //this.calculateReflectedControlPoint();
    const res =  new QCommand(this.controlPoint.x, this.controlPoint.y, this.x, this.y, this.relative);
    //res.startingPoint = this.startingPoint;
    //res.endingPoint = this.endingPoint;
    return res;
  }

  /*toCurveCommand(previousCommand?: SvgCommand): CCommand {
    let controlPoint: IPoint;

    if (previousCommand instanceof QCommand || previousCommand instanceof TCommand) {
      // Reflect the previous control point across the starting point
      controlPoint = {
        x: 2 * this.startingPoint.x - previousCommand.controlPoint.x,
        y: 2 * this.startingPoint.y - previousCommand.controlPoint.y,
      };
    } else {
      // No previous Q or T, use the starting point as the control point
      controlPoint = this.startingPoint;
    }

    // Compute cubic Bézier control points using quadratic approximation
    const x1 = this.startingPoint.x + (2 / 3) * (controlPoint.x - this.startingPoint.x);
    const y1 = this.startingPoint.y + (2 / 3) * (controlPoint.y - this.startingPoint.y);
    const x2 = this.x + (2 / 3) * (controlPoint.x - this.x);
    const y2 = this.y + (2 / 3) * (controlPoint.y - this.y);

    return new CCommand(x1, y1, x2, y2, this.x, this.y, this.relative);
  }*/

    toCurveCommand(previousCommand?: SvgCommand): CCommand {
      let controlPoint: IPoint;

      if (previousCommand instanceof QCommand || previousCommand instanceof TCommand) {
        const prevControl = previousCommand.controlPoint;
        controlPoint = {
          x: 2 * this.startingPoint.x - prevControl.x,
          y: 2 * this.startingPoint.y - prevControl.y,
        };
      } else {
        controlPoint = this.startingPoint;
      }

      const c1 = {
        x: this.startingPoint.x + (2 / 3) * (controlPoint.x - this.startingPoint.x),
        y: this.startingPoint.y + (2 / 3) * (controlPoint.y - this.startingPoint.y),
      };

      const endPoint = { x: this.x, y: this.y };

      const c2 = {
        x: endPoint.x + (2 / 3) * (controlPoint.x - endPoint.x),
        y: endPoint.y + (2 / 3) * (controlPoint.y - endPoint.y),
      };

      const res =  new CCommand(c1.x, c1.y, c2.x, c2.y, endPoint.x, endPoint.y, this.relative);
      //res.startingPoint = this.startingPoint;
      //res.endingPoint = endPoint;
      return res;
    }




  toAbsolute(current: IPoint): { cmd: TCommand; endPoint: IPoint } {
    const absX = this.relative ? current.x + this.x : this.x;
    const absY = this.relative ? current.y + this.y : this.y;
    const absCP = {
      x: this.relative ? current.x + this.controlPoint.x : this.controlPoint.x,
      y: this.relative ? current.y + this.controlPoint.y : this.controlPoint.y,
    };
    const absPCP = this.previousControlPoint ? {
      x: this.relative ? current.x + this.previousControlPoint.x  : this.previousControlPoint.x,
      y: this.relative ? current.y + this.previousControlPoint.y : this.previousControlPoint.y,
    } : null;

    const res = {
      cmd: new TCommand(absX, absY, false),
      endPoint: { x: absX, y: absY }
    };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //res.cmd.endingPoint.x = absX;
    //res.cmd.endingPoint.y = absY;

    //res.cmd.controlPoint = absCP;
    res.cmd.x1 = absCP.x;
    res.cmd.y1 = absCP.y;
    //if (absPCP) {
    //  res.cmd.previousControlPoint = absPCP;
    //}
    return res;
  }

  toRelative(current: IPoint): { cmd: TCommand; endPoint: IPoint } {
    const abs = this.toAbsolute(current).cmd;
    const relX = abs.x - current.x;
    const relY = abs.y - current.y;
    const res = { cmd: new TCommand(relX, relY, true), endPoint: { x: abs.x, y: abs.y } };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = res.endPoint;
    return res;
  }
  clone(): TCommand {
    return new TCommand(this.x, this.y, this.relative);
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
    const controlPoint = rotatePoint(this.controlPoint);
    const endingPoint = rotatePoint({ x: this.x, y: this.y });

    this.x = endingPoint.x;
    this.y = endingPoint.y;
    this.x1 = controlPoint.x;
    this.y1 = controlPoint.y;
  }

  reverseDirection() {
    // Swap the starting and ending points
    const [startingPoint, endingPoint] = [this.endingPoint, this.startingPoint];

    // Recalculate the control point to maintain curve shape
    const controlPoint = {
      x: 2 * this.startingPoint.x - this.controlPoint.x,
      y: 2 * this.startingPoint.y - this.controlPoint.y,
    };

    // Update coordinates
    this.x = endingPoint.x;
    this.y = endingPoint.y;
    this.x1 = controlPoint.x;
    this.y1 = controlPoint.y;
  }
  getTotalLength(): number {
    const segments = 100; // Number of segments for approximation
    let length = 0;
    let prev = this.startingPoint;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = (1 - t) * (1 - t) * this.startingPoint.x +
                2 * (1 - t) * t * this.controlPoint.x +
                t * t * this.endingPoint.x;

      const y = (1 - t) * (1 - t) * this.startingPoint.y +
                2 * (1 - t) * t * this.controlPoint.y +
                t * t * this.endingPoint.y;

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
      const x = (1 - fraction) * (1 - fraction) * this.startingPoint.x +
                2 * (1 - fraction) * fraction * this.controlPoint.x +
                fraction * fraction * this.endingPoint.x;

      const y = (1 - fraction) * (1 - fraction) * this.startingPoint.y +
                2 * (1 - fraction) * fraction * this.controlPoint.y +
                fraction * fraction * this.endingPoint.y;

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
    this.x += x;
    this.y += y;
    this.x1 += x;
    this.y1 += y;
    //this.endingPoint.x += x;
    //this.endingPoint.y += y;
  }

  scale(s: number) {
    this.x *= s;
    this.y *= s;
    this.x1 *= s;
    this.y1 *= s;
    //this.endingPoint.x *= s;
    //this.endingPoint.y *= s;
  }

  split(point: IPoint, step: number = 0.01): [TCommand, TCommand] {
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
    const first = new TCommand(mid.x, mid.y, this.relative);
    const second = new TCommand(this.x, this.y, this.relative);

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
    return `${this.relative ? 't' : 'T'} ${format(this.x)} ${format(this.y)}`;
  }

}
