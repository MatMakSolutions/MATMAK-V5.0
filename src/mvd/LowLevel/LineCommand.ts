import { SvgCommand } from "./SvgCommand";

/**
 * Represents an "L" (line) command.
 */

export class LineCommand extends SvgCommand {
  constructor(
    public x: number,
    public y: number,
    relative: boolean = false
  ) {
    super('L', relative);
  }

  previous: { x: number, y: number } = { x: 0, y: 0 };

  getTotalLength(): number {
    return Math.sqrt((this.x - this.previous.x) * (this.x - this.previous.x) + (this.y - this.previous.y) * (this.y - this.previous.y));
  }

  getPointAtLength(t: number): { x: number; y: number } {
    // Clamp t to the valid range.
    if (t <= 0) {
      return { x: this.previous.x, y: this.previous.y };
    }
    const totalLength = this.getTotalLength();
    if (t >= totalLength) {
      return { x: this.x, y: this.y };
    }

    const fraction = t / totalLength;
    const x = this.previous.x + (this.x - this.previous.x) * fraction;
    const y = this.previous.y + (this.y - this.previous.y) * fraction;
    return { x, y };
  }
}
