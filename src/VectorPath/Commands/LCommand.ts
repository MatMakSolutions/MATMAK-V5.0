import { IPoint } from "../Utils/IPoint";
import { format, SvgCommand, TClosestPointResult, TCommandLetter } from "./Abstract/SvgCommand";
import {CCommand} from "../Commands/CCommand";

/**
 * Represents an "L" (line) command.
 */

export class LCommand extends SvgCommand {

  ////////////////////////////////////////
 public getLength(): number {
    const start = this.startingPoint;
    const dx = this.x - start.x;
    const dy = this.y - start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public getClosestPoint(point: IPoint): TClosestPointResult {
    const start = this.startingPoint;
    const end = this.endingPoint;

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
      const dist = Math.hypot(point.x - start.x, point.y - start.y);
      return { t: 0, point: { ...start }, distance: dist, distanceOnSegment: 0 };
    }

    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
    const finalT = Math.max(0, Math.min(1, t)); // Clamp t to the segment

    const closestPoint = { x: start.x + finalT * dx, y: start.y + finalT * dy };
    const distance = Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);
    const distanceOnSegment = this.getLength() * finalT;

    return { t: finalT, point: closestPoint, distance, distanceOnSegment };
  }
  //////////////////////////////////////////////////
  /*
  getLength(): number {
    throw new Error("Method not implemented.");
  }
  getClosestPoint(p: IPoint): TClosestPointResult {
    throw new Error("Method not implemented.");
  }*/
  type: 'L' = 'L';
  isClosingPath: boolean = false;

  //startingPoint: { x: number, y: number } = { x: 0, y: 0 };
  //endingPoint: { x: number, y: number } = { x: 0, y: 0 };

  get endingPoint(): IPoint {
    return { x: this.x, y: this.y };
  }

  updateEndingPoint(point: IPoint) {
    this.x = point.x;
    this.y = point.y;
  }

  constructor(
    public x: number,
    public y: number,
    relative: boolean = false
  ) {
    super(relative);
  }


  getTotalLength(): number {
    return Math.sqrt(
      (this.x - this.startingPoint.x) ** 2 + (this.y - this.startingPoint.y) ** 2
    );
  }


  getPointAtLength(t: number): { x: number; y: number } {
    if (t <= 0) {
      return { x: this.startingPoint.x, y: this.startingPoint.y };
    }
    const totalLength = this.getTotalLength();
    if (t >= totalLength) {
      return { x: this.x, y: this.y };
    }

    const fraction = t / totalLength;
    const x = this.startingPoint.x + (this.x - this.startingPoint.x) * fraction;
    const y = this.startingPoint.y + (this.y - this.startingPoint.y) * fraction;
    return { x, y };
  }

  toAbsolute(current: IPoint): { cmd: LCommand; endPoint: IPoint } {
    const absX = this.relative ? current.x + this.x : this.x;
    const absY = this.relative ? current.y + this.y : this.y;
    const res = { cmd: new LCommand(absX, absY, false), endPoint: { x: absX, y: absY } };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //res.cmd.endingPoint.x = absX;
    //res.cmd.endingPoint.y = absY;
    return res;
  }
  toRelative(current: IPoint): { cmd: LCommand; endPoint: IPoint } {
    const { endPoint } = this.toAbsolute(current);
    const relX = endPoint.x - current.x;
    const relY = endPoint.y - current.y;
    const res = { cmd: new LCommand(relX, relY, true), endPoint: endPoint };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = res.endPoint;
    return res;
  }
  clone(): LCommand {
    return new LCommand(this.x, this.y, this.relative);
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
    const endingPoint = rotatePoint({ x: this.x, y: this.y });

    this.x = endingPoint.x;
    this.y = endingPoint.y;
  }

  reverseDirection() {
    // Swap the starting and ending points
    const [startingPoint, endingPoint] = [this.endingPoint, this.startingPoint];

    // Update coordinates
    this.x = endingPoint.x;
    this.y = endingPoint.y;
  }

  translate(x: number, y: number) {
    this.x += x;
    this.y += y;
    //this.endingPoint.x = this.x;
    //this.endingPoint.y = this.y;
  }

  scale(s: number) {
    this.x *= s;
    this.y *= s;
    //this.endingPoint.x = this.x;
    //this.endingPoint.y = this.y;
  }
  
  scaleXY(sx: number, sy: number) {
    this.x *= sx;
    this.y *= sy;
  }

  split(length: number, step: number = 0.01): { left: LCommand; right: LCommand } {
    const point = this.getPointAtLength(Math.min(length, Math.max(0, this.getTotalLength())));

    const left = new LCommand(point.x, point.y, this.relative);
    const right = new LCommand(this.x, this.y, this.relative);

    return { left, right };
  }

  getNearestPoint(point: IPoint, step: number): [IPoint, number, number] {
    const A = this.startingPoint;
    const B = this.endingPoint;
    let length = 0;

    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const AB_squared = ABx * ABx + ABy * ABy;
    
    // Handle degenerate segment (zero-length line)
    if (AB_squared === 0 || !isFinite(AB_squared)) {
      // Line has zero length, return distance to the single point
      const distance = Math.hypot(point.x - A.x, point.y - A.y);
      return [{ x: A.x, y: A.y }, distance, 0];
    }
    
    let t = ((point.x - A.x) * ABx + (point.y - A.y) * ABy) / AB_squared;

    t = Math.max(0, Math.min(1, t)); // Clamp between 0 and 1

    const nearestPoint = { x: A.x + t * ABx, y: A.y + t * ABy };
    const distance = Math.hypot(point.x - nearestPoint.x, point.y - nearestPoint.y);

    return [nearestPoint, distance, this.getTotalLength() * t];
  }

  toString(): string {
    return this.isClosingPath
      ? `${this.relative ? "z" : "Z"}`
      : `${this.relative ? 'l' : 'L'} ${format(this.x)} ${format(this.y)}`;
  }

  /////////////////////////////////
  toCurveCommand(): CCommand {
    const x1 = this.startingPoint.x + (this.x - this.startingPoint.x) / 3;
    const y1 = this.startingPoint.y + (this.y - this.startingPoint.y) / 3;
    const x2 = this.startingPoint.x + 2 * (this.x - this.startingPoint.x) / 3;
    const y2 = this.startingPoint.y + 2 * (this.y - this.startingPoint.y) / 3;
    const res = new CCommand(x1, y1, x2, y2, this.x, this.y, this.relative);
    return res;
}
}
