import { Pattern } from "src/Pattern/Pattern";
import { SurfaceData, TSurfaceDataPattern } from "./SurfaceData";
import { surfaceManager } from "../../Graphics/SurfaceManager";

export class SurfaceCollection {
  // Collection of board meta data
  collection : SurfaceData[] = [];
  draftSelection : SurfaceData | null = null;
  _selectedSurfaceDataIndex : number = 0;

  constructort() {}

  private setOnRefresh = () => {
    try {
      this.selectedSurfaceData.onRefrersh = () => {
        this.onRefresh?.();
      }
    } catch {}
  }

  onRefresh: () => void = () => {};

  set selectedSurfaceDataIndex(index: number) {
    this._selectedSurfaceDataIndex = index;

    // control the index to be in the range of the collection
    if (this.selectedSurfaceDataIndex < 0) {
      this._selectedSurfaceDataIndex = 0;
    }

    if (this.selectedSurfaceDataIndex >= this.collection.length) {
      this._selectedSurfaceDataIndex = this.collection.length - 1;
    }

    // Plug the onRefresh event to the selected SurfaceData
    this.setOnRefresh?.();
  }

  get selectedSurfaceDataIndex() {
    return this._selectedSurfaceDataIndex;
  }

  get selectedSurfaceData() {
    return this.collection[this.selectedSurfaceDataIndex];
  }

  updatePattern(pattern: typeof Pattern, noUndoRollback: boolean = false) {
    const pt = this.selectedSurfaceData.getPattern(pattern._guid);
    if (pt) {
      pt.paths         = [pattern._vector["_path"],...pattern._vector.paths];
      pt.boardPosition = { x: pattern.zCtx, y: pattern.zCty };
      pt.boardAngle    = pattern._rotation;
      (!noUndoRollback) && surfaceManager.saveSlectedSurface();
      //this.selectedSurfaceData.addToUndoRedoStack();
    }
  }

  createSurfaceData(boardWidth: number, boardLength: number): SurfaceData {
    const surfaceData = new SurfaceData(boardWidth, boardLength);
    this.collection.push(surfaceData);
    return surfaceData;
  }

  removeSurfaceData(index: number) {
    this.collection.splice(index, 1);
    this.selectedSurfaceDataIndex = 0;
  }

  addPatternToSelectedSurface(pattern: TSurfaceDataPattern) {
    this.selectedSurfaceData.addPattern(pattern);
    //this.selectedSurfaceData.addToUndoRedoStack();
    surfaceManager.saveSlectedSurface();
  }

  removePatternFromSelectedSurface(patternGuid: string) {
    this.selectedSurfaceData.removePattern(patternGuid);
    //this.selectedSurfaceData.addToUndoRedoStack();
    surfaceManager.saveSlectedSurface();
  }

  getPatternFromSelectedSurface(patternGuid: string) {
    return this.selectedSurfaceData.getPattern(patternGuid);
  }

  setPatternToSelectedSurface(pattern: TSurfaceDataPattern) {
    this.selectedSurfaceData.setPattern(pattern);
    //this.selectedSurfaceData.addToUndoRedoStack();
    surfaceManager.saveSlectedSurface();
  }

  addPatternToDraftedSurface(pattern: TSurfaceDataPattern) {
    if (!this.draftSelection) {
      this.draftSelection = new SurfaceData();
    }
    this.draftSelection.addPattern(pattern);
    //this.draftSelection.addToUndoRedoStack();
  }

  clearDraft() {
    this.draftSelection = null;
  }

  createFromDraft() {
    if (this.draftSelection) {
      this.draftSelection.undoRedoStack = [];
      this.draftSelection.undoRedoIndex = -1;
      //this.draftSelection.addToUndoRedoStack();

      this.collection.push(this.draftSelection ?? new SurfaceData());
      this.clearDraft();
      this.selectedSurfaceDataIndex = this.collection.length - 1;
    } else {
      this.collection.push(new SurfaceData());
      this.selectedSurfaceDataIndex = this.collection.length - 1;
    }
  }

}

export const surfaceCollection = new SurfaceCollection();