import { format, SvgCommand ,TClosestPointResult} from "./Abstract/SvgCommand";
import { LCommand } from "./LCommand";
import { IPoint } from "../Utils/IPoint";

/**
 * Represents an "H" (horizontal line) command.
 */
export class HCommand extends SvgCommand {
  type: 'H' = 'H';

  x: number;
  //startingPoint: IPoint = { x: 0, y: 0 };
  //endingPoint: IPoint = { x: 0, y: 0 };

 ////////////////////////////////////////
 private _asLine(): LCommand {
      const line = new LCommand(this.endingPoint.x, this.endingPoint.y);
      line.linkBefore(this.previousCommand); // So it gets the correct starting point
      return line;
  }
public getLength(): number { return this._asLine().getLength(); }
  public getClosestPoint(point: IPoint): TClosestPointResult { return this._asLine().getClosestPoint(point); }
  //////////////////////////////////////////////////

  get endingPoint(): IPoint {
    return { x: this.x, y: this.startingPoint.y };
  }

  updateEndingPoint(point: IPoint): void {
    this.x = point.x;
  }

  constructor(x: number, relative: boolean = false) {
    super(relative);
    this.x = x;
  }

  /**
   * Converts the H command to an equivalent Line command.
   */
  toLineCommand(): LCommand {
    const y = this.startingPoint.y;
    const line = new LCommand(this.x, y, this.relative);
    //line.startingPoint = this.startingPoint;
    //line.endingPoint = { x: this.x, y };
    return line;
  }

  toAbsolute(current: IPoint): { cmd: HCommand; endPoint: IPoint } {
    const absX = this.relative ? current.x + this.x : this.x;
    // Horizontal line: y remains the same.
    const res = { cmd: new HCommand(absX, false), endPoint: { x: absX, y: current.y } };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = this.endingPoint;
    //this.endingPoint.x = res.endPoint.x;
    //this.endingPoint.y = res.endPoint.y;
    return res;
  }
  toRelative(current: IPoint): { cmd: HCommand; endPoint: IPoint } {
    const { endPoint } = this.toAbsolute(current);
    const relX = endPoint.x - current.x;
    const res = { cmd: new HCommand(relX, true), endPoint: endPoint };
    //res.cmd.startingPoint = this.startingPoint;
    //res.cmd.endingPoint = res.endPoint;
    return res;
  }
  clone(): HCommand {
    return new HCommand(this.x, this.relative);
  }

  rotate(origin: IPoint, angle: number) {
    const angleRad = (angle * Math.PI) / 180;

    // Since this is a horizontal line, we need to rotate both start and end points
    const rotatePoint = (p: IPoint): IPoint => {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      return {
        x: origin.x + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: origin.y + dx * Math.sin(angleRad) + dy * Math.cos(angleRad),
      };
    };

    //this.startingPoint = rotatePoint(this.startingPoint);
    const endingPoint = rotatePoint({ x: this.x, y: this.startingPoint.y });

    this.x = endingPoint.x;
  }

  reverseDirection() {
    // Swap the starting and ending points
    const [startingPoint, endingPoint] = [this.endingPoint, this.startingPoint];

    // Update x coordinate
    this.x = endingPoint.x;
  }

    /**
   * Approximates the total length of the horizontal line.
   */
    getTotalLength(): number {
      return Math.abs(this.x - this.startingPoint.x);
    }

    /**
     * Returns a point at a given fraction of the line's length.
     */
    getPointAtLength(t: number): { x: number; y: number } {
      const targetX = this.startingPoint.x + t * (this.x - this.startingPoint.x);
      return { x: targetX, y: this.startingPoint.y };
    }

    translate(x: number, y: number) {
      this.x += x;
      //this.endingPoint.x = this.x;
    }

    scale(s: number) {
      this.x *= s;
      //this.endingPoint.x = this.x;
    }


    split(point: IPoint, step: number = 0.01): [HCommand, HCommand] {
      const first = new HCommand(point.x, this.relative);
      const second = new HCommand(this.x, this.relative);

      //first.startingPoint = this.startingPoint;
      //first.endingPoint = { x: point.x, y: this.startingPoint.y };
      //second.startingPoint = first.endingPoint;
      //second.endingPoint = this.endingPoint;

      return [first, second];
    }

    getNearestPoint(point: IPoint, step: number): [IPoint, number] {
      // Handle degenerate segment (zero-length horizontal line)
      if (this.x === this.startingPoint.x) {
        // Horizontal line has zero length, return distance to the single point
        const distance = Math.hypot(point.x - this.startingPoint.x, point.y - this.startingPoint.y);
        return [{ x: this.startingPoint.x, y: this.startingPoint.y }, distance];
      }
      
      const nearestX = Math.max(Math.min(point.x, this.x), this.startingPoint.x);
      const nearestPoint = { x: nearestX, y: this.startingPoint.y };
      const distance = Math.abs(point.y - this.startingPoint.y);

      return [nearestPoint, distance];
    }

    toString(): string {
      return `${this.relative ? 'h' : 'H'} ${format(this.x)}`;
    }


}
