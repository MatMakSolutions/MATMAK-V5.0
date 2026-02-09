import { SvgCommand } from "./SvgCommand";

/**
 * Represents an "M" (move) command.
 */

export class MoveCommand extends SvgCommand {
  constructor(
    public x: number,
    public y: number,
    relative: boolean = false
  ) {
    super('M', relative);
  }
}
