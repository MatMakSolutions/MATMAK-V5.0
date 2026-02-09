import { ACommand } from "../ACommand";
import { ZCommand } from "../ZCommand";
import { CCommand } from "../CCommand";
import { HCommand } from "../HCommand";
import { IPoint } from "../../Utils/IPoint";
import { LCommand } from "../LCommand";
import { MoveCommand } from "../MCommand";
import { QCommand } from "../QCommand";
import { SCommand } from "../SCommand";
import { TCommand } from "../TCommand";
import { VCommand } from "../VCommand";

export function format(value: number): string {
  return value.toFixed(2).replace(/\.00$/, ''); // Truncate to 2 decimal places, remove trailing ".00"
}


export type TCommandLetter = 'M' | 'L' | 'C' | 'Q' | 'V' | 'H' | 'S' | 'T' | 'A' | 'Z';

///////////////////////////////////////////////////
export type TClosestPointResult = {
  t: number;                // Parameter along the segment (0 to 1)
  point: IPoint;            // The {x, y} coordinates of the closest point
  distance: number;         // The direct, straight-line distance from the input point
  distanceOnSegment: number;// The arc length from the start of this segment to the closest point
};
////////////////////////////////////////////////////////////
/**
 * Base abstract class for all path commands.
 */
export abstract class SvgCommand {
  abstract type: TCommandLetter;
  private _previousCommand!: SvgCommand;
  private _nextCommand!: SvgCommand;

  abstract toAbsolute(current: IPoint): { cmd: TSVGCommand; endPoint: IPoint };
  // Convert command to relative coordinates based on the provided current point.
  abstract toRelative(current: IPoint): { cmd: TSVGCommand; endPoint: IPoint };
  abstract clone(): TSVGCommand;

  abstract get endingPoint(): IPoint;
  abstract updateEndingPoint(point: IPoint): void;

  abstract reverseDirection(): void;

  /////////////////////////////////////////////////
// --- NEW AND STANDARDIZED METHODS ---
  /**
   * Calculates the total arc length of the command segment.
   */
  abstract getLength(): number;

  /**
   * Finds the closest point on the segment to a given external point.
   */
  abstract getClosestPoint(p: IPoint): TClosestPointResult;
  //////////////////////////////////////////////////

  get previousCommand(): SvgCommand {
    return this._previousCommand;
  }

  get nextCommand(): SvgCommand {
    return this._nextCommand;
  }

  getPreviousControlPoint(): IPoint {
    if (this._previousCommand.type === 'C') {
      return (this._previousCommand as CCommand).controlPoint2;
    }
    if (this._previousCommand.type === 'Q') {
      return (this._previousCommand as QCommand).controlPoint;
    }
    if (this._previousCommand.type === 'S') {
      return (this._previousCommand as SCommand).controlPoint2;
    }
    if (this._previousCommand.type === 'T') {
      return (this._previousCommand as TCommand).controlPoint
    }
    return this.endingPoint;
  }

  linkBefore(command: SvgCommand) {
    this._previousCommand = command;
    command._nextCommand = this;
  }

  linkAfter(command: SvgCommand) {
    this._nextCommand = command;
    command._previousCommand = this;
  }

  insertbefore(command: SvgCommand) {
    this._previousCommand._nextCommand = command;
    command._previousCommand           = this._previousCommand;
    command._nextCommand               = this;
    this._previousCommand              = command;
  }

  insertAfter(command: SvgCommand) {
    this._nextCommand._previousCommand = command;
    command._nextCommand               = this._nextCommand;
    command._previousCommand           = this;
    this._nextCommand                  = command;
  }

  replaceWith(command: SvgCommand) {
    this._previousCommand._nextCommand = command;
    this._nextCommand._previousCommand = command;
    command._previousCommand           = this._previousCommand;
    command._nextCommand               = this._nextCommand;
    this._nextCommand                  = this;
    this._previousCommand              = this;
  }

  delete() {
    this._previousCommand._nextCommand = this._nextCommand;
    this._nextCommand._previousCommand = this._previousCommand;
  }

  reverse() {
    const previous = this._previousCommand;
    this._previousCommand = this._nextCommand;
    this._nextCommand = previous;
    this.reverseDirection();
  }

  get startingPoint(): IPoint {
    return this._previousCommand?.endingPoint ?? this.endingPoint;
  }

  updateStartingPoint(point: IPoint) {
    this._previousCommand.updateEndingPoint(point);
  }

  constructor(
    public relative: boolean
  ) { }
}

export type TSVGCommand = MoveCommand | LCommand | HCommand | VCommand |
                          CCommand    | SCommand | QCommand | ACommand |
                          TCommand    | ZCommand;
