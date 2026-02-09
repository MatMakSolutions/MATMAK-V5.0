export class ProtocolGenerator {

static sortPolygonsByMinX(polygons: [number, number][][]): [number, number][][] {
  return polygons.slice().sort((a, b) => {
    const minX_A = Math.min(...a.map(point => point[0]));
    const minX_B = Math.min(...b.map(point => point[0]));
    return minX_A - minX_B;
  });
}

static sortPolygonsByMinY(polygons: [number, number][][]): [number, number][][] {
  return polygons.slice().sort((a, b) => {
    const minY_A = Math.min(...a.map(point => point[1]));
    const minY_B = Math.min(...b.map(point => point[1]));
    return minY_A - minY_B;
  });
}
  static preprocessPolygons(
  polygons      : [number, number][][],
  surfaceHeight : number,
  ratio         : number
  )             : [number, number][][] {

    const sortedPolygons = ProtocolGenerator.sortPolygonsByMinX(polygons);
    return sortedPolygons.map(polygon =>
      polygon.map(([x, y]) => [
        (x * ratio),
        (surfaceHeight - y * ratio)


      ])
    );
  }
  /// for the swap x and Y
  static preprocessPolygonsx(
  polygons : [number, number][][],
  ratio    : number
  )        : [number, number][][] {
     const sortedPolygons = ProtocolGenerator.sortPolygonsByMinY(polygons);
    return sortedPolygons.map(polygon =>
      polygon.map(([x, y]) => [
        (y * ratio),
        (x * ratio)
      ])
    );
  }

  static generateHPGL(
    polygons: [number, number][][],
    options: {
      force?: number;
      velocity?: number;
      pen?: number;
      absolute?: boolean;
      moveToOrigin?: { x: number; y: number };
      feedAfterCut?: number;
    } = {}
  ): string {
    let cuttingCommands = "";

    // Initialize plotter commands
    cuttingCommands += "IN;";

    // Set force if provided
    if (options.force !== undefined) {
      cuttingCommands += `FS${options.force};`;
    }

    // Set velocity if provided
    if (options.velocity !== undefined) {
      cuttingCommands += `VS${options.velocity};`;
    }

    // Set pen if provided
    if (options.pen !== undefined) {
      cuttingCommands += `SP${options.pen};`;
    }

    // Determine positioning mode
    const absolute = options.absolute ?? true; // Default to absolute

    polygons.forEach(polygon => {
      if (polygon.length === 0) return;

      // Move to the starting point with the pen up
      const [startX, startY] = polygon[0];
      cuttingCommands += `${absolute ? 'PU' : 'PR'}${Math.round(startX)},${Math.round(startY)};`;

      // Draw the rest of the polygon with the pen down using multi-point batching
      // Build: PD{x1},{y1},{x2},{y2},...{xn},{yn};
      cuttingCommands += `${absolute ? 'PD' : 'PR'}`;
      for (let i = 1; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        cuttingCommands += `${Math.round(x)},${Math.round(y)},`;
      }
      
      // Close the polygon by returning to the start
      cuttingCommands += `${Math.round(polygon[0][0])},${Math.round(polygon[0][1])};`;
    });

    // Finish the command sequence
    // commands += "IN;";
    
    let finalProtocol = "";
    if (options.moveToOrigin) {
      finalProtocol += this.moveToOrigin("HPGL", options.moveToOrigin);
    }
    finalProtocol += cuttingCommands;
    if (options.feedAfterCut !== undefined) {
      finalProtocol += this.feedAfterCut("HPGL", options.feedAfterCut);
    }
    return finalProtocol;
  }

  static generateDMPL(
    polygons: [number, number][][],
    mode: number,
    options: {
      force?: number;
      velocity?: number;
      pen?: number;
      absolute?: boolean;
      moveToOrigin?: { x: number; y: number };
      feedAfterCut?: number;
    } = {}
  ): string {
    if (![1, 2, 3, 4, 6].includes(mode)) {
      throw new Error("Invalid mode. Must be one of: 1, 2, 3, 4, 6.");
    }

    let cuttingCommands = "";

    switch (mode) {
      case 1:
        cuttingCommands += ";:HAEC1";
        break;
      case 2:
        cuttingCommands += " ;:ECN A L0 ";
        break;
      case 3:
      case 4:
        cuttingCommands += " ;:H A L0 ";
        break;
      case 6:
        cuttingCommands += "IN;PA;";
        break;
    }

    if (options.velocity !== undefined) {
      cuttingCommands += `V${options.velocity} `;
    }

    if (options.force !== undefined) {
      cuttingCommands += `BP${options.force} `;
    }

    if (options.pen !== undefined) {
      cuttingCommands += `EC${options.pen} `;
    }

    const absolute = options.absolute ?? true;

    polygons.forEach(polygon => {
      if (polygon.length === 0) return;

      const [startX, startY] = polygon[0];
      cuttingCommands += `${absolute ? (mode === 6 ? 'PU' : 'U') : ''}${Math.round(startX /** ratio*/)},${Math.round(startY /** ratio*/)};`;

      for (let i = 1; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        cuttingCommands += `${absolute ? (mode === 6 ? 'PD' : 'D') : ''}${Math.round(x /** ratio*/)},${Math.round(y /** ratio*/)};`;
      }

      cuttingCommands += `${absolute ? (mode === 6 ? 'PD' : 'D') : ''}${Math.round(polygon[0][0] /** ratio*/)},${Math.round(polygon[0][1] /** ratio*/)};`;
    });

    let finalProtocol = "";
    const protocolName = `DMPL${mode}`;
    if (options.moveToOrigin) {
      finalProtocol += this.moveToOrigin(protocolName, options.moveToOrigin);
    }
    finalProtocol += cuttingCommands;
    if (options.feedAfterCut !== undefined) {
      finalProtocol += this.feedAfterCut(protocolName, options.feedAfterCut);
    }
    return finalProtocol;
  }


  static generateCAMMGL(
    polygons: [number, number][][],
    options: {
      force?: number;
      velocity?: number;
      pen?: number;
      absolute?: boolean;
      moveToOrigin?: { x: number; y: number };
      feedAfterCut?: number;
    } = {}
  ): string {
    let cuttingCommands = "";
    cuttingCommands += "IN;";

    if (options.force !== undefined) {
      cuttingCommands += `FS${options.force};`;
    }

    if (options.velocity !== undefined) {
      cuttingCommands += `VS${options.velocity};`;
    }

    if (options.pen !== undefined) {
      cuttingCommands += `SP${options.pen};`;
    }

    const absolute = options.absolute ?? true;

    polygons.forEach(polygon => {
      if (polygon.length === 0) return;

      const [startX, startY] = polygon[0];
      cuttingCommands += `${absolute ? 'M' : ''}${Math.round(startX)},${Math.round(startY)};`;

      for (let i = 1; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        cuttingCommands += `${absolute ? 'D' : ''}${Math.round(x)},${Math.round(y)};`;
      }

      cuttingCommands += `${absolute ? 'D' : ''}${Math.round(polygon[0][0])},${Math.round(polygon[0][1])};`;
    });

    let finalProtocol = "";
    if (options.moveToOrigin) {
      finalProtocol += this.moveToOrigin("CAMMGL", options.moveToOrigin);
    }
    finalProtocol += cuttingCommands;
    if (options.feedAfterCut !== undefined) {
      finalProtocol += this.feedAfterCut("CAMMGL", options.feedAfterCut);
    }
    return finalProtocol;
  }

  static generateCAMMGLMode1(
    polygons: [number, number][][],
    options: {
      force?: number;
      velocity?: number;
      pen?: number;
      absolute?: boolean;
      moveToOrigin?: { x: number; y: number };
      feedAfterCut?: number;
    } = {}
  ): string {
    let cuttingCommands = "";

    cuttingCommands += "H;";
/* to verify the pen command 
    if (options.pen !== undefined) {
      commands += `EC${options.pen};`;
    }
*/
    const absolute = options.absolute ?? true;

    polygons.forEach(polygon => {
      if (polygon.length === 0) return;

      const [startX, startY] = polygon[0];
      cuttingCommands += `${absolute ? 'M' : ''}${Math.round(startX)},${Math.round(startY)};`;

      for (let i = 1; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        cuttingCommands += `${absolute ? 'D' : ''}${Math.round(x)},${Math.round(y)};`;
      }

      cuttingCommands += `${absolute ? 'D' : ''}${Math.round(polygon[0][0])},${Math.round(polygon[0][1])};`;
    });


    cuttingCommands += "EC0;";
    cuttingCommands += "!PG0;";
    cuttingCommands += "!ST1;";
    cuttingCommands += "PA;";
    cuttingCommands += "@PJL RESET;";
    cuttingCommands += "@PJL ENTER LANGUAGE = RESET;";
    
    let finalProtocol = "";
    if (options.moveToOrigin) {
      finalProtocol += this.moveToOrigin("CAMMGLMode1", options.moveToOrigin);
    }
    finalProtocol += cuttingCommands;
    if (options.feedAfterCut !== undefined) {
      finalProtocol += this.feedAfterCut("CAMMGLMode1", options.feedAfterCut);
    }
    return finalProtocol;
  }

  static generateCAMMGLMode2(
    polygons: [number, number][][],
    options: {
      force?: number;
      velocity?: number;
      pen?: number;
      absolute?: boolean;
      moveToOrigin?: { x: number; y: number };
      feedAfterCut?: number;
    } = {}
  ): string {
    let cuttingCommands = "";

    // Initialize plotter
    cuttingCommands += "IN;PA;";

    // Set pen if provided
    if (options.pen !== undefined) {
      cuttingCommands += `EC${options.pen};`;
    }

    const absolute = options.absolute ?? true;

    polygons.forEach(polygon => {
      if (polygon.length === 0) return;

      // Move to the starting point with the pen up
      const [startX, startY] = polygon[0];
      cuttingCommands += `${absolute ? 'PU' : 'PR'}${Math.round(startX)},${Math.round(startY)};`;

      // Draw the rest of the polygon with the pen down
      for (let i = 1; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        cuttingCommands += `${absolute ? 'PD' : 'PR'}${Math.round(x)},${Math.round(y)};`;
      }

      // Close the polygon by returning to the start
      cuttingCommands += `${absolute ? 'PD' : 'PR'}${Math.round(polygon[0][0])},${Math.round(polygon[0][1])};`;
    });

    // Finish the command sequence
 
    cuttingCommands += "EC0;";
    cuttingCommands += "!PG0;";
    cuttingCommands += "!ST1;";
    cuttingCommands += "PA;";
    cuttingCommands += "@PJL RESET;";
    cuttingCommands += "@PJL ENTER LANGUAGE = RESET;";
    
    let finalProtocol = "";
    if (options.moveToOrigin) {
      finalProtocol += this.moveToOrigin("CAMMGLMode2", options.moveToOrigin);
    }
    finalProtocol += cuttingCommands;
    if (options.feedAfterCut !== undefined) {
      finalProtocol += this.feedAfterCut("CAMMGLMode2", options.feedAfterCut);
    }
    return finalProtocol;
  }

  static generateGPGL(
    polygons: [number, number][][],
    options: {
      force?: number;
      velocity?: number;
      pen?: number;
      absolute?: boolean;
      moveToOrigin?: { x: number; y: number };
      feedAfterCut?: number;
    } = {}
  ): string {
    let cuttingCommands = "";

    // Start command: ESC + EOT + "TT"
    cuttingCommands += "\u001b\u0004TT\u0003";

    // Set pen command if provided
    if (options.pen !== undefined) {
      cuttingCommands += `J${options.pen}\u0003`;
    } else {
      cuttingCommands += "J1\u0003"; // Default pen
    }

    if (options.force !== undefined) {
      cuttingCommands += `FX${options.force},1\u0003`;
    }

    if (options.velocity !== undefined) {
      cuttingCommands += `!${options.velocity}\u0003`;
    }

    const absolute = options.absolute ?? true;

    polygons.forEach(polygon => {
      if (polygon.length === 0) return;

      // Move to start with pen up
      const [startX, startY] = polygon[0];
      cuttingCommands += `${absolute ? 'M' : ''}${Math.round(startX)},${Math.round(startY)}\u0003`;

      // Draw with pen down using multi-point batching like cutagent: D{x1},{y1},{x2},{y2},...
      cuttingCommands += `${absolute ? 'D' : ''}`;
      for (let i = 1; i < polygon.length; i++) {
        const [x, y] = polygon[i];
        cuttingCommands += `${Math.round(x)},${Math.round(y)},`;
      }
      
      // Close the polygon
      cuttingCommands += `${Math.round(polygon[0][0])},${Math.round(polygon[0][1])}\u0003`;
    });

    // Finish command: H (instead of SO,SO,)
    cuttingCommands += "H\u0003";

    let finalProtocol = "";
    if (options.moveToOrigin) {
      finalProtocol += this.moveToOrigin("GPGL", options.moveToOrigin);
    }
    finalProtocol += cuttingCommands;
    if (options.feedAfterCut !== undefined) {
      finalProtocol += this.feedAfterCut("GPGL", options.feedAfterCut);
    }
    return finalProtocol;
  }

static getMaxXFromHPGL(command: string): number {
    // Matches PU/PD/U/D/M followed by x,y with optional semicolon
    const regex = /(?:PU|PD|U|D|M)(\d+),\d+(?:;|$)/g;
    const matches = [...command.matchAll(regex)];
    if (matches.length === 0) {
      return 0; // Return 0 if no coordinates are found
    }

    const xCoordinates = matches.map(match => parseInt(match[1], 10));
    return Math.max(...xCoordinates);
  }


 static moveToOrigin(
    protocol: string,
    origin: { x: number; y: number }
  ): string {
    switch (protocol) {
      case "HPGL":
        return `PU${origin.x},${origin.y};`;
      case "DMPL1":
      case "DMPL2":
      case "DMPL3":
      case "DMPL4":
      case "DMPL6":
        return `U${origin.x},${origin.y};`;
      case "CAMMGL":
      case "CAMMGLMode1":
        return `M${origin.x},${origin.y};`;
      case "CAMMGLMode2":
        return `PU${origin.x},${origin.y};`;
      case "GPGL":
        return `M${origin.x},${origin.y},SO,SO,\u0003`;
      default:
        throw new Error("Unsupported protocol");
    }
  }

  static feedAfterCut(
    protocol: string,
    feedDistance: number
  ): string {
    switch (protocol) {
      case "HPGL":
        return `PU${feedDistance},0;`;
      case "DMPL1":
      case "DMPL2":
      case "DMPL3":
      case "DMPL4":
      case "DMPL6":
        return `U${feedDistance},0;`;
      case "CAMMGL":
      case "CAMMGLMode1":
        return `M${feedDistance},0;`;
      case "CAMMGLMode2":
        return `PU${feedDistance},0;`;
      case "GPGL":
        return `M${feedDistance},0,SO,SO,\u0003`;
      default:
        throw new Error("Unsupported protocol");
    }
  }


  static generateProtocol(
    polygons: [number, number][][],
    config: {
      protocol: string;
      force?: number;
      velocity?: number;
      pen?: number;
      moveToOrigin?: { x: number; y: number };
      feedAfterCut?: number;
    }
  ): string {
    const { protocol, force, velocity, pen, moveToOrigin, feedAfterCut } = config;
    const options = { force, velocity, pen, moveToOrigin, feedAfterCut };

    switch (protocol) {
      case "HPGL":
        return this.generateHPGL(polygons, options);
      case "CAMMGL":
        return this.generateCAMMGL(polygons, options);
      case "CAMMGLMode1":
        return this.generateCAMMGLMode1(polygons, options);
      case "CAMMGLMode2":
        return this.generateCAMMGLMode2(polygons, options);
      case "DMPL1":
        return this.generateDMPL(polygons, 1, options);
      case "DMPL2":
        return this.generateDMPL(polygons, 2, options);
      case "DMPL3":
        return this.generateDMPL(polygons, 3, options);
      case "DMPL4":
        return this.generateDMPL(polygons, 4, options);
      case "DMPL6":
        return this.generateDMPL(polygons, 6, options);
      case "GPGL":
        return this.generateGPGL(polygons, options);
      default:
        throw new Error("Unsupported protocol");
    }
  }
  ////////////////////////for cut preview

 static parseHPGL(hpgl: string, ratio: number, surfaceHeight: number): {x: number, y: number}[][] {
    const paths: {x: number, y: number}[][] = [];
    let currentPath: {x: number, y: number}[] | null = null;
    let penDown = false;

    const commands = hpgl.split(';').filter(cmd => cmd.trim() !== '');

    for (const command of commands) {
        const instruction = command.substring(0, 2);
        const argsStr = command.substring(2);
        
        // Skip if there are no arguments
        if (!argsStr) {
          if (instruction === 'PD') penDown = true;
          if (instruction === 'PU') penDown = false;
          continue;
        };

        const coords = argsStr.split(',').map(Number);

        if (instruction === 'PU') {
            penDown = false;
            if (currentPath && currentPath.length > 1) {
                paths.push(currentPath);
            }
         
            if (coords.length >= 2) {
                const x = coords[0] / ratio;
                const y = (surfaceHeight - coords[1]) / ratio;
                currentPath = [{ x: x, y: y }];
            } else {
                currentPath = null;
            }
        } else if (instruction === 'PD') {
            penDown = true;
            if (!currentPath) {
                currentPath = [];
            }
            if (argsStr) {
                for (let i = 0; i < coords.length; i += 2) {
                    const x = coords[i] / ratio;
                    const y = (surfaceHeight - (coords[i+1] || 0)) / ratio;
                    currentPath.push({ x: x, y: y });
                }
            }
        } else if (instruction === 'PA') {
             if (coords.length >= 2) {
                const x = coords[0] / ratio;
                const y = (surfaceHeight - coords[1]) / ratio;
                const point = { x: x, y: y };
                
                if (penDown) {
                    if (!currentPath) currentPath = [];
                    // If the path is empty, add the starting point from the last pen up move
                    if(currentPath.length === 0) {
                      const lastPath = paths[paths.length -1];
                      if(lastPath) currentPath.push(lastPath[lastPath.length-1]);
                    }
                    currentPath.push(point);
                } else {
                    if (currentPath && currentPath.length > 1) {
                        paths.push(currentPath);
                    }
                    currentPath = [point];
                }
            }
        }
    }

    if (currentPath && currentPath.length > 1) {
        paths.push(currentPath);
    }

  const rotatedPaths = paths.map(path => 
 
        path.map(point => {
        
            return { x: point.y, y: -point.x };
        })
    );


    return rotatedPaths;
  }

  ////////////////////////////new custom protocol /////////////////////
static getMaxXFromPolygons(polygons: [number, number][][]): number {
  let maxX = 0;
  for (const polygon of polygons) {
    for (const point of polygon) {
      if (point[0] > maxX) {
        maxX = point[0];
      }
    }
  }
  return Math.round(maxX);
}


/**
 * Formats a single coordinate pair into a command template
 */
static formatCoordinates(template: string, point: [number, number]): string {
  let command = template.replace(/\{0:0\}/g, String(Math.round(point[0])));
  command = command.replace(/\{1:0\}/g, String(Math.round(point[1])));
  return command;
}

/**
 * Processes the delimiter marker ($) at the end of commands
 * If a command ends with $, it means DON'T add the delimiter after it
 */
static processDelimiterMarker(sourceCommand: string): { command: string; delimiterNeeded: boolean } {
  if (!sourceCommand || sourceCommand.endsWith('$')) {
    return {
      command: sourceCommand ? sourceCommand.substring(0, sourceCommand.length - 1) : '',
      delimiterNeeded: false
    };
  }
  return { command: sourceCommand, delimiterNeeded: true };
}

/**
 * Parses multi-point command syntax like "PD({0:0},{1:0},)"
 * Returns structure for batching multiple coordinates in one command
 */
static parseMultiPointCommand(source: string): {
  head: string;
  coordsBlock: string;
  blockDelimiter: string;
  endOf: string;
  multiplePointsAllowed: boolean;
} {
  const coordsStart = source.indexOf('{');
  const coordsEnd = source.lastIndexOf('}');
  
  if (coordsStart === -1 || coordsEnd === -1 || coordsEnd < coordsStart) {
    throw new Error(`Invalid command syntax: ${source}`);
  }

  // Check for multi-point syntax with parentheses: "PD({0:0},{1:0},)"
  const opening = source.indexOf('(');
  const closing = source.indexOf(')');
  
  if (opening === -1 || closing <= opening + 2) {
    // Simple single-point command like "D{0:0},{1:0}"
    return {
      head: source.substring(0, coordsStart),
      coordsBlock: source.substring(coordsStart, coordsEnd + 1),
      blockDelimiter: '',
      endOf: source.substring(coordsEnd + 1),
      multiplePointsAllowed: false
    };
  }
  
  // Multi-point command like "PD({0:0},{1:0},)"
  // head: "PD"
  // coordsBlock: "{0:0},{1:0}" (the content inside parentheses, excluding delimiter)
  // blockDelimiter: "," (the delimiter between coordinate pairs)
  // endOf: "" (content after closing parenthesis)
  return {
    head: source.substring(0, opening),
    coordsBlock: source.substring(opening + 1, closing - 1), // Content between ( and last char before )
    blockDelimiter: source.substring(closing - 1, closing),   // The delimiter (usually comma)
    endOf: source.substring(closing + 1),
    multiplePointsAllowed: true
  };
}


/**
 * Process escape sequences in command strings
 * Handles both JSON-parsed strings and literal escape sequence strings
 */
static processEscapeSequences(str: string): string {
  if (!str) return str;
  
  // Note: JSON.parse() already handles escape sequences like \u001b, \r\n
  // But if strings come from user input or are double-escaped, we need to handle them
  
  // Check if string contains actual escape characters (already processed by JSON.parse)
  // If so, return as-is
  const hasEscapeBytes = /[\x00-\x1F\x7F]/.test(str);
  if (hasEscapeBytes) {
    // Already contains control characters, no processing needed
    console.log('String already contains escape bytes, skipping processing');
    return str;
  }
  
  // Process literal escape sequence strings (from user input or double-escaped)
  let processed = str
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    // Handle unicode escapes: \u0003, \u001b, etc.
    .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
      console.log(`Converting ${match} to byte 0x${hex}`);
      return String.fromCharCode(parseInt(hex, 16));
    });
  
  return processed;
}

/**
 * Get the default delimiter/term for a protocol
 */
static getDefaultTerm(protocol: string): string {
  const proto = protocol.toUpperCase();
  if (proto === 'GPGL') return '\u0003'; // ETX character
  if (proto.startsWith('DMPL')) return ' '; // Space
  if (proto.startsWith('CAMMGL')) return ';\r\n'; // Semicolon + CRLF
  return ';\r\n'; // Default for HPGL and others
}

static generateCustomProtocol(
  polygons: [number, number][][],
  config: {
    protocol: string;     // The base protocol name (e.g., HPGL, GCode)
    term?: string;        // Command delimiter (e.g., ";\r\n" for HPGL, " " for DMPL)
    start?: string;       // Optional: Command to send at the beginning
    finish?: string;      // Optional: Command to send at the end  
    penUp?: string;       // Optional: Pen up command (standalone, sent before moveUp)
    penDown?: string;     // Optional: Pen down command (standalone, sent before moveDown)
    moveUp?: string;      // Optional: Move command with pen up (can include pen up or be standalone)
    moveDown?: string;    // Optional: Move command with pen down (can include pen down or be standalone)
    force?: number;
    velocity?: number;
    pen?: number;
    moveToOrigin?: { x: number; y: number };
    feedAfterCut?: number;
  }
): string {
  const {
    protocol,
    moveUp,
    moveDown,
  } = config;
  
  // Process escape sequences in all command strings
  const start = this.processEscapeSequences(config.start || '');
  const finish = this.processEscapeSequences(config.finish || '');
  const penUp = config.penUp ? this.processEscapeSequences(config.penUp) : undefined;
  const penDown = config.penDown ? this.processEscapeSequences(config.penDown) : undefined;
  
  // Get term with proper default based on protocol, and process escape sequences
  const term = config.term ? this.processEscapeSequences(config.term) : this.getDefaultTerm(protocol);

  let coreCommands = "";
  let lastX = 0;
  let lastY = 0;
  
  // Add start command
  if (start) {
    const { command: startCmd, delimiterNeeded } = this.processDelimiterMarker(start);
    if (startCmd) {
      coreCommands += startCmd;
      if (delimiterNeeded) coreCommands += term;
    }
  }

  // If we have custom commands, use them; otherwise fall back to standard protocol
  if (moveUp && moveDown) {
    // Process polygons with custom commands following cutagent's logic
    polygons.forEach(polygon => {
      if (polygon.length === 0) return;

      // ===== MoveTo (Pen Up) =====
      // First, send standalone penUp command if provided
      if (penUp) {
        const { command: penUpCmd, delimiterNeeded } = this.processDelimiterMarker(penUp);
        if (penUpCmd) {
          coreCommands += penUpCmd;
          if (delimiterNeeded) coreCommands += term;
        }
      }

      // Then send moveUp command with first point coordinates
      const { command: moveUpCmd, delimiterNeeded: moveUpNeedsDelim } = this.processDelimiterMarker(moveUp);
      const moveToCoords = this.formatCoordinates(moveUpCmd, polygon[0]);
      coreCommands += moveToCoords;
      if (moveUpNeedsDelim) coreCommands += term;
      
      // Track last position
      lastX = Math.max(lastX, polygon[0][0]);
      lastY = Math.max(lastY, polygon[0][1]);

      // ===== PolylineTo (Pen Down) =====
      // First, send standalone penDown command if provided
      if (penDown) {
        const { command: penDownCmd, delimiterNeeded } = this.processDelimiterMarker(penDown);
        if (penDownCmd) {
          coreCommands += penDownCmd;
          if (delimiterNeeded) coreCommands += term;
        }
      }

      // Process moveDown command - check if it supports multi-point batching
      const { command: moveDownCmd, delimiterNeeded: moveDownNeedsDelim } = this.processDelimiterMarker(moveDown);
      
      try {
        const multiPointInfo = this.parseMultiPointCommand(moveDownCmd);
        
        if (multiPointInfo.multiplePointsAllowed) {
          // Multi-point batching: Build command like "PD{x1},{y1},{x2},{y2},{x3},{y3};"
          // Collect all points for the polygon (including closing point)
          const allPoints: [number, number][] = [];
          for (let i = 1; i < polygon.length; i++) {
            allPoints.push(polygon[i]);
          }
          // Close the polygon
          allPoints.push(polygon[0]);

          // Build the batched command using parsed structure
          coreCommands += multiPointInfo.head;
          allPoints.forEach((point, idx) => {
            const coords = this.formatCoordinates(multiPointInfo.coordsBlock, point);
            coreCommands += coords;
            if (idx < allPoints.length - 1) {
              coreCommands += multiPointInfo.blockDelimiter;
            }
            // Track last position
            lastX = Math.max(lastX, point[0]);
            lastY = Math.max(lastY, point[1]);
          });
          coreCommands += multiPointInfo.endOf;
          if (moveDownNeedsDelim) coreCommands += term;
          
        } else {
          // Single-point mode: Use parsed structure to build each command
          for (let i = 1; i < polygon.length; i++) {
            coreCommands += multiPointInfo.head;
            coreCommands += this.formatCoordinates(multiPointInfo.coordsBlock, polygon[i]);
            coreCommands += multiPointInfo.endOf;
            if (moveDownNeedsDelim) coreCommands += term;
            lastX = Math.max(lastX, polygon[i][0]);
            lastY = Math.max(lastY, polygon[i][1]);
          }
          // Close polygon
          coreCommands += multiPointInfo.head;
          coreCommands += this.formatCoordinates(multiPointInfo.coordsBlock, polygon[0]);
          coreCommands += multiPointInfo.endOf;
          if (moveDownNeedsDelim) coreCommands += term;
        }
      } catch (error) {
        // If parsing fails, fall back to simple formatting
        console.warn('Failed to parse multi-point syntax, using fallback:', error);
        const { command: moveDownCmd, delimiterNeeded: moveDownNeedsDelim } = this.processDelimiterMarker(moveDown);
        for (let i = 1; i < polygon.length; i++) {
          coreCommands += this.formatCoordinates(moveDownCmd, polygon[i]);
          if (moveDownNeedsDelim) coreCommands += term;
          lastX = Math.max(lastX, polygon[i][0]);
          lastY = Math.max(lastY, polygon[i][1]);
        }
        // Close polygon
        coreCommands += this.formatCoordinates(moveDownCmd, polygon[0]);
        if (moveDownNeedsDelim) coreCommands += term;
      }
    });
  } else {
    // Fallback to standard protocol generation if custom commands are incomplete
    console.warn("generateCustomProtocol: Incomplete custom commands. Falling back to standard protocol generation.");
    console.log("Protocol:", protocol);
    console.log("Custom start:", start ? `"${start.substring(0, 50)}..."` : "none");
    console.log("Custom finish:", finish ? `"${finish.substring(0, 50)}..."` : "none");
    
    const optionsForFallback = { protocol: protocol || "HPGL" };
    const generatedFallbackProtocol = this.generateProtocol(polygons, optionsForFallback);
    
    // If we have a custom start, the standard protocol's start command will conflict
    // We already added the custom start earlier, so strip the standard start from the generated protocol
    let protocolWithoutStart = generatedFallbackProtocol;
    
    if (start) {
      // Remove common start sequences that standard protocols add
      protocolWithoutStart = protocolWithoutStart
        .replace(/^IN;PA;/g, '')       // CAMMGLMode2: IN;PA;
        .replace(/^IN;DF;/g, '')       // CAMMGLMode2 alt: IN;DF;
        .replace(/^IN;/g, '')          // HPGL: IN;
        .replace(/^IN;\r\n/g, '')      // HPGL with CRLF
        .replace(/^H\u0003/g, '')      // GPGL: H + ETX
        .replace(/^;:HAEC1 /g, '')     // DMPL: ;:HAEC1
        .replace(/^DF;/g, '')          // CAMMGLMode2: DF;
        .replace(/^PA;/g, '');         // CAMMGLMode2: PA;
    }
    
    coreCommands += protocolWithoutStart;
    lastX = this.getMaxXFromPolygons(polygons);
  }

  // ===== Append Finish Command =====
  if (finish) {
    const maxX = lastX || this.getMaxXFromPolygons(polygons);
    const maxY = lastY || (polygons.length > 0 && polygons[0].length > 0 ? polygons[0][0][1] : 0);
    
    let formattedFinish = finish.replace(/\{0:0\}/g, String(Math.round(maxX)));
    formattedFinish = formattedFinish.replace(/\{1:0\}/g, String(Math.round(maxY)));
    
    const { command: finishCmd, delimiterNeeded } = this.processDelimiterMarker(formattedFinish);
    if (finishCmd) {
      coreCommands += finishCmd;
      if (delimiterNeeded) coreCommands += term;
    }
  }

  return coreCommands;
}

  /////////////////////////////////////////
}