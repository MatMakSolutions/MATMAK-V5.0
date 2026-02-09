import { IPoint } from "../Utils/IPoint";
import { SvgCommand ,TClosestPointResult} from "./Abstract/SvgCommand";
import { LCommand } from "./LCommand";

/**
 * Represents a "Z" (close path) command.
 */

export class ZCommand extends SvgCommand {
  type: 'Z' = 'Z';
  isRealCommand: boolean = true;

  //startingPoint: IPoint = { x: 0, y: 0 };
  //endingPoint: IPoint = { x: 0, y: 0 };
 ////////////////////////////////////////
private _asLine(): LCommand {
      const line = new LCommand(this.endingPoint.x, this.endingPoint.y, this.relative);
      line.linkBefore(this.previousCommand);
      return line;
  }

  public getLength(): number { return this._asLine().getLength(); }
  public getClosestPoint(point: IPoint): TClosestPointResult { return this._asLine().getClosestPoint(point); }
  //////////////////////////////////////////////////
  get endingPoint(): IPoint {
    return this.nextCommand?.startingPoint ?? this.startingPoint;
  }

  updateEndingPoint(point: IPoint): void {
    // Closing path; ending point is the same as the starting point.
    //this.endingPoint = point;
  }

  constructor(relative: boolean = false) {
    super(relative);
  }

  toAbsolute(current: IPoint): { cmd: ZCommand; endPoint: IPoint } {
    // For Close, the endpoint is assumed to be the starting point of the subpath,
    // which should be managed externally. Here we return the current point.
    const res = { cmd: new ZCommand(false), endPoint: current };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //this.endingPoint.x = current.x;
    //this.endingPoint.y = current.y;
    return res;
  }
  toRelative(current: IPoint): { cmd: ZCommand; endPoint: IPoint } {
    const res = { cmd: new ZCommand(true), endPoint: current };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = res.endPoint;
    return res;
  }
  clone(): ZCommand {
    const cloned =  new ZCommand(this.relative);
    //cloned.startingPoint = this.startingPoint;
    //cloned.endingPoint = this.endingPoint;
    return cloned;
  }

  toLineCommand(): LCommand {
    // Represents a line that close teh path.
    const res = new LCommand(this.startingPoint.x, this.startingPoint.y, this.relative);
    //res.startingPoint = this.startingPoint;
    //res.endingPoint   = this.endingPoint;
    res.isClosingPath = true;
    return res;
  }

  rotate(origin: IPoint, angle: number) {
    /*const angleRad = (angle * Math.PI) / 180;

    const rotatePoint = (p: IPoint): IPoint => {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      return {
        x: origin.x + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: origin.y + dx * Math.sin(angleRad) + dy * Math.cos(angleRad),
      };
    };

    //this.startingPoint = rotatePoint(this.startingPoint);
    const endingPoint = rotatePoint(this.endingPoint);*/
  }

  reverseDirection() {
    // Closing path; reversing direction does not affect functionality.
    // Conceptually swap the start and end points (though they should be the same).
    //c[startingPoint, endingPoint] = [this.endingPoint, this.startingPoint];
  }

  getTotalLength(): number {
    return Math.sqrt(
      (this.endingPoint.x - this.startingPoint.x) ** 2 +
      (this.endingPoint.y - this.startingPoint.y) ** 2
    );
  }

  getPointAtLength(t: number): { x: number; y: number } {
    const totalLength = this.getTotalLength();
    if (totalLength === 0) return this.startingPoint; // Prevent division by zero

    const targetX = this.startingPoint.x + t * (this.endingPoint.x - this.startingPoint.x);
    const targetY = this.startingPoint.y + t * (this.endingPoint.y - this.startingPoint.y);

    return { x: targetX, y: targetY };
  }

  translate(x: number, y: number) {
    // Closing path; translation does not affect functionality.
  }

  scale(s: number) {
    // Closing path; scaling does not affect functionality.
  }

  getNearestPoint(point: IPoint, step: number): [IPoint, number] {
    // Just like a line, we find the nearest point between startingPoint and endingPoint
    const A = this.startingPoint;
    const B = this.endingPoint;

    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const AB_squared = ABx * ABx + ABy * ABy;
    let t = ((point.x - A.x) * ABx + (point.y - A.y) * ABy) / AB_squared;

    t = Math.max(0, Math.min(1, t)); // Clamp between 0 and 1

    const nearestPoint = { x: A.x + t * ABx, y: A.y + t * ABy };
    const distance = Math.hypot(point.x - nearestPoint.x, point.y - nearestPoint.y);

    return [nearestPoint, distance];
  }

  toString(): string {
    return this.relative ? 'z' : 'Z';
  }

}
