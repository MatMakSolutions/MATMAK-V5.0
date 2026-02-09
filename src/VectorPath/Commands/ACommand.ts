import { format, SvgCommand ,TClosestPointResult} from "./Abstract/SvgCommand";
import { CCommand } from "./CCommand";
import { IPoint } from "../Utils/IPoint";
import arcToBezier from "../Utils/ArcToBezier";

/**
 * Represents an "A" (elliptical arc) command.
 */
export class ACommand extends SvgCommand {
  type: 'A' = 'A';
 ////////////////////////////////////////
private _asCurves(): CCommand[] {
    const curves = this.toCurveCommands();
    let lastCmd = this.previousCommand;
    curves.forEach(c => {
        c.linkBefore(lastCmd);
        lastCmd = c;
    });
    return curves;
  }

  public getLength(): number {
    return this._asCurves().reduce((acc, curve) => acc + curve.getLength(), 0);
  }

  public getClosestPoint(point: IPoint): TClosestPointResult {
    const curves = this._asCurves();
    let bestMatch: TClosestPointResult | null = null;
    let accumulatedLength = 0;

    for (const curve of curves) {
        const closest = curve.getClosestPoint(point);
        if (!bestMatch || closest.distance < bestMatch.distance) {
            bestMatch = {
                ...closest,
                distanceOnSegment: accumulatedLength + closest.distanceOnSegment
            };
        }
        accumulatedLength += curve.getLength();
    }
    return bestMatch!;
  }

  //////////////////////////////////////////////////
  //startingPoint: IPoint = { x: 0, y: 0 };
  //endingPoint: IPoint = { x: 0, y: 0 };

  get endingPoint(): IPoint {
    return {
      x: this.x,
      y: this.y
    }
  }

  updateEndingPoint(point: IPoint): void {
    this.x = point.x;
    this.y = point.y;
  }

  rx: number;
  ry: number;
  xAxisRotation: number;
  largeArcFlag: boolean;
  sweepFlag: boolean;
  x: number;
  y: number;

  constructor(
    rx: number,
    ry: number,
    xAxisRotation: number,
    largeArcFlag: boolean,
    sweepFlag: boolean,
    x: number,
    y: number,
    relative: boolean = false
  ) {
    super(relative);
    this.rx = rx;
    this.ry = ry;
    this.xAxisRotation = xAxisRotation;
    this.largeArcFlag = largeArcFlag;
    this.sweepFlag = sweepFlag;
    this.x = x;
    this.y = y;
  }

  /**
   * Converts the arc to an array of cubic Bézier CurveCommands.
   */
  toCurveCommands(): CCommand[] {
    const curves: CCommand[] = [];

    if (!this.startingPoint) {
      console.warn("ACommand must have a valid startingPoint set before conversion.");
      return [];
    }

    // Convert arc to Bézier curves
    const bezierSegments = arcToBezier({
      px: this.startingPoint.x,
      py: this.startingPoint.y,
      cx: this.x,
      cy: this.y,
      rx: this.rx,
      ry: this.ry,
      xAxisRotation: this.xAxisRotation,
      largeArcFlag: this.largeArcFlag ? 1 : 0,
      sweepFlag: this.sweepFlag ? 1 : 0,
    });

    // Convert Bezier segments into CCommand objects
    bezierSegments.forEach((segment, index) => {
      const curve = new CCommand(
        segment.x1,
        segment.y1,
        segment.x2,
        segment.y2,
        segment.x,
        segment.y,
        this.relative
      );

      // Set start and end points correctly
      //if (index === 0) {
      //  curve.startingPoint = this.startingPoint;
      //} else {
      //  curve.startingPoint = curves[index - 1].endingPoint;
      //}
      //curve.endingPoint = { x: segment.x, y: segment.y };

      curves.push(curve);
    });

    return curves;
  }

  /**
   * Calculates the center of the arc and the angles for the arc segment.
   * (This part uses the standard elliptical arc calculation algorithm.)
   */
  private calculateArcCenter(rx: number, ry: number, xAxisRotation: number): { cx: number; cy: number; startAngle: number; endAngle: number } {
    const phi = (xAxisRotation * Math.PI) / 180; // Convert rotation to radians

    // Calculate the difference between the starting point and the endpoint
    const dx = (this.startingPoint.x - this.x) / 2;
    const dy = (this.startingPoint.y - this.y) / 2;

    // Rotate (dx, dy) back by -phi to get the transformed midpoint
    const x1Prime = Math.cos(phi) * dx + Math.sin(phi) * dy;
    const y1Prime = -Math.sin(phi) * dx + Math.cos(phi) * dy;

    // Ensure radii are large enough
    let lambda = (x1Prime * x1Prime) / (rx * rx) + (y1Prime * y1Prime) / (ry * ry);
    if (lambda > 1) {
      lambda = Math.sqrt(lambda);
      rx *= lambda;
      ry *= lambda;
    }

    // Compute the center of the ellipse in the transformed coordinate system
    const sign = this.largeArcFlag !== this.sweepFlag ? 1 : -1;
    const cxPrime = sign * Math.sqrt(((rx * rx) * (ry * ry) - (rx * rx) * (y1Prime * y1Prime) - (ry * ry) * (x1Prime * x1Prime)) /
      ((rx * rx) * (y1Prime * y1Prime) + (ry * ry) * (x1Prime * x1Prime))) * (rx * y1Prime) / ry;
    const cyPrime = sign * Math.sqrt(((rx * rx) * (ry * ry) - (rx * rx) * (y1Prime * y1Prime) - (ry * ry) * (x1Prime * x1Prime)) /
      ((rx * rx) * (y1Prime * y1Prime) + (ry * ry) * (x1Prime * x1Prime))) * -(ry * x1Prime) / rx;

    // Transform the center back to the original coordinate system
    const cx = Math.cos(phi) * cxPrime - Math.sin(phi) * cyPrime + (this.startingPoint.x + this.x) / 2;
    const cy = Math.sin(phi) * cxPrime + Math.cos(phi) * cyPrime + (this.startingPoint.y + this.y) / 2;

    // Compute the start and end angles
    const startAngle = Math.atan2((y1Prime - cyPrime) / ry, (x1Prime - cxPrime) / rx);
    const endAngle = Math.atan2((-y1Prime - cyPrime) / ry, (-x1Prime - cxPrime) / rx);

    return { cx, cy, startAngle, endAngle };
  }

  toAbsolute(current: IPoint): { cmd: ACommand; endPoint: IPoint } {
    const absX = this.relative ? current.x + this.x : this.x;
    const absY = this.relative ? current.y + this.y : this.y;

    const res =  {
      cmd: new ACommand(this.rx, this.ry, this.xAxisRotation, this.largeArcFlag, this.sweepFlag, absX, absY, false),
      endPoint: { x: absX, y: absY }
    };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint.x = res.endPoint.x;
    //res.cmd.endingPoint.y = res.endPoint.y;
    //this.endingPoint.x = absX;
    //this.endingPoint.y = absY;
    return res;
  }
  toRelative(current: IPoint): { cmd: ACommand; endPoint: IPoint } {
    const abs = this.toAbsolute(current).cmd;
    const relX = abs.x - current.x;
    const relY = abs.y - current.y;
    const res =  {
      cmd: new ACommand(abs.rx, abs.ry, abs.xAxisRotation, abs.largeArcFlag, abs.sweepFlag, relX, relY, true),
      endPoint: { x: abs.x, y: abs.y }
    };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint.x = res.endPoint.x;
    //res.cmd.endingPoint.y = res.endPoint.y;
    return res;
  }

  clone(): ACommand {
    return new ACommand(
      this.rx,
      this.ry,
      this.xAxisRotation,
      this.largeArcFlag,
      this.sweepFlag,
      this.x,
      this.y,
      this.relative
    );
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

    // Rotate the start and end points
    //this.startingPoint = rotatePoint(this.startingPoint);
    const newEnd = rotatePoint({ x: this.x, y: this.y });

    this.x = newEnd.x;
    this.y = newEnd.y;

    // Rotate the x-axis rotation angle
    this.xAxisRotation = (this.xAxisRotation + angle) % 360;
  }

  reverseDirection() {
    // Swap the starting and ending points
    [this.x, this.y] = [this.startingPoint.x, this.startingPoint.y];

    // Toggle the sweep flag to reverse the arc's direction
    this.sweepFlag = !this.sweepFlag;
  }

  /**
   * Approximates the total length of the arc using numerical integration.
   */
  getTotalLength(): number {
    const { cx, cy, startAngle, endAngle } = this.calculateArcCenter(this.rx, this.ry, this.xAxisRotation);
    const segments = 100; // Number of segments for approximation
    let length = 0;
    let prevX = cx + this.rx * Math.cos(startAngle);
    let prevY = cy + this.ry * Math.sin(startAngle);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + t * (endAngle - startAngle);
      const x = cx + this.rx * Math.cos(angle);
      const y = cy + this.ry * Math.sin(angle);
      length += Math.sqrt((x - prevX) ** 2 + (y - prevY) ** 2);
      prevX = x;
      prevY = y;
    }

    return length;
  }

  /**
   * Returns a point at a given fraction of the arc's length.
   */
  getPointAtLength(t: number): { x: number; y: number } {
    const totalLength = this.getTotalLength();
    const targetLength = t * totalLength;
    const { cx, cy, startAngle, endAngle } = this.calculateArcCenter(this.rx, this.ry, this.xAxisRotation);
    const segments = 100;
    let length = 0;
    let prevX = cx + this.rx * Math.cos(startAngle);
    let prevY = cy + this.ry * Math.sin(startAngle);

    for (let i = 1; i <= segments; i++) {
      const fraction = i / segments;
      const angle = startAngle + fraction * (endAngle - startAngle);
      const x = cx + this.rx * Math.cos(angle);
      const y = cy + this.ry * Math.sin(angle);
      const segmentLength = Math.sqrt((x - prevX) ** 2 + (y - prevY) ** 2);

      if (length + segmentLength >= targetLength) {
        const ratio = (targetLength - length) / segmentLength;
        return {
          x: prevX + ratio * (x - prevX),
          y: prevY + ratio * (y - prevY)
        };
      }
      length += segmentLength;
      prevX = x;
      prevY = y;
    }

    return { x: prevX, y: prevY };
  }

  translate(x: number, y: number) {
    this.x += x;
    this.y += y;
    this.rx += x;
    this.ry += y;
    //this.endingPoint.x = this.x;
    //this.endingPoint.y = this.y;
  }

  split(point: IPoint, step: number = 0.01): [ACommand, ACommand] {
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
    const first = new ACommand(this.rx, this.ry, this.xAxisRotation, this.largeArcFlag, this.sweepFlag, mid.x, mid.y, this.relative);
    const second = new ACommand(this.rx, this.ry, this.xAxisRotation, this.largeArcFlag, this.sweepFlag, this.x, this.y, this.relative);

    //first.startingPoint = this.startingPoint;
    //first.endingPoint.x = mid.x;
    //first.endingPoint.y = mid.y;
    //second.startingPoint = mid;
    //second.endingPoint.x = this.x;
    //second.endingPoint.y = this.y;

    return [first, second];
  }

  getNearestPoint(point: IPoint, step: number): [IPoint, number] {
    let nearestPoint: IPoint = this.startingPoint;
    let minDistance = Infinity;

    for (let t = 0; t <= 1; t += step) {
      const arcPoint = this.getPointAtLength(t * this.getTotalLength());
      const distance = Math.hypot(point.x - arcPoint.x, point.y - arcPoint.y);

      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = arcPoint;
      }
    }

    return [nearestPoint, minDistance];
  }

  toString(full = false): string {
    let strPath =  `${this.relative ? 'a' : 'A'} ${format(this.rx)} ${format(this.ry)} ${format(this.xAxisRotation)} ${this.largeArcFlag ? 1 : 0} ${this.sweepFlag ? 1 : 0} ${format(this.x)} ${format(this.y)}`;
    if (full) {
      strPath = `${this.relative ? "m" : "M"} ${format(this.startingPoint.x)} ${format(this.startingPoint.y)} ${strPath} ${this}`;
    }
    return strPath;
  }

  scale(s: number) {
    this.rx *= s;
    this.ry *= s;
    this.x *= s;
    this.y *= s;
    this.endingPoint.x *= s;
    this.endingPoint.y *= s;
  }


}
