import { SvgCommand } from "./SvgCommand";

/**
 * Represents a "Z" (close path) command.
 */

export class CloseCommand extends SvgCommand {
  constructor(relative: boolean = false) {
    super('Z', relative);
  }
}
