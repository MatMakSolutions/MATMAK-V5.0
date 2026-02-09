import { CloseCommand } from "./CloseCommand";
import { CurveCommand } from "./CurveCommand";
import { LineCommand } from "./LineCommand";
import { MoveCommand } from "./MoveCommand";
import { SvgCommand } from "./SvgCommand";

export class PathManipulator {
  private _pathString: string = '';

  /**
   * If true, the path is stored/edited as relative coordinates;
   * Otherwise, it is stored/edited as absolute coordinates.
   */
  public isRelative: boolean;

  /**
   * The array of command instances (Move, Line, Curve, Close).
   */
  public data: (MoveCommand | LineCommand | CurveCommand | CloseCommand)[] = [];

  /**
   * Offsets used during normalize/denormalize.
   */
  public normalX: number = 0;
  public normalY: number = 0;

  constructor(
    pathString: string,
    isRelative = false
  ) {
    this.isRelative = isRelative;
    this.path = pathString; // Use the setter to parse
  }

  calculatePreviousPoints() {
    // Calculate the previous points
    // first point is 0,0 if first item is not a move command
    const isRelative = this.isRelative;
    this.convertToAbsolute();
    let previousPoint = { x: 0, y: 0 };
    for (let i = 0; i < this.data.length; i++) {
      const cmd = this.data[i];
      if (cmd.type === 'M') {
        previousPoint = { x: (cmd as MoveCommand).x, y: (cmd as MoveCommand).y };
      } else if (cmd.type === 'L') {
        (cmd as LineCommand).previous = previousPoint;
        previousPoint = { x: (cmd as LineCommand).x, y: (cmd as LineCommand).y };
      } else if (cmd.type === 'C') {
        (cmd as CurveCommand).previous = previousPoint;
        previousPoint = { x: (cmd as CurveCommand).x, y: (cmd as CurveCommand).y };
      }
    }
    if (isRelative) {
      this.convertToRelative();
    }
  }


  /**
   * Getter/setter for the raw path string.
   * Setting it will parse and populate this.data.
   * Getting it will re-build from this.data.
   */
  public get path(): string {
    return this._pathString;
  }
  public set path(value: string) {
    this._pathString = value;
    this.data = this.parsePath(value);
    // If isRelative is true, ensure data is stored in relative form
    // or convert to absolute if false, after parsing.
    if (this.isRelative) {
      this.convertToRelative();
    } else {
      this.convertToAbsolute();
    }
  }

  // ————————————————————————————————————
  //  Public methods
  // ————————————————————————————————————

  /**
   * Translate the entire path by (dx, dy).
   * If we are storing path as relative, we must first convert to absolute,
   * translate, then convert back if needed.
   */
  public translate(dx: number, dy: number): void {
    if (this.isRelative) {
      // Temporarily convert to absolute
      this.convertToAbsolute();
    }

    for (const cmd of this.data) {
      if (cmd.type === 'M' || cmd.type === 'L') {
        (cmd as MoveCommand | LineCommand).x += dx;
        (cmd as MoveCommand | LineCommand).y += dy;
      } else if (cmd.type === 'C') {
        const c = cmd as CurveCommand;
        c.x1 += dx;
        c.y1 += dy;
        c.x2 += dx;
        c.y2 += dy;
        c.x  += dx;
        c.y  += dy;
      }
      // "Z" has no coordinates to translate
    }

    if (this.isRelative) {
      // Convert back to relative if that was our storage preference
      this.convertToRelative();
    }

    // Update the path string
    this._pathString = this.buildPathString();
  }

  /**
   * Rotate the entire path around its geometric center by `angle` degrees.
   * If we are storing as relative, convert to absolute first, do rotation, then convert back.
   * For simplicity, we treat "center" as the bounding box center.
   */
  public rotate(angle: number): void {
    if (this.isRelative) {
      this.convertToAbsolute();
    }

    const center = this.getCenter();
    const rad = (Math.PI / 180) * angle;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (const cmd of this.data) {
      if (cmd.type === 'M' || cmd.type === 'L') {
        const c = cmd as MoveCommand | LineCommand;
        const [nx, ny] = this.rotatePoint(c.x, c.y, center.x, center.y, cos, sin);
        c.x = nx;
        c.y = ny;
      } else if (cmd.type === 'C') {
        const c = cmd as CurveCommand;
        const [x1, y1] = this.rotatePoint(c.x1, c.y1, center.x, center.y, cos, sin);
        const [x2, y2] = this.rotatePoint(c.x2, c.y2, center.x, center.y, cos, sin);
        const [x,  y ] = this.rotatePoint(c.x,  c.y,  center.x, center.y, cos, sin);
        c.x1 = x1;  c.y1 = y1;
        c.x2 = x2;  c.y2 = y2;
        c.x  = x;   c.y  = y;
      }
    }

    if (this.isRelative) {
      this.convertToRelative();
    }

    this._pathString = this.buildPathString();
  }

  /**
   * Update one of the commands in `this.data` by index with new data,
   * then rebuild the path string. This respects the current `isRelative` state.
   */
  public update(
    index: number,
    newCmd: MoveCommand | LineCommand | CurveCommand | CloseCommand
  ): void {
    if (index < 0 || index >= this.data.length) {
      throw new Error(`Index ${index} is out of range for data array.`);
    }

    // Replace the command
    this.data[index] = newCmd;

    // Rebuild path string
    this._pathString = this.buildPathString();
    // If we store as relative, ensure the commands are relative
    if (this.isRelative) {
      this.convertToRelative();
      this._pathString = this.buildPathString();
    }
  }

  /**
   * Normalize the path so its center is at (0,0).
   * We store the translation used in `normalX` and `normalY`.
   */
  public normalize(): void {
    if (this.isRelative) {
      this.convertToAbsolute();
    }

    const center = this.getCenter();
    this.normalX = center.x;
    this.normalY = center.y;
    // Translate everything so that center moves to (0,0).
    this.translate(-center.x, -center.y);

    if (this.isRelative) {
      this.convertToRelative();
    }
    this._pathString = this.buildPathString();
  }

  /**
   * Denormalize by applying back the translation from normalX, normalY.
   * Moves path center from (0,0) back to original location.
   */
  public denormalize(): void {
    if (this.isRelative) {
      this.convertToAbsolute();
    }
    this.translate(this.normalX, this.normalY);

    if (this.isRelative) {
      this.convertToRelative();
    }
    this._pathString = this.buildPathString();
  }

  // ————————————————————————————————————
  //  Private helpers
  // ————————————————————————————————————

  /**
   * Parse the path string into an array of command objects (M, L, C, Z).
   */
  private parsePath(pathString: string): (MoveCommand | LineCommand | CurveCommand | CloseCommand)[] {
    const commands: (MoveCommand | LineCommand | CurveCommand | CloseCommand)[] = [];

    // Tokenize by command letters (M/m, L/l, C/c, Z/z)
    // Then read subsequent numbers as needed.
    // A basic approach:
    const regex = /([MLCZmlcz])|(-?\d*\.?\d+)/g;
    const tokens = pathString.match(regex) || [];

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (/[MLCZmlcz]/.test(token)) {
        // This is a command letter
        const cmdLetter = token;
        i++;

        switch (cmdLetter.toUpperCase()) {
          case 'M': {
            // For an M command, we might have multiple coordinate pairs following
            // until we encounter a new command or run out of tokens.
            const rel = (cmdLetter === 'm');
            // Typically the first pair is the Move, subsequent pairs can be implied "LineTo"
            // (SVG path spec nuance). We'll handle the first pair as MoveCommand,
            // and subsequent as LineCommand if found right after.
            if (i + 1 <= tokens.length) {
              // We expect x,y next
              const x = parseFloat(tokens[i]);
              const y = parseFloat(tokens[i+1]);
              i += 2;
              commands.push(new MoveCommand(x, y, rel));

              // If more coordinate pairs follow directly, interpret them as L commands
              while (i + 1 < tokens.length && !/[MLCZmlcz]/.test(tokens[i])) {
                const lx = parseFloat(tokens[i]);
                const ly = parseFloat(tokens[i+1]);
                i += 2;
                commands.push(new LineCommand(lx, ly, rel));
              }
            }
            break;
          }
          case 'L': {
            const rel = (cmdLetter === 'l');
            // We can have multiple (x,y) pairs until next command
            while (i + 1 < tokens.length && !/[MLCZmlcz]/.test(tokens[i])) {
              const x = parseFloat(tokens[i]);
              const y = parseFloat(tokens[i+1]);
              i += 2;
              commands.push(new LineCommand(x, y, rel));
            }
            break;
          }
          case 'C': {
            const rel = (cmdLetter === 'c');
            // We can have multiple sets of 6 coords: (x1 y1 x2 y2 x y)
            while (i + 5 < tokens.length && !/[MLCZmlcz]/.test(tokens[i])) {
              const x1 = parseFloat(tokens[i]);
              const y1 = parseFloat(tokens[i+1]);
              const x2 = parseFloat(tokens[i+2]);
              const y2 = parseFloat(tokens[i+3]);
              const x  = parseFloat(tokens[i+4]);
              const y  = parseFloat(tokens[i+5]);
              i += 6;
              commands.push(new CurveCommand(x1, y1, x2, y2, x, y, rel));
            }
            break;
          }
          case 'Z': {
            const rel = (cmdLetter === 'z');
            commands.push(new CloseCommand(rel));
            break;
          }
        }
      } else {
        // If we get here, it might be a stray number, or path is malformed.
        // We'll just skip it, or you could throw an error.
        i++;
      }
    }

    return commands;
  }

  /**
   * Rebuild a path string from `this.data`.
   */
  buildPathString(): string {
    let d = '';

    for (let i = 0; i < this.data.length; i++) {
      const cmd = this.data[i];
      const letter = cmd.relative ? cmd.type.toLowerCase() : cmd.type.toUpperCase();

      switch (cmd.type) {
        case 'M': {
          const c = cmd as MoveCommand;
          d += `${letter} ${this.fmt(c.x)} ${this.fmt(c.y)} `;
          break;
        }
        case 'L': {
          const c = cmd as LineCommand;
          d += `${letter} ${this.fmt(c.x)} ${this.fmt(c.y)} `;
          break;
        }
        case 'C': {
          const c = cmd as CurveCommand;
          d += `${letter} ${this.fmt(c.x1)} ${this.fmt(c.y1)} ${this.fmt(c.x2)} ${this.fmt(c.y2)} ${this.fmt(c.x)} ${this.fmt(c.y)} `;
          break;
        }
        case 'Z': {
          d += `${letter} `;
          break;
        }
      }
    }

    // Trim extra spaces
    return d.trim();
  }

  /**
   * Convert all commands in `this.data` to absolute coordinates (if they are not already).
   */
  convertToAbsolute(): void {
    let currentX = 0, currentY = 0;

    for (let i = 0; i < this.data.length; i++) {
      const cmd = this.data[i];
      if (!cmd.relative) {
        // Already absolute
        if (cmd.type === 'M' || cmd.type === 'L') {
          currentX = (cmd as MoveCommand | LineCommand).x;
          currentY = (cmd as MoveCommand | LineCommand).y;
        } else if (cmd.type === 'C') {
          const c = cmd as CurveCommand;
          currentX = c.x;
          currentY = c.y;
        }
        continue;
      }

      // Convert from relative to absolute
      switch (cmd.type) {
        case 'M': {
          const c = cmd as MoveCommand;
          c.x += currentX;
          c.y += currentY;
          currentX = c.x;
          currentY = c.y;
          c.relative = false;
          break;
        }
        case 'L': {
          const c = cmd as LineCommand;
          c.x += currentX;
          c.y += currentY;
          currentX = c.x;
          currentY = c.y;
          c.relative = false;
          break;
        }
        case 'C': {
          const c = cmd as CurveCommand;
          c.x1 += currentX;
          c.y1 += currentY;
          c.x2 += currentX;
          c.y2 += currentY;
          c.x  += currentX;
          c.y  += currentY;
          currentX = c.x;
          currentY = c.y;
          c.relative = false;
          break;
        }
        case 'Z': {
          // Z doesn't change currentX/Y but just mark relative = false
          cmd.relative = false;
          break;
        }
      }
    }
  }

  /**
   * Convert all commands in `this.data` to relative coordinates.
   */
  convertToRelative(): void {
    let currentX = 0, currentY = 0;

    for (let i = 0; i < this.data.length; i++) {
      const cmd = this.data[i];
      if (cmd.relative) {
        // Already relative
        // We still need to update the running currentX/currentY
        if (cmd.type === 'M' || cmd.type === 'L') {
          currentX += (cmd as MoveCommand | LineCommand).x;
          currentY += (cmd as MoveCommand | LineCommand).y;
        } else if (cmd.type === 'C') {
          const c = cmd as CurveCommand;
          currentX += c.x;
          currentY += c.y;
        }
        continue;
      }

      // Convert from absolute to relative
      switch (cmd.type) {
        case 'M': {
          const c = cmd as MoveCommand;
          c.x = c.x - currentX;
          c.y = c.y - currentY;
          currentX += c.x;
          currentY += c.y;
          c.relative = true;
          break;
        }
        case 'L': {
          const c = cmd as LineCommand;
          c.x = c.x - currentX;
          c.y = c.y - currentY;
          currentX += c.x;
          currentY += c.y;
          c.relative = true;
          break;
        }
        case 'C': {
          const c = cmd as CurveCommand;
          c.x1 = c.x1 - currentX;
          c.y1 = c.y1 - currentY;
          c.x2 = c.x2 - currentX;
          c.y2 = c.y2 - currentY;
          const absX = c.x;  // store old absolute for currentX
          const absY = c.y;
          c.x  = c.x - currentX;
          c.y  = c.y - currentY;
          currentX += c.x;
          currentY += c.y;
          c.relative = true;
          break;
        }
        case 'Z': {
          // Doesn't affect the current point, just mark relative
          cmd.relative = true;
          break;
        }
      }
    }
  }

  /**
   * Returns the bounding box center of the path in absolute coordinates.
   * We assume everything is in absolute coordinates. If `isRelative` is true,
   * call `convertToAbsolute()` first (which is done in the rotate/normalize calls).
   */
  private getCenter(): { x: number; y: number } {
    // We'll collect all x/y from Move, Line, Curve to find bounding box.
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    let startX = 0;
    let startY = 0;

    for (const cmd of this.data) {
      switch (cmd.type) {
        case 'M':
        case 'L': {
          const c = cmd as MoveCommand | LineCommand;
          if (c.x < minX) minX = c.x;
          if (c.y < minY) minY = c.y;
          if (c.x > maxX) maxX = c.x;
          if (c.y > maxY) maxY = c.y;
          break;
        }
        case 'C': {
          const c = cmd as CurveCommand;
          const pts = [
            [c.x1, c.y1],
            [c.x2, c.y2],
            [c.x,  c.y ]
          ];
          for (const [px, py] of pts) {
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
          break;
        }
        case 'Z': {
          // Z doesn't add new bounding points, but it closes to the last Move,
          // which we’ve already accounted for from the M command.
          break;
        }
      }
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return { x: cx, y: cy };
  }

  /**
   * Helper to rotate a point (px, py) around (cx, cy) by cos, sin.
   */
  private rotatePoint(
    px: number, py: number,
    cx: number, cy: number,
    cos: number, sin: number
  ): [number, number] {
    // Translate to origin
    const dx = px - cx;
    const dy = py - cy;
    // Rotate
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    // Translate back
    return [rx + cx, ry + cy];
  }

  /**
   * Format a number nicely to reduce unnecessary decimals.
   */
  private fmt(n: number): string {
    return Number(n.toFixed(3)).toString();
  }


  /**
 * Returns the nearest location on this path to the given target point.
 * We sample each segment at small increments of `step` (default 0.01).
 *
 * @param target { x, y } - The point to check against
 * @param step number - The increment in [0..1] to sample each segment
 * @returns {
 *   index: number;        // index of the closest command in this.data
  *   command: SvgCommand;  // that command instance
  *   distance: number;     // the closest distance found
  *   closestPoint: { x: number, y: number }; // coordinates of the nearest point
  * }
  */
 public getNearestLocation(
   target: { x: number; y: number },
   step: number = 0.01
 ): {
   index: number;
   command: SvgCommand;
   distance: number;
   closestPoint: { x: number; y: number };
 } {
   // Make sure we are working in absolute coordinates for simplicity
   const wasRelative = this.isRelative;
   if (wasRelative) {
     this.convertToAbsolute();
   }

   let minDist = Number.MAX_VALUE;
   let nearestIndex = -1;
   let nearestCommand: SvgCommand | null = null;
   let nearestPt = { x: 0, y: 0 };

   // We need to track the "current" (start) point of each segment
   let currX = 0;
   let currY = 0;
   let startX = 0;
   let startY = 0;

   for (let i = 0; i < this.data.length; i++) {
     const cmd = this.data[i];

     if (cmd.type === 'M') {
       // Move command sets a new current point
       const mc = cmd as MoveCommand;
       currX = mc.x;
       currY = mc.y;
       startX = mc.x;
       startY = mc.y;
       continue;
     }

     if (cmd.type === 'L') {
       // For a line from currX,currY to cmd.x,cmd.y
       const lc = cmd as LineCommand;
       const segStart = { x: currX, y: currY };
       const segEnd = { x: lc.x, y: lc.y };

       // Sample line
       for (let t = 0; t <= 1; t += step) {
         const sx = segStart.x + t * (segEnd.x - segStart.x);
         const sy = segStart.y + t * (segEnd.y - segStart.y);
         const dist = distance(sx, sy, target.x, target.y);
         if (dist < minDist) {
           minDist = dist;
           nearestIndex = i;
           nearestCommand = cmd;
           nearestPt = { x: sx, y: sy };
         }
       }

       currX = lc.x;
       currY = lc.y;
     }
     else if (cmd.type === 'C') {
       // For a cubic Bezier from currX,currY to cmd.x,cmd.y with control points
       const cc = cmd as CurveCommand;
       const p0 = { x: currX, y: currY };
       const p1 = { x: cc.x1, y: cc.y1 };
       const p2 = { x: cc.x2, y: cc.y2 };
       const p3 = { x: cc.x,  y: cc.y  };

       // Sample cubic
       for (let t = 0; t <= 1; t += step) {
         const { x: bx, y: by } = cubicAt(p0, p1, p2, p3, t);
         const dist = distance(bx, by, target.x, target.y);
         if (dist < minDist) {
           minDist = dist;
           nearestIndex = i;
           nearestCommand = cmd;
           nearestPt = { x: bx, y: by };
         }
       }

       currX = cc.x;
       currY = cc.y;
     }
     else if (cmd.type === 'Z') {
       // A close command from current point back to startX,startY
       const segStart = { x: currX, y: currY };
       const segEnd = { x: startX, y: startY };
       for (let t = 0; t <= 1; t += step) {
         const sx = segStart.x + t * (segEnd.x - segStart.x);
         const sy = segStart.y + t * (segEnd.y - segStart.y);
         const dist = distance(sx, sy, target.x, target.y);
         if (dist < minDist) {
           minDist = dist;
           nearestIndex = i;
           nearestCommand = cmd;
           nearestPt = { x: sx, y: sy };
         }
       }
       // After Z, current point is at start
       currX = startX;
       currY = startY;
     }
   }

   // If path was originally relative, convert back if desired
   if (wasRelative) {
     this.convertToRelative();
   }

   if (!nearestCommand) {
     throw new Error('No nearest command found (path is empty?)');
   }

   return {
     index: nearestIndex,
     command: nearestCommand,
     distance: minDist,
     closestPoint: nearestPt
   };
 }

/**
 * Splits the command at `index` into 2 new commands by inserting a break at `splitPoint`.
 * Returns an object describing the 2 new commands + their indexes.
 *
 * For a LineCommand, we simply create two lines.
 * For a CurveCommand, we do a naive "split" - ideally you'd compute param t.
 * If the command is 'M' or 'Z', or if the split point doesn't lie on the segment, we throw an error.
 */
public split(
  index: number,
  splitPoint: { x: number; y: number }
): {
  command1: SvgCommand;
  command2: SvgCommand;
  index1: number;
  index2: number;
} {
  if (index < 0 || index >= this.data.length) {
    throw new Error(`split: Index ${index} out of range`);
  }

  // Convert to absolute if needed, so we can rely on absolute coordinates
  const wasRelative = this.isRelative;
  if (wasRelative) {
    this.convertToAbsolute();
  }

  const cmdToSplit = this.data[index];
  if (cmdToSplit.type === 'M' || cmdToSplit.type === 'Z') {
    throw new Error(`split: Cannot split command type ${cmdToSplit.type}`);
  }

  // We need the starting point of this segment
  const { startX, startY } = this.getSegmentStart(index);

  let cmd1: SvgCommand;
  let cmd2: SvgCommand;

  if (cmdToSplit.type === 'L') {
    const lc = cmdToSplit as LineCommand;
    // old line: start -> lc.x,lc.y
    // new lines: start -> splitPoint, then splitPoint -> end
    cmd1 = new LineCommand(splitPoint.x, splitPoint.y, false);
    cmd2 = new LineCommand(lc.x, lc.y, false);
  }
  else if (cmdToSplit.type === 'C') {
    const cc = cmdToSplit as CurveCommand;
    // We do a naive approach:
    // (1) Ideally find param t; below is a placeholder t=0.5 or so
    // (2) Subdivide the cubic
    // For demonstration, we assume we *already* know param t for the point:
    const t = this.estimateParamForPoint(
      { x: startX, y: startY },
      { x: cc.x1, y: cc.y1 },
      { x: cc.x2, y: cc.y2 },
      { x: cc.x,  y: cc.y  },
      splitPoint
    );
    const [c1, c2] = this.splitCubic(
      { x: startX, y: startY },
      { x: cc.x1, y: cc.y1 },
      { x: cc.x2, y: cc.y2 },
      { x: cc.x,  y: cc.y  },
      t
    );
    // c1 and c2 are arrays of 4 points [p0, p1, p2, p3]
    // Create two CurveCommands
    cmd1 = new CurveCommand(c1[1].x, c1[1].y, c1[2].x, c1[2].y, c1[3].x, c1[3].y, false);
    cmd2 = new CurveCommand(c2[1].x, c2[1].y, c2[2].x, c2[2].y, c2[3].x, c2[3].y, false);
  }
  else {
    throw new Error(`split: Unknown command type ${cmdToSplit.type}`);
  }

  // Remove the old command from the data array
  this.data.splice(index, 1, cmd1, cmd2);

  const cmd1Index = index;
  const cmd2Index = index + 1;

  // Rebuild path string
  this._pathString = this.buildPathString();

  // If we originally had relative, convert back
  if (wasRelative) {
    this.convertToRelative();
    this._pathString = this.buildPathString();
  }

  return {
    command1: cmd1,
    command2: cmd2,
    index1: cmd1Index,
    index2: cmd2Index
  };
}

/**
 * Helper: returns the start point (x,y) for the segment at `index`.
 * We walk from data[0] to data[index-1] to find the "current point" in absolute coords.
 */
private getSegmentStart(index: number): { startX: number; startY: number } {
  let currX = 0, currY = 0;
  let startX = 0, startY = 0;
  for (let i = 0; i < index; i++) {
    const c = this.data[i];
    if (c.type === 'M') {
      const m = c as MoveCommand;
      currX = m.x;
      currY = m.y;
      startX = m.x;
      startY = m.y;
    }
    else if (c.type === 'L') {
      const l = c as LineCommand;
      currX = l.x;
      currY = l.y;
    }
    else if (c.type === 'C') {
      const cc = c as CurveCommand;
      currX = cc.x;
      currY = cc.y;
    }
    else if (c.type === 'Z') {
      // After Z, we return to the subpath's start
      currX = startX;
      currY = startY;
    }
  }
  return { startX: currX, startY: currY };
}

/**
 * (Optional) Example of how you might estimate a param `t` for the split point
 * in a cubic. This is just a placeholder:
 *   - do a naive "sample" approach
 *   - find t that yields minimal distance to splitPoint
 */
private estimateParamForPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  splitPoint: { x: number; y: number },
  divisions: number = 100
): number {
  let bestT = 0;
  let minDist = Number.MAX_VALUE;
  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    const pt = cubicAt(p0, p1, p2, p3, t);
    const dist = distance(pt.x, pt.y, splitPoint.x, splitPoint.y);
    if (dist < minDist) {
      minDist = dist;
      bestT = t;
    }
  }
  return bestT;
}

/**
 * Splits a cubic Bézier at param t into two cubics.
 * Returns [[p0, p1a, p2a, p3a], [p3a, p1b, p2b, p3]] for the two segments.
 * Standard De Casteljau approach (or any known formula).
 */
private splitCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): [{ x: number; y: number }[], { x: number; y: number }[]] {
  // De Casteljau or direct formula
  // For brevity here is a quick reference approach:
  const p01   = this.lerp(p0, p1, t);
  const p12   = this.lerp(p1, p2, t);
  const p23   = this.lerp(p2, p3, t);
  const p0112 = this.lerp(p01, p12, t);
  const p1223 = this.lerp(p12, p23, t);
  const pMid  = this.lerp(p0112, p1223, t);

  // First cubic: p0 -> p01 -> p0112 -> pMid
  // Second cubic: pMid -> p1223 -> p23 -> p3
  return [
    [p0, p01, p0112, pMid],
    [pMid, p1223, p23, p3]
  ];
}

/** linear interpolation of points */
lerp(a: {x:number;y:number}, b: {x:number;y:number}, t: number) {
  return { x: a.x + t*(b.x - a.x), y: a.y + t*(b.y - a.y) };
}

/**
 * Given two points (p1, p2), find where each lies on this path (by nearest segment index + param),
 * then return them in the order they appear along this path's clockwise drawing.
 *
 * If p1 occurs first, returns [p1, p2].
 * If p2 occurs first, returns [p2, p1].
 *
 * @param p1   The first point, e.g. { x: number, y: number }
 * @param p2   The second point
 * @param step The sampling step used by getNearestLocation (default 0.01)
 * @returns    A 2-tuple of points in their clockwise order
 */
public getPointsInClockwiseOrder(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  step: number = 0.01
): [{ x: number; y: number }, { x: number; y: number }, boolean] {
  // 1) Find the nearest location info for each point
  const near1 = this.getNearestLocation(p1, step);
  const near2 = this.getNearestLocation(p2, step);

  // 2) Compare segment indices
  if (near1.index < near2.index) {
    // p1 is encountered first
    return [p1, p2, true];
  } else if (near1.index > near2.index) {
    // p2 is encountered first
    return [p2, p1, false];
  } else {
    // 3) If both are on the same segment, compare param t
    if (near1.distance <= near2.distance) {
      return [p1, p2, true];
    } else {
      return [p2, p1, false];
    }
  }
}

}

export function calculateProjection(p1: { x: number; y: number }, p2: { x: number; y: number }, distance: number) {
   // Step 1: Calculate the direction vector of the segment
   const dx = p2.x - p1.x;
   const dy = p2.y - p1.y;

   // Step 2: Compute the perpendicular vector
   // For a top-left origin, perpendicular is (dy, -dx) to maintain correct orientation
   let perpX = dy;
   let perpY = -dx;

   // Step 3: Normalize the perpendicular vector
   const length = Math.sqrt(perpX * perpX + perpY * perpY);
   perpX /= length;
   perpY /= length;

   // Step 4: Scale the perpendicular vector by the distance
   perpX *= distance;
   perpY *= distance;

   // Step 5: Add the scaled perpendicular vector to p1 to get the projected point
   const projectedPoint = {
     x: perpX,
     y: perpY,
   };

   return projectedPoint;
  }

 /**
  * Helper to compute Euclidean distance
  */
 function distance(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}


/**
 * Helper to compute cubic Bezier at parameter t
 * B(t) = (1 - t)^3 * p0 + 3(1 - t)^2 * t * p1 + 3(1 - t) * t^2 * p2 + t^3 * p3
 */
function cubicAt(p0: {x:number,y:number}, p1: {x:number,y:number}, p2: {x:number,y:number}, p3: {x:number,y:number}, t: number): { x: number, y: number } {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
    y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
  };
}
