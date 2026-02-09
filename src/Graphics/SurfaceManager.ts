import { IPoint } from "../VectorPath/Utils/IPoint";
import { waitForElt, waitForMs } from "../core/Dom";
import { surfaceCollection } from "../data/repository/SurfaceCollection";
import { splitPattern } from "../shared/Substract";
import { nestingEvents, _evtBus } from "../core/EventBus";
import { Surface } from "./Surface";
import { _Pattern, Pattern } from "../Pattern/Pattern";
import { guid } from "../core/Guid";
import { VectorPath } from "../VectorPath/VectorPath";
import { config, TConfig } from "../core/Constant";
import { ppInfo, ppNesting, ppConfirm,ppWait,ppNestingProgress,ppNestingQuality ,ppChooseNesting,ppCutOrPreview } from "../ui/controls/popup/Popup";
import { toastWarning, toastInfo, toastSuccess, toastError } from "../ui/controls/Toast/Toast";
import paper from "paper";
import { curProjectId, sFetch } from "../uof/Globals";
import { createPolygonFromSVGPaths } from "../cutboard/PrepareCut";
import {ProtocolGenerator} from "./ProtocolGenerator";
import { boardManager } from "../cutboard/BoardManager";
import { getUow } from "../uof/UnitOfWork";
import { AnnotationPopup } from "../ui/controls/AnnotationPopup/AnnotationPopup";
import * as PIXI from 'pixi.js'; /// new for nesting

// ========================================================================
// Cut Validation Types
// ========================================================================
interface CutValidationResponse {
  payload: {
    canCut: boolean;
    message: string;
    jobId: string;
    expiresUtc: string;
    signature: string | null;
  };
  statusCode: number;
}
import { TEditionPattern } from "../Pattern/Extentions/PatternEdition";
import { CutPreviewPopup } from "../ui/controls/popup/CutPreviewPopup";
import { convertMm, liveConfig } from "../core/LiveConfig";
import { Matrix } from "pixi.js"
import { UndoRedoManager, PatternAction, undoRedoManager } from '../core/UndoRedoManager';
import { TSurfaceDataPattern } from "../data/repository/SurfaceData";




declare var sendCutToIp: (ip: string, port: string, hpgl: string) => Promise<{ success: boolean, message?: string, error?: string }>;
declare var sendCutToSuma: (data: { message: string }) => Promise<{ success: boolean, message?: string, error?: string }>;
declare var getConfig: () => Promise<TConfig>;
///////////////////////////////

////////////////////
////////////////code for comport plotter ///////////////////////////////
//declare var cutcomport : (hpgl: string ,portname: string ,baudRate:string ,parity : string ,Bytesize:string,stopBits: string ) =>void;
declare var cutcomport: (
  hpgl: string,
  portName: string,
  baudRate: number,
  parity: "none"| "mark" | "even" | "odd" | "space",
  dataBits: 5 | 6 | 7 | 8,
  stopBits: 1 | 1.5 | 2
) => void;

// Create and append a canvas to the document so you can see the results.
const canvas = document.createElement('canvas');
canvas.width = 500;
canvas.height = 500;
document.body.appendChild(canvas);
paper.setup(canvas);

/////////////////////////////////////////////////////
 interface ClipboardItem {
  data: any;
  relX: number;
  relY: number;
  relAngle: number;
  isGroup: boolean; 
} 
//////////////////////////////////////////////////////
// Service Layer for managing surfaces <-> data
export class SurfaceManager {
  currentSurface: Surface | null = null;
    isSwitchingBoards: boolean = false; 
  // Global multi-selection state for edition mode
  globalSelectedHandlers: { pattern: typeof Pattern, handler: any }[] = [];
  globalMultiDragStart: IPoint | null = null;
  globalIsDraggingMultiple: boolean = false;

    ///////////////////////////////////////////////
// New properties for click-to-place nesting
nestedTemplateI: { patternIdx: number; relX: number; relY: number; relAngle: number }[] | null = null;
nestedTemplate: { patternIdx: number; absX: number; absY: number; relAngle: number }[] | null = null;


//////////////////////////////////////////////////////////////
isReadyToPlaceNested: boolean = false;
layoutOrigin: { x: number; y: number } = { x: Infinity, y: Infinity }; 
_tempPreviewGroup: PIXI.Container | null = null; 
onNestPointerDown?: (event: PIXI.FederatedPointerEvent) => void;
onNestPointerMove?: (event: PIXI.FederatedPointerEvent) => void;

private onCancelNestKeydown?: (event: KeyboardEvent) => void;

//////////////////////////////////////////////////////////////
  // PROPERTIES FOR COPY-PASTE 
  //
  clipboard: ClipboardItem[] = [];
  isPasting: boolean = false;
  pastePreviewContainer: PIXI.Container | null = null;
  private onPastePointerDown?: (event: PIXI.FederatedPointerEvent) => void;
  private onPastePointerMove?: (event: PIXI.FederatedPointerEvent) => void;
  private onCancelPasteKeydown?: (event: KeyboardEvent) => void;
  focalPivotModeEnabled: boolean = false;

//////////////////////////
private recordPatternAction(type: PatternAction['type'], patternGuid: string, metadata?: any): void {
  const beforeState = undoRedoManager.capturePatternState(patternGuid);
  
  // Record the action after the modification
  setTimeout(() => {
    const afterState = undoRedoManager.capturePatternState(patternGuid);
    
    undoRedoManager.recordPatternAction({
      type,
      patternGuid,
      beforeState,
      afterState,
      metadata
    });
  }, 0);
}

private recordMultiplePatternActions(type: PatternAction['type'], patternGuids: string[], metadata?: any): void {
  const actions = patternGuids.map(guid => {
    // For 'group' operations, don't capture beforeState because the grouped pattern didn't exist before
    const beforeState = (type === 'group') ? null : undoRedoManager.capturePatternState(guid);
    return {
      type,
      patternGuid: guid,
      beforeState: beforeState || undefined,
      metadata
    };
  });
  
  setTimeout(() => {
    const updatedActions = actions.map(action => ({
      ...action,
      afterState: undoRedoManager.capturePatternState(action.patternGuid)
    }));
    
    undoRedoManager.recordMultiplePatternActions(updatedActions);
  }, 0);
}
/////////////////////////////////
copySelectedPatterns() {
    if (!this.currentSurface) return;
     //surfaceCollection.selectedSurfaceData.addToUndoRedoStack();  

    const selectedPatterns = this.currentSurface._Patterns.filter(p => p._state === 'selected');
    if (selectedPatterns.length === 0) {
      this.clipboard = [];
      toastWarning("Select a pattern to copy");
      return;
    }

    try {
      let minX = Infinity;
      let minY = Infinity;

      selectedPatterns.forEach(p => {
        minX = Math.min(minX, p.unZoomed(p.x));
        minY = Math.min(minY, p.unZoomed(p.y));
      });

      this.clipboard = selectedPatterns.map(p => {
        const patternData = surfaceCollection.selectedSurfaceData.getPattern(p._guid);
        return {
          data: JSON.parse(JSON.stringify(patternData)),
          relX: p.unZoomed(p.x) - minX,
          relY: p.unZoomed(p.y) - minY,
          relAngle: p._rotation,
          isGroup: p.isGroup, 
        };
      });

      toastSuccess(`${selectedPatterns.length} pattern${selectedPatterns.length > 1 ? 's' : ''} copied`);
    } catch (error: any) {
      toastError(`Failed to copy patterns: ${error.message || 'Unknown error'}`, 4000);
    }
  }

  
  initiatePaste() {
    if (!this.currentSurface) return;
    
    if (this.clipboard.length === 0) {
      toastWarning("No patterns in clipboard to paste");
      return;
    }
    
    if (this.isPasting) return;
    
    if (this.isPasting) {
        this.cancelPaste(); 
    }
    this.isPasting = true;
    const surface = this.currentSurface;
    surface._app.canvas.style.cursor = 'copy';

    
    this.onPastePointerDown = (event: PIXI.FederatedPointerEvent) => {
      if (event.button !== 0) return; 

      const worldPoint = this.getWorldPoint(event);
      this.pastePatterns(worldPoint);
    };


    this.onPastePointerMove = (event: PIXI.FederatedPointerEvent) => {
      const worldPoint = this.getWorldPoint(event);
      this.updatePastePreview(worldPoint);
    };
    
  
    this.onCancelPasteKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            this.cancelPaste();
        }
    };

    surface._app.stage.interactive = true;
    surface._app.stage.eventMode = 'static';
    const stage = surface._app.stage;
    const screen = surface._app.screen;

    // Expand hit area to cover the full canvas area, not just screen borders
    // Use board dimensions or a large area to ensure paste preview works everywhere
    const board = surface._Board;
    const boardWidth = board._boardWidth || 5000;
    const boardLength = board._boardLength || 10000;
    
    // Create a hit area that covers the entire board plus extra margin
    const margin = 2000;
    stage.hitArea = new PIXI.Rectangle(-margin, -margin, boardLength + margin * 2, boardWidth + margin * 2);
    
    surface._app.stage.addListener('pointerdown', this.onPastePointerDown);
    surface._app.stage.addListener('pointermove', this.onPastePointerMove);
    window.addEventListener('keydown', this.onCancelPasteKeydown);
  }

  
private updatePastePreview(worldPoint: { x: number, y: number }) {
    if (!this.currentSurface || !this.isPasting) return;
    const surface = this.currentSurface;

    if (!this.pastePreviewContainer) {
        this.pastePreviewContainer = new PIXI.Container();
        
        this.clipboard.forEach(item => {
            const vp = new VectorPath();
            vp.parse(item.data.paths[0]);
            vp.paths = item.data.paths.slice(1);
            vp.normalize();

            const previewPattern = new Pattern(vp);
            previewPattern.zoomFactor = 1; // Create at base zoom
            previewPattern._color = 0x3498db; 
            
            previewPattern.x = item.relX; // Use unzoomed coordinates
            previewPattern.y = item.relY; // Use unzoomed coordinates
            
            // The paths already have rotation baked in, so set both _rotation and _vectorRotation
            // to prevent double-rotation when displaying
            previewPattern._rotation = item.relAngle;
            previewPattern._vectorRotation = item.relAngle;
            
            previewPattern.display();
            
            // Sub-patterns also need their rotation synced
            previewPattern.subPatterns.forEach(subPattern => {
              subPattern._rotation = item.relAngle;
              subPattern._vectorRotation = item.relAngle;
            }); 
        
            previewPattern.container.alpha = 0.6;

            this.pastePreviewContainer!.addChild(previewPattern.container);
        });
        
        surface._app.stage.addChild(this.pastePreviewContainer);
    }

    const zoom = surface.zoomFactor;
    this.pastePreviewContainer.position.set(worldPoint.x * zoom, worldPoint.y * zoom);
    this.pastePreviewContainer.scale.set(zoom, zoom); 
}

 
 private pastePatterns(worldPoint: { x: number; y: number }) {
    if (!this.currentSurface || this.clipboard.length === 0) return;
     //surfaceCollection.selectedSurfaceData.addToUndoRedoStack();  

    const surface = this.currentSurface;

    try {
      this.clipboard.forEach(item => {
        const newGuid = guid();
        const newPatternData = item.data;

        const finalX = worldPoint.x + item.relX;
        const finalY = worldPoint.y + item.relY;

        const newPattern = surface.addPath(newPatternData.paths[0], {
          guid: newGuid,
          nestedPaths: newPatternData.paths.slice(1),
          noNormilize: false,
        });
        
        newPattern.isGroup = item.isGroup; 

        newPattern.x = newPattern.zoomed(finalX + newPattern._vector.originalPosition.x);
        newPattern.y = newPattern.zoomed(finalY + newPattern._vector.originalPosition.y);
        
        // The paths already have rotation baked in, sync both rotation values
        newPattern._rotation = item.relAngle;
        newPattern._vectorRotation = item.relAngle;
        
        newPattern.display();
        
        // Sub-patterns also need their rotation synced
        newPattern.subPatterns.forEach(subPattern => {
          subPattern._rotation = item.relAngle;
          subPattern._vectorRotation = item.relAngle;
        });

        surfaceCollection.selectedSurfaceData.addPattern({
          ...newPatternData,
          guid: newGuid,
          boardPosition: { x: newPattern.x, y: newPattern.y },
          boardAngle: newPattern._rotation,
          
        });
        this.updateSelectedSurfaceData() ;
      });

      toastSuccess(`${this.clipboard.length} pattern${this.clipboard.length > 1 ? 's' : ''} pasted successfully`);
       //surfaceCollection.selectedSurfaceData.addToUndoRedoStack() ;
      this.cancelPaste();
    } catch (error: any) {
      toastError(`Failed to paste patterns: ${error.message || 'Unknown error'}`, 4000);
      this.cancelPaste();
    }
  }

 
  private cancelPaste() {
    if (!this.currentSurface || !this.isPasting) return;
    
    
    const surface = this.currentSurface;
    this.isPasting = false;
    surface._app.canvas.style.cursor = 'default';

    if (this.pastePreviewContainer) {
        surface._app.stage.removeChild(this.pastePreviewContainer);
        this.pastePreviewContainer.destroy({ children: true });
        this.pastePreviewContainer = null;
    }

    if (this.onPastePointerDown) surface._app.stage.removeListener('pointerdown', this.onPastePointerDown);
    if (this.onPastePointerMove) surface._app.stage.removeListener('pointermove', this.onPastePointerMove);
    if (this.onCancelPasteKeydown) window.removeEventListener('keydown', this.onCancelPasteKeydown);

    surface._app.stage.interactive = false;
    surface._app.stage.hitArea = null;
    surface._app.stage.eventMode = 'dynamic';
  }

  enableFocalPivotMode(): boolean {
    if (!this.currentSurface) {
      toastWarning("Load a board before setting a focal pivot");
      return false;
    }

    this.focalPivotModeEnabled = true;
    this.currentSurface.enableCustomPivotMode();
    return true;
  }

  disableFocalPivotMode(): void {
    this.focalPivotModeEnabled = false;
    this.currentSurface?.disableCustomPivotMode();
  }

  toggleFocalPivotMode(): boolean {
    if (this.focalPivotModeEnabled) {
      this.disableFocalPivotMode();
      return false;
    }

    return this.enableFocalPivotMode();
  }

  getActiveFocalPivotPoint() {
    return this.currentSurface?.getCustomPivotPoint() ?? null;
  }

  private syncPivotModeToSurface() {
    if (!this.currentSurface) {
      return;
    }

    if (this.focalPivotModeEnabled) {
      this.currentSurface.enableCustomPivotMode({ silent: true });
    } else {
      this.currentSurface.disableCustomPivotMode({ silent: true });
    }
  }

  

  private getWorldPoint(event: PIXI.FederatedPointerEvent): { x: number; y: number } {
      const surface = this.currentSurface!;
      const global = event.global;
      const stagePos = surface._app.stage.position;
      const zoom = surface.zoomFactor;
      const worldX = (global.x - stagePos.x) / zoom;
      const worldY = (global.y - stagePos.y) / zoom;
      return { x: worldX, y: worldY };
  }

////////////////////////////////////////////////////////////////////
setPanMode(isPan: boolean) {
    if (this.currentSurface) {
        this.currentSurface.isPanMode = isPan;
        this.currentSurface._app.canvas.style.cursor = isPan ? 'grab' : 'default';
    }
}

  async groupPatterns(selectedPatterns: (typeof Pattern)[]) {
    if (selectedPatterns.length < 2) return;

    const patternGuids = selectedPatterns.map(p => p._guid);
  
  // Capture original patterns data for metadata
  const originalPatterns = selectedPatterns.map(pattern => {
    //const surfaceCollection = (window as any).surfaceCollection;
    const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(pattern._guid);
    
    return {
      guid: pattern._guid,
      paths: [pattern._vector.generatePathString(), ...pattern.subPatterns.map((p: any) => p._vector.generatePathString())],
      boardPosition: { x: pattern.unZoomed(pattern.x), y: pattern.unZoomed(pattern.y) },
      boardAngle: pattern._rotation,
      patternId: patternData?.patternId || "",
      patternName: patternData?.patternName || "",
      patternColor: patternData?.patternColor || pattern._color,
      originalPosition: pattern._vector.originalPosition,
      firstLoad: patternData?.firstLoad || false
    };
  });
  
    // Record the action with metadata
    


    const surface = this.currentSurface!;
    const { guid } = await import('../core/Guid');


    const mainPattern = selectedPatterns.reduce((largest, current) => {
      const largestArea = largest.width * largest.height;
      const currentArea = current.width * current.height;
      return currentArea > largestArea ? current : largest;
    });

  
    const mainPatternData = surfaceCollection.selectedSurfaceData.getPattern(mainPattern._guid);
    const patternColor = mainPatternData?.patternColor || mainPattern._color;
    const patternName = mainPatternData?.patternName || "Grouped Pattern";
    const patternId = mainPatternData?.patternId || "";
    
 
    const mainPath = mainPattern._vector.generatePathString();
    const subPaths: string[] = [];
    

    selectedPatterns.forEach(pattern => {
        
        pattern.subPatterns.forEach((subPattern: _Pattern) => {
            const subPath = new paper.Path(subPattern._vector.generatePathString());
         
            const subX = pattern.unZoomed(pattern.x) + subPattern.unZoomed(subPattern.x);
            const subY = pattern.unZoomed(pattern.y) + subPattern.unZoomed(subPattern.y);
            subPath.translate(new paper.Point(subX, subY));
           
            subPath.translate(new paper.Point(-mainPattern.unZoomed(mainPattern.x), -mainPattern.unZoomed(mainPattern.y)));
            subPaths.push(subPath.pathData);
        });

   
        if (pattern !== mainPattern) {
            const path = new paper.Path(pattern._vector.generatePathString());
            path.translate(new paper.Point(pattern.unZoomed(pattern.x), pattern.unZoomed(pattern.y)));
       
            path.translate(new paper.Point(-mainPattern.unZoomed(mainPattern.x), -mainPattern.unZoomed(mainPattern.y)));
            subPaths.push(path.pathData);
        }
    });


    const newGroupGuid = guid();
    surface.addPath(mainPath, {
      guid: newGroupGuid,
      nestedPaths: subPaths,
      noNormilize: false,
    });

    const newGroupPattern = surface._Patterns[surface._Patterns.length - 1];
    newGroupPattern.isGroup = true; 

    
    const normalizeOffsetX = newGroupPattern._vector.originalPosition.x;
    const normalizeOffsetY = newGroupPattern._vector.originalPosition.y;
    newGroupPattern.x = newGroupPattern.zoomed(mainPattern.unZoomed(mainPattern.x) + normalizeOffsetX);
    newGroupPattern.y = newGroupPattern.zoomed(mainPattern.unZoomed(mainPattern.y) + normalizeOffsetY);
    newGroupPattern.display();

 
    surfaceCollection.selectedSurfaceData.addPattern({
      boardAngle: 0,
      boardPosition: { x: newGroupPattern.x, y: newGroupPattern.y },
      guid: newGroupPattern._guid,
      paths: [newGroupPattern._vector.generatePathString(), ...newGroupPattern.subPatterns.map((p) => p._vector.generatePathString())],
      patternColor: patternColor,
      patternName: patternName,
      patternId: patternId,
    });

 
    selectedPatterns.forEach(pattern => {
        surface.removePattern(pattern);
        surfaceCollection.selectedSurfaceData.removePattern(pattern._guid);
    });

    
    //surface.multiSelection = [newGroupPattern];
    //newGroupPattern.setState('selected');
    surface.display();
    // surfaceCollection.selectedSurfaceData.addToUndoRedoStack() ;
    this.recordMultiplePatternActions('group', [newGroupGuid], {
      originalPatterns: originalPatterns,
      originalPatternGuids: patternGuids
    });
    this.saveSlectedSurface();
  }

async ungroupPatterns(groupPattern: typeof Pattern) {
  const surface = this.currentSurface!;

  const patternGuid = groupPattern._guid;
  
  // Capture the grouped pattern state BEFORE ungrouping
  const beforeState = undoRedoManager.capturePatternState(patternGuid);

  // Check if this is a nested path selected via Shift+Click (has _parentPattern and _state === 'selected')
  if (groupPattern._parentPattern && groupPattern._state === 'selected') {
      // Handle nested path ungroup (ungroup from parent pattern)
      const parentPattern = groupPattern._parentPattern;
      const nestedIndex = parentPattern.subPatterns.indexOf(groupPattern);
      
      if (nestedIndex === -1) {
          toastWarning("Could not find nested path in parent pattern");
          return;
      }
      
      // Capture parent pattern state before ungrouping
      const parentBeforeState = undoRedoManager.capturePatternState(parentPattern._guid);
      
      // Remove the nested path from parent
      parentPattern.subPatterns.splice(nestedIndex, 1);
      parentPattern._vector.paths.splice(nestedIndex, 1);
      
      // Get the nested path's absolute position
      const nestedPath = groupPattern._vector.generatePathString();
      const parentX = parentPattern.unZoomed(parentPattern.x);
      const parentY = parentPattern.unZoomed(parentPattern.y);
      
      // Create new standalone pattern from the nested path
      const newPattern = surface.addPath(nestedPath, {
          guid: guid(),
          noNormilize: false,
      });
      
      const groupData = surfaceCollection.selectedSurfaceData.getPattern(parentPattern._guid);
      const patternColor = groupData?.patternColor || parentPattern._color;
      const patternName = "Ungrouped Sub-Pattern";
      const patternId = "";

      // Calculate position relative to parent
      const normalizeOffsetX = newPattern._vector.originalPosition.x;
      const normalizeOffsetY = newPattern._vector.originalPosition.y;

      newPattern.x = newPattern.zoomed(parentX + normalizeOffsetX);
      newPattern.y = newPattern.zoomed(parentY + normalizeOffsetY);
      newPattern.display();
      
      const newPatternData: TSurfaceDataPattern = {
          boardAngle: 0,
          boardPosition: { x: newPattern.x, y: newPattern.y },
          guid: newPattern._guid,
          paths: [newPattern._vector.generatePathString()],
          patternColor: patternColor,
          patternName: patternName,
          patternId: patternId,
      };
      
      surfaceCollection.selectedSurfaceData.addPattern(newPatternData);
      
      // Dispose the nested path from parent
      groupPattern.dispose();
      
      // Update parent pattern display
      parentPattern.display();
      
      // Clear selection
      surface.multiSelection = surface.multiSelection.filter(p => p !== groupPattern);
      
      // Capture the parent pattern's state AFTER ungrouping the subpattern
      const parentAfterState = undoRedoManager.capturePatternState(parentPattern._guid);
      
      // Record undo/redo action for nested path ungrouping
      undoRedoManager.recordPatternAction({
        type: 'ungroup',
        patternGuid: parentPattern._guid,
        beforeState: parentBeforeState!,
        afterState: parentAfterState!,
        metadata: {
          newlyCreatedPatterns: [newPatternData],
          newlyCreatedPatternGuids: [newPattern._guid],
          isNestedPathUngroup: true // Flag to identify this special case
        }
      });
      
      this.saveSlectedSurface();
      toastSuccess("Nested path ungrouped successfully", 2000);
      return;
  }

  if (groupPattern._state === 'edition') {
      const editionPattern = groupPattern as _Pattern & TEditionPattern;
      let fullySelectedSubpattern: (_Pattern & TEditionPattern) | null = null;
      
      for (const subPattern of editionPattern.subPatterns as (_Pattern & TEditionPattern)[]) {
          const subPatternHandlers = subPattern.handlerList;
          // Check if ALL handlers of this subpattern are selected (regardless of what else is selected)
          if (subPatternHandlers.length > 0 &&
              subPatternHandlers.every(h => surfaceManager.globalSelectedHandlers.some(sh => sh.handler === h && sh.pattern === subPattern))) {
              fullySelectedSubpattern = subPattern;
              break;
          }
      }
      
      if (fullySelectedSubpattern) {
          const subPatternIndex = editionPattern.subPatterns.indexOf(fullySelectedSubpattern);
          if (subPatternIndex > -1) {
              editionPattern.subPatterns.splice(subPatternIndex, 1);
              editionPattern._vector.paths.splice(subPatternIndex, 1);
              
              const newPath = fullySelectedSubpattern._vector.generatePathString();
              const newPattern = surface.addPath(newPath, {
                  guid: guid(),
                  noNormilize: false,
              });
              
              const groupData = surfaceCollection.selectedSurfaceData.getPattern(editionPattern._guid);
              const patternColor = groupData?.patternColor || editionPattern._color;
              const patternName = "Ungrouped Sub-Pattern";
              const patternId = "";

              const groupX = editionPattern.unZoomed(editionPattern.x);
              const groupY = editionPattern.unZoomed(editionPattern.y);
              const normalizeOffsetX = newPattern._vector.originalPosition.x;
              const normalizeOffsetY = newPattern._vector.originalPosition.y;

              newPattern.x = newPattern.zoomed(groupX + normalizeOffsetX);
              newPattern.y = newPattern.zoomed(groupY + normalizeOffsetY);
              newPattern.display();
              
              const newPatternData: TSurfaceDataPattern = {
                  boardAngle: 0,
                  boardPosition: { x: newPattern.x, y: newPattern.y },
                  guid: newPattern._guid,
                  paths: [newPattern._vector.generatePathString()],
                  patternColor: patternColor,
                  patternName: patternName,
                  patternId: patternId,
              };
              
              surfaceCollection.selectedSurfaceData.addPattern(newPatternData);
              
              fullySelectedSubpattern.dispose();
              editionPattern.display();
              
              // Capture the parent pattern's state AFTER ungrouping the subpattern
              const afterState = undoRedoManager.capturePatternState(patternGuid);
              
              // Record undo/redo action for edit-mode subpattern ungrouping
              undoRedoManager.recordPatternAction({
                type: 'ungroup',
                patternGuid: patternGuid,
                beforeState: beforeState!,
                afterState: afterState!,
                metadata: {
                  newlyCreatedPatterns: [newPatternData],
                  newlyCreatedPatternGuids: [newPattern._guid],
                  isEditModeUngroup: true // Flag to identify this special case
                }
              });
              
              this.saveSlectedSurface();
          }
          return;
      }
  }


  // Arrays to collect newly created pattern data for undo/redo
  const newlyCreatedPatterns: TSurfaceDataPattern[] = [];
  const newlyCreatedPatternGuids: string[] = [];
  
  const groupData = surfaceCollection.selectedSurfaceData.getPattern(groupPattern._guid);
  const patternColor = groupData?.patternColor || groupPattern._color;
  const patternName = groupData?.patternName || "Ungrouped Pattern";
  const patternId = groupData?.patternId || "";
  
  const groupX = groupPattern.unZoomed(groupPattern.x);
  const groupY = groupPattern.unZoomed(groupPattern.y);

 
  const mainPath = groupPattern._vector.generatePathString();
  surface.addPath(mainPath, { guid: guid(), noNormilize: false });
  const newMainPattern = surface._Patterns[surface._Patterns.length - 1];
  
  const mainNormalizeOffsetX = newMainPattern._vector.originalPosition.x;
  const mainNormalizeOffsetY = newMainPattern._vector.originalPosition.y;
  newMainPattern.x = newMainPattern.zoomed(groupX + mainNormalizeOffsetX);
  newMainPattern.y = newMainPattern.zoomed(groupY + mainNormalizeOffsetY);
  newMainPattern.display();

  const mainPatternData: TSurfaceDataPattern = {
      boardAngle: 0,
      boardPosition: { x: newMainPattern.x, y: newMainPattern.y },
      guid: newMainPattern._guid,
      paths: [newMainPattern._vector.generatePathString()],
      patternColor: patternColor,
      patternName: patternName,
      patternId: patternId,
  };

  surfaceCollection.selectedSurfaceData.addPattern(mainPatternData);
  newlyCreatedPatterns.push(mainPatternData);
  newlyCreatedPatternGuids.push(newMainPattern._guid);

 
  groupPattern.subPatterns.forEach((subPattern: _Pattern) => {
      const subPath = subPattern._vector.generatePathString();
      surface.addPath(subPath, { guid: guid(), noNormilize: false });
      const newSubPattern = surface._Patterns[surface._Patterns.length - 1];

   
      const normalizeOffsetX = newSubPattern._vector.originalPosition.x;
      const normalizeOffsetY = newSubPattern._vector.originalPosition.y;
      newSubPattern.x = newSubPattern.zoomed(groupX + normalizeOffsetX);
      newSubPattern.y = newSubPattern.zoomed(groupY + normalizeOffsetY);
      newSubPattern.display();
      
      const subPatternData: TSurfaceDataPattern = {
          boardAngle: 0,
          boardPosition: { x: newSubPattern.x, y: newSubPattern.y },
          guid: newSubPattern._guid,
          paths: [newSubPattern._vector.generatePathString()],
          patternColor: patternColor,
          patternName: "Ungrouped Sub-Pattern",
          patternId: "",
      };
      
      surfaceCollection.selectedSurfaceData.addPattern(subPatternData);
      newlyCreatedPatterns.push(subPatternData);
      newlyCreatedPatternGuids.push(newSubPattern._guid);
  });


  surface.removePattern(groupPattern);
  surfaceCollection.selectedSurfaceData.removePattern(groupPattern._guid);
  
  // Record undo/redo action with all the metadata
  undoRedoManager.recordPatternAction({
    type: 'ungroup',
    patternGuid: patternGuid,
    beforeState: beforeState!,
    afterState: undefined,
    metadata: {
      newlyCreatedPatterns: newlyCreatedPatterns,
      newlyCreatedPatternGuids: newlyCreatedPatternGuids
    }
  });
  
  // --- FIX STARTS HERE ---
  // After ungrouping, we need to reset the surface's multi-selection and editing state.
  surface.multiSelection = [];
  surface._isEditing = false;
  
  // Ensure all patterns (especially the newly created ones) are in a selectable state.
  surface._Patterns.forEach(p => {
    if (p._state === 'edition') {
      p.setState(''); // Exit edition mode
    }
  });
  // --- FIX ENDS HERE ---

  surface.display();
  this.saveSlectedSurface();
  
  toastSuccess(`Group ungrouped successfully into ${newlyCreatedPatterns.length} patterns`, 2000);
}

//////////////////////////////////////////////////////////////
private placeNestedAtI(worldPoint: { x: number; y: number },selectedPatterns: typeof Pattern[]) {

  if (!this.nestedTemplateI || !this.currentSurface) return  ;

  const surface = this.currentSurface;
const dx = worldPoint.x;
const dy = worldPoint.y;
this.nestedTemplateI.forEach(({ patternIdx, relX, relY, relAngle }) => {
  const pattern = selectedPatterns[patternIdx];
  if (!pattern) return;
  pattern.zCtx = relX + dx;  
  pattern.zCty = relY + dy;
  pattern._rotation = relAngle;
  pattern._backupRotation = -relAngle;
  pattern.applyTransformations({ rotate: true, translate: false });
  pattern.display();
});

  this.updateSelectedSurfaceData();
  surface.display();

  this.isReadyToPlaceNested = false;
  this.nestedTemplateI = null;
  surface._app.canvas.style.cursor = 'default';  
  surface._app.stage.removeListener('pointerdown', this.onNestPointerDown);
  surface._app.stage.removeListener('pointermove', this.onNestPointerMove);

  
  if (this.onCancelNestKeydown) {
    window.removeEventListener('keydown', this.onCancelNestKeydown);
    this.onCancelNestKeydown = undefined;
  }
  
  // Emit event for material usage update after nesting
  _evtBus.emit("nestingComplete");
 
}

private placeNestedAt(worldPoint: { x: number; y: number }, selectedPatterns: typeof Pattern[]) {
  if (!this.nestedTemplate || !this.currentSurface) return;

  const surface = this.currentSurface;
  const dx = worldPoint.x;
  const dy = worldPoint.y;


  let minX = Infinity, minY = Infinity;
  this.nestedTemplate.forEach(({ absX, absY }) => {
    minX = Math.min(minX, absX);
    minY = Math.min(minY, absY);
  });


  this.nestedTemplate.forEach(({ patternIdx, absX, absY, relAngle }) => {
    const pattern = selectedPatterns[patternIdx];
    if (!pattern) return;
    pattern.zCtx = (absX - minX) + dx;
    pattern.zCty = (absY - minY) + dy;
    pattern._rotation = relAngle;
    pattern._backupRotation = -relAngle;
    pattern.applyTransformations({ rotate: true, translate: false });
    pattern.display();
  });

  this.updateSelectedSurfaceData();
  surface.display();

  this.isReadyToPlaceNested = false;
  this.nestedTemplate = null;
  surface._app.canvas.style.cursor = 'default';
  surface._app.stage.removeListener('pointerdown', this.onNestPointerDown);
  surface._app.stage.removeListener('pointermove', this.onNestPointerMove);

  if (this.onCancelNestKeydown) {
    window.removeEventListener('keydown', this.onCancelNestKeydown);
    this.onCancelNestKeydown = undefined;
  }
  
  // Emit event for material usage update after nesting
  _evtBus.emit("nestingComplete");
}


//////////////////////////////////////////////////////////

  saveSlectedSurface(forceFirstLoad: boolean = false) {
    setTimeout(() => {
      /*
      if (!this.currentSurface) return;
      // Save the selected surface
      this.currentSurface!._Patterns.forEach((item) => {
        const pt = surfaceCollection.getPatternFromSelectedSurface(item._guid);
        item._vector.paths = item._vector.paths.filter((p) => p !== item._vector["_path"]);
        pt!.paths = [item._vector.generatePathString(), ...item.subPatterns.map((p) => p._vector.generatePathString())];
       pt!.boardPosition = { x: item.zCtx, y: item.zCty };
       
        pt!.boardAngle = item._rotation;
        if (forceFirstLoad) {
          pt!.firstLoad = false;
        }
        surfaceCollection.selectedSurfaceData.setPattern(pt!);
      });

    surfaceCollection.selectedSurfaceData.boardY          = this.currentSurface!._app.stage.position.y;
      surfaceCollection.selectedSurfaceData.addToUndoRedoStack();
      */
     this.updateSelectedSurfaceData() ;


   }, 1);
    }




  checkCollision() {
    const surface = this.currentSurface;
    if (!surface) return;
    const patterns = surface._Patterns;
    if (patterns.length < 2) {
      patterns.push(patterns[0]);
    }
    const collisions = [] as { pattern1: typeof Pattern, pattern2: typeof Pattern }[];
    
    // Define board boundaries once - use dynamic board dimensions from current surface
    const bWidth  = surface._Board._boardWidth || config.boardWidth;
    const bLength = surface._Board._boardLength || config.boardLenght;
    const boardBounds = new paper.Path.Rectangle({
      x: 0, 
      y: 0,
      width: bLength,
      height: bWidth
    });
    
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const p1 = patterns[i];
        const p2 = patterns[j];
        const c1 = new paper.Path(p1._vector["_path"]);
        const c2 = new paper.Path(p2._vector["_path"]);
        c1.translate({x: p1.zCtx, y: p1.zCty});
        c2.translate({x: p2.zCtx, y: p2.zCty});
        
        // Check pattern-to-pattern collision using Paper.js's reliable intersects method
        if (p1 !== p2 && c1.intersects(c2)) {
          collisions.push({ pattern1: p1, pattern2: p2 });
        }
        
        // Clean up paths
        c1.remove();
        c2.remove();
      }
      
      // Check each pattern against board boundaries
      const p = patterns[i];
      const c = new paper.Path(p._vector["_path"]);
      c.translate({x: p.zCtx, y: p.zCty});
      
      // Pattern is out of bounds if it extends beyond the board or intersects board edges
      const bounds = c.bounds;
      const isOutOfBounds = bounds.x < 0 || 
                           bounds.y < 0 || 
                           bounds.x + bounds.width > bLength || 
                           bounds.y + bounds.height > bWidth;
      
      if (isOutOfBounds) {
        collisions.push({ pattern1: p, pattern2: p });
      }
      
      // Clean up
      c.remove();
    }
    
    // Clean up board bounds
    boardBounds.remove();

    let p = null as typeof Pattern | null;
     surface._Patterns.forEach((p) => {
      p.setState("");
    });
      let color = true;
      let num = 0;
      const idx = setInterval(() => {
        color = !color;
        num++
        collisions.forEach((c) => {
          //if (c.pattern1 === p || c.pattern2 === p) {
            c.pattern1.setState(color ? "collided" : "");
            c.pattern2.setState(color ? "collided" : "");
         // }
        });
        if (num > 15) {
          clearInterval(idx);
          collisions.forEach((c) => {
            //if (c.pattern1 === p || c.pattern2 === p) {
              c.pattern1.setState("");
              c.pattern2.setState("");
           // }
          });
        }
      }, 100);
      surfaceManager.currentSurface!.selectionBox!.isSelecting = false;
    return collisions;
  }

  updateSelectedSurfaceData() {
    // Guard: Check if currentSurface exists
    if (!this.currentSurface) {
      console.warn("updateSelectedSurfaceData: currentSurface is null");
      return;
    }

    // Guard: Check if _Board exists and has valid dimensions
    if (!this.currentSurface._Board) {
      console.warn("updateSelectedSurfaceData: _Board is null or undefined");
      return;
    }

    // Guard: Check if board dimensions exist and are valid
    if (!this.currentSurface._Board._boardWidth || !this.currentSurface._Board._boardLength) {
      console.warn("updateSelectedSurfaceData: Board dimensions are not set", {
        boardWidth: this.currentSurface._Board._boardWidth,
        boardLength: this.currentSurface._Board._boardLength
      });
      return;
    }

    // Guard: Check if board dimensions are positive
    if (this.currentSurface._Board._boardWidth <= 0 || this.currentSurface._Board._boardLength <= 0) {
      console.warn("updateSelectedSurfaceData: Board dimensions must be positive", {
        boardWidth: this.currentSurface._Board._boardWidth,
        boardLength: this.currentSurface._Board._boardLength
      });
      return;
    }

    // Guard: Check if _Patterns exists
    if (!this.currentSurface._Patterns) {
      console.warn("updateSelectedSurfaceData: _Patterns is null or undefined");
      return;
    }

    // Guard: Check if _app exists (needed for board position)
    if (!this.currentSurface._app) {
      console.warn("updateSelectedSurfaceData: _app is null or undefined");
      return;
    }

    const surfacePatternGuids = new Set(this.currentSurface._Patterns.map(p => p._guid));
  
    // Remove any patterns from SurfaceData that no longer exist on the surface
    const surfaceDataPatterns = surfaceCollection.selectedSurfaceData.patterns;
    for (let i = surfaceDataPatterns.length - 1; i >= 0; i--) {
      if (!surfacePatternGuids.has(surfaceDataPatterns[i].guid)) {
        surfaceDataPatterns.splice(i, 1);
      }
    }
    this.currentSurface._Patterns.forEach((item) => {
      // Check if pattern is in edition mode
      const isInEditionMode = item._state === 'edition';
      
      const strPattern = item._vector.generatePathString();
      const oldPaths = item.subPatterns.map((p) => p._vector.generatePathString());
      
      if (isInEditionMode) {
        // ⚠️ EDITION MODE: Skip normalization to prevent vector replacement
        // Save raw paths as-is without normalizing
        // cleanUp_edition() will normalize everything when exiting edit mode
        const refPat = surfaceCollection.getPatternFromSelectedSurface(item._guid);
        if (refPat) {
          // Save paths without normalization
          refPat.paths = [strPattern, ...oldPaths];
          
          // Calculate position using current vector's originalPosition
          const unzoomedX = item.unZoomed(item.x);
          const unzoomedY = item.unZoomed(item.y);
          const baseX = unzoomedX - item._vector.originalPosition.x;
          const baseY = unzoomedY - item._vector.originalPosition.y;
          
          refPat.boardPosition = { x: baseX, y: baseY };
          refPat.boardAngle = item._rotation;
        }
      } else {
        // ✅ NORMAL MODE: Normalize and save (for non-edit mode patterns)
        const vecPattern = new VectorPath();
        vecPattern.parse(strPattern);
        
        // --- START OF THE FIX ---
        
        // 1. UN-COMMENT THIS. It is essential.
        vecPattern.normalize();
        
        // 2. Get the new offset that normalize() just calculated.
        const normX = vecPattern.originalPosition.x;
        const normY = vecPattern.originalPosition.y;

        // 3. Apply the *exact same* translation to all sub-paths
        //    so they are correctly aligned with the new normalized main path.
        const normalizedSubPaths = oldPaths.map(subPathString => {
            // We must use paper.js to apply the translation
            const tempPaperPath = new paper.Path(subPathString);
            tempPaperPath.translate(new paper.Point(-normX, -normY)); 
            return tempPaperPath.pathData;
        });

        // 4. Assign the *newly translated* sub-paths.
        vecPattern.paths = normalizedSubPaths;
        item._vector = vecPattern; // The pattern's vector is now 100% consistent.

        const refPat = surfaceCollection.getPatternFromSelectedSurface(item._guid);
        if (refPat) {
          // 5. Save the new, correct path strings.
          refPat.paths = [vecPattern.generatePathString(), ...normalizedSubPaths];
          
          // --- END OF THE FIX ---

          // This position-saving code is correct and will now work
          // because item._vector.originalPosition is correct.
          const unzoomedX = item.unZoomed(item.x);
          const unzoomedY = item.unZoomed(item.y);
          const baseX = unzoomedX - item._vector.originalPosition.x;
          const baseY = unzoomedY - item._vector.originalPosition.y;
          
          refPat.boardPosition = { x: baseX, y: baseY };
         
               refPat.boardAngle = item._rotation;
        }
      }
    });
    
    surfaceCollection.selectedSurfaceData.boardZoomFactor = this.currentSurface.zoomFactor;
    surfaceCollection.selectedSurfaceData.boardWidth      = this.currentSurface._Board._boardWidth;
    surfaceCollection.selectedSurfaceData.boardLength     = this.currentSurface._Board._boardLength;
    surfaceCollection.selectedSurfaceData.boardX          = this.currentSurface._app.stage.position.x;
    
    // Save annotations to current board
    if (boardManager.boards[boardManager.currentBoardIndex] && this.currentSurface._Board.annotations) {
      boardManager.boards[boardManager.currentBoardIndex].annotations = [...this.currentSurface._Board.annotations];
    }
    surfaceCollection.selectedSurfaceData.boardY          = this.currentSurface._app.stage.position.y;
  }
    
  
//////////////////////////////////check collision only for patterns to cut 
checkCollisionPatterntocut(patternsToCut: typeof Pattern[]): { pattern1: typeof Pattern, pattern2: typeof Pattern }[] {
    const surface = this.currentSurface;
    if (!surface) return [];

    const collisions: { pattern1: typeof Pattern, pattern2: typeof Pattern }[] = [];
    const boardWidth = surface._Board._boardWidth;
    const boardLength = surface._Board._boardLength;

    // Check for intersections between the patterns that are going to be cut
    for (let i = 0; i < patternsToCut.length; i++) {
        const p1 = patternsToCut[i];
        const c1 = new paper.Path(p1._vector["_path"]);
        c1.translate({ x: p1.zCtx, y: p1.zCty });

        // Check if pattern is out of board boundaries
        const bounds = c1.bounds;
        const isOutOfBounds = bounds.x < 0 || 
                             bounds.y < 0 || 
                             bounds.x + bounds.width > boardLength || 
                             bounds.y + bounds.height > boardWidth;
        
        if (isOutOfBounds) {
            collisions.push({ pattern1: p1, pattern2: p1 }); // A collision with itself indicates a border collision
        }

        // Check pattern-to-pattern collisions
        for (let j = i + 1; j < patternsToCut.length; j++) {
            const p2 = patternsToCut[j];
            const c2 = new paper.Path(p2._vector["_path"]);
            c2.translate({ x: p2.zCtx, y: p2.zCty });

            // Check for collision using Paper.js's reliable intersects method
            if (c1.intersects(c2)) {
                collisions.push({ pattern1: p1, pattern2: p2 });
            }
            
            // Clean up c2
            c2.remove();
        }
        
        // Clean up c1
        c1.remove();
    }

    // Animate the collided patterns to provide visual feedback to the user
    if (collisions.length > 0) {
        let color = true;
        let num = 0;
        const idx = setInterval(() => {
            color = !color;
            num++;
            collisions.forEach((c) => {
                c.pattern1.setState(color ? "collided" : "");
                c.pattern2.setState(color ? "collided" : "");
            });
            if (num > 15) {
                clearInterval(idx);
                collisions.forEach((c) => {
                    c.pattern1.setState("");
                    c.pattern2.setState("");
                });
            }
        }, 100);
    }

    if (surface.selectionBox) {
        surface.selectionBox.isSelecting = false;
    }
    
    return collisions;
}
///////////////////////////////////////////////////////////////////////////
  async cut() {
    if (!this.currentSurface) return;

    //////////////////////////////////////////////////////////finding only patterns inside the cutting board 
    const boardWidth = this.currentSurface._Board._boardWidth;
const boardLength = this.currentSurface._Board._boardLength;



// CRITICAL FIX: Ensure ALL patterns have _polyHit initialized before boundary check
let uninitializedCount = 0;
this.currentSurface._Patterns.forEach(item => {
  if (!item._polyHit || !item._polyHit["points"] || item._polyHit["points"].length === 0) {
    uninitializedCount++;
    // Force initialize _polyHit immediately
    item._polyHit.setPath(item._vector.generatePathString());
  }
});

let filteredOutCount = 0;
let validItems = this.currentSurface._Patterns.filter(item => {
  const hull = item._polyHit["points"];
  
  // Safety check: if hull is still empty after initialization, skip this pattern
  if (!hull || hull.length === 0) {
    console.warn(`⚠️ Pattern ${item._guid} has empty _polyHit after initialization`);
    filteredOutCount++;
    return false;
  }
  
  const minX = Math.min(...hull.map(_ => _.x));
  const minY = Math.min(...hull.map(_ => _.y));
  const maxX = Math.max(...hull.map(_ => _.x));
  const maxY = Math.max(...hull.map(_ => _.y));

  const bBox = {
    x: minX + item.zCtx,
    y: minY + item.zCty,
    width: maxX - minX,
    height: maxY - minY
  };

  // Check for intersection with the board
  const intersects = bBox.x < boardLength &&
                     bBox.x + bBox.width > 0 &&
                     bBox.y < boardWidth &&
                     bBox.y + bBox.height > 0;

  if (!intersects) {
    filteredOutCount++;
  }

  return intersects;
});

    ////////////////////////////////////////////////////////////////////////////////////////
    // Remove duplicates from validItems
    validItems = validItems.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t._guid === item._guid
      ))
    );
    
    // IMPORTANT: Check for selected patterns BEFORE collision check
    // because checkCollision() clears all pattern states
    const selectedPatterns = validItems.filter(item => item._state === 'selected');
    
    // If there are selected patterns, only cut those; otherwise cut all validItems
    if (selectedPatterns.length > 0) {
      validItems = selectedPatterns;
    }
    
    if (validItems.length === 0) {
      toastWarning("No items to cut");
      return;
    }

///////////////////////////check collision for patterns to cut only 
    // Use the dedicated collision check that doesn't clear pattern states
    const hasCollision = this.checkCollisionPatterntocut(validItems);

    if (hasCollision.length > 0) {
     const resul = await  ppConfirm("Collision Detected", "an overlap might be detected !") ;
          if (resul !== "ok") {
            return  ;
          }

  }
    
    // Show count in popup
    const patternCountText = validItems.length === 1 
      ? "1 pattern will be cut." 
      : `${validItems.length} patterns will be cut.`;
    const popupMessage = `${patternCountText}\n\nWould you like to preview the cut layout or cut directly?`;
    
const userChoice = await ppCutOrPreview("Proceed to Cut", popupMessage);
    if (!userChoice || userChoice === "cancel") {
      return; // User cancelled the operation
    }
    const _ppWait_= ppWait("Processing", "please wait...");
    _ppWait_.show();
    const config = await getConfig();
 

    const usages: number[] = [];

        const strPatterns = [] as string[];
        validItems.forEach(item => {
          // if the patternId is not yet in the list we add it
          const itemData = surfaceCollection.getPatternFromSelectedSurface(item._guid);
          if (!strPatterns.includes(itemData.patternId)) {
           strPatterns.push(itemData.patternId ?? "");
          }
        });

        // Calculate offset for selected patterns to reposition them to origin
        let offsetX = 0;
        let offsetY = 0;
        
        if (selectedPatterns.length > 0) {
          // Find the minimum X and Y positions among selected patterns
          let minX = Infinity;
          let minY = Infinity;
          
          validItems.forEach(item => {
            const hull = item._polyHit["points"];
            if (hull && hull.length > 0) {
              const patternMinX = Math.min(...hull.map(_ => _.x)) + item.zCtx;
              const patternMinY = Math.min(...hull.map(_ => _.y)) + item.zCty;
              
              if (patternMinX < minX) minX = patternMinX;
              if (patternMinY < minY) minY = patternMinY;
            }
          });
          
          offsetX = minX !== Infinity ? minX : 0;
          offsetY = minY !== Infinity ? minY : 0;
        }

        const res = [] as string[];
        
        validItems.forEach((item, idx) => {
          // Apply offset to reposition selected patterns to origin
          const translationPoint = { 
            x: item.zCtx - offsetX, 
            y: item.zCty - offsetY 
          };
          
          item._vector.translate(translationPoint.x, translationPoint.y); // move to calculate the path
          const vc = item._vector.generatePathString();
          item._vector.translate(-translationPoint.x, -translationPoint.y); // move back to original position
          res.push(vc);
          
          const subPatternCount = item.subPatterns.length;
          item.subPatterns.forEach((p) => {
            p._vector.translate(translationPoint.x, translationPoint.y); // move to calculate the path
            res.push(p._vector.generatePathString());
            p._vector.translate(-translationPoint.x, -translationPoint.y); // move back to original position
          });
        });

    
        // Use maximum precision (80) for accurate curves and fine details
        // The 500ms delay removal and parallel processing provide speed gains
        // without sacrificing quality
        const precision = 80;
        

        const startTime = performance.now();
        const normalizedPolygons = await createPolygonFromSVGPaths(res, precision);
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);

        // Re-apply board offset only when the selection is already near the front edge.
        // Otherwise, keep patterns snapped to the origin so the cut starts at the front of the film.
        const FRONT_SNAP_THRESHOLD_MM = 5;
        const shouldSnapToFront = offsetX > FRONT_SNAP_THRESHOLD_MM;
        const reapplyOffsetX = shouldSnapToFront ? 0 : offsetX;
        const reapplyOffsetY = offsetY;

        const polygons: [number, number][][] = normalizedPolygons.map(polygon =>
          polygon.map(([x, y]) => [x + reapplyOffsetX, y + reapplyOffsetY] as [number, number])
        );
    

        // from the table of poligon, one unit = 1 millimeter
        // we need to calculate the surface used in square meters
        // based on the max width and board height
        // Use dynamic board dimensions from current surface
        const currentBoardWidth = this.currentSurface!._Board._boardWidth || config.boardWidth;
        const currentBoardLength = this.currentSurface!._Board._boardLength || config.boardLenght;
        // we need to calculate the surface used in square meters
        const maxX = Math.max(...polygons.map(p => Math.max(...p.map(point => point[0]))));
        const maxY = currentBoardWidth; // assuming board width is the height of the board
        const surfaceUsed = (maxX * maxY) / 1000000; // convert to square meters
        usages[0] = surfaceUsed; // in square meters
        
        // Calculate usage percentage correctly (matching CutBoard.tsx logic)
        // Total board area in square meters
        const boardArea = (currentBoardLength * currentBoardWidth) / 1000000;
        // Usage percentage = (used area / total board area) * 100
        usages[1] = boardArea > 0 ? (surfaceUsed / boardArea) * 100 : 0;
///////////////////////////////////////////////

 const valTextMeasure = convertMm(maxX, 'inches');
 let surfaceUsage :number ;
 let previewwidth : number ;
 let previewlength : number ;
    if (valTextMeasure[1] === "Imperial") {
    surfaceUsage = surfaceUsed * 10.7639; 
    previewwidth = currentBoardWidth /25.4 ;
     previewlength = currentBoardLength /25.4 ;
    }else {surfaceUsage = surfaceUsed,previewwidth=currentBoardWidth , previewlength =currentBoardLength }
    const usageText = `${surfaceUsage.toFixed(2)} ${valTextMeasure[1] === "Metric" ? "m²" : "sqft"}`;
    const cutwidth = `${previewwidth.toFixed(2)} ${valTextMeasure[1] === "Metric" ? "mm" : "in"}`;
    const cutlength = `${previewlength.toFixed(2)} ${valTextMeasure[1] === "Metric" ? "mm" : "in"}`;
let costText = "N/A";
    let selectedRollText = "N/A";
    try {
      const userRollData = (window as any).userRollData;
      const userCurrency = (window as any).userCurrency;
      const selectedRollIndex = (window as any).selectedRollIndex || 0;
      if (userRollData && userRollData.length > 0) {
        const roll = userRollData[selectedRollIndex] || userRollData[0];
        const pricePerM2 = roll.purchase_price;
        const totalCost = surfaceUsed * pricePerM2;
        const currencySymbol = userCurrency === 1 ? "$" : userCurrency === 2 ? "€" : "£";
        costText = `${currencySymbol}${totalCost.toFixed(2)}`;
        selectedRollText = roll.name || `Roll ${selectedRollIndex + 1}`;
      }
    } catch (e) {
    }

          /////////////////////////////////////////////////////////////new cutting process//////////////////////////////
          let ratio = 40 ; // ratio should be defined by protocol , needs to confirm
          const surfaceHeight = currentBoardWidth * ratio ;
          let  polygonsforprotocols ;

          ///////////////////////////////////////////////////process the polpygons based on the swap x/y setting///////////
      

          if (config.cut.swapAxis.toLowerCase() === "true") {

               polygonsforprotocols = ProtocolGenerator.preprocessPolygonsx(polygons,ratio) ;

          }
          else {
              polygonsforprotocols = ProtocolGenerator.preprocessPolygons(polygons, surfaceHeight,ratio) ;
          }
          
          // Calculate total points across all polygons
        

///////////////////////////////////////////////////////this block if the settings of the protocol is not custom ////////////////////////

          //////////////////block to generate the protocol based on the settings //////////////////////

///////////////////////////////////////this block if the settings of the protocol is custom /////////////////////////

let cuttingcommands : string = "";
let previewcommands = ProtocolGenerator.generateProtocol(polygonsforprotocols, {"protocol": "HPGL" });
if (config.cut.cuttingProtocol === "Custom"){
  cuttingcommands = ProtocolGenerator.generateCustomProtocol(polygonsforprotocols, config.custom);
}
else {  
          const protocol = config.cut.cuttingProtocol || "HPGL";
           const  force =  config.cut.ForceValue;
           const  velocity = config.cut.VelocityValue;


           const options: { force?: number; velocity?: number } = {};
           if (force !== null && force !== "" && force !== undefined) {
               options.force = Number(force);
           }
           if (velocity !== null && velocity !== "" && velocity !== undefined) {
               options.velocity = Number(velocity);
           }
           ///////////////////////////Generate the cutting command  /////////////////////////////////////////////////

            cuttingcommands = ProtocolGenerator.generateProtocol(polygonsforprotocols, { protocol, ...options });
           ///////////////////////////////////////////// feed after cut  + return to origin ///////////////////////////////////////////////////////////////////
           // Use polygon data directly instead of parsing HPGL string for more robust max X calculation
           const maxx = ProtocolGenerator.getMaxXFromPolygons(polygonsforprotocols) ;
           const feedcommand = ProtocolGenerator.feedAfterCut(protocol , maxx) ;
           const toorigincommand = ProtocolGenerator.moveToOrigin(protocol,{x:0,y:0});
           if ( config.cut.feedaftercut.toLowerCase() === "true")
                {
                  cuttingcommands += feedcommand ;

                }
                else {if (config.cut.returntooringin.toLowerCase() === "true"){
                  cuttingcommands += toorigincommand ;


                }


                }
              }
              
         
             
///////////////////////////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////  
          const proceedWithCut = async () => {
        try {
          // ========================================================================
          // VALIDATE CUT BEFORE PROCEEDING
          // ========================================================================
          //const validationPopup = ppWait("Validating", "Validating cut, please wait...");
          //validationPopup.show();
          
          try {
            const validationPayload = {
              "usageSize": usages[0] // Surface used in square meters
            };
            
            const validationResponse = await sFetch<CutValidationResponse>("usercuttes/cutvalidation", "POST", validationPayload, true);

            // Check if the response is successful and canCut is true
            if (validationResponse.statusCode !== 200) {
              //validationPopup.hide();
              _ppWait_.hide();
              ppInfo("Validation Failed", validationResponse.payload?.message || "Failed to validate cut. Please try again.");
              return;
            }

            if (!validationResponse.payload || validationResponse.payload.canCut !== true) {
              //validationPopup.hide();
              _ppWait_.hide();
              ppInfo("Cut Not Allowed", validationResponse.payload?.message || "You are not allowed to proceed with this cut.");
              return;
            }

            // Store validation data for potential future use
            const validationData = {
              jobId: validationResponse.payload.jobId,
              expiresUtc: validationResponse.payload.expiresUtc,
              signature: validationResponse.payload.signature
            };
            
           // validationPopup.hide();
            
          } catch (validationError: any) {
            console.error("Validation error:", validationError);
           //validationPopup.hide();
            ppInfo("Validation Error", `Failed to validate cut: ${validationError.message || 'Unknown error'}`);
            _ppWait_.hide();
              return;
          }

          // ========================================================================
          // PROCEED WITH CUT (Validation Passed)
          // ========================================================================
      
          
          let message = "";
          let useIpcNet = true;

          // Build message based on cutting type
          // IMPORTANT: Base64 encode commands to preserve newlines and special characters
          // IPC.NET must decode this back to original bytes
          const base64Commands = btoa(unescape(encodeURIComponent(cuttingcommands)));
          
          if (config.cut.target === "PRINTER") {
            // Format: PRINTER|PRINTER_NAME|BASE64_HPGL
            message = `PRINTER|${config.cut.printer.name}|${base64Commands}`;
          }

          else if (config.cut.target === "COMPORT") {
            // Format: COMPORT|PORT_NAME|BAUD_RATE|PARITY|DATA_BITS|STOP_BITS|BASE64_HPGL
            const portName = config.cut.COMPORT.portName;
            const baudRate = config.cut.COMPORT.baudRate;
            const parity = config.cut.COMPORT.parity || "None";
            const dataBits = config.cut.COMPORT.Bytesize || 8;
            const stopBits = config.cut.COMPORT.stopBits || 1;
            
            message = `COMPORT|${portName}|${baudRate}|${parity}|${dataBits}|${stopBits}|${base64Commands}`;
          }

          else if (config.cut.target === "USB") {
            // Format: USB|DEVICE_PATH|BASE64_HPGL
            const devicePath = config.cut.usb.path || "\\\\.\\USBPRINT001";
            message = `USB|${devicePath}|${base64Commands}`;
          }

          else if (config.cut.target === "SUMMA") {
            // Format: SUMMA|BASE64_HPGL
            message = `SUMMA|${base64Commands}`;
          }

          else if (config.cut.target === "IP") {
            // Network/IP cutting - uses direct TCP, not IPC.NET
            useIpcNet = false;
            const result = await sendCutToIp(config.cut.network.ip, config.cut.network.port.toString(), cuttingcommands);
            
            if (result.success) {
              // ========================================================================
              // RECORD CUT DETAILS ON SERVER (Only after successful IP cut)
              // ========================================================================
              try {
                const payload = {
                  "usagePercent"      : usages[1],
                  "usageSize"         : usages[0],
                  "patternCuttedList" : strPatterns
                } as any;

                if (curProjectId.id !== "") {
                  payload["projectId"] = curProjectId.id;
                }

                await sFetch("usercuttes", "POST", payload);
                _ppWait_.hide();
              } catch (recordError: any) {
                console.error("Failed to record cut details:", recordError);
                // Don't fail the cut if recording fails - it's already been executed
                _ppWait_.hide();
              }
            } else {
              console.error("❌ IP cut failed:", result.error);
              // Error notification is shown by main.ts
              _ppWait_.hide();
            }
            
        
            return;
          }

          else {
            ppInfo("Error", `Unknown cutting target: ${config.cut.target}`);
            _ppWait_.hide();
       
            return;
          }

          // Send via IPC.NET for PRINTER, COMPORT, DIRECTUSB, SUMMA
          if (useIpcNet) {
            const result = await sendCutToSuma({ message });
            
            if (result.success) {
              // Success notification is shown by main.ts
              
              // ========================================================================
              // RECORD CUT DETAILS ON SERVER (Only after successful cut)
              // ========================================================================
              try {
                const payload = {
                  "usagePercent"      : usages[1],
                  "usageSize"         : usages[0],
                  "patternCuttedList" : strPatterns
                } as any;

                if (curProjectId.id !== "") {
                  payload["projectId"] = curProjectId.id;
                }

                await sFetch("usercuttes", "POST", payload);
                _ppWait_.hide();
              } catch (recordError: any) {
                console.error("Failed to record cut details:", recordError);
                // Don't fail the cut if recording fails - it's already been executed
                _ppWait_.hide();
              }
            } else {
              
              console.error("❌ Cut failed:", result.error);
              // Error notification is shown by main.ts
              _ppWait_.hide();
            }
          }

    
        } catch (error: any) {
          _ppWait_.hide();
          ppInfo("Error", `Failed to send cut: ${error.message || 'Unknown error'}`);
       
        }
    };

    const cancelCut = () => {
      _ppWait_.hide();
    };

  if (userChoice === "preview") {
      const previewPopup = new CutPreviewPopup({
        hpgl: previewcommands,
        onProceed: proceedWithCut,
        onCancel: cancelCut,
        usage:usageText,
        cost: costText,
        selectedRoll: selectedRollText,
        boardWidth: cutwidth,
        boardlength :  cutlength ,
        swapxy : config.cut.swapAxis 
      });
      _ppWait_.hide();
      previewPopup.show();
    } else { 
      proceedWithCut();
    }
  }
    
  

  centerBoard() {
    if (!this.currentSurface) return;

    const board = this.currentSurface._Board;
    const canvas = this.currentSurface._app.canvas;
    const stage = this.currentSurface._app.stage;

    // 1. Get board size without zoom (original size in board units)
    const boardWidth = board._boardWidth;
    const boardLenght = board._boardLength;

    // 2. Get canvas size
    const canvasW = canvas.getBoundingClientRect().width;
    const canvasH = canvas.getBoundingClientRect().height;

    // 3. get available space for the board minus 10% margin
    const availableW = canvasW * 0.9;
    const availableH = canvasH * 0.9;


    // 4. get the zoom factor to fit the board in the available space
    const zoomX = availableW / boardLenght;
    const zoomY = availableH / boardWidth;
    const zoom = Math.min(zoomX, zoomY);

    // 5. set the zoom factor
    this.currentSurface.zoomFactor = zoom;


    // 7. display the board
    this.currentSurface.display();

    // 6. center the board
    stage.position.x = (canvasW - boardLenght * zoom) / 2;
    stage.position.y = (canvasH - boardWidth * zoom) / 2;
  }


  
  async connectToScreen() {
    if (!surfaceCollection.selectedSurfaceData) {
      return;
    }
    // Flag is set by caller - no need to set again here


    /////////////////////////////////////
const showLoadingBar = (parentEl: HTMLElement) => {
  
    if (document.getElementById('loading-overlay')) return;
document.body.classList.add('loading');
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    Object.assign(overlay.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: '10000'
    });

 
    const barContainer = document.createElement('div');
    Object.assign(barContainer.style, {
        width: '250px',
        height: '4px', 
        backgroundColor: '#f3f3f3', 
        borderRadius: '2px',
        overflow: 'hidden', 
    });

    
    const movingBar = document.createElement('div');
    Object.assign(movingBar.style, {
        width: '100%',
        height: '100%',
        backgroundColor: '#3498db', 
        borderRadius: '2px',
        animation: 'slide 1.5s linear infinite' 
    });


    if (!document.getElementById('loading-bar-style')) {
        const styleSheet = document.createElement("style");
        styleSheet.id = 'loading-bar-style';
        styleSheet.type = "text/css";
   
        styleSheet.innerText = `@keyframes slide { 
            0% { transform: translateX(-100%); } 
            100% { transform: translateX(100%); } 
        }`;
        document.head.appendChild(styleSheet);
    }

    if (window.getComputedStyle(parentEl).position === 'static') {
        parentEl.style.position = 'relative';
    }

    barContainer.appendChild(movingBar);
    overlay.appendChild(barContainer);
    parentEl.appendChild(overlay);
};


const hideLoadingBar = () => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
    document.body.classList.remove('loading');
};


    ////////////////////////////////////////
    
    const parent = (await waitForElt<HTMLDivElement>(".cut-board-workspace"));
     showLoadingBar(parent);
    let canvas = document.querySelector<HTMLCanvasElement>("#cut-board-canvas") as HTMLCanvasElement;
    if (!canvas) {
      canvas                = document.createElement("canvas");
      canvas.id             = "cut-board-canvas";
      canvas.style.top      = "0";
      canvas.style.left     = "0";
      canvas.style.width    = "100%";
      canvas.style.height   = "100%";
      canvas.style.position = "absolute";
      parent.appendChild(canvas);
    }
    canvas = await waitForElt<HTMLCanvasElement>("#cut-board-canvas");
    if (this.currentSurface) {
      this.currentSurface.dispose();
    }

    //await waitForMs(17);
    this.currentSurface = new Surface({
      canvas,
      resizeTo: canvas.parentElement as HTMLElement,
    });

      await this.currentSurface.init();
    this.syncPivotModeToSurface();
    //await waitForMs(17);

    this.currentSurface.zoomFactor = surfaceCollection.selectedSurfaceData.boardZoomFactor ?? 1;

    surfaceCollection.selectedSurfaceData.patterns.forEach((pattern) => {
      const instancePattern = this.currentSurface?.addPath(pattern.paths[0],
        {
          guid: pattern.guid,
          nestedPaths: pattern.paths.slice(1),
          noNormilize: false, 
        });
       /* const pat = this.currentSurface?._Patterns.find(p => p._guid === pattern.guid);
   
      pat!.x = pattern.boardPosition.x;
      pat!.y = pattern.boardPosition.y;
*/

const pat = this.currentSurface?._Patterns.find(p => p._guid === pattern.guid);
   
        // pat!._vector.originalPosition was just calculated inside addPath
        const newOriginalX = pat!._vector.originalPosition.x;
        const newOriginalY = pat!._vector.originalPosition.y;
        
        // pattern.boardPosition now holds the "base" position (baseX, baseY)
        const newUnzoomedX = pattern.boardPosition.x + newOriginalX;
        const newUnzoomedY = pattern.boardPosition.y + newOriginalY;
        
        pat!.x = pat!.zoomed(newUnzoomedX);
        pat!.y = pat!.zoomed(newUnzoomedY);
     
        pat!._rotation = pattern.boardAngle || 0;
        // CRITICAL: Sync _vectorRotation with _rotation when loading saved patterns
        // The saved paths already have rotation baked in, so _vectorRotation must match _rotation
        (pat as any)._vectorRotation = pattern.boardAngle || 0;
        pat!.display();
        
        // CRITICAL: Also sync rotation for subpatterns (nested patterns)
        // After display() creates subpatterns via initializeNestedPatterns()
        if (pat!.subPatterns && pat!.subPatterns.length > 0) {
          pat!.subPatterns.forEach(subPattern => {
            subPattern._rotation = pattern.boardAngle || 0;
            (subPattern as any)._vectorRotation = pattern.boardAngle || 0;
          });
        }

        if (pattern.firstLoad)  {
          pattern.firstLoad = false;
          //pattern.boardPosition = pattern.originalPosition;
        }
    });


    this.currentSurface._Board._boardWidth = surfaceCollection.selectedSurfaceData.boardWidth || config.boardWidth;
    this.currentSurface._Board._boardLength = surfaceCollection.selectedSurfaceData.boardLength || config.boardLenght;
    this.currentSurface._app.stage.position.x = surfaceCollection.selectedSurfaceData.boardX;
    this.currentSurface._app.stage.position.y = surfaceCollection.selectedSurfaceData.boardY;

   
    
    // Restore annotations from current board
    if (boardManager.boards[boardManager.currentBoardIndex] && boardManager.boards[boardManager.currentBoardIndex].annotations) {
      this.currentSurface._Board.annotations = [...boardManager.boards[boardManager.currentBoardIndex].annotations];
    } else {
      this.currentSurface._Board.annotations = [];
    }
    
    this.currentSurface.display();
    
    // Re-establish annotation popup reference if it exists - AFTER display() so zoom is set
    const mainFrame = getUow("mainFrame") as any;
    if (mainFrame && mainFrame.children) {
      const annotationPopup = mainFrame.children.find((c: any) => c instanceof AnnotationPopup);
      if (annotationPopup) {
        (this.currentSurface as any)._annotationPopup = annotationPopup;
        // Update popup with current board's annotations
        if (annotationPopup.isVisible) {
          annotationPopup.annotations = [...this.currentSurface._Board.annotations];
          // Call showAllAnnotations after a delay to ensure zoom is properly set
          setTimeout(() => {
            annotationPopup.showAllAnnotations();
          }, 100);
        }
      }
    }



   //this.centerBoard();

   /*
   this.currentSurface._Patterns.forEach(async (p) => {
      p.setState("edition");
      p.display();
      p.setState("");
      p.display();
    });

 */
 
   // Wait for the async display to complete before releasing the lock
   await waitForMs(1);
   this.currentSurface.display();
   this.saveSlectedSurface();
   
   // Emit event to notify that surface has been loaded
   _evtBus.emit("surfaceLoaded", {});
   
   // Release the lock only after everything is done
   surfaceManager.isSwitchingBoards = false;
   hideLoadingBar();
  }

  async wrapPattern(point1: IPoint, point2: IPoint) {
    const pattern = surfaceManager.currentSurface!._Patterns.find(p => p._state === "wrap");

  }

  async weldPatterns(pattern1: typeof Pattern, pattern2: typeof Pattern) {
 
    
    try {
      // Import necessary modules
      const paper = (await import('paper')).default;
      const { guid } = await import('../core/Guid');
      
      // Get the current surface
      const surface = this.currentSurface!;
      
      // Capture original patterns data BEFORE welding
      const originalPattern1Data = undoRedoManager.capturePatternState(pattern1._guid);
      const originalPattern2Data = undoRedoManager.capturePatternState(pattern2._guid);
      const originalPatterns = [originalPattern1Data, originalPattern2Data].filter(p => p !== null);
      const originalPatternGuids = [pattern1._guid, pattern2._guid];
      
      // Create Paper.js paths from patterns
      const path1 = new paper.Path(pattern1._vector.generatePathString());
      const path2 = new paper.Path(pattern2._vector.generatePathString());
      
      // Apply pattern transformations
      // Note: Patterns store their position in zoomed coordinates
      const x1 = pattern1.unZoomed(pattern1.x);
      const y1 = pattern1.unZoomed(pattern1.y);
      const x2 = pattern2.unZoomed(pattern2.x);
      const y2 = pattern2.unZoomed(pattern2.y);
      
      path1.translate(new paper.Point(x1, y1));
      path2.translate(new paper.Point(x2, y2));
      
      // Check if they actually intersect
      if (!path1.intersects(path2)) {
        ppInfo("Weld", "Selected patterns do not overlap. They must overlap to be welded.");
        return;
      }
      
      // Perform union operation
      const unitedPath = path1.unite(path2);
      
      if (!unitedPath) {
        ppInfo("Weld", "Failed to weld patterns");
        return;
      }
      
      // Get the bounds of the united path
      const bounds = unitedPath.bounds;
      const weldedX = bounds.x;
      const weldedY = bounds.y;
      
      // Translate the path to origin before creating the pattern
      // This ensures the pattern's internal coordinates start at 0,0
      unitedPath.translate(new paper.Point(-weldedX, -weldedY));
      
      // Get the welded path data
      const mainPath = unitedPath.pathData;
      
      // Handle sub-patterns from both original patterns
      const subPaths: string[] = [];
      
      // Process sub-patterns from pattern1
      pattern1.subPatterns.forEach((subPattern: _Pattern) => {
        const subPath = new paper.Path(subPattern._vector.generatePathString());
        // Sub-patterns are already positioned relative to their parent
        const subX = x1 + subPattern.unZoomed(subPattern.x);
        const subY = y1 + subPattern.unZoomed(subPattern.y);
        subPath.translate(new paper.Point(subX, subY));
        
        // Translate to match the main pattern's translation
        subPath.translate(new paper.Point(-weldedX, -weldedY));
        subPaths.push(subPath.pathData);
      });
      
      // Process sub-patterns from pattern2
      pattern2.subPatterns.forEach((subPattern: _Pattern) => {
        const subPath = new paper.Path(subPattern._vector.generatePathString());
        const subX = x2 + subPattern.unZoomed(subPattern.x);
        const subY = y2 + subPattern.unZoomed(subPattern.y);
        subPath.translate(new paper.Point(subX, subY));
        
        // Translate to match the main pattern's translation
        subPath.translate(new paper.Point(-weldedX, -weldedY));
        subPaths.push(subPath.pathData);
      });
      
      // Get pattern metadata from first pattern
      const pattern1Data = surfaceCollection.selectedSurfaceData.getPattern(pattern1._guid);
      const patternColor = pattern1Data?.patternColor || pattern1._color;
      const patternName = pattern1Data?.patternName || "Welded Pattern";
      const patternId = pattern1Data?.patternId || "";
      
      // Add new welded pattern to visual layer WITH normalization
      surfaceManager.currentSurface!.addPath(mainPath, {
        guid: guid(),
        nestedPaths: subPaths,
        noNormilize: false,  // Let it normalize to center the pattern
      });
      
      // Get the newly added pattern (last in array)
      const newP = surfaceManager.currentSurface!._Patterns[surfaceManager.currentSurface!._Patterns.length - 1];
      
      // After normalization, the vector's originalPosition tells us how much it was translated
      // to center it. We need to add this offset to our desired position.
      const normalizeOffsetX = newP._vector.originalPosition.x;
      const normalizeOffsetY = newP._vector.originalPosition.y;
      
      // Set the pattern position to where the welded bounds were, accounting for normalization
      // The pattern was normalized (centered), so originalPosition contains the offset
      // We add this offset to the welded position to maintain the correct location
      newP.x = newP.zoomed(weldedX + normalizeOffsetX);
      newP.y = newP.zoomed(weldedY + normalizeOffsetY);
      
      newP.display();
      
      // Add new pattern to data layer (exactly like split)
      surfaceCollection.selectedSurfaceData.addPattern({
        boardAngle: 0,
        boardPosition: { x: newP.x, y: newP.y },
        guid: newP._guid,
        paths: [newP._vector.generatePathString(), ...newP.subPatterns.map((p) => p._vector.generatePathString())],
        patternColor: patternColor,
        patternName: patternName,
        patternId: patternId,
      });
      
      // Remove original patterns AFTER adding new one (like split does)
      pattern1._state = '';
      pattern2._state = '';
      surfaceManager.currentSurface!.removePattern(pattern1);
      surfaceManager.currentSurface!.removePattern(pattern2);
      surfaceCollection.selectedSurfaceData.removePattern(pattern1._guid);
      surfaceCollection.selectedSurfaceData.removePattern(pattern2._guid);
      
      // Clear multiSelection if patterns were there
      surfaceManager.currentSurface!.multiSelection = surfaceManager.currentSurface!.multiSelection.filter(
        p => p._guid !== pattern1._guid && p._guid !== pattern2._guid
      );
      
      // Update surface display
      surfaceManager.currentSurface!.display();
      
      // Record undo/redo action with metadata
      this.recordMultiplePatternActions('weld', [newP._guid], {
        originalPatterns: originalPatterns,
        originalPatternGuids: originalPatternGuids
      });
      
      // Save state for undo/redo
      this.saveSlectedSurface();
      
    } catch (error) {
      console.error("Error welding patterns:", error);
      ppInfo("Weld", "An error occurred while welding patterns");
    }
  }

  async splitPattern(point1: IPoint, point2: IPoint) {
    // get the pattern in split or bikini mode
    if (!surfaceManager.currentSurface) return;

    const pattern = surfaceManager.currentSurface!._Patterns.find(p => p._state === "split" || p._state === "bikini");
    if (pattern) {
      if (pattern.isGroup) {
        await this.ungroupPatterns(pattern);
   ppInfo("","splitting a Group will result ungrouping")
      }
    }
    
    if (!pattern) return;
    
    // Capture original pattern data BEFORE splitting
    const originalPatternData = undoRedoManager.capturePatternState(pattern._guid);
    
    const subPatterns = pattern!.subPatterns
    if (surfaceManager.currentSurface!.splitLine) {
      surfaceManager.currentSurface!.splitLine.canBeUsed = false;
    }
    
    if (pattern) {
      // Use liveConfig for curved split settings
      const isCurved = liveConfig.curvedSplitEnabled;
      const curveDepth = liveConfig.curvedSplitDepth;
      
      const paths = splitPattern(pattern, point1, point2, false, null, isCurved, curveDepth);
      const subPaths = [] as string[];

      subPatterns.forEach((p: _Pattern) => {
        const sbs = splitPattern(p as typeof Pattern, point1, point2, true, pattern, isCurved, curveDepth);
        subPaths.push(...sbs);
      });

      // now we want to have teh candidate as Array<string[]> where first string is the main path and the rest are the sub paths
      const candidates = paths.map((p) => {
        const vp = new VectorPath();
        vp.parse(p);
        vp.toAbsolute();
        const res = [p] as string[];

        subPaths.forEach((sp) => {
          const vsp = new VectorPath();
          vsp.parse(sp);
          vsp.toAbsolute();

          if (vp.isNested(vsp)) {
            res.push(sp);
          }
        });

        return res;
      });

      const createdPatterns: TSurfaceDataPattern[] = [];
      const createdPatternGuids: string[] = [];

      candidates.forEach((c) => {
        const mainPath = c[0];
        const subPaths = c.slice(1);

        surfaceManager.currentSurface!.addPath(mainPath, {
          guid: guid(),
          nestedPaths: subPaths,
     
        });
        const newP = surfaceManager.currentSurface!._Patterns[surfaceManager.currentSurface!._Patterns.length - 1];
        newP.x = pattern.x + pattern.zoomed(newP._vector.originalPosition.x);
        newP.y = pattern.y + pattern.zoomed(newP._vector.originalPosition.y);
       
        const newOriginalPosition = newP._vector.originalPosition;
        const oldOriginalPosition = pattern._vector.originalPosition;
        const diffPoint = { x: newOriginalPosition.x - oldOriginalPosition.x, y: newOriginalPosition.y - oldOriginalPosition.y };
   
        newP.display();

        const newPatternData: TSurfaceDataPattern = {
          boardAngle: 0,
          boardPosition: { x: newP.x ?? 0, y: newP.y ?? 0},
          guid: newP?._guid ?? guid(),
          paths: [newP._vector.generatePathString(), ...newP.subPatterns.map((p) => p._vector.generatePathString())],
          patternColor: pattern._color,
          patternName: surfaceCollection.selectedSurfaceData.getPattern(pattern._guid)?.patternName ?? "",
          patternId: surfaceCollection.selectedSurfaceData.getPattern(pattern._guid)?.patternId ?? "",
        };

        surfaceCollection.selectedSurfaceData.addPattern(newPatternData);
        createdPatterns.push(newPatternData);
        createdPatternGuids.push(newP._guid);
      });

      pattern._state = '';
      surfaceManager.currentSurface!.removePattern(pattern);
      surfaceCollection.selectedSurfaceData.removePattern(pattern._guid);
      surfaceManager.currentSurface!.display();

      // Record undo/redo action with metadata
      undoRedoManager.recordPatternAction({
        type: 'split',
        patternGuid: pattern._guid,
        beforeState: originalPatternData!,
        afterState: undefined,
        metadata: {
          createdPatterns: createdPatterns,
          createdPatternGuids: createdPatternGuids
        }
      });
    }
  }

  async BACKUP_splitPattern(point1: IPoint, point2: IPoint) {
    // get the pattern in split or bikini mode
    const pattern = surfaceManager.currentSurface!._Patterns.find(p => p._state === "split" || p._state === "bikini");
    if (surfaceManager.currentSurface!.splitLine) {
      surfaceManager.currentSurface!.splitLine.canBeUsed = false;
    }
    if (pattern) {
      const paths = splitPattern(pattern, point1, point2);
      if (paths) {
        paths.forEach((p) => {
          surfaceManager.currentSurface!.addPath(p);
          const newP = surfaceManager.currentSurface!._Patterns[surfaceManager.currentSurface!._Patterns.length - 1];
          newP.x = pattern.x + pattern.zoomed(newP._vector.originalPosition.x);
          newP.y = pattern.y + pattern.zoomed(newP._vector.originalPosition.y);
          surfaceCollection.selectedSurfaceData.addPattern({
            boardAngle: 0,
            boardPosition: { x: newP.x ?? 0, y: newP.y ?? 0},
            guid: newP?._guid ?? guid(),
            paths: [newP._vector.generatePathString()],
            patternColor: "",
            patternName: surfaceCollection.selectedSurfaceData.getPattern(pattern._guid)?.patternName ?? "",
            patternId: surfaceCollection.selectedSurfaceData.getPattern(pattern._guid)?.patternId ?? "",
          });
        });
        pattern._state = '';
        surfaceManager.currentSurface!.removePattern(pattern);
        surfaceCollection.selectedSurfaceData.removePattern(pattern._guid);
        surfaceManager.currentSurface!.display();
        //surfaceCollection.selectedSurfaceData.addToUndoRedoStack();
      }
    }
  }

  fixedPatterns: typeof Pattern[] = [];
  //local nesting
 async local_doNesting() {

    //surfaceCollection.selectedSurfaceData.addToUndoRedoStack() ;
  this.fixedPatterns =[] ;
  
  // Track if we need to cleanup on error
  let needsCleanup = false;
  let errorOccurred = false;
   
  try {
    
    const popup = ppNesting();
    const surface = surfaceManager.currentSurface;
    
    // Validate surface exists
    if (!surface) {
      toastError("No surface available for nesting", 4000);
      console.error("local_doNesting: No current surface available");
      return;
    }
    
    // Validate board dimensions
    if (!surface._Board || !surface._Board._boardLength || !surface._Board._boardWidth) {
      toastError("Invalid board dimensions", 4000);
      console.error("local_doNesting: Invalid board dimensions");
      return;
    }
    
    if (surface._Board._boardLength <= 0 || surface._Board._boardWidth <= 0) {
      toastError("Board dimensions must be positive", 4000);
      console.error("local_doNesting: Board dimensions are not positive", surface._Board);
      return;
    }
    
    let packItems = {} as { [key: number]: typeof Pattern }
    let placement = [] as PackResult[];
    
    // Initialize nesting session with error handling
    try {
      nestingEvents.sessionCreation.do();
    } catch (error: any) {
      toastError("Failed to initialize nesting session", 4000);
      console.error("local_doNesting: Session creation failed:", error);
      errorOccurred = true;
      throw new Error(`Session creation failed: ${error.message || 'Unknown error'}`);
    }
    
    // Set bin dimensions with error handling
    try {
      nestingEvents.setBin.do({ width: surface!._Board._boardLength, height: surface!._Board._boardWidth });
    } catch (error: any) {
      toastError("Failed to set board dimensions for nesting", 4000);
      console.error("local_doNesting: Set bin failed:", error);
      errorOccurred = true;
      throw new Error(`Failed to set bin dimensions: ${error.message || 'Unknown error'}`);
    }
    
    packItems = {} as { [key: number]: typeof Pattern }
    /////////////////////////////////////////////////////////
    // Select patterns to nest
    let selectedPatterns = surface._Patterns.filter(p => p._state === 'selected');
    if (selectedPatterns.length === 0) {
      selectedPatterns = [...surface._Patterns];
    }
    
    // Validate patterns exist
    if (selectedPatterns.length === 0) {
      toastWarning("No patterns available for nesting");
      console.warn("local_doNesting: No patterns to nest");
      return;
    }
    
    const originalPatterns: typeof Pattern[] = [];
    let patternsCopied = 0;

    // Create pattern copies with validation
    try {
      for (const oldPattern of selectedPatterns) {
        const patternData = surfaceCollection.selectedSurfaceData.getPattern(oldPattern._guid);
        
        if (!patternData) {
          console.warn(`Pattern ${oldPattern._guid} not found in surface data, skipping`);
          continue;
        }
        
        // Validate pattern has paths
        if (!patternData.paths || patternData.paths.length === 0) {
          console.warn(`Pattern ${oldPattern._guid} has no paths, skipping`);
          continue;
        }
        
        // Validate main path
        if (!patternData.paths[0] || patternData.paths[0].trim().length === 0) {
          console.warn(`Pattern ${oldPattern._guid} has empty main path, skipping`);
          continue;
        }

        originalPatterns.push(oldPattern);

        try {
          const newPattern = surface.addPath(patternData.paths[0], {
            guid: guid(),
            nestedPaths: patternData.paths.slice(1),
            noNormilize: false,
          });

          // Validate new pattern was created
          if (!newPattern || !newPattern._vector) {
            throw new Error(`Failed to create copy of pattern ${oldPattern._guid}`);
          }

          newPattern.x = patternData.boardPosition.x;
          newPattern.y = patternData.boardPosition.y;
          newPattern._rotation = patternData.boardAngle || 0;
          newPattern.zoomFactor = surface.zoomFactor;

          surfaceCollection.selectedSurfaceData.addPattern({
            ...patternData,
            guid: newPattern._guid,
            boardPosition: { x: newPattern.x, y: newPattern.y },
          });

          this.fixedPatterns.push(newPattern);
          patternsCopied++;
        } catch (patternError: any) {
          console.error(`Failed to copy pattern ${oldPattern._guid}:`, patternError);
          toastError(`Failed to prepare pattern for nesting: ${patternError.message}`, 4000);
          throw new Error(`Pattern copy failed: ${patternError.message || 'Unknown error'}`);
        }
      }
      
      // Mark that we created copies that need cleanup
      needsCleanup = true;
      
    } catch (error: any) {
      console.error("Error creating pattern copies:", error);
      errorOccurred = true;
      throw new Error(`Failed to prepare patterns: ${error.message || 'Unknown error'}`);
    }
    
    // Validate we have patterns to nest
    if (this.fixedPatterns.length === 0) {
      toastWarning("No valid patterns could be prepared for nesting");
      console.warn("local_doNesting: No valid patterns after copy");
      return;
    }
    
    this.updateSelectedSurfaceData();

    // Add patterns to nesting with error handling
    try {
      this.fixedPatterns.forEach((item, idx) => {
        try {
          nestingEvents.addPart.do({ idx, item });
          packItems[idx] = item;
        } catch (partError: any) {
          console.error(`Failed to add pattern ${idx} to nesting:`, partError);
          throw new Error(`Failed to add pattern ${idx}: ${partError.message || 'Unknown error'}`);
        }
      });
    } catch (error: any) {
      console.error("Error adding patterns to nesting:", error);
      errorOccurred = true;
      throw new Error(`Failed to add patterns to nesting: ${error.message || 'Unknown error'}`);
    }



    nestingEvents.start.do();
    const nestedProgress = (nestingEvents.progress.waitFor((e) => {
    
    }));
    const nestingEventsPackingResult = (nestingEvents.packingResult.waitFor((e) => {
      placement.push(e);
      e.placements.forEach((item) => {
        packItems[item.part].x = packItems[item.part].zoomed(item.position.x);
        packItems[item.part].y = packItems[item.part].zoomed(item.position.y);
        packItems[item.part]._rotation = item.rotation * 180 / Math.PI;
        packItems[item.part]._backupRotation = -packItems[item.part]._rotation;
        packItems[item.part].applyTransformations({ rotate: true, translate: false });
        packItems[item.part].display();
           
      });
      e.unplaced.forEach((item) => {
        packItems[item.id].x = 0;
        packItems[item.id].y = 0;
        packItems[item.id]._rotation = 0;
        packItems[item.id].applyTransformations({ rotate: true, translate: false });
        packItems[item.id].display();
           
      });
     
if (e.isLast) {


  placement.sort((a, b) => b.placed.length - a.placed.length);

  const maxPlaced = placement[0].placed.length;
  placement = placement.filter(_ => _.placed.length === maxPlaced);
  const bestPlacement = placement[0];
  let minX = Infinity, minY = Infinity;
bestPlacement.placements.forEach((p) => {
  minX = Math.min(minX, p.position.x);
  minY = Math.min(minY, p.position.y);
});
bestPlacement.unplaced.forEach((u) => {
  minX = Math.min(minX, 0);
  minY = Math.min(minY, 0);
});
this.layoutOrigin = { x: minX, y: minY };
this.nestedTemplateI= [
  ...bestPlacement.placements.map((p) => ({
    patternIdx: p.part,
    relX: p.position.x - minX,
    relY: p.position.y - minY,
    relAngle: p.rotation * 180 / Math.PI


    
  })),
 ...bestPlacement.unplaced.map((u) => ({
    patternIdx: u.id,
    relX: 0 - minX,
    relY: 0 - minY,
    relAngle: 0
  }))
]; 


      
const surface = this.currentSurface!;
surface._app.stage.interactive = true;
surface._app.stage.eventMode = 'static';

// Expand hit area to cover the full canvas area for nesting placement
const board = surface._Board;
const boardWidth = board._boardWidth || 5000;
const boardLength = board._boardLength || 10000;
const margin = 2000;
surface._app.stage.hitArea = new PIXI.Rectangle(-margin, -margin, boardLength + margin * 2, boardWidth + margin * 2);

surface._app.canvas.style.cursor = 'crosshair';
this.onNestPointerDown = (event: PIXI.FederatedPointerEvent) => {
     if (event.button !== 0) return;
  if (this.isReadyToPlaceNested && this.fixedPatterns .filter(p => p._state === 'edition').length === 0) {
    const global = event.global;
    const stagePos = surface._app.stage.position;
    const zoom = surface.zoomFactor;
    const worldX = (global.x - stagePos.x) / zoom;
    const worldY = (global.y - stagePos.y) / zoom;
    const worldPoint = { x: worldX, y: worldY };
    this.placeNestedAtI(worldPoint ,this.fixedPatterns );
  }
};
surface._app.stage.addListener('pointerdown', this.onNestPointerDown);

 
  const cancelNest = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.isReadyToPlaceNested) {
      this.isReadyToPlaceNested = false;
      this.nestedTemplateI = null;
      this.currentSurface!._app.canvas.style.cursor = 'default';;
      this.currentSurface!._app.stage.removeListener('pointerdown', this.onNestPointerDown);
      this.currentSurface!._app.stage.removeListener('pointermove', this.onNestPointerMove);
      surface._app.stage.interactive = false;
      surface._app.stage.hitArea = null;
surface._app.stage.eventMode = 'dynamic';
      if (this._tempPreviewGroup) {
        this.currentSurface!._app.stage.removeChild(this._tempPreviewGroup);
        this._tempPreviewGroup.destroy({ children: true });
        this._tempPreviewGroup = null;
      }
     
      event.preventDefault();
    }
  };
  window.addEventListener('keydown', cancelNest);
  nestingEventsPackingResult.off();
  nestedProgress.off();

      this.isReadyToPlaceNested = true;
    originalPatterns.forEach((pattern) => {
              this.currentSurface.removePattern(pattern);
              surfaceCollection.selectedSurfaceData.removePattern(pattern._guid);
            });
            
            this.saveSlectedSurface();
            surfaceManager.centerBoard();
 
      
}
    
    }));
  } catch (ex: any) {
    // Comprehensive error handling with cleanup
    console.error("local_doNesting: Critical error occurred:", ex);
    errorOccurred = true;
    
    // Stop nesting process
    try {
      nestingEvents.stop.do();
    } catch (stopError) {
      console.error("Failed to stop nesting events:", stopError);
    }
    
    // Clean up pattern copies if needed
    if (needsCleanup) {
      try {
        this.cleanupNestingCopies();
      } catch (cleanupError) {
        console.error("Failed to cleanup nesting copies:", cleanupError);
      }
    }
    
    // Determine error message
    let userMessage = "Nesting failed";
    let detailMessage = "An unknown error occurred during nesting";
    
    if (ex instanceof Error) {
      detailMessage = ex.message;
      
      // Provide specific user-friendly messages based on error type
      if (ex.message.includes('timeout')) {
        userMessage = "Nesting Timeout";
        detailMessage = "The nesting operation took too long. Try with fewer patterns or simpler shapes.";
      } else if (ex.message.includes('Session creation')) {
        userMessage = "Initialization Failed";
        detailMessage = "Failed to initialize the nesting engine. Please try again.";
      } else if (ex.message.includes('bin dimensions')) {
        userMessage = "Invalid Board Size";
        detailMessage = "The board dimensions are invalid. Please check your board settings.";
      } else if (ex.message.includes('Pattern copy')) {
        userMessage = "Pattern Error";
        detailMessage = "One or more patterns could not be processed for nesting.";
      } else if (ex.message.includes('add pattern')) {
        userMessage = "Pattern Processing Failed";
        detailMessage = "Failed to add patterns to the nesting engine. Check pattern validity.";
      } else if (ex.message.includes('invalid polygon') || ex.message.includes('invalid coordinates')) {
        userMessage = "Invalid Pattern Geometry";
        detailMessage = "One or more patterns have invalid shapes. Please check your patterns.";
      } else if (ex.message.includes('No patterns')) {
        userMessage = "No Patterns";
        detailMessage = "No valid patterns found to nest.";
      } else {
        userMessage = "Nesting Failed";
        detailMessage = ex.message;
      }
    } else if (typeof ex === 'string') {
      detailMessage = ex;
    }
    
    // Show error to user
    toastError(userMessage, 4000);
    ppInfo(userMessage, detailMessage);
    
    // Log for debugging
    console.error(`Nesting failed: ${userMessage} - ${detailMessage}`);
  }
 
}

cleanupNestingCopies() {
  this.fixedPatterns.forEach(pattern => {
    if (this.currentSurface) {
      this.currentSurface.removePattern(pattern);
    }
    surfaceCollection.selectedSurfaceData.removePattern(pattern._guid);
  });
  this.fixedPatterns = [];
}


/// nesting API Final code 
async API_doNesting() {
   //surfaceCollection.selectedSurfaceData.addToUndoRedoStack() ;
     this.fixedPatterns =[] ;
  let progressPopup: any = null;
  try {
    const surface = this.currentSurface;
    if (!surface) {
      console.error('No current surface available');
      return;
    }
    const chosenConfig = await ppNestingQuality();
    if (!chosenConfig) {
      return;
    }

    let flattenTolerance: number;
    let estimatedSeconds: number;
    switch (chosenConfig) {
      case 'fast':
        flattenTolerance = 0.1;
        estimatedSeconds = 70;
        break;
      case 'balanced':
        flattenTolerance = 0.01;
        estimatedSeconds = 240;
        break;
      case 'high_quality':
        flattenTolerance = 0.001;
        estimatedSeconds = 660;
        break;
      default:
        flattenTolerance = 0.01;
        estimatedSeconds = 240;
    }
    progressPopup = ppNestingProgress("Nesting in Progress", estimatedSeconds);

  
    let selectedPatterns = surface._Patterns.filter(p => p._state === 'selected');
    if (selectedPatterns.length === 0) {
     selectedPatterns= [...surface._Patterns];
    }


   // const fixedPatterns: typeof Pattern[] = [];
      const originalPatterns : typeof Pattern[]=[] ;
    for (const oldPattern of selectedPatterns) {
        const patternData = surfaceCollection.selectedSurfaceData.getPattern(
          oldPattern._guid
        );
        if (!patternData) continue;

        originalPatterns.push(oldPattern);

        const newPattern = surface.addPath(patternData.paths[0], {
          guid: guid(),
          nestedPaths: patternData.paths.slice(1),
          noNormilize: false,
        });

        newPattern.x = patternData.boardPosition.x;
        newPattern.y = patternData.boardPosition.y;
        newPattern._rotation = patternData.boardAngle || 0;
        newPattern.zoomFactor = surface.zoomFactor;
/*
        newPattern.setState("edition");
        newPattern.display();
        newPattern.setState("");
        newPattern.display();
*/
        surfaceCollection.selectedSurfaceData.addPattern({
          ...patternData,
          guid: newPattern._guid,
          boardPosition: { x: newPattern.x, y: newPattern.y },
        });

      this.fixedPatterns .push(newPattern);
      }


  
 this.updateSelectedSurfaceData();

 
   // surface.display();
    //this.saveSlectedSurface();  

    //selectedPatterns = fixedPatterns;



    const polygons = this.fixedPatterns.map((item) => {
      const path = new paper.Path(item._vector["_path"]);
      path.flatten(flattenTolerance);
      const points = path.segments.map((seg) => [seg.point.x, seg.point.y]);
      if (points.length > 1 && points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]) {
        points.pop();
      }
      return points;
    });


    const payload = {
      polygons,
      board_width: surface._Board._boardWidth - 0.001,
      config: chosenConfig
    };

    // Use absolute URL - the Vite dev proxy (/api/nest) only works in development
    // In production (built app), we need the full URL
    const nestingApiUrl = 'https://nesting-server.matmaksolutions.com/nest';
    
    // Set timeout based on quality setting (with generous buffer)
    const timeoutMs = estimatedSeconds * 2000; // 2x the estimated time as timeout
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(nestingApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status} - ${response.statusText}`;
      try {
        const errorText = await response.text();
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorText;
        } else {
          errorMessage = errorText || errorMessage;
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
      
      if (progressPopup) {
        progressPopup.hide();
      }
      this.cleanupNestingCopies();
      
      // Show error to user with both toast and popup
      toastError("Nesting Failed", 4000);
      await ppInfo("Nesting Error", errorMessage);
      
      console.error('Nesting API error:', errorMessage);
      return; // Exit function after error
    }

    if (response.ok) {
      const data = await response.json();
      ppInfo("Nesting Completed", "Nesting completed successfully.Press Esc if you want to keep the nesting at its current place or click any where in the board if you want to place it somewhere else on the board");
      // Close the countdown popup immediately when server responds
      if (progressPopup) {
        progressPopup.hide();
      }
      
      const packItems = this.fixedPatterns;
      const placedIds = new Set();
      data.solution.layout.placed_items.forEach((item: { item_id: number; transformation: { rotation: number; translation: [number, number] } }) => {
        const idx = item.item_id;
        const pattern = packItems[idx];
        if (pattern) {
          placedIds.add(idx);
          pattern.x = pattern.zoomed(item.transformation.translation[0]);
          pattern.y = pattern.zoomed(item.transformation.translation[1]);
          pattern._rotation = item.transformation.rotation * (180 / Math.PI);
          pattern._backupRotation = -pattern._rotation;
          pattern.applyTransformations({ rotate: true, translate: true });
          pattern.display();
        }
         this.updateSelectedSurfaceData();
      });

      
      this.nestedTemplate = data.solution.layout.placed_items.map((item: { item_id: number; transformation: { rotation: number; translation: [number, number] } }) => ({
        patternIdx: item.item_id,
        absX: item.transformation.translation[0],
        absY: item.transformation.translation[1],
        relAngle: item.transformation.rotation * (180 / Math.PI)
      }));

      this.isReadyToPlaceNested = true;
      toastSuccess(`Nesting completed! Click to place ${this.fixedPatterns.length} patterns`, 4000);
       originalPatterns.forEach((pattern) => {
              this.currentSurface.removePattern(pattern);
              surfaceCollection.selectedSurfaceData.removePattern(pattern._guid);
            });
      const surfaceForPlacement = this.currentSurface!;
      surfaceForPlacement._app.stage.interactive = true;
      surfaceForPlacement._app.stage.eventMode = 'static';
      
      // Expand hit area to cover the full canvas area for nesting placement
      const board = surfaceForPlacement._Board;
      const boardWidth = board._boardWidth || 5000;
      const boardLength = board._boardLength || 10000;
      const margin = 2000;
      surfaceForPlacement._app.stage.hitArea = new PIXI.Rectangle(-margin, -margin, boardLength + margin * 2, boardWidth + margin * 2);
      
      surfaceForPlacement._app.canvas.style.cursor = 'crosshair';

      this.onNestPointerDown = (event: PIXI.FederatedPointerEvent) => {
        if (event.button !== 0) return;
        if (this.isReadyToPlaceNested && this.fixedPatterns.filter(p => p._state === 'edition').length === 0) {
          const global = event.global;
          const stagePos = surfaceForPlacement._app.stage.position;
          const zoom = surfaceForPlacement.zoomFactor;
          const worldX = (global.x - stagePos.x) / zoom;
          const worldY = (global.y - stagePos.y) / zoom;
          const worldPoint = { x: worldX, y: worldY };
          this.placeNestedAt(worldPoint, this.fixedPatterns);
        }
      };
      surfaceForPlacement._app.stage.addListener('pointerdown', this.onNestPointerDown);

      const cancelNest = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.isReadyToPlaceNested) {
          this.isReadyToPlaceNested = false;
          this.nestedTemplate = null;
          
          surfaceForPlacement._app.stage.removeListener('pointerdown', this.onNestPointerDown!);
          surfaceForPlacement._app.stage.interactive = false;
          surfaceForPlacement._app.stage.hitArea = null;
          surfaceForPlacement._app.stage.eventMode = 'dynamic';
          surfaceForPlacement._app.canvas.style.cursor = 'default';
          event.preventDefault();
        }
      };
      window.addEventListener('keydown', cancelNest);
   
    this.updateSelectedSurfaceData();
    
      
     
    surfaceManager.centerBoard();
 
    }
    } catch (fetchError) {
      // Clean up timeout if fetch fails
      clearTimeout(timeoutId);
      
      // Re-throw to be handled by outer catch block
      throw fetchError;
    }
  } catch (ex) {
    // Hide progress popup
    if (progressPopup) {
      progressPopup.hide();
    }
    
    // Cleanup any created patterns
    this.cleanupNestingCopies();
    
    // Determine user-friendly error message
    let userMessage = "Nesting Failed";
    let detailMessage = "An unexpected error occurred during nesting.";
    
    if (ex instanceof Error) {
      detailMessage = ex.message;
      
      // Handle specific error types
      if (ex.name === 'TypeError' && ex.message.includes('fetch')) {
        userMessage = "Network Error";
        detailMessage = "Could not connect to the nesting server. Please check your internet connection and try again.";
      } else if (ex.name === 'AbortError' || ex.message.includes('timeout')) {
        userMessage = "Request Timeout";
        detailMessage = "The nesting server took too long to respond. Please try again or use a faster quality setting.";
      } else if (ex.message.includes('JSON')) {
        userMessage = "Invalid Response";
        detailMessage = "Received an invalid response from the nesting server. Please try again.";
      } else if (ex.message.includes('CORS') || ex.message.includes('cross-origin')) {
        userMessage = "Connection Error";
        detailMessage = "Could not access the nesting server due to security restrictions.";
      }
    } else if (typeof ex === 'string') {
      detailMessage = ex;
    }
    
    // Show error to user
    toastError(userMessage, 4000);
    await ppInfo(userMessage, detailMessage);
    
    // Log for debugging
    console.error('Error during nesting:', ex);
  }
}


async doNesting() {
  const choice = await ppChooseNesting();
  if (choice === "local") {
  
    await this.local_doNesting();
  } else if (choice === "cloud") {

    await this.API_doNesting();
  }
}

/**
 * Aligns two patterns by their centers
 * Moves the second pattern so its center aligns with the first pattern's center
 */
async alignPatternsByCenter() {
  if (!this.currentSurface) {
    toastWarning("No surface available");
    return;
  }

  const selectedPatterns = this.currentSurface._Patterns.filter(p => p._state === 'selected');
  
  if (selectedPatterns.length !== 2) {
    toastWarning("Select exactly 2 patterns to align by center");
    return;
  }

  const [firstPattern, secondPattern] = selectedPatterns;
  
  try {
    // Capture state before alignment for undo/redo
    const capturedStates = new Map<string, any>();
    capturedStates.set(secondPattern._guid, undoRedoManager.capturePatternState(secondPattern._guid));

    // Get the center of the first pattern (reference pattern - won't move)
    const firstCenter = firstPattern._vector.getCenter();
    const firstUnzoomedX = firstPattern.unZoomed(firstPattern.x);
    const firstUnzoomedY = firstPattern.unZoomed(firstPattern.y);
    const firstAbsoluteCenterX = firstUnzoomedX + firstCenter.x;
    const firstAbsoluteCenterY = firstUnzoomedY + firstCenter.y;

    // Get the center of the second pattern (pattern to be moved)
    const secondCenter = secondPattern._vector.getCenter();
    const secondUnzoomedX = secondPattern.unZoomed(secondPattern.x);
    const secondUnzoomedY = secondPattern.unZoomed(secondPattern.y);
    const secondAbsoluteCenterX = secondUnzoomedX + secondCenter.x;
    const secondAbsoluteCenterY = secondUnzoomedY + secondCenter.y;

    // Calculate the offset needed to align centers
    const offsetX = firstAbsoluteCenterX - secondAbsoluteCenterX;
    const offsetY = firstAbsoluteCenterY - secondAbsoluteCenterY;

    // Move the second pattern by the offset
    const newUnzoomedX = secondUnzoomedX + offsetX;
    const newUnzoomedY = secondUnzoomedY + offsetY;
    
    // Move the second pattern
    secondPattern.x = secondPattern.zoomed(newUnzoomedX);
    secondPattern.y = secondPattern.zoomed(newUnzoomedY);
    
    // Apply transformations to update the vector
    secondPattern.applyTransformations({ rotate: false, translate: true });
    
    // Update surface data FIRST (this may re-normalize the vector)
    this.updateSelectedSurfaceData();
    this.saveSlectedSurface();
    
    // THEN force refresh of displays AFTER data is updated
    firstPattern.display();
    secondPattern.display();
    
    // Also refresh sub-patterns if they exist
    secondPattern.subPatterns.forEach(sub => sub.display());
    firstPattern.subPatterns.forEach(sub => sub.display());
    
    // Force render the entire canvas
    if (this.currentSurface && this.currentSurface._app) {
      this.currentSurface._app.render();
    }

    // Record the action for undo/redo
    const afterState = undoRedoManager.capturePatternState(secondPattern._guid);
    
    if (afterState) {
      undoRedoManager.recordPatternAction({
        type: 'align_center',
        patternGuid: secondPattern._guid,
        beforeState: capturedStates.get(secondPattern._guid),
        afterState: afterState,
        metadata: {
          description: 'Align patterns by center',
          referencePatternGuid: firstPattern._guid,
          movedPatternGuid: secondPattern._guid
        }
      });
    }

    toastSuccess("Patterns aligned by center", 1500);
    
  } catch (error) {
    console.error('Error aligning patterns by center:', error);
    toastError("Failed to align patterns");
  }
}


}



export const surfaceManager = new SurfaceManager();
(window as any).surfaceManager = surfaceManager;
