
import { PaperOffset } from 'paperjs-offset';
import { ACommand } from "./Commands/ACommand";
import { ZCommand } from "./Commands/ZCommand";
import { CCommand } from "./Commands/CCommand";
import { HCommand } from "./Commands/HCommand";
import { LCommand } from "./Commands/LCommand";
import { MoveCommand } from "./Commands/MCommand";
import { QCommand } from "./Commands/QCommand";
import { SCommand } from "./Commands/SCommand";
import { SvgCommand, TSVGCommand } from "./Commands/Abstract/SvgCommand";
import { TCommand } from "./Commands/TCommand";
import { VCommand } from "./Commands/VCommand";
import { IPoint } from "./Utils/IPoint";
import paper from 'paper';
import {ppInfo} from "../ui/controls/popup/Popup";

// Create and append a canvas to the document so you can see the results.
const canvas = document.createElement('canvas');
canvas.width = 500;
canvas.height = 500;
document.body.appendChild(canvas);
paper.setup(canvas);

export class ReferencePoint {
  _X : number = 0;
  _Y : number = 0;

  _points: IPoint[] = [];

  constructor(x: number, y: number) {
    this._X = x;
    this._Y = y;
  }

  get X(): number {
    return this._X;
  }

  set X(value: number) {
    this._X = value;
  }

  get Y(): number {
    return this._Y;
  }

  set Y(value: number) {
    this._Y = value;
  }

  addPoint(point: IPoint): void {
    this._points.push(point);
  }

  updatePosition(x: number, y: number): void {
    // Update the position of the reference point
    // Update a delta position for all points so they stay visually the same
    const deltaX = x - this._X;
    const deltaY = y - this._Y;
    this._X = x;
    this._Y = y;
    this._points.forEach(point => {
      point.x += deltaX;
      point.y += deltaY;
    });
  }
}

export class VectorPath {
  private _cloned: boolean = false;
  private _paths: string[];
  private nested: VectorPath[];
  private commands: TSVGCommand[] = [];
  private _originalPosition: IPoint = { x: 0, y: 0 };
  private _normalized: boolean = false;
  private backup: VectorPath;
  private _path: string;
  _referencePoint: ReferencePoint | null = null;

  constructor() {
    this._paths = [];
    this.nested = [];
  }

  get paths(): string[] {
    return this._paths;
  }

  set paths(value: string[]) {
    this._paths = value;
  }

  get originalPosition(): IPoint {
    return {...this._originalPosition};
  }
set originalPosition(value: IPoint) {
  this._originalPosition = { ...value };
}
  getCommands() {
    const commands: TSVGCommand[] = [];
    const firstCmd = this.commands[0];
    // Add all commands and go to teh next one until we reach the first command again
    let currentCmd: SvgCommand = firstCmd;
    do {
      commands.push(currentCmd as TSVGCommand);
      currentCmd = currentCmd.nextCommand;
    } while (currentCmd !== firstCmd);
    return commands;
    //return this.commands;
  }

  reset() {
    this.parse(this._path, true);
    if (this._normalized) {
      this._normalized = false;
      this.toAbsolute();
      this.simplify({forceLine: true, forceCurve: true});
      this.normalize();
    }
  }

  public parse(pathString: string, forReset: boolean = false): void {
    if (!this._path) this._path = pathString;
    const commands: TSVGCommand[] = [];
    // TODO implement the clock wise check
    const pp = new paper.Path(pathString);
    pp.closePath();
    pp.clockwise = true;
    pathString = pp.pathData;

    // Updated regex includes all SVG path command letters
    const regex = /([MLHVCSQTAZmlhvcsqtaz])|(-?\d*\.?\d+)/g;
    const tokens = pathString.match(regex) || [];

    let prevCommandCursor! : SvgCommand;
    let startMC!: MoveCommand;

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (/[MLHVCSQTAZmlhvcsqtaz]/.test(token)) {
        const cmdLetter = token;
        i++;
        const relative = (cmdLetter === cmdLetter.toLowerCase());
        switch (cmdLetter.toUpperCase()) {
          case 'M': {
            // The first pair is a Move; any subsequent pairs are implicit Line commands.
            if (i + 1 < tokens.length) {
              const x = parseFloat(tokens[i]);
              const y = parseFloat(tokens[i + 1]);
              i += 2;
              const Mcmd = new MoveCommand(x, y, relative);
              prevCommandCursor = Mcmd;
              startMC = Mcmd;
              commands.push(Mcmd);
              //Mcmd.startingPoint = { x, y };
              //Mcmd.endingPoint = { x, y };

              // Process additional pairs as LineCommands.
              while (i + 1 < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
                const lx = parseFloat(tokens[i]);
                const ly = parseFloat(tokens[i + 1]);
                i += 2;
                const Lcmd = new LCommand(lx, ly, relative);
                const LcmdIdx = commands.push(Lcmd);
                prevCommandCursor.linkAfter(Lcmd);
                prevCommandCursor = Lcmd;
                //Lcmd.startingPoint = commands[LcmdIdx - 2].endingPoint;
                //Lcmd.endingPoint = { x: lx, y: ly };
              }
            }
            break;
          }
          case 'L': {
            while (i + 1 < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const x = parseFloat(tokens[i]);
              const y = parseFloat(tokens[i + 1]);
              i += 2;
              const Lcmd = new LCommand(x, y, relative);
              const LcmdIdx = commands.push(Lcmd);
              prevCommandCursor.linkAfter(Lcmd);
              prevCommandCursor = Lcmd;
              //Lcmd.startingPoint = commands[LcmdIdx - 2].endingPoint;
              //Lcmd.endingPoint = { x, y };
            }
            break;
          }
          case 'H': {
            // Horizontal line: one coordinate per command.
            while (i < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const x = parseFloat(tokens[i]);
              i++;
              const Hcmd = new HCommand(x, relative);
              const HcmdIdx = commands.push(Hcmd);
              prevCommandCursor.linkAfter(Hcmd);
              prevCommandCursor = Hcmd;
              //Hcmd.startingPoint = commands[HcmdIdx - 2].endingPoint;
              //Hcmd.endingPoint = { x, y: Hcmd.startingPoint.y };
            }
            break;
          }
          case 'V': {
            // Vertical line: one coordinate per command.
            while (i < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const y = parseFloat(tokens[i]);
              i++;
              const Vcmd = new VCommand(y, relative);
              const VcmdIdx = commands.push(Vcmd);
              prevCommandCursor.linkAfter(Vcmd);
              prevCommandCursor = Vcmd;
              //Vcmd.startingPoint = commands[VcmdIdx - 2].endingPoint;
              //Vcmd.endingPoint = { x: Vcmd.startingPoint.x, y };
            }
            break;
          }
          case 'C': {
            // Cubic Bézier: six numbers per segment.
            while (i + 5 < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const x1 = parseFloat(tokens[i]);
              const y1 = parseFloat(tokens[i + 1]);
              const x2 = parseFloat(tokens[i + 2]);
              const y2 = parseFloat(tokens[i + 3]);
              const x  = parseFloat(tokens[i + 4]);
              const y  = parseFloat(tokens[i + 5]);
              i += 6;
              const Ccmd = new CCommand(x1, y1, x2, y2, x, y, relative);
              const CcmdIdx = commands.push(Ccmd);
              prevCommandCursor.linkAfter(Ccmd);
              prevCommandCursor = Ccmd;
              //Ccmd.startingPoint = commands[CcmdIdx - 2].endingPoint;
              //Ccmd.endingPoint.x = x;
              //Ccmd.endingPoint.y = y;
            }
            break;
          }
          case 'S': {
            // Smooth cubic Bézier: four numbers per segment (x2, y2, x, y).
            while (i + 3 < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const x2 = parseFloat(tokens[i]);
              const y2 = parseFloat(tokens[i + 1]);
              const x  = parseFloat(tokens[i + 2]);
              const y  = parseFloat(tokens[i + 3]);
              i += 4;
              const Scmd = new SCommand(x2, y2, x, y, relative);
              const ScmdIdx = commands.push(Scmd);
              prevCommandCursor.linkAfter(Scmd);
              prevCommandCursor = Scmd;
              //Scmd.startingPoint = commands[ScmdIdx - 2].endingPoint;
              //Scmd.endingPoint = { x, y };
              //const previousCommand = commands[ScmdIdx - 2];
              //if (previousCommand instanceof CCommand || previousCommand instanceof SCommand) {
              //  Scmd.previousControlPoint = previousCommand.controlPoint2;
              //}
            }
            break;
          }
          case 'Q': {
            // Quadratic Bézier: four numbers per segment (x1, y1, x, y).
            while (i + 3 < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const x1 = parseFloat(tokens[i]);
              const y1 = parseFloat(tokens[i + 1]);
              const x  = parseFloat(tokens[i + 2]);
              const y  = parseFloat(tokens[i + 3]);
              i += 4;
              const Qcmd = new QCommand(x1, y1, x, y, relative);
              const QcmdIdx = commands.push(Qcmd);
              prevCommandCursor.linkAfter(Qcmd);
              prevCommandCursor = Qcmd;
              //Qcmd.startingPoint = commands[QcmdIdx - 2].endingPoint;
              //Qcmd.endingPoint = { x, y };
            }
            break;
          }
          case 'T': {
            // Smooth quadratic Bézier: two numbers per segment (x, y).
            while (i + 1 < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const previousCommand = commands[commands.length - 1];
              const x = parseFloat(tokens[i]);
              const y = parseFloat(tokens[i + 1]);
              i += 2;
              const Tcmd = new TCommand(x, y, relative, previousCommand);
              commands.push(Tcmd);
              previousCommand.linkAfter(Tcmd);
              prevCommandCursor = Tcmd;

              //Tcmd.startingPoint = previousCommand.endingPoint;
              //Tcmd.endingPoint = { x, y };
            }
            break;
          }
          case 'A': {
            // Elliptical arc: seven numbers per segment.
            // (rx, ry, x-axis-rotation, large-arc-flag, sweep-flag, x, y)
            while (i + 6 < tokens.length && !/[MLHVCSQTAZmlhvcsqtaz]/.test(tokens[i])) {
              const rx             = parseFloat(tokens[i]);
              const ry             = parseFloat(tokens[i + 1]);
              const xAxisRotation  = parseFloat(tokens[i + 2]);
              const largeArcFlag   = parseFloat(tokens[i + 3]);
              const sweepFlag      = parseFloat(tokens[i + 4]);
              const x              = parseFloat(tokens[i + 5]);
              const y              = parseFloat(tokens[i + 6]);
                    i             += 7;
              const Acmd    = new ACommand(rx, ry, xAxisRotation, !!largeArcFlag, !!sweepFlag, x, y, relative);
              const AcmdIdx = commands.push(Acmd);
              prevCommandCursor.linkAfter(Acmd);
              prevCommandCursor = Acmd;
              //Acmd.startingPoint = commands[AcmdIdx - 2].endingPoint;
              //Acmd.endingPoint.x = x;
              //Acmd.endingPoint.y = y
            }
            break;
          }
          case 'Z': {
            // Close path: no parameters.
            const Zcmd = new ZCommand(relative);
            const ZcmdIdx = commands.push(Zcmd);
            prevCommandCursor.linkAfter(Zcmd);
            prevCommandCursor = Zcmd;
            startMC.linkBefore(Zcmd);
            //Zcmd.startingPoint = commands[ZcmdIdx - 2].endingPoint;
            //Zcmd.endingPoint = commands[0].startingPoint;
            //commands[0].startingPoint = commands[ZcmdIdx - 2].endingPoint;
            break;
          }
          default:
            // Skip any unknown commands.
            break;
        }
      } else {
        // Skip stray numbers or unexpected tokens.
        i++;
      }
    }
    this.commands = commands;

  }

  generatePathString(): string {
    const commands = [];
    const firstCommand = this.commands[0];
   
    let cursor: SvgCommand = firstCommand;
    while (cursor.nextCommand !== firstCommand) {
     
      commands.push(cursor);
      cursor = cursor.nextCommand;
    }
    commands.push(cursor);
    this.commands = commands as TSVGCommand[];
     
    return this.commands.map(cmd => cmd.toString()).join(' ');
  }

  translate(x: number, y: number): void {
    for (const cmd of this.commands) {
      cmd.translate(x, y);
    }
  }

  scale(s: number) {
    for (const cmd of this.commands) {
      cmd.scale(s);
    }
  }
  
  scaleXY(sx: number, sy: number) {
    for (const cmd of this.commands) {
      cmd.scaleXY(sx, sy);
    }
  }

  toAbsolute() {
    let b: IPoint = this.commands[0].endingPoint;

    this.commands.forEach((_, idx, all) => {
      const res = _.toAbsolute(b);
      all[idx] = res.cmd;
      _.replaceWith(res.cmd);
      b = res.endPoint;
    })

    // Update for each _previousCommand and _nextCommand, knowing that the first command is the MoveCommand and its previous command is the last command
    //this.commands[0]._previousCommand = this.commands[this.commands.length - 1];  // Last command
    //this.commands[0]._nextCommand = this.commands[1];

    //for (let i = 1; i < this.commands.length - 1; i++) {
    //  this.commands[i]._previousCommand = this.commands[i - 1];
    //  this.commands[i]._nextCommand = this.commands[i + 1];
    //}

    //this.commands[this.commands.length - 1]._previousCommand = this.commands[this.commands.length - 2];
    //this.commands[this.commands.length - 1]._nextCommand = this.commands[0];  // First command
  }

  toRelative() {
    let b: IPoint = this.commands[0].endingPoint;

    this.commands.forEach((_, idx, all) => {
      const res = _.toRelative(b);
      all[idx] = res.cmd;
      b = res.endPoint
    })
  }
/* old 
  getCenter(): IPoint {
    if (this.commands.length === 0) return { x: 0, y: 0 };

    let totalX = 0;
    let totalY = 0;
    let count = 0;

    for (const cmd of this.getCommands()) {
      // Consider only the ending points of commands (except Z, which just closes the path)
      // (!(cmd instanceof ZCommand)) {
        totalX += cmd.endingPoint.x;
        totalY += cmd.endingPoint.y;
        count++;
      //
    }

    // Avoid division by zero
    if (count === 0) return { x: 0, y: 0 };

    return { x: totalX / count, y: totalY / count };
  }
*/ 

/// new getcenter


getCenter(): IPoint {


  if (this.commands.length === 0) return { x: 0, y: 0 };
  // Collect unique vertices from ending points, skipping ZCommand (close path)
  const points = this.getCommands()
    .filter(cmd => !(cmd instanceof ZCommand))
    .map(cmd => cmd.endingPoint);
    

  const n = points.length;
  if (n < 3) {
    // For degenerate cases (line or point), fall back to simple average
    let totalX = 0;
    let totalY = 0;
    for (const point of points) {
      totalX += point.x;
      totalY += point.y;
    }
    return { x: totalX / n, y: totalY / n };
  }

  // Compute signed area using shoelace formula
  let area = 0.0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  area /= 2.0;

  // Avoid division by zero
  if (area === 0) return { x: 0, y: 0 };

  // Compute weighted sums for centroid (matching Rust formula)
  let cx_sum = 0.0;
  let cy_sum = 0.0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const det = xi * yj - xj * yi;
    cx_sum += (xi + xj) * det;
    cy_sum += (yi + yj) * det;
  }

  const cx = cx_sum / (6.0 * area);
  const cy = cy_sum / (6.0 * area);

  return { x: cx, y: cy };
}
  
 
  rotate(angle: number, origin: IPoint = {x: 0, y: 0}): void {
    for (const cmd of this.commands) {
      cmd.rotate(origin, angle);
    }
  }

  simplify({forceLine, forceCurve}: {forceLine: boolean, forceCurve: boolean}): void {
    const newArr = [] as TSVGCommand[];

    this.commands.forEach((cmd, idx, all) => {
      if (forceLine && cmd instanceof HCommand) {
        const lc = cmd.toLineCommand();
        newArr.push(lc);
        cmd.replaceWith(lc);
      } else if (forceLine && cmd instanceof VCommand) {
        const lc = cmd.toLineCommand();
        newArr.push(lc);
        cmd.replaceWith(lc);
      } else if (forceCurve && cmd instanceof ACommand) {
        const newCommandArray = cmd.toCurveCommands();
        let firstCmd = newCommandArray[0]
        const lastCmd = newCommandArray[newCommandArray.length - 1];
        newCommandArray.forEach((c, idx) => {
          if (idx === 0) return;
          firstCmd.linkAfter(c);
          firstCmd = c;
        });
        newArr.push(...newCommandArray);
        const before = cmd.previousCommand;
        const after = cmd.nextCommand;
        cmd.delete();
        before.linkAfter(newCommandArray[0]);
        lastCmd.linkAfter(after);
      } else if (forceCurve && cmd instanceof QCommand) {
        newArr.push(cmd);
      } else if (forceCurve && cmd instanceof TCommand) {
        const qCmd = cmd.toQuadCurveCommand();
        newArr.push(qCmd);
        cmd.replaceWith(qCmd);  // Replace the T command with the new Q command in the list
      } else if (forceCurve && cmd instanceof SCommand) {
        const cCmd = cmd.toCurveCommand(idx === 1 ? undefined :all[idx - 1]);
        newArr.push(cCmd);
        cmd.replaceWith(cCmd);
      } else if (forceCurve && cmd instanceof ZCommand) {
        const lc = cmd.toLineCommand();
        newArr.push(lc);
        cmd.replaceWith(lc);
      }else {
        newArr.push(cmd);
      }
    });
    this.commands = newArr.map(cmd => cmd);

    newArr.length = 0;
    this.commands.forEach((cmd) => {
      if (forceCurve && cmd instanceof QCommand) {
        const qCmd = cmd.toCurveCommand();
        newArr.push(qCmd);
        newArr.push(cmd.toCurveCommand());
      } else {
        newArr.push(cmd);
      }
    });

    this.commands = newArr.map(cmd => cmd);

    // Update for each _previousCommand and _nextCommand, knowing that the first command is the MoveCommand and its previous command is the last command
    //this.commands[0]._previousCommand = this.commands[this.commands.length - 1];  // Last command
    //this.commands[0]._nextCommand = this.commands[1];

    //for (let i = 1; i < this.commands.length - 1; i++) {
    //  this.commands[i]._previousCommand = this.commands[i - 1];
    //  this.commands[i]._nextCommand = this.commands[i + 1];
   // }

   // this.commands[this.commands.length - 1]._previousCommand = this.commands[this.commands.length - 2];
   // this.commands[this.commands.length - 1]._nextCommand = this.commands[0];  //
  }

  normalize(asNested: boolean = false) {
    // Normalizing the path will do the following :
    // 1. COnvert it to absolute
    // 2. Simplify the path
    // 3. Get the center of the path
    // 4. Translate the path to the origin so 0.0 will become the center of the path
    if (this._normalized) return;

    this._normalized = true;
    this.toAbsolute();
    this.simplify({forceLine: true, forceCurve: true});
    const center = this.getCenter();

    // If nested we avoid this part as teh translation should be ihnerited from the parent
    // This action is done at pattern level
    if (!asNested && !this._cloned) {
     this.translate(-center.x, -center.y);
     this._originalPosition = { x: center.x, y: center.y };
    }

    let dx = 0;
    let dy = 0;

    if (this._cloned) {
      // calculate the new center of the path
      const newCenter = this.getCenter();
      const deltaX = this._originalPosition.x - newCenter.x;
      const deltaY = this._originalPosition.y - newCenter.y;
      //this.translate(deltaX, deltaY);
      //this._originalPosition = { x: newCenter.x, y: newCenter.y };
      dx = deltaX;
      dy = deltaY;
    }

    return { x: dx, y: dy };
  }

  getBoundingBox(): { x: number, y: number, width: number, height: number } {
    let minX =  Infinity;
    let minY =  Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const cmd of this.commands) {
      if (cmd.startingPoint.x < minX) minX = cmd.startingPoint.x;
      if (cmd.startingPoint.y < minY) minY = cmd.startingPoint.y;
      if (cmd.endingPoint.x < minX)   minX = cmd.endingPoint.x;
      if (cmd.endingPoint.y < minY)   minY = cmd.endingPoint.y;

      if (cmd.startingPoint.x > maxX) maxX = cmd.startingPoint.x;
      if (cmd.startingPoint.y > maxY) maxY = cmd.startingPoint.y;
      if (cmd.endingPoint.x > maxX)   maxX = cmd.endingPoint.x;
      if (cmd.endingPoint.y > maxY)   maxY = cmd.endingPoint.y;
    }

    return {
      x      : minX,
      y      : minY,
      width  : maxX - minX,
      height : maxY - minY,
    };
  }

  isNested(candidate: VectorPath): boolean {
    const samplePoints: IPoint[] = candidate.getCommands().map(cmd => cmd.endingPoint);

    // Also include candidate centroid for robust detection
    const centroid = candidate.getCenter();
    samplePoints.push(centroid);
    let insideCount = 0;
    this.isPointInsidePolygon(centroid) && insideCount++;
    return insideCount > 0
  }

  private isPointInsidePolygon(point: IPoint): boolean {
    let inside = false;
    const commands = this.getCommands();
    const n = commands.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = commands[i].endingPoint.x, yi = commands[i].endingPoint.y;
      const xj = commands[j].endingPoint.x, yj = commands[j].endingPoint.y;

      // Skip horizontal edges explicitly
      if (yi === yj) continue;

      const intersect = ((yi > point.y) !== (yj > point.y)) &&
                        (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }



/**

   * @param distance 
   */
  public expand(distance: number): void {
   
    if (distance < 0) {
      const bounds = this.getBoundingBox();
      const minDimension = Math.min(bounds.width, bounds.height);
      const shrinkAmount = Math.abs(distance);

      if (shrinkAmount > minDimension / 2) {
          ppInfo("","Shrink distance is too large.")
        return; 
      }
    }
    
    try {
      const pathString = this.generatePathString();
     
      if (!pathString || pathString.trim() === '') {
         ppInfo("","Cannot expand an empty path.")
        return;
      }

      const paperPath = new paper.Path(pathString);
      const offsetPath = PaperOffset.offset(paperPath, distance, { join: 'round' });

      
      if (!offsetPath || offsetPath.pathData === '') {
          ppInfo("","Path shrunk to nothingness. Clearing commands.")
        this.commands = []; // Clear the path
        return;
      }
      
      this.parse(offsetPath.pathData);

    } catch (error) {
     
        ppInfo("","Failed to apply offset.")
      
    }
  }

  /**
   * Shrinks the path by a given distance.
   * @param distance 
   */
  public shrink(distance: number): void {
    
    this.expand(-Math.abs(distance));
  }
////////////////////////////////////////
public getTotalLength(): number {
    return this.getCommands().reduce((acc, cmd) => acc + (cmd as any).getLength(), 0);
  }
////////////////////////////////////////////////////
 
}
