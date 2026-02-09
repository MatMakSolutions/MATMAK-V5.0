import { IPoint } from "../Utils/IPoint";
import { format, SvgCommand ,TClosestPointResult} from "./Abstract/SvgCommand";

/**
 * Represents an "M" (move) command.
 */

export class MoveCommand extends SvgCommand {
  type: 'M' = 'M';
  //point: IPoint = { x: 0, y: 0 };

  //startingPoint: IPoint = { x: 0, y: 0 };
  //endingPoint: IPoint = { x: 0, y: 0 };
 ////////////////////////////////////////
 public getLength(): number {
    return 0;
  }
  
  // The closest point is always the move command's point itself.
  public getClosestPoint(point: IPoint): TClosestPointResult {
    const distance = Math.hypot(point.x - this.x, point.y - this.y);
    return { t: 0, point: { x: this.x, y: this.y }, distance, distanceOnSegment: 0 };
  }
  //////////////////////////////////////////////////
  get endingPoint(): IPoint {
    return {
      x: this.x,
      y: this.y,
    }
  }

  get startingPoint(): IPoint {
    return {
      x: this.x,
      y: this.y,
    }
  }

  updateEndingPoint(point: IPoint): void {
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

  translate(x: number, y: number): void {
    this.x += x;
    this.y += y;
    //this.point.x += x;
    //this.point.y += y;
    //this.endingPoint.x += x;
    //this.endingPoint.y += y;
  }

  scale(s: number) {
    this.x *= s;
    this.y *= s;
    //this.point.x *= s;
    //this.point.y *= s;
    //this.endingPoint.x *= s;
    //this.endingPoint.y *= s;
  }
  
  scaleXY(sx: number, sy: number) {
    this.x *= sx;
    this.y *= sy;
  }

  toAbsolute(current: IPoint): { cmd: MoveCommand; endPoint: IPoint } {
    const absX = this.relative ? current.x + this.x : this.x;
    const absY = this.relative ? current.y + this.y : this.y;
    const res = { cmd: new MoveCommand(absX, absY, false), endPoint: { x: absX, y: absY } };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //res.cmd.endingPoint.x = absX;
    //res.cmd.endingPoint.y = absY;
    return res;
  }

  toRelative(current: IPoint): { cmd: MoveCommand; endPoint: IPoint } {
    // Compute the absolute endpoint then subtract the current point.
    const { endPoint } = this.toAbsolute(current);
    const relX = endPoint.x - current.x;
    const relY = endPoint.y - current.y;
    const res = { cmd: new MoveCommand(relX, relY, true), endPoint: endPoint };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = res.endPoint;
    return res;
  }

  clone(): MoveCommand {
    return new MoveCommand(this.x, this.y, this.relative);
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

    const newPoint = rotatePoint({ x: this.x, y: this.y });

    this.x = newPoint.x;
    this.y = newPoint.y;
    //this.point = newPoint;
    //this.startingPoint = newPoint;
    //this.endingPoint = newPoint;
  }

  reverseDirection() {
    // Move command is just setting a point, reversing does not change anything
  }

  toString(): string {
    return `${this.relative ? 'm' : 'M'} ${format(this.x)} ${format(this.y)}`;
  }


}
