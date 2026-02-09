import { format, SvgCommand,TClosestPointResult } from "./Abstract/SvgCommand";
import { LCommand } from "./LCommand";
import { IPoint } from "../Utils/IPoint";

/**
 * Represents a "V" (vertical line) command.
 */
export class VCommand extends SvgCommand {
  type: 'V' = 'V';
  x:number;
  y: number;
  //startingPoint: IPoint = { x: 0, y: 0 };
  //endingPoint: IPoint = { x: 0, y: 0 };
 ////////////////////////////////////////
private _asLine(): LCommand {
      const line = new LCommand(this.endingPoint.x, this.endingPoint.y);
      line.linkBefore(this.previousCommand);
      return line;
  }

  public getLength(): number { return this._asLine().getLength(); }
  public getClosestPoint(point: IPoint): TClosestPointResult { return this._asLine().getClosestPoint(point); }
  //////////////////////////////////////////////////
  get endingPoint(): IPoint {
    return { x: this.startingPoint.x, y: this.y };
  }

  updateEndingPoint(point: IPoint): void {
    this.y = point.y;
  }

  constructor(y: number, relative: boolean = false) {
    super(relative);
    this.y = y;
  }

  /**
   * Converts the V command to an equivalent Line command.
   */
  toLineCommand(): LCommand {
    const x = this.startingPoint.x;
    const line = new LCommand(x, this.y, this.relative);
    //line.startingPoint = this.startingPoint;
    //line.endingPoint = { x, y: this.y };
    return line;
  }

  toAbsolute(current: IPoint): { cmd: VCommand; endPoint: IPoint } {
    const absY = this.relative ? current.y + this.y : this.y;
    // Vertical line: x remains the same.
    const res =  { cmd: new VCommand(absY, false), endPoint: { x: current.x, y: absY } };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //this.endingPoint.x = res.endPoint.x;
    //this.endingPoint.y = res.endPoint.y;
    return res;
  }
  toRelative(current: IPoint): { cmd: VCommand; endPoint: IPoint } {
    const { endPoint } = this.toAbsolute(current);
    const relY = endPoint.y - current.y;
    const res =  { cmd: new VCommand(relY, true), endPoint: endPoint };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = res.endPoint;
    return res;
  }
  clone(): VCommand {
    return new VCommand(this.y, this.relative);
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
    const endingPoint = rotatePoint({ x: this.startingPoint.x, y: this.y });
    this.y = endingPoint.y;
  }

  reverseDirection() {
    // Swap the starting and ending points
    const [startingPoint, endingPoint] = [this.endingPoint, this.startingPoint];

    // Update y coordinate
    this.y = this.endingPoint.y;
  }

  getTotalLength(): number {
    return Math.abs(this.y - this.startingPoint.y);
  }

  getPointAtLength(t: number): { x: number; y: number } {
    const totalLength = this.getTotalLength();
    const targetY = this.startingPoint.y + t * (this.y - this.startingPoint.y);
    return { x: this.startingPoint.x, y: targetY };
  }

  translate(x: number, y: number) {
    this.y += y;
    this.endingPoint.y += y;
  }

  scale(s: number) {
    this.y *= s;
    this.endingPoint.y *= s;
  }

  split(point: IPoint, step: number = 0.01): [VCommand, VCommand] {
    const first = new VCommand(point.y, this.relative);
    const second = new VCommand(this.y, this.relative);

    //first.startingPoint = this.startingPoint;
    //first.endingPoint = { x: this.startingPoint.x, y: point.y };
    //second.startingPoint = first.endingPoint;
    //second.endingPoint = this.endingPoint;

    return [first, second];
  }

  getNearestPoint(point: IPoint, step: number): [IPoint, number] {
    // Handle degenerate segment (zero-length vertical line)
    if (this.y === this.startingPoint.y) {
      // Vertical line has zero length, return distance to the single point
      const distance = Math.hypot(point.x - this.startingPoint.x, point.y - this.startingPoint.y);
      return [{ x: this.startingPoint.x, y: this.startingPoint.y }, distance];
    }
    
    const nearestY = Math.max(Math.min(point.y, this.y), this.startingPoint.y);
    const nearestPoint = { x: this.startingPoint.x, y: nearestY };
    const distance = Math.abs(point.x - this.startingPoint.x);

    return [nearestPoint, distance];
  }

  toString(): string {
    return `${this.relative ? 'v' : 'V'} ${format(this.y)}`;
  }

}
