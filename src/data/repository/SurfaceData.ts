import { guid } from "../../core/Guid";
import { IPoint } from "../../VectorPath/Utils/IPoint";

/**
 * SurfaceData class
 * This class manages the meta data of one Cut Board
 *
 * One SurfaceData is rendered with a Surface
 * Link between SurfaceData and Surface is managed by a SurfaceManager
 *
 * A surface Collection represents all Tabs in the Cut Board
 */
export class SurfaceData {
  boardZoomFactor: number = 1; // Zoom factor of the board
  surfaceName : string                = ""; // Name of the surface
  patterns    : TSurfaceDataPattern[] = []; // List of patterns in the surface
  boardWidth  : number                = 0; // Width of the board
  boardLength : number                = 0; // Length of the board
  boardX      : number                = 0; // X position of the board
  boardY      : number                = 0; // Y position of the board

  // Saved board tracking - used when board is loaded from "Saved Boards"
  savedBoardId   : string = ""; // The board_id from the server (set when loading a saved board)
  savedBoardName : string = ""; // The original name of the saved board

  undoRedoStack : string[]  = []; // Stack of undo/redo actions
  undoRedoIndex : number    = 0; // Index of the current state in the stack


  /**
   * Event to trigger when the data is refreshed
   * */
  onRefrersh: () => void = () => {};

  constructor(boardWidth?: number, boardLength?: number) {
    boardWidth  && (this.boardWidth  = boardWidth);
    boardLength && (this.boardLength = boardLength);
  }

  /**
   * Undo the last action
   * */
  undo() {
    if (this.undoRedoIndex > 0) {
      this.undoRedoIndex--;
      this.deserialize(this.undoRedoStack[this.undoRedoIndex]);
      this.onRefrersh?.();
    }
  }

  /**
   * Redo the last undone action
   * */
  redo() {
    if (this.undoRedoIndex < this.undoRedoStack.length - 1) {
      this.undoRedoIndex++;
      this.deserialize(this.undoRedoStack[this.undoRedoIndex]);
      this.onRefrersh?.();
    }
  }

  /**
   * Add the current state to the undo/redo stack
   * */
  addToUndoRedoStack() {
    // Remove all the redo steps after the current index
    this.undoRedoStack = this.undoRedoStack.slice(0, this.undoRedoIndex + 1);
    // Add the current state to the stack
    const serialized = this.serialize();
    // Check if the last element is different from the current state
    if (this.undoRedoStack[this.undoRedoStack.length - 1] !== serialized) {
      this.undoRedoStack.push(serialized);
    }
    // Set the index to the last element
    this.undoRedoIndex = this.undoRedoStack.length - 1;
  }

  /**
   * Add the pattern to the list of patterns
   * @param pattern TSurfaceData
   * */
  addPattern(pattern: TSurfaceDataPattern) {
    // check if the pattern exists
    const index = this.patterns.findIndex((p) => p.guid === pattern.guid);
    if (index !== -1 || !pattern.guid) {
      pattern.guid = guid();
    }
    if (!pattern.guid) {
      pattern.guid = guid();
    }
    this.patterns.push(pattern);
  }

  /**
   * Remove the pattern from the list of patterns
   * @param patternGuid string
   */
  removePattern(patternGuid: string) {
    const index = this.patterns.findIndex((p) => p.guid === patternGuid);
    if (index !== -1) {
      this.patterns.splice(index, 1);
    }
  }

  /**
   * Get the pattern from the list of patterns
   * @param patternGuid string
   * @returns TSurfaceDataPattern
   * */
  getPattern(patternGuid: string) {
    return this.patterns.find((p) => p.guid === patternGuid);
  }

  /**
   * Set the pattern in the list of patterns
   * @param pattern TSurfaceDataPattern
   * @returns void
   * */
  setPattern(pattern: TSurfaceDataPattern) {
    const index = this.patterns.findIndex((p) => p.guid === pattern.guid);
    if (index !== -1) {
      this.patterns[index] = pattern;
    }
  }

  /**
   * Serialize the data to a string
   * @returns string
   * */
  serialize(): string {
    return JSON.stringify({
      surfaceName    : this.surfaceName,
      patterns       : this.patterns,
      boardWidth     : this.boardWidth,
      boardLength    : this.boardLength,
      savedBoardId   : this.savedBoardId,
      savedBoardName : this.savedBoardName,
    });
  }

  /**
   * Deserialize the data from a string
   * @param data string
   * @returns void
   * */
  deserialize(data: string) {
    const obj = JSON.parse(data);

    this.surfaceName    = obj.surfaceName;
    this.patterns       = obj.patterns;
    this.boardWidth     = obj.boardWidth;
    this.boardLength    = obj.boardLength;
    this.savedBoardId   = obj.savedBoardId || "";
    this.savedBoardName = obj.savedBoardName || "";
  }
}

export type TSurfaceDataPattern = {
  guid          : string;          // Unique identifier of the pattern
  paths         : string[];        // List of all paths in the pattern
  boardPosition : IPoint;          // Position of the pattern in the board
  boardAngle    : number;          // Angle of the pattern in the board
  patternId     : string;          // Id of the pattern
  patternName   : string;          // Name of the pattern
  patternColor  : string | number; // Color of the pattern
  originalPosition?: IPoint; // Original position of the pattern
  firstLoad?: boolean; // Flag to indicate if the pattern is loaded for the first time
}
