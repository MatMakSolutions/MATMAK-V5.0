import { format, SvgCommand ,TClosestPointResult} from "./Abstract/SvgCommand";
import { CCommand } from "./CCommand";
import { IPoint } from "../Utils/IPoint";

/**
 * Represents an "S" (smooth cubic Bezier curve) command.
 */
export class SCommand extends SvgCommand {
  type: 'S' = 'S';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;

  //startingPoint: IPoint = { x: 0, y: 0 };
  //controlPoint1: IPoint = { x: 0, y: 0 }; // Automatically calculated as the reflection of the previous control point.
  //controlPoint2: IPoint = { x: 0, y: 0 };
  //endingPoint: IPoint = { x: 0, y: 0 };
  //previousControlPoint?: IPoint;
 ////////////////////////////////////////
 private _asCurve(): CCommand {
    const curve = this.toCurveCommand();
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
  get endingPoint(): IPoint {
    return { x: this.x, y: this.y };
  }

  updateEndingPoint(point: IPoint): void {
    this.x = point.x;
    this.y = point.y;
  }

  get controlPoint2(): IPoint {
    return { x: this.x2, y: this.y2 };
  }

  get controlPoint1(): IPoint {
    return { x: this.x1, y: this.y1 };
  }

  constructor(x2: number, y2: number, x: number, y: number, relative: boolean = false) {
    super(relative);
    this.x1 = x2;
    this.y1 = y2;
    this.x2 = x2;
    this.y2 = y2;
    this.x = x;
    this.y = y;
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
    const previousControlPoint = this.getPreviousControlPoint();
    let controlPoint1: IPoint = { x: 0, y: 0 };
    if (previousControlPoint) {
      controlPoint1 = {
        x: 2 * this.startingPoint.x - previousControlPoint.x,
        y: 2 * this.startingPoint.y - previousControlPoint.y,
      };
    } else {
      controlPoint1 = {x: this.startingPoint.x , y: this.startingPoint.y};
    }
    const controlPoint2 = { x: this.x2, y: this.y2 };
    const endingPoint = { x: this.x, y: this.y };

    this.x1 = controlPoint1.x;
    this.y1 = controlPoint1.y;
    this.x2 = controlPoint2.x;
    this.y2 = controlPoint2.y;
    this.x  = endingPoint.x;
    this.y  = endingPoint.y;
  }

  /**
   * Converts the S command to an equivalent C (cubic Bezier) command.
   */
  /*toCurveCommand(): CCommand {
    this.calculateReflectedControlPoint();
    return new CCommand(
      this.controlPoint1.x,
      this.controlPoint1.y,
      this.controlPoint2.x,
      this.controlPoint2.y,
      this.x,
      this.y,
      this.relative
    );
  }*/

    toCurveCommand(previousCommand?: SvgCommand): CCommand {
      this.calculateReflectedControlPoint();
      // Compute the reflected control point
      //let controlPoint1: IPoint;

      /*if (previousCommand instanceof CCommand || previousCommand instanceof SCommand) {
        // Reflect the previous curve's second control point over the last endpoint
        controlPoint1 = {
          x: 2 * this.startingPoint.x - previousCommand.x2,
          y: 2 * this.startingPoint.y - previousCommand.y2,
        };
      } else {
        // No previous C or S curve, so the reflection defaults to the starting point
        controlPoint1 = this.startingPoint;
      }*/

      const res =  new CCommand(
        this.controlPoint1.x,
        this.controlPoint1.y,
        this.x2,
        this.y2,
        this.x,
        this.y,
        this.relative
      );

      //res.startingPoint = this.startingPoint;
      //res.endingPoint = this.endingPoint;
      return res;
    }



  toAbsolute(current: IPoint): { cmd: SCommand; endPoint: IPoint } {
    const absX2 = this.relative ? current.x + this.x2 : this.x2; // Represents the reflection of the previous control point.
    const absY2 = this.relative ? current.y + this.y2 : this.y2; // Represents the reflection of the previous control point.
    const absX  = this.relative ? current.x + this.x  : this.x;  // Ending point
    const absY  = this.relative ? current.y + this.y  : this.y;  // Ending point
    const res = {
      cmd: new SCommand(absX2, absY2, absX, absY, false),
      endPoint: { x: absX, y: absY }
    };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //res.cmd.endingPoint.x = absX;
    //res.cmd.endingPoint.y = absY;
    return res;
  }

  toRelative(current: IPoint): { cmd: SCommand; endPoint: IPoint } {
    const abs = this.toAbsolute(current).cmd;
    const relX2 = abs.x2 - current.x;
    const relY2 = abs.y2 - current.y;
    const relX  = abs.x  - current.x;
    const relY  = abs.y  - current.y;
    const res =  {
      cmd: new SCommand(relX2, relY2, relX, relY, true),
      endPoint: { x: abs.x, y: abs.y }
    };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = res.endPoint;
    return res;
  }
  clone(): SCommand {
    return new SCommand(this.x2, this.y2, this.x, this.y, this.relative);
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
    const controlPoint1 = rotatePoint(this.controlPoint1);
    const controlPoint2 = rotatePoint({ x: this.x2, y: this.y2 });
    const endingPoint   = rotatePoint({ x: this.x, y: this.y });

    this.x1 = controlPoint1.x;
    this.y1 = controlPoint1.y;
    this.x2 = controlPoint2.x;
    this.y2 = controlPoint2.y;
    this.x  = endingPoint.x;
    this.y  = endingPoint.y;
  }

  reverseDirection() {
    // Swap the starting and ending points
    const [startingPoint, endingPoint] = [this.endingPoint, this.startingPoint];

    // Swap control points to reflect the new direction
    const [controlPoint1, controlPoint2] = [this.controlPoint2, this.controlPoint1];

    // Update coordinates
    this.x1 = controlPoint1.x;
    this.y1 = controlPoint1.y;
    this.x2 = controlPoint2.x;
    this.y2 = controlPoint2.y;
    this.x = endingPoint.x;
    this.y = endingPoint.y;
  }

  getTotalLength(): number {
    const segments = 100; // Number of segments for approximation
    let length = 0;
    let prev = this.startingPoint;

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = Math.pow(1 - t, 3) * this.startingPoint.x +
                3 * Math.pow(1 - t, 2) * t * this.controlPoint1.x +
                3 * (1 - t) * Math.pow(t, 2) * this.controlPoint2.x +
                Math.pow(t, 3) * this.endingPoint.x;

      const y = Math.pow(1 - t, 3) * this.startingPoint.y +
                3 * Math.pow(1 - t, 2) * t * this.controlPoint1.y +
                3 * (1 - t) * Math.pow(t, 2) * this.controlPoint2.y +
                Math.pow(t, 3) * this.endingPoint.y;

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
      const x = Math.pow(1 - fraction, 3) * this.startingPoint.x +
                3 * Math.pow(1 - fraction, 2) * fraction * this.controlPoint1.x +
                3 * (1 - fraction) * Math.pow(fraction, 2) * this.controlPoint2.x +
                Math.pow(fraction, 3) * this.endingPoint.x;

      const y = Math.pow(1 - fraction, 3) * this.startingPoint.y +
                3 * Math.pow(1 - fraction, 2) * fraction * this.controlPoint1.y +
                3 * (1 - fraction) * Math.pow(fraction, 2) * this.controlPoint2.y +
                Math.pow(fraction, 3) * this.endingPoint.y;

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
    this.x2              += x;
    this.y2              += y;
    this.x               += x;
    this.y               += y;
    this.controlPoint1.x += x;
    this.controlPoint1.y += y;
    this.controlPoint2.x += x;
    this.controlPoint2.y += y;
    this.endingPoint.x   += x;
    this.endingPoint.y   += y;
  }

  scale(s: number) {
    this.x2              *= s;
    this.y2              *= s;
    this.x               *= s;
    this.y               *= s;
    this.controlPoint1.x *= s;
    this.controlPoint1.y *= s;
    this.controlPoint2.x *= s;
    this.controlPoint2.y *= s;
    this.endingPoint.x   *= s;
    this.endingPoint.y   *= s;
  }

  split(point: IPoint, step: number = 0.01): [SCommand, SCommand] {
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
    const first = new SCommand(this.x2, this.y2, mid.x, mid.y, this.relative);
    const second = new SCommand(this.x2, this.y2, this.x, this.y, this.relative);

    //first.startingPoint = this.startingPoint;
    //first.endingPoint = mid;
    //second.startingPoint = mid;
    //second.endingPoint = this.endingPoint;

    return [first, second];
  }

  toString(): string {
    return `${this.relative ? 's' : 'S'} ${format(this.x2)} ${format(this.y2)}, ${format(this.x)} ${format(this.y)}`;
  }

}
