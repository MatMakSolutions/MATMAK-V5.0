import { Graphics, GraphicsPath, Matrix ,Text,TextStyle} from "pixi.js";
import { _Pattern, Pattern } from "../Pattern";
import { extendClass } from "./_BasePlugin";
import { CCommand } from "../../VectorPath/Commands/CCommand";
import { ZCommand } from "../../VectorPath/Commands/ZCommand";
import { Handler } from "../../Graphics/Handler";
import { Segment } from "../../Graphics/Segment";
import { CircleMenu } from "../../Graphics/CircleMenu";
import { CONTROL_POINT_COLOR, HANLDER_COLOR, ORIGINAL_PATTERN_COLOR, PATTERN_COLOR, PATTERN_HOVER_COLOR, PATTERN_SELECTED_COLOR } from "../PatternConstants";
import { VectorPath } from "../../VectorPath/VectorPath";
import { surfaceManager } from "../../Graphics/SurfaceManager";
import { IPoint } from "../../VectorPath/Utils/IPoint";
import { surfaceCollection } from "../../data/repository/SurfaceCollection";
import { SvgCommand ,TSVGCommand } from "../../VectorPath/Commands/Abstract/SvgCommand";
import { convertMm } from "../../core/LiveConfig";
import { LCommand } from "../../VectorPath/Commands/LCommand";
import { QCommand } from "../../VectorPath/Commands/QCommand";
import { guid } from "../../core/Guid"; //
import { undoRedoManager } from "../../core/UndoRedoManager";


export type TEditionPattern = {
  originalPath               : string;
  control1                   : Handler;
  control2                   : Handler;
  circleMenu                 : CircleMenu;
  currentSegment             : Segment;
  segmentList                : Segment[];
  handlerList                : Handler[];
  editionGraphics            : Graphics;
  handlerMode                : 'normal' | 'symmetrical' | 'smooth';
  init_edition               : () => void;
  dispose_edition            : () => void;
  display_edition            : () => void;
  cleanUp_edition            : () => void;
  checkPrerequisites_edition : () => void;
  destroySegments_edition    : () => void;
 deleteSelected_edition: () => void;
  clearGlobalSelection_edition: () => void;
  drawSelectionRect_edition():()=> void;
  selectHandlersInRect_edition() :() => void;
  // Multi-selection fields
  selectionGraphics          : Graphics | null;
  isSelecting                : boolean;
  selectionStart             : IPoint | null;
  selectionEnd               : IPoint | null;
  selectedHandlers           : Handler[];
  isDraggingMultiple         : boolean;
  multiDragStart             : IPoint | null;
////tracking dragging distance
   dragDistanceText           : Text | null;
  dragStartPoint             : IPoint | null;

}

/**
 * Hide all circle menus and handlers from all patterns in edit mode
 * This ensures only one circle menu and handlers are visible at a time
 */
function hideAllCircleMenusAndHandlers() {
  if (!surfaceManager.currentSurface) return;
  
  const surface = surfaceManager.currentSurface;
  
  // Hide circle menus and handlers for all main patterns
  surface._Patterns.forEach((pattern) => {
    if (pattern._state === 'edition') {
      const editionPattern = pattern as _Pattern & TEditionPattern;
      
      // Hide circle menu
      if (editionPattern.circleMenu) {
        editionPattern.circleMenu.visible = false;
        editionPattern.circleMenu.setInteractivity(false);
      }
      
      // Hide handlers
      if (editionPattern.control1) {
        editionPattern.control1.visible = false;
      }
      if (editionPattern.control2) {
        editionPattern.control2.visible = false;
      }
      
      // Also check subpatterns
      if (editionPattern.subPatterns && editionPattern.subPatterns.length > 0) {
        editionPattern.subPatterns.forEach((subPattern) => {
          const subEditionPattern = subPattern as _Pattern & TEditionPattern;
          
          // Hide subpattern circle menu
          if (subEditionPattern.circleMenu) {
            subEditionPattern.circleMenu.visible = false;
            subEditionPattern.circleMenu.setInteractivity(false);
          }
          
          // Hide subpattern handlers
          if (subEditionPattern.control1) {
            subEditionPattern.control1.visible = false;
          }
          if (subEditionPattern.control2) {
            subEditionPattern.control2.visible = false;
          }
        });
      }
    }
  });
}

function destroySegments(this: _Pattern & TEditionPattern) {
  if (this.currentSegment) {
    hideHandler.call(this);
    this.currentSegment = null
  }

  this.segmentList.forEach((segment) => {
    this.container.removeChild(segment);
    segment.dispose();
  });
  this.segmentList = [];
  // Destroy the handlers associated to the segments
  destroyHandlers.call(this);
}

function destroyHandlers(this: _Pattern & TEditionPattern) {
  this.handlerList.forEach((handler) => {
    this.container.removeChild(handler);
    handler.dispose();
  });
  this.handlerList = [];
}

function initializeSegments(this: _Pattern & TEditionPattern) {
  //For each command in the vector path
  this._vector.getCommands().forEach((command, idx, all) => {
    // Display the segment
    const segment = new Segment(command);
    //this._childrens.push(segment);

    // Set the stroke color
    segment.strokeNormalColor   = PATTERN_COLOR;
    segment.strokeColor         = PATTERN_COLOR;
    segment.strokeHoverColor    = PATTERN_HOVER_COLOR
    segment.strokeSelectedColor = PATTERN_SELECTED_COLOR;
    segment.zoomFactor          = this.zoomFactor;

    this.container.addChild(segment);
    this.segmentList.push(segment);

    // Display the handler for the ending point
    const handler = new Handler(4, HANLDER_COLOR, 12);
    handler._zoomFactor = this.zoomFactor;
    this.handlerList.push(handler);
    handler.x = this.zoomed((segment["command"] as CCommand).endingPoint.x);
    handler.y = this.zoomed((segment["command"] as CCommand).endingPoint.y);
    handler.onEventOver = () => {
      segment.isHovered = true;
    }
    handler.onEventOut = () => {
      segment.isHovered = false;
    }
    handler.onEventDrop = (eventData) => {
      ///dragging text
       if (this.dragDistanceText) {
        (this.dragDistanceText as any).visible = false;
      }
      this.dragStartPoint = null;
      
      // Record undo/redo action after node editing
      if ((this as any)._stateBeforeNodeEdit) {
        // For subpatterns, capture and record using the parent pattern instead
        const targetPattern = this._parentPattern || this;
        const stateAfter = undoRedoManager.capturePatternState(targetPattern._guid);
        
        if (stateAfter) {
          undoRedoManager.recordPatternAction({
            type: 'edit_nodes',
            patternGuid: targetPattern._guid,
            beforeState: (this as any)._stateBeforeNodeEdit,
            afterState: stateAfter,
            metadata: {}
          });
          
          // Save immediately after recording undo/redo
          surfaceManager.saveSlectedSurface();
        }
        
        delete (this as any)._stateBeforeNodeEdit;
      }
////////////////////////////////////////////////
      // Hide all circle menus and handlers globally first
      hideAllCircleMenusAndHandlers();
      
      const absolutePos = this.getAbsolutePosition();
      this.circleMenu.visible = true
      this.circleMenu.setInteractivity(true);
      this.circleMenu.x = eventData.x + 100 - absolutePos.x;
      this.circleMenu.y = eventData.y - absolutePos.y;
      this.circleMenu.update();
    }
    handler.onEventDrag = (eventData) => {
      // Skip individual drag if we're in multi-selection mode or if this handler is part of global selection
      if (this.isDraggingMultiple || this.selectedHandlers.length > 1 ||
          surfaceManager.globalIsDraggingMultiple || surfaceManager.globalSelectedHandlers.length > 1) {
        return;
      }

      // Capture pattern state BEFORE first drag movement for undo/redo
      if (!(this as any)._stateBeforeNodeEdit) {
        // For subpatterns, capture the parent pattern state instead
        const targetPattern = this._parentPattern || this;
        (this as any)._stateBeforeNodeEdit = undoRedoManager.capturePatternState(targetPattern._guid);
      }

      ///////////////////////
 if (!this.dragDistanceText) {
        const style = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 14,
            fill: '#000000',
            stroke: '#ffffff',

        });
        this.dragDistanceText = new Text({text:'', style:style});
        (this.dragDistanceText as any).anchor.set(0.5);
        surfaceManager.currentSurface._app.stage.addChild(this.dragDistanceText as any);
      }

      const dx = eventData.x - this.dragStartPoint.x;
      const dy = eventData.y - this.dragStartPoint.y;
      const distanceInPixels = Math.sqrt(dx * dx + dy * dy);
      const distanceInMm = distanceInPixels / surfaceManager.currentSurface.zoomFactor;

      const [convertedDistance, unit] = convertMm(distanceInMm, 'inches');

      (this.dragDistanceText as any).text = `${convertedDistance.toFixed(2)} ${unit === 'Metric' ? 'mm' : 'in'}`;
      (this.dragDistanceText as any).position.set(eventData.x + 20, eventData.y - 20);
      (this.dragDistanceText as any).visible = true;

      ///////////////////////////////

       try {
        this.circleMenu.visible = false;
        this.circleMenu.setInteractivity(false);
        this.circleMenu.update();
        this.container.removeChild(this.circleMenu);
        this.container.addChild(this.circleMenu);
        this.segmentList.forEach((segment) => segment.isSelected = false);
        if (!segment.isSelected) {
          segment.isSelected = true;
          this.currentSegment = segment;
          if (segment.command instanceof CCommand) {
            showHandler.call(this, segment);
          }
        }
        // For sub-patterns, we need to account for parent's position
        const absolutePos = this.getAbsolutePosition();
        handler.position.set(eventData.x - absolutePos.x, eventData.y - absolutePos.y);
        segment.command?.updateEndingPoint({ x: this.unZoomed(eventData.x - absolutePos.x), y: this.unZoomed(eventData.y - absolutePos.y) });
        segment.update();
        segment.nextSegment?.update();
        this.control1?.update();
        this.control2?.update();
      } catch (e) { }
    }
    handler.onEventClick = (eventData) => {
      // Hide all circle menus and handlers globally first
      hideAllCircleMenusAndHandlers();
      
      this.segmentList.forEach((segment) => segment.isSelected = false);
      segment.isSelected = true;
      this.currentSegment = segment;
      if (segment.command instanceof CCommand) {
        showHandler.call(this, segment);
      }
      ////////////////////////////////////////////
else if (segment.command instanceof LCommand) {
        const curveCommand = (segment.command as LCommand).toCurveCommand();
        segment.command.replaceWith(curveCommand);
        segment.command = curveCommand;
        showHandler.call(this, segment);
    } else if (segment.command instanceof QCommand) {
        const curveCommand = (segment.command as QCommand).toCurveCommand();
        segment.command.replaceWith(curveCommand);
        segment.command = curveCommand;
        showHandler.call(this, segment);
    }

      /////////////////////////////////////////
      const absolutePos = this.getAbsolutePosition();
      this.circleMenu.visible = false;
      this.circleMenu.setInteractivity(false);
      this.circleMenu.visible = true;
      this.circleMenu.setInteractivity(true);
      this.circleMenu.x = eventData.x + 100 - absolutePos.x;
      this.circleMenu.y = eventData.y - absolutePos.y;
      this.container.removeChild(this.circleMenu);
      this.container.addChild(this.circleMenu);
      this.circleMenu.update();
    }
    this.container.addChild(handler);
  });


  // Now we link all segment to their previosu and next segment
  //we link the first with previous as last and the last with next as first
  this.segmentList.forEach((segment, idx) => {
    if (idx === 0) {
      segment.previousSegment = this.segmentList[this.segmentList.length - 1];
    } else {
      segment.previousSegment = this.segmentList[idx - 1];
    }

    if (idx === this.segmentList.length - 1) {
      segment.nextSegment = this.segmentList[0];
    } else {
      segment.nextSegment = this.segmentList[idx + 1];
    }
  });
}


function hideHandler(this: _Pattern & TEditionPattern) {
  this.control1 && this.container.removeChild(this.control1);
  this.control2 && this.container.removeChild(this.control2);
  this.control1 && this.control1.dispose();
  this.control2 && this.control2.dispose();
  this.control1 && this.control1.destroy();
  this.control2 && this.control2.destroy();
  (this.control1 as any) = null;
  (this.control2 as any) = null;
}

function showHandler(this: _Pattern & TEditionPattern, segment: Segment ) {
  hideHandler.call(this);
   this.control1 = new Handler(4, CONTROL_POINT_COLOR, 12);
   this.control1._zoomFactor = this.zoomFactor;
   //this.control1.app = (window as any).app;
   this.control1.getAnchor = () => (segment.command?.startingPoint!);
   this.control1.x = this.zoomed((segment["command"] as CCommand).controlPoint1.x);
   this.control1.y = this.zoomed((segment["command"] as CCommand).controlPoint1.y);
   this.control1.onEventDrop = (eventData) => {
    (segment["command"] as CCommand)["buildLookupTable"]();
    
    // Record undo/redo action after control point editing
    if ((this as any)._stateBeforeNodeEdit) {
      // For subpatterns, capture and record using the parent pattern instead
      const targetPattern = this._parentPattern || this;
      const stateAfter = undoRedoManager.capturePatternState(targetPattern._guid);
      
      if (stateAfter) {
        undoRedoManager.recordPatternAction({
          type: 'edit_nodes',
          patternGuid: targetPattern._guid,
          beforeState: (this as any)._stateBeforeNodeEdit,
          afterState: stateAfter,
          metadata: {}
        });
        
        // Save immediately after recording undo/redo
        surfaceManager.saveSlectedSurface();
      }
      
      delete (this as any)._stateBeforeNodeEdit;
    }
   }
this.control1.onEventDrag = (eventData: any) => {
  if (this.isDraggingMultiple || this.selectedHandlers.length > 1 || surfaceManager.globalIsDraggingMultiple || surfaceManager.globalSelectedHandlers.length > 1) {
    return;
  }

  // Capture pattern state BEFORE first drag movement for undo/redo
  if (!(this as any)._stateBeforeNodeEdit) {
    // For subpatterns, capture the parent pattern state instead
    const targetPattern = this._parentPattern || this;
    (this as any)._stateBeforeNodeEdit = undoRedoManager.capturePatternState(targetPattern._guid);
  }

  try {
    const absolutePos = this.getAbsolutePosition();
    const newPos1 = { x: eventData.x - absolutePos.x, y: eventData.y - absolutePos.y };

    this.control1.position.set(newPos1.x, newPos1.y);
    this.control1.update();
    const unzoomedNewPos1 = { x: this.unZoomed(newPos1.x), y: this.unZoomed(newPos1.y) };
    (segment.command as CCommand).x1 = unzoomedNewPos1.x;
    (segment.command as CCommand).y1 = unzoomedNewPos1.y;

    if (this.handlerMode === 'symmetrical' || this.handlerMode === 'smooth') {
      updateOppositeControlPoint.call(this, 'control1', segment, unzoomedNewPos1);
    }

    segment.update();
  } catch (e) { }
};

    this.container.addChild(this.control1);

    this.control2 = new Handler(4, CONTROL_POINT_COLOR, 12);
    this.control2._zoomFactor = this.zoomFactor;
    this.control2.getAnchor = () => (segment.command?.endingPoint!);
    this.control2.x = this.zoomed((segment["command"] as CCommand).controlPoint2.x);
    this.control2.y = this.zoomed((segment["command"] as CCommand).controlPoint2.y);
    this.control2.onEventDrop = (eventData) => {
      (segment["command"] as CCommand)["buildLookupTable"]();
      
      // Record undo/redo action after control point editing
      if ((this as any)._stateBeforeNodeEdit) {
        // For subpatterns, capture and record using the parent pattern instead
        const targetPattern = this._parentPattern || this;
        const stateAfter = undoRedoManager.capturePatternState(targetPattern._guid);
        
        if (stateAfter) {
          undoRedoManager.recordPatternAction({
            type: 'edit_nodes',
            patternGuid: targetPattern._guid,
            beforeState: (this as any)._stateBeforeNodeEdit,
            afterState: stateAfter,
            metadata: {}
          });
          
          // Save immediately after recording undo/redo
          surfaceManager.saveSlectedSurface();
        }
        
        delete (this as any)._stateBeforeNodeEdit;
      }
     }
     this.control2.onEventDrag = (eventData: any) => {
  if (this.isDraggingMultiple || this.selectedHandlers.length > 1 || surfaceManager.globalIsDraggingMultiple || surfaceManager.globalSelectedHandlers.length > 1) {
    return;
  }

  // Capture pattern state BEFORE first drag movement for undo/redo
  if (!(this as any)._stateBeforeNodeEdit) {
    // For subpatterns, capture the parent pattern state instead
    const targetPattern = this._parentPattern || this;
    (this as any)._stateBeforeNodeEdit = undoRedoManager.capturePatternState(targetPattern._guid);
  }

  try {
    const absolutePos = this.getAbsolutePosition();
    const newPos2 = { x: eventData.x - absolutePos.x, y: eventData.y - absolutePos.y };

    this.control2.position.set(newPos2.x, newPos2.y);
    this.control2.update();
    const unzoomedNewPos2 = { x: this.unZoomed(newPos2.x), y: this.unZoomed(newPos2.y) };
    (segment.command as CCommand).x2 = unzoomedNewPos2.x;
    (segment.command as CCommand).y2 = unzoomedNewPos2.y;

    if (this.handlerMode === 'symmetrical' || this.handlerMode === 'smooth') {
      updateOppositeControlPoint.call(this, 'control2', segment, unzoomedNewPos2);
    }

    segment.update();
  } catch (e) { }
};
    this.container.addChild(this.control2);
    this.control1.update();
    this.control2.update();
}
function updateOppositeControlPoint(this: _Pattern & TEditionPattern, draggedControl: 'control1' | 'control2', segment: Segment, newPos: IPoint) {
  const command = segment.command as CCommand;
  const oppositeControl = draggedControl === 'control1' ? this.control2 : this.control1;


  const anchorPoint = draggedControl === 'control1' ? command.startingPoint : command.endingPoint;
  const oppositeAnchorPoint = draggedControl === 'control1' ? command.endingPoint : command.startingPoint;

  const dx = anchorPoint.x - newPos.x;
  const dy = anchorPoint.y - newPos.y;

  let oppositeNewPos: IPoint;

  if (this.handlerMode === 'symmetrical') {
   
    oppositeNewPos = {
      x: oppositeAnchorPoint.x + (anchorPoint.x - newPos.x),
      y: oppositeAnchorPoint.y + (anchorPoint.y - newPos.y)
    };
  } else { // smooth mode
   
    const oppositeControlPoint = draggedControl === 'control1' ? command.controlPoint2 : command.controlPoint1;
    const oppositeDx = oppositeControlPoint.x - oppositeAnchorPoint.x;
    const oppositeDy = oppositeControlPoint.y - oppositeAnchorPoint.y;
    const oppositeDist = Math.sqrt(oppositeDx * oppositeDx + oppositeDy * oppositeDy);
    const angle = Math.atan2(dy, dx) + Math.PI; 

    oppositeNewPos = {
      x: anchorPoint.x + oppositeDist * Math.cos(angle),
      y: anchorPoint.y + oppositeDist * Math.sin(angle)
    };
  }


  if (draggedControl === 'control1') {
    command.x2 = oppositeNewPos.x;
    command.y2 = oppositeNewPos.y;
  } else {
    command.x1 = oppositeNewPos.x;
    command.y1 = oppositeNewPos.y;
  }

 
  oppositeControl.position.set(this.zoomed(oppositeNewPos.x), this.zoomed(oppositeNewPos.y));
  oppositeControl.update();
}
export const EditionPattern = (input: any) => extendClass(input, {
  fields: ["originalPath", "control1", "control2", "circleMenu", "handlerMode",
           "selectionGraphics", "isSelecting", "selectionStart", "selectionEnd",
           "selectedHandlers", "isDraggingMultiple", "multiDragStart"],
  methods: [
    // Clear global selection helper
  {name: 'clearGlobalSelection_edition', body: function (this: _Pattern & TEditionPattern) {
        // Clear all global selections
        surfaceManager.globalSelectedHandlers.forEach(item => {
            // Add a null/destroyed check for the handler to prevent errors
            if (item.handler && !item.handler.destroyed) {
                item.handler.setColor(HANLDER_COLOR);
                item.handler.disableAnchorLine = false;
                item.handler.update();
            }
        });
        surfaceManager.globalSelectedHandlers = [];
    }
},
////////////////////////////////////
{  name: 'deleteSelectedHandlers_edition', body: function (this: _Pattern & TEditionPattern) {
        if (surfaceManager.globalSelectedHandlers.length === 0) return;

        // Capture states before deletion for undo/redo (for all affected patterns)
        const statesByPattern = new Map<string, any>();
        const uniquePatternGuids = new Set<string>();
        surfaceManager.globalSelectedHandlers.forEach(item => {
            const pattern = item.pattern as _Pattern & TEditionPattern;
            const capturePattern = pattern._parentPattern || pattern;
            uniquePatternGuids.add(capturePattern._guid);
        });
        uniquePatternGuids.forEach(guid => {
            const state = undoRedoManager.capturePatternState(guid);
            if (state) {
                statesByPattern.set(guid, state);
            }
        });

        const deletionsByPattern = new Map<_Pattern & TEditionPattern, SvgCommand[]>();
        surfaceManager.globalSelectedHandlers.forEach(item => {
            const pattern = item.pattern as _Pattern & TEditionPattern;
            if (!deletionsByPattern.has(pattern)) {
                deletionsByPattern.set(pattern, []);
            }
            const handlerIndex = pattern.handlerList.indexOf(item.handler);
            if (handlerIndex > -1 && pattern.segmentList[handlerIndex]?.command) {
                deletionsByPattern.get(pattern)!.push(pattern.segmentList[handlerIndex].command);
            }
        });

        deletionsByPattern.forEach((commandsToDelete, pattern) => {
            const vector = pattern._vector;
            const allCommands = vector.getCommands();
            const surface = surfaceManager.currentSurface!;


            const editablePoints = allCommands.filter(c => c.type !== 'Z' && c.type !== 'M');
           if (commandsToDelete.length >= editablePoints.length) {

                if (pattern._parentPattern) {
                    const parent = pattern._parentPattern as _Pattern & TEditionPattern;
                    const index = parent.subPatterns.indexOf(pattern as typeof Pattern);
                    if (index > -1) {
                        parent.subPatterns.splice(index, 1);
                        parent._vector.paths.splice(index, 1);
                    }
                    pattern.dispose();


                    if (!deletionsByPattern.has(parent)) {
                        parent.display();
                    }
                } else {
                    pattern.dispose();
                    surface.removePattern(pattern as typeof Pattern);
                    surfaceCollection.removePatternFromSelectedSurface(pattern._guid);
                }
                return;
            }


            const deleteSet = new Set(commandsToDelete);

            if (deleteSet.has(allCommands[0])) {
               console.warn("","The starting point of a path cannot be deleted.");
               deleteSet.delete(allCommands[0]);
            }
            if (deleteSet.size === 0) return;


            const newCommands: TSVGCommand[] = [];
            let i = 0;
            while (i < allCommands.length) {
                const cmd = allCommands[i];
                if (!deleteSet.has(cmd)) {
                    newCommands.push(cmd);
                    i++;
                } else {
                    let blockEndIndex = i;
                    while (blockEndIndex + 1 < allCommands.length && deleteSet.has(allCommands[blockEndIndex + 1])) {
                        blockEndIndex++;
                    }
                    const endPoint = allCommands[blockEndIndex].endingPoint;
                    if (allCommands[blockEndIndex].type !== 'Z') {
                        //newCommands.push(new LCommand(endPoint.x, endPoint.y, false));
                    }
                    i = blockEndIndex + 1;
                }
            }


            const finalCommands: TSVGCommand[] = newCommands.filter(cmd => cmd.type !== 'Z');
            if (finalCommands.length > 0) {
                finalCommands.push(new ZCommand(false));
            } else {
                pattern.dispose();
                surface.removePattern(pattern as typeof Pattern);
                surfaceCollection.removePatternFromSelectedSurface(pattern._guid);
                return;
            }


            for (let j = 0; j < finalCommands.length; j++) {
                finalCommands[j].linkAfter(finalCommands[(j + 1) % finalCommands.length]);
            }


            (vector as any).commands = finalCommands;
            pattern.destroySegments_edition();
            pattern.display();
        });


        this.clearGlobalSelection_edition();
        
        // Record undo/redo actions for all affected patterns after deletion
        statesByPattern.forEach((beforeState, guid) => {
            const afterState = undoRedoManager.capturePatternState(guid);
            if (afterState) {
                undoRedoManager.recordPatternAction({
                    type: 'edit_nodes',
                    patternGuid: guid,
                    beforeState: beforeState,
                    afterState: afterState,
                    metadata: {}
                });
            }
        });
        
        surfaceManager.saveSlectedSurface();
    }
}
,
///////////////////////////////////////////
    // Initialize the edition pattern
    { name: 'init_edition', body: function (this: _Pattern & TEditionPattern) {
      this.originalPath    = '';
      this.control1        = null;
      this.control2        = null;
      this.circleMenu      = null;
      this.currentSegment  = null;
      this.handlerMode = 'normal';

      // Initialize multi-selection fields
      this.selectionGraphics = null;
      this.isSelecting = false;
      this.selectionStart = null;
      this.selectionEnd = null;
      this.selectedHandlers = [];
      this.isDraggingMultiple = false;
      this.multiDragStart = null;
      this.segmentList     = [];
      this.handlerList     = [];
      this.editionGraphics = null;
    } },
    // Dispose the edition pattern
    { name: 'dispose_edition', body: function (this: _Pattern & TEditionPattern) {} },
    // destroySegments
    { name: 'destroySegments_edition', body: function (this: _Pattern & TEditionPattern) {
      destroySegments.call(this);
    } },
    { name: 'checkPrerequisites_edition', body: function (this: _Pattern & TEditionPattern) {
        // When enter in edition we store the original path
        if (!this.originalPath) {
          this.originalPath = this._vector.generatePathString();
        }

        if (!this.circleMenu) {
          this.circleMenu = new CircleMenu();
          this.container.addChild(this.circleMenu);
          this.circleMenu.items = [
            {
              name: "Insert Point at click",
              handler: () => {
                surfaceManager.currentSurface.activatePointSelection = true;
                surfaceManager.currentSurface._app.canvas.style.cursor = 'crosshair';
                this.circleMenu.visible = false;
                this.circleMenu.setInteractivity(false);
              }
            },
            {
              name: "Delete Point",
             handler: () => {
                const allCommands = this._vector.getCommands();
                if (this.currentSegment.command === allCommands[0]) {
                 console.warn("","The starting point of a path cannot be deleted.");
               return ;
                }
                
                // Capture beforeState for undo/redo
                const targetPattern = this._parentPattern || this;
                const beforeState = undoRedoManager.capturePatternState(targetPattern._guid);
                
                // Delete the point
                (this.currentSegment.command as CCommand).delete();
                this.destroySegments_edition();
                this.currentSegment = null;
                this.circleMenu.visible = false;
                this.circleMenu.setInteractivity(false);
                this.display();
                
                // Capture afterState and record undo/redo
                const afterState = undoRedoManager.capturePatternState(targetPattern._guid);
                if (beforeState && afterState) {
                  undoRedoManager.recordPatternAction({
                    type: 'edit_nodes',
                    patternGuid: targetPattern._guid,
                    beforeState: beforeState,
                    afterState: afterState,
                    metadata: { action: 'delete_point' }
                  });
                }
                
                // Save immediately after deletion
                surfaceManager.saveSlectedSurface();
              }
            }


          ]

          // Add events to the circle menu
          this.circleMenu.onEventClick = () => {
            this.circleMenu.isMenuOpened = !this.circleMenu.isMenuOpened;
            this.circleMenu.update();
          }

        };

        if (!this.editionGraphics) {
          this.editionGraphics = new Graphics();
          this.container.addChild(this.editionGraphics);
        }
      }
    },
    {
      name: 'display_edition', body: function (this: _Pattern & TEditionPattern) {
        this.checkPrerequisites_edition();

        // Reset the circle menu
        this.circleMenu.x       = 0;
        this.circleMenu.y       = 0;
        this.circleMenu.visible = false;

        // Reset mouse states
        (window as any).dragging = false;
        (window as any).over     = false;

        // Display the original path
        const g = this.editionGraphics;
        g.clear();
        g.transform(new Matrix().scale(this.zoomFactor, this.zoomFactor));
        g.setStrokeStyle({ width: 1, color: ORIGINAL_PATTERN_COLOR, alpha: 0.5 });
        this.container.addChild(g);
        g.path(new GraphicsPath(this.originalPath));
        g.stroke();

        if (this.segmentList.length === 0) {
          // Force refresh the vector on first edition entry
          const pattern = this._vector.generatePathString();
          const oldPaths = this._vector.paths;
          const oldOriginalPosition = this._vector.originalPosition;
          this._vector = new VectorPath();
          this._vector.parse(pattern);
          this._vector["_originalPosition"] = oldOriginalPosition;
          this._vector["_cloned"] = true;
          this._vector.normalize();
          this._vector.paths = oldPaths;

          initializeSegments.call(this);
        } else {
          this.segmentList.forEach((segment) => {
            if (segment.zoomFactor !== this.zoomFactor) {
              segment.zoomFactor = this.zoomFactor;
              segment.update();
            }
          });
          
          // Update endpoint handlers - skip any that are currently being dragged
          this.handlerList.forEach((handler, handlerIdx) => {
            // Check if this handler is being dragged (either individually or as part of multi-selection)
            const isInGlobalSelection = surfaceManager.globalIsDraggingMultiple && 
                                       surfaceManager.globalSelectedHandlers.some(
                                         item => item.handler === handler && item.pattern === this
                                       );
            const isBeingDragged = handler._isDragging || isInGlobalSelection;
            
            // Only update position if not currently dragging
            if (!isBeingDragged) {
              handler.x = this.zoomed((this.segmentList[handlerIdx]["command"] as CCommand).endingPoint.x);
              handler.y = this.zoomed((this.segmentList[handlerIdx]["command"] as CCommand).endingPoint.y);
            }
            // Always update zoom factor
            handler._zoomFactor = this.zoomFactor;
          });
          
          // Update control point handlers ONCE, outside the loop
          if (this.currentSegment && this.currentSegment.command instanceof CCommand) {
            // Instead of recreating handlers, just update their positions if they exist
            if (this.control1) {
              this.control1._zoomFactor = this.zoomFactor;
              // Only update position if not currently dragging
              if (!this.control1._isDragging) {
                this.control1.x = this.zoomed((this.currentSegment.command as CCommand).controlPoint1.x);
                this.control1.y = this.zoomed((this.currentSegment.command as CCommand).controlPoint1.y);
              }
              this.control1.update();
            }
            if (this.control2) {
              this.control2._zoomFactor = this.zoomFactor;
              // Only update position if not currently dragging
              if (!this.control2._isDragging) {
                this.control2.x = this.zoomed((this.currentSegment.command as CCommand).controlPoint2.x);
                this.control2.y = this.zoomed((this.currentSegment.command as CCommand).controlPoint2.y);
              }
              this.control2.update();
            }
          }
        }

        this.subPatterns.forEach((pattern) => {
          pattern.display();
        });
      }
    },

    // Clean up the edition pattern
    /*
    { name: 'cleanUp_edition', body: function (this: _Pattern & TEditionPattern) {
      // Cleanup teh segments
      destroySegments.call(this);
      // Cleanup the circle menu
      this.circleMenu.dispose();
      this.circleMenu = null;

      this.editionGraphics.clear();

      // Clean up selection graphics
      if (this.selectionGraphics) {
        this.container.removeChild(this.selectionGraphics);
        this.selectionGraphics.destroy();
        this.selectionGraphics = null;
      }
      this.selectedHandlers = [];
      this.isSelecting = false;

      const pattern = this._vector.generatePathString();
      const oldPaths = this._vector.paths;
      const oldOriginalPosition = this._vector.originalPosition;
      this._vector = new VectorPath();
      this._vector.parse(pattern);
      this._vector["_originalPosition"] = oldOriginalPosition;
      this._vector["_cloned"] = true;
      this._vector.normalize();
      this._vector.paths = oldPaths;

      this._polyHit.setPath(this._vector.generatePathString());
      surfaceCollection.updatePattern(this as typeof Pattern, true);
    
    }},
*/
// Clean up the edition pattern
    { name: 'cleanUp_edition', body: function (this: _Pattern & TEditionPattern) {
      
      // --- START OF FIX ---

      // 1. Do visual-only cleanup first (for all patterns)
      destroySegments.call(this);
      if (this.circleMenu) {
        this.circleMenu.dispose();
        this.circleMenu = null;
      }
      if (this.editionGraphics) {
        this.editionGraphics.clear();
      }
      if (this.selectionGraphics) {
        this.container.removeChild(this.selectionGraphics);
        this.selectionGraphics.destroy();
        this.selectionGraphics = null;
      }
      this.selectedHandlers = [];
      this.isSelecting = false;

      // 2. Check if this is a sub-pattern
      if (this._parentPattern) {
        // This is a sub-pattern. Its geometry is saved by its parent.
        // We must NOT try to delete/recreate it or access surfaceCollection.
        // We just need to finalize its own vector and polyHit for consistency.
        
        const patternPath = this._vector.generatePathString();
        const subPaths = this._vector.paths; // sub-patterns don't have sub-patterns
        
        this._vector = new VectorPath();
        this._vector.parse(patternPath);
        this._vector["_cloned"] = true;
        this._vector.normalize();
        this._vector.paths = subPaths;
        
        this._polyHit.setPath(this._vector.generatePathString());
        
        // Mark the parent pattern as dirty so it knows to save sub-pattern changes
        if (this._parentPattern) {
          (this._parentPattern as any)._isDirty = true;
        }
        
        return; // Exit here.
      }

      // 3. If we are here, this is a MAIN pattern. Proceed with delete/recreate.
      const surface = surfaceManager.currentSurface;
      if (!surface) return;

      // 4. Capture all data from the old (edited) pattern
      const oldPatternDataJSON = surfaceCollection.selectedSurfaceData.getPattern(this._guid);
      if (!oldPatternDataJSON) {
          console.error("cleanUp_edition: Could not find pattern data for guid:", this._guid);
          return; // Safety check for the JSON.parse
      }
      const oldPatternData = JSON.parse(JSON.stringify(oldPatternDataJSON));
      
      // Calculate the true "base" position
      const oldUnzoomedX = this.unZoomed(this.x);
      const oldUnzoomedY = this.unZoomed(this.y);
      const oldOriginalPos = this._vector.originalPosition;
      const baseX = oldUnzoomedX - oldOriginalPos.x;
      const baseY = oldUnzoomedY - oldOriginalPos.y;
      
      const oldRotation = this._rotation;
      const oldGuid = this._guid;
      const isGroup = this.isGroup;
      
      // Get the *final* edited geometry
      const editedMainPath = this._vector.generatePathString();
      // Get sub-paths from the sub-patterns' *in-memory vectors*
      // IMPORTANT: Use the current in-memory vectors, not the old saved ones
      const editedSubPaths = this.subPatterns.map(p => p._vector.generatePathString());

      // 5. Destroy the old pattern completely
      surface.removePattern(this as typeof Pattern);
      surfaceCollection.selectedSurfaceData.removePattern(oldGuid);

      // 6. Create the new pattern (Visual Layer)
      const newPattern = surface.addPath(editedMainPath, {
        guid: oldGuid,
        nestedPaths: editedSubPaths,
        noNormilize: false, // Force normalization
      });

      // 7. Set its position and state correctly
      const newOriginalPos = newPattern._vector.originalPosition;
      newPattern.x = newPattern.zoomed(baseX + newOriginalPos.x);
      newPattern.y = newPattern.zoomed(baseY + newOriginalPos.y);
      newPattern._rotation = oldRotation;
      newPattern.isGroup = isGroup; // Preserve group status
      newPattern.display(); // Display the new, consistent pattern

      // 8. Add the new pattern back to the Data Model
      surfaceCollection.selectedSurfaceData.addPattern({
        ...oldPatternData, // Re-use all old data
        guid: oldGuid, // Use the same GUID
        paths: [newPattern._vector.generatePathString(), ...editedSubPaths], // Save the new paths
        boardPosition: { x: baseX, y: baseY }, // Save the true base position
        boardAngle: oldRotation,
      });

      // 9. Call the main save function
      //    (This is now safe and will find a 100% consistent pattern)
      surfaceManager.saveSlectedSurface();

      // --- END OF FIX ---
    }},

/////////////////////////////
    // Mouse event handlers for multi-selection
    { name: 'onMouseDown_edition', body: function (this: _Pattern & TEditionPattern, event: { x: number, y: number, shiftKey?: boolean, ctrlKey?: boolean }) {
      const absolutePos = this.getAbsolutePosition();
      const localX = event.x - absolutePos.x;
      const localY = event.y - absolutePos.y;

      // Store initial drag position
this.dragStartPoint = { x: event.x, y: event.y };

      // Check if Shift or Ctrl is held for multi-selection
      if (event.shiftKey || event.ctrlKey) {
        // Only the main pattern should start the selection
        const mainPattern = this._parentPattern || this;
        if (this === mainPattern) {
          // Clear any existing selection first (globally)
          this.clearGlobalSelection_edition();

          // Start rectangle selection
          this.isSelecting = true;
          this.selectionStart = { x: localX, y: localY };
          this.selectionEnd = { x: localX, y: localY };

          if (!this.selectionGraphics) {
            this.selectionGraphics = new Graphics();
            this.container.addChild(this.selectionGraphics);
          }
        }

        // All patterns disable their handlers during selection
        this.handlerList.forEach(handler => {
          handler.setInteractivity(false);
        });
      } else if (surfaceManager.globalSelectedHandlers.length > 0) {
        // Check if clicking on a selected handler to start multi-drag
        let clickedOnSelected = false;
        for (const item of surfaceManager.globalSelectedHandlers) {
          // Check if this handler belongs to this pattern
          const handler = item.handler;
          const pattern = item.pattern as _Pattern & TEditionPattern;

          // Calculate handler position in screen space using absolute position
          const patternAbsolutePos = pattern.getAbsolutePosition();
          const handlerScreenX = patternAbsolutePos.x + handler.x;
          const handlerScreenY = patternAbsolutePos.y + handler.y;

          // Simple distance check
          const dx = handlerScreenX - event.x;
          const dy = handlerScreenY - event.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 10) { // Within 10 pixels
            clickedOnSelected = true;
            break;
          }
        }

        if (clickedOnSelected) {
          surfaceManager.globalIsDraggingMultiple = true;
          surfaceManager.globalMultiDragStart = { x: event.x, y: event.y };
        } else {
          // Clear global selection if clicking elsewhere
          this.clearGlobalSelection_edition();
        }
      }
    }},

    { name: 'onMouseMove_edition', body: function (this: _Pattern & TEditionPattern, event: { x: number, y: number }) {
      const absolutePos = this.getAbsolutePosition();
      const localX = event.x - absolutePos.x;
      const localY = event.y - absolutePos.y;

      // Check if any pattern is selecting
      const mainPattern = this._parentPattern || this;
      if (mainPattern === this && this.isSelecting && this.selectionStart) {
        // Update selection rectangle
        this.selectionEnd = { x: localX, y: localY };
        this.drawSelectionRect_edition();
      } else if (surfaceManager.globalIsDraggingMultiple && surfaceManager.globalMultiDragStart) {
        // Capture state on first drag movement if not already captured
        if (!(surfaceManager as any)._globalDragStates) {
          const uniquePatternGuids = new Set<string>();
          surfaceManager.globalSelectedHandlers.forEach(item => {
            const pattern = item.pattern as _Pattern & TEditionPattern;
            // For subpatterns, use the parent pattern's GUID instead since subpatterns don't exist independently
            const targetGuid = pattern._parentPattern ? pattern._parentPattern._guid : pattern._guid;
            uniquePatternGuids.add(targetGuid);
          });

          (surfaceManager as any)._globalDragStates = new Map<string, any>();
          uniquePatternGuids.forEach(guid => {
            const state = undoRedoManager.capturePatternState(guid);
            if (state) {
              (surfaceManager as any)._globalDragStates.set(guid, state);
            }
          });
        }
        
        // Move all selected handlers globally
        const deltaX = event.x - surfaceManager.globalMultiDragStart.x;
        const deltaY = event.y - surfaceManager.globalMultiDragStart.y;

        surfaceManager.globalMultiDragStart = { x: event.x, y: event.y };

        // Move each selected handler globally
        for (let i = 0; i < surfaceManager.globalSelectedHandlers.length; i++) {
          const item = surfaceManager.globalSelectedHandlers[i];
          const handler = item.handler;
          const pattern = item.pattern as _Pattern & TEditionPattern;
          const handlerIndex = pattern.handlerList.indexOf(handler);
          if (handlerIndex >= 0 && handlerIndex < pattern.segmentList.length) {
            const segment = pattern.segmentList[handlerIndex];
            const command = segment.command;

            // Update handler position
            handler.position.x += deltaX;
            handler.position.y += deltaY;
            // Ensure anchor line stays disabled during drag
            handler.disableAnchorLine = true;
            handler.update();

            // Update command ending point
            const newX = pattern.unZoomed(handler.position.x);
            const newY = pattern.unZoomed(handler.position.y);
            command?.updateEndingPoint({ x: newX, y: newY });

            // When moving an endpoint, we need to update control points that are attached to it
            // 1. The endpoint controls control point 2 of its own segment
            if (command instanceof CCommand) {
              // Update control point 2 (attached to this endpoint)
              command.x2 += pattern.unZoomed(deltaX);
              command.y2 += pattern.unZoomed(deltaY);
            }

            // 2. The endpoint also controls control point 1 of the NEXT segment
            if (segment.nextSegment && segment.nextSegment.command instanceof CCommand) {
              const nextCommand = segment.nextSegment.command as CCommand;
              nextCommand.x1 += pattern.unZoomed(deltaX);
              nextCommand.y1 += pattern.unZoomed(deltaY);
            }

            segment.update();
            segment.nextSegment?.update();
            segment.previousSegment?.update();
          }
        }

        // Update visible control point handlers if they exist
        if (this.currentSegment && this.currentSegment.command instanceof CCommand) {
          // Update control point positions based on the new command values
          if (this.control1) {
            this.control1.x = this.zoomed((this.currentSegment.command as CCommand).x1);
            this.control1.y = this.zoomed((this.currentSegment.command as CCommand).y1);
            this.control1.update();
          }
          if (this.control2) {
            this.control2.x = this.zoomed((this.currentSegment.command as CCommand).x2);
            this.control2.y = this.zoomed((this.currentSegment.command as CCommand).y2);
            this.control2.update();
          }
        }
      }

      //tracking dragging distance
      if (this.isDraggingMultiple || surfaceManager.globalIsDraggingMultiple) {
            if (!this.dragDistanceText) {
                const style = new TextStyle({
                    fontFamily: 'Arial',
                    fontSize: 14,
                    fill: '#000000',
                    stroke: '#ffffff',

                });
                this.dragDistanceText = new Text('', style);
                this.dragDistanceText.anchor.set(0.5);
                surfaceManager.currentSurface._app.stage.addChild(this.dragDistanceText as any);
            }

            const dx = event.x - this.dragStartPoint.x;
            const dy = event.y - this.dragStartPoint.y;
            const distanceInPixels = Math.sqrt(dx * dx + dy * dy);
            const distanceInMm = distanceInPixels / surfaceManager.currentSurface.zoomFactor;

            const [convertedDistance, unit] = convertMm(distanceInMm, 'inches');

            this.dragDistanceText.text = `${convertedDistance.toFixed(2)} ${unit === 'Metric' ? 'mm' : 'in'}`;
            this.dragDistanceText.x = event.x + 20;
            this.dragDistanceText.y = event.y - 20;
            this.dragDistanceText.visible = true;
       }
/////////////////////////////////////////
        // Update visible control point handlers if they exist
        if (this.currentSegment && this.currentSegment.command instanceof CCommand) {
          // Update control point positions based on the new command values
          if (this.control1) {
            this.control1.x = this.zoomed((this.currentSegment.command as CCommand).x1);
            this.control1.y = this.zoomed((this.currentSegment.command as CCommand).y1);
            this.control1.update();
          }
          if (this.control2) {
            this.control2.x = this.zoomed((this.currentSegment.command as CCommand).x2);
            this.control2.y = this.zoomed((this.currentSegment.command as CCommand).y2);
            this.control2.update();
          }
        }

    }},

    { name: 'onMouseUp_edition', body: function (this: _Pattern & TEditionPattern, event: { x: number, y: number }) {
      const mainPattern = this._parentPattern || this;

       ///////////////////tracking dragging distance
      if (this.dragDistanceText) {
          this.dragDistanceText.visible = false; 0+6 ;
      }
      this.dragStartPoint = null;
      
      // Record undo/redo action after multi-selection node editing
      if ((this as any)._stateBeforeNodeEdit) {
        // For subpatterns, capture and record using the parent pattern instead
        const targetPattern = this._parentPattern || this;
        const stateAfter = undoRedoManager.capturePatternState(targetPattern._guid);
        
        if (stateAfter) {
          undoRedoManager.recordPatternAction({
            type: 'edit_nodes',
            patternGuid: targetPattern._guid,
            beforeState: (this as any)._stateBeforeNodeEdit,
            afterState: stateAfter,
            metadata: {}
          });
        }
        
        delete (this as any)._stateBeforeNodeEdit;
      }
//////////////////////////////////////////////////
      // Only main pattern handles selection completion
      if (mainPattern === this && this.isSelecting && this.selectionStart && this.selectionEnd) {
        // Get all patterns in edition mode
        const allPatterns: (_Pattern & TEditionPattern)[] = [this];
        this.subPatterns.forEach(sp => {
          if (sp._state === 'edition') {
            allPatterns.push(sp as _Pattern & TEditionPattern);
          }
        });

        // Each pattern selects its own handlers within the rectangle
        allPatterns.forEach(pattern => {
          pattern.selectHandlersInRect_edition();
        });

        this.isSelecting = false;

        // Clear selection graphics
        if (this.selectionGraphics) {
          this.selectionGraphics.clear();
        }

        // Re-enable all handlers
        allPatterns.forEach(pattern => {
          pattern.handlerList.forEach(handler => {
            handler.setInteractivity(true);
          });
        });
      } else {
        // Sub-patterns just re-enable their handlers
        this.handlerList.forEach(handler => {
          handler.setInteractivity(true);
        });
      }

      // Re-enable anchor lines for selected handlers after drag ends
      if (surfaceManager.globalIsDraggingMultiple) {
        surfaceManager.globalSelectedHandlers.forEach(item => {
          item.handler.disableAnchorLine = false;
          item.handler.update();
        });
        
        // Record undo/redo actions for all affected patterns
        if ((surfaceManager as any)._globalDragStates) {
          const states = (surfaceManager as any)._globalDragStates as Map<string, any>;
          
          states.forEach((beforeState, guid) => {
            const afterState = undoRedoManager.capturePatternState(guid);
            if (afterState) {
              undoRedoManager.recordPatternAction({
                type: 'edit_nodes',
                patternGuid: guid,
                beforeState: beforeState,
                afterState: afterState,
                metadata: {
                  action: 'mouse_drag',
                  // Store info about which subpatterns were moved for proper restoration
                  movedSubpatterns: surfaceManager.globalSelectedHandlers
                    .filter(item => item.pattern._parentPattern && item.pattern._parentPattern._guid === guid)
                    .map(item => item.pattern._guid)
                }
              });
            }
          });
          
          delete (surfaceManager as any)._globalDragStates;
          
          // Save immediately after recording all undo/redo actions
          surfaceManager.saveSlectedSurface();
        }
      }

      surfaceManager.globalIsDraggingMultiple = false;
      surfaceManager.globalMultiDragStart = null;



    }},

    { name: 'drawSelectionRect_edition', body: function (this: _Pattern & TEditionPattern) {
      if (!this.selectionGraphics || !this.selectionStart || !this.selectionEnd) return;

      const g = this.selectionGraphics;
      g.clear();

      const x = Math.min(this.selectionStart.x, this.selectionEnd.x);
      const y = Math.min(this.selectionStart.y, this.selectionEnd.y);
      const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
      const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);

      g.setStrokeStyle({ width: 1, color: 0x00FFFF, alpha: 0.8 });
      g.setFillStyle({ color: 0x00FFFF, alpha: 0.1 });
      g.rect(x, y, width, height);
      g.stroke();
      g.fill();
    }},

    { name: 'selectHandlersInRect_edition', body: function (this: _Pattern & TEditionPattern) {
      // Get the main pattern's selection bounds
      const mainPattern = (this._parentPattern || this) as _Pattern & TEditionPattern;
      if (!mainPattern.selectionStart || !mainPattern.selectionEnd) return;

      // Calculate selection rectangle in screen space
      const mainPatternPos = mainPattern.getAbsolutePosition();
      const minScreenX = mainPatternPos.x + Math.min(mainPattern.selectionStart.x, mainPattern.selectionEnd.x);
      const minScreenY = mainPatternPos.y + Math.min(mainPattern.selectionStart.y, mainPattern.selectionEnd.y);
      const maxScreenX = mainPatternPos.x + Math.max(mainPattern.selectionStart.x, mainPattern.selectionEnd.x);
      const maxScreenY = mainPatternPos.y + Math.max(mainPattern.selectionStart.y, mainPattern.selectionEnd.y);

      // Get this pattern's absolute position
      const patternPos = this.getAbsolutePosition();

      // Select handlers within rectangle from this pattern
      this.handlerList.forEach(handler => {
        // Convert handler position to screen space
        const handlerScreenX = patternPos.x + handler.position.x;
        const handlerScreenY = patternPos.y + handler.position.y;

        if (handlerScreenX >= minScreenX && handlerScreenX <= maxScreenX &&
            handlerScreenY >= minScreenY && handlerScreenY <= maxScreenY) {
          // Add to global selection
          surfaceManager.globalSelectedHandlers.push({
            pattern: this as typeof Pattern,
            handler: handler
          });
          // Visual feedback - change handler color
          handler.setColor(0x00FFFF);
          // Disable anchor lines for selected handlers
          handler.disableAnchorLine = true;
          handler.update();
        }
      });
    }},

    { name: 'clearSelection_edition', body: function (this: _Pattern & TEditionPattern) {
      // Reset handler colors and re-enable anchor lines for this pattern
      this.handlerList.forEach(handler => {
        // Check if this handler was selected
        const wasSelected = surfaceManager.globalSelectedHandlers.some(
          item => item.pattern === this && item.handler === handler
        );
        if (wasSelected) {
          handler.setColor(HANLDER_COLOR);
          handler.disableAnchorLine = false;
          handler.update();
        }
      });

      // Remove this pattern's handlers from global selection
      surfaceManager.globalSelectedHandlers = surfaceManager.globalSelectedHandlers.filter(
        item => item.pattern !== this
      );
    }},
  ]
});

