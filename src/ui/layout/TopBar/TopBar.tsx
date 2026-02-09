/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { systemDesign } from "../../SystemDesign";
import { TIcon } from "../../../ui/controls/icons/TIcon";
import { curProjectId, currentPatternSelection, mapToArray, mapToArray2, searchResults, sFetch } from "../../../uof/Globals";
import { ppConfirm, ppInfo, ppPrompt, ppSaveChoice } from "../../../ui/controls/popup/Popup";
import { boardManager } from "../../..//cutboard/BoardManager";
import { _boardEvts, _evtBus, _evts } from "../../../core/EventBus";
import { getUow } from "../../../uof/UnitOfWork";
import { surfaceManager } from "../../../Graphics/SurfaceManager";
import { liveConfig } from "../../../core/LiveConfig";
import { VectorPath } from "../../../VectorPath/VectorPath";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";
import { ButtonBar } from "../../controls/buttons/ButtonBar";
import { Pattern } from "../../../Pattern/Pattern";
import { guid } from "../../../core/Guid";
import { waitForMs } from "../../../core/Dom";
import { GeometryPopup } from "../../controls/GeometryPopup/GeometryPopup";
import { AnnotationPopup } from "../../controls/AnnotationPopup/AnnotationPopup";
import { ShortcutsPopup } from "../../controls/shortcutsPopup/ShortcutsPopup";
import { MirroringPopup } from "../../controls/MirroringPopup/MirroringPopup";
import { RulerPopup } from "../../controls/RulerPopup/RulerPopup";
import { MainFrame } from "../Frame";
import { RollSelectionPopup } from "../../controls/RollSelectionPopup/RollSelectionPopup";
import { createExternalOutwardPolygon } from "../../../outward/_Outward";
import { TEditionPattern } from "../../../Pattern/Extentions/PatternEdition";
import { TWrapPattern } from "../../../Pattern/Extentions/PatternWrap";
import { _Pattern } from "../../../Pattern//Pattern";
import "../../../utils/css/topbar.css";
import { annotationPopup } from "../../controls/AnnotationPopup/AnnotationPopup";
import { UndoRedoManager, PatternAction, undoRedoManager } from '../../../core/UndoRedoManager';
import { toastSuccess, toastError, toastInfo, toastWarning } from '../../controls/Toast/Toast';
import { segmentManager } from '../../../Pattern/SegmentManager';


export class TopBar extends BaseComponent {
  isMaximized: boolean = false;
  isExpanded: boolean = false;
  isVisible: boolean = false;
   activeCurveMode: 'symmetrical' | 'smooth' | 'normal' = 'normal';
  isFocalPivotMode: boolean = false;
  hasBikiniPattern: boolean = false; // Track if there's a pattern in bikini mode

  constructor() {
    super("TopBar");
    this.registerTemplate("default",_default);
    this.registerDependencyProperties(["isExpanded", "isVisible", "activeCurveMode", "isFocalPivotMode", "hasBikiniPattern"]);

    _evtBus.on(_evts.ButtonBar.Click, (payload: { name: string }) => {
      this.isVisible = payload.name === "cut-board";
      if (this.isVisible) {
        this.isExpanded = true;
      }
      this.updateBikiniState();
      this.update();
    });

    // Update bikini state periodically to catch state changes
    setInterval(() => {
      this.updateBikiniState();
    }, 100);
  }

  updateBikiniState() {
    const surface = surfaceManager.currentSurface;
    const bikiniPattern = surface?._Patterns.find(p => p._state === "bikini");
    const newHasBikini = !!bikiniPattern;
    if (this.hasBikiniPattern !== newHasBikini) {
      this.hasBikiniPattern = newHasBikini;
      this.update();
    }
  }
}

// Helper function to check if multiple patterns are selected
const checkMultiplePatternsSelected = (surface: any): boolean => {
  // Get all selected patterns (excluding nested paths)
  const selectedPatterns = surface._Patterns.filter((p: any) => p._state === 'selected' && !p._parentPattern);
  return selectedPatterns.length > 1;
};

// Helper function to check if multiple nested paths are selected
const checkMultipleNestedPathsSelected = (surface: any): boolean => {
  // Get all selected nested paths (patterns with a parent)
  const selectedNestedPaths = surface._Patterns.filter((p: any) => p._state === 'selected' && p._parentPattern);
  // Also check multiSelection for nested paths
  const multiSelectedNestedPaths = surface.multiSelection.filter((p: any) => p._parentPattern && p._state === 'selected');
  // Use Set to avoid duplicates and check if total unique nested paths > 1
  const uniqueNestedPaths = new Set([...selectedNestedPaths.map((p: any) => p._guid), ...multiSelectedNestedPaths.map((p: any) => p._guid)]);
  return uniqueNestedPaths.size > 1;
};

// Helper function to check if focal pivot mode is active and block action
const checkFocalPivotBlock = (): boolean => {
  if (surfaceManager.focalPivotModeEnabled) {
    toastWarning("Exit focal pivot mode first");
    return true;
  }
  return false;
};

const _default: TRenderHandler = ($this:TopBar) => {
    if (!$this.isVisible) {
    return <></>;
  }
  return <>
    <div class="top-bar">
     

      {/* Edit Group */}
      <div class="top-bar-group">
        <span class="top-bar-group-title">Edit</span>
{tbItem("tb-undo", "Undo", () => {
  if (checkFocalPivotBlock()) return;
  const action = undoRedoManager.undo();
  if (action) {
    undoRedoManager.applyPatternAction(action, true);
    toastSuccess("Undo completed", 1500);
  } else {
    toastInfo("Nothing to undo", 1500);
  }

}, false, "Revert the last action")}
{tbItem("tb-redo", "Redo", () => {
  if (checkFocalPivotBlock()) return;
  const action = undoRedoManager.redo();
  if (action) {
    undoRedoManager.applyPatternAction(action, false);
    toastSuccess("Redo completed", 1500);
  } else {
    toastInfo("Nothing to redo", 1500);
  }
 
}, false, "Repeat the last undone action")}

        {tbItem("tb-copy", "Copy", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          const selectedPatterns = surface._Patterns.filter(p => p._state === 'selected');
          if (selectedPatterns.length === 0) {
            toastWarning("Select a pattern to copy");
            return;
          }
          surfaceManager.copySelectedPatterns();
        }, false, "Copy selected patterns to clipboard")}
        {tbItem("tb-paste", "Paste", () => {
          if (checkFocalPivotBlock()) return;
          surfaceManager.initiatePaste();
        }, false, "Paste patterns from clipboard")}
      </div>

      {/* View Group */}
      <div class="top-bar-group">
        <span class="top-bar-group-title">Zoom</span>
        {tbItem("tb-zoom-in", "In", () => {
 
          if ((window as any).noAction === true) return;
          const surface = surfaceManager.currentSurface!;
          let newScale = surface.zoomFactor * Math.exp(1 * 0.3);
          newScale = Math.max(0.1, Math.min(100, newScale));
          if (newScale > 100) {
            newScale = 100;
          }
          surface.zoomFactor = newScale;
          surface.display();
        }, false, "Zoom in to see details")}
        {tbItem("tb-zoom-out", "Out", () => {
       
          if ((window as any).noAction === true) return;
          const surface = surfaceManager.currentSurface!;
          let newScale = surface.zoomFactor / Math.exp(1 * 0.3);
          newScale = Math.max(0.1, Math.min(100, newScale));
          if (newScale < 0.1) {
            newScale = 0.1;
          }
          surface.zoomFactor = newScale;
          surface.display();
        }, false, "Zoom out to see more area")}
      </div>
      
      {/* Arrange Group */}
      <div class="top-bar-group">
        <span class="top-bar-group-title">Arrange</span>
        {tbItem("tb-rotate", "Rotate", async () => {
          if ((window as any).noAction === true) return;
          const surface = surfaceManager.currentSurface!;
          const selected = surface._Patterns.find(p => p._state === "selected");
          const pivotPoint = surface.getCustomPivotPoint();
          
          // Store before states for undo/redo
          const beforeStates: Map<string, any> = new Map();
          
          if (surface.multiSelection.length > 0) {
            // Check if any nested paths are selected
            const hasNestedPathSelected = surface.multiSelection.some((pattern) => 
              pattern._state === 'selected' && pattern._parentPattern
            );
            
            if (hasNestedPathSelected) {
              return; // Prevent rotation if nested paths are selected
            }
            
            // Capture before states for all multi-selected patterns
            surface.multiSelection.forEach((pattern) => {
              if (pattern._state === 'selected') {
                const beforeState = undoRedoManager.capturePatternState(pattern._guid);
                if (beforeState) {
                  beforeStates.set(pattern._guid, beforeState);
                }
              }
            });
            
            // Perform rotation
            const selectedPatterns = surface.multiSelection.filter(pattern => pattern._state === 'selected');
            if (selectedPatterns.length === 0) {
              return;
            }

            const points = selectedPatterns.map(pattern => ({
              x: pattern.zCtx,
              y: pattern.zCty
            }));

            const rotationCenter = pivotPoint ?? surface.getCenterPoint(points);

            selectedPatterns.forEach((pattern) => {
              pattern._rotation += liveConfig._rotation;
              pattern.applyTransformations({ rotate: true, translate: false });
              // Only move pattern center if there's a pivot point (same as Ctrl+mouse wheel)
              if (pivotPoint) {
                const finalRotation = surface.getRotatedPosition({
                  x: pattern.zCtx,
                  y: pattern.zCty
                }, rotationCenter, liveConfig._rotation);
                pattern.zCtx = finalRotation.x;
                pattern.zCty = finalRotation.y;
              }
              pattern.display();
            });
            
            // Record undo/redo actions and save
            beforeStates.forEach((beforeState, patternGuid) => {
              const afterState = undoRedoManager.capturePatternState(patternGuid);
              if (afterState) {
                undoRedoManager.recordPatternAction({
                  type: 'rotate',
                  patternGuid: patternGuid,
                  beforeState: beforeState,
                  afterState: afterState,
                  metadata: {}
                });
              }
            });
            
            // Save to data layer
            surfaceManager.saveSlectedSurface();
            return;
          }
          
          if (selected) {
            // Prevent rotation if nested path is selected
            if (selected._parentPattern) {
              return; // Prevent rotation if nested path is selected
            }
            
            // Capture before state for single selected pattern
            const beforeState = undoRedoManager.capturePatternState(selected._guid);
            
            // Perform rotation
            const currentCenter = { x: selected.zCtx, y: selected.zCty };
            selected._rotation += liveConfig._rotation;
            selected.applyTransformations({ rotate: true, translate: false });
            if (pivotPoint) {
              const finalRotation = surface.getRotatedPosition(
                currentCenter,
                pivotPoint,
                liveConfig._rotation
              );
              selected.zCtx = finalRotation.x;
              selected.zCty = finalRotation.y;
            }
            selected.display();
            
            // Record undo/redo action and save
            if (beforeState) {
              const afterState = undoRedoManager.capturePatternState(selected._guid);
              if (afterState) {
                undoRedoManager.recordPatternAction({
                  type: 'rotate',
                  patternGuid: selected._guid,
                  beforeState: beforeState,
                  afterState: afterState,
                  metadata: {}
                });
              }
            }
            
            // Save to data layer
            surfaceManager.saveSlectedSurface();
          }
        }, false, "Rotate selected patterns")}
        {tbItem("tb-pivot", "Focal Pivot", () => {
          if (!surfaceManager.currentSurface) {
            toastWarning("Load a board before setting a focal point");
            return;
          }

          if (surfaceManager.focalPivotModeEnabled) {
            surfaceManager.disableFocalPivotMode();
          } else {
            const enabled = surfaceManager.enableFocalPivotMode();
            if (!enabled) {
              return;
            }
          }

          $this.isFocalPivotMode = surfaceManager.focalPivotModeEnabled;
          $this.update();
        }, surfaceManager.focalPivotModeEnabled, "Place a custom rotation center")}
        {tbItem("tb-group", "Group", () => {
          if (checkFocalPivotBlock()) return;
          const selectedPatterns = surfaceManager.currentSurface._Patterns.filter(p => p._state === 'selected');
          if (selectedPatterns.length >= 2) {
            surfaceManager.groupPatterns(selectedPatterns);
          } else {
            toastWarning("Select at least 2 patterns to group");
          }
        }, false, "Group selected patterns together")}
        {tbItem("tb-ungroup", "Ungroup", async () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          
          // Get all selected nested paths (from multiSelection)
          const selectedNestedPaths = surface.multiSelection.filter(p => p._parentPattern && p._state === 'selected');
          
          if (selectedNestedPaths.length > 0) {
            // Handle multiple nested path ungroup
            // Group by parent pattern to handle index shifting correctly
            const nestedPathsByParent = new Map<typeof Pattern, typeof Pattern[]>();
            
            selectedNestedPaths.forEach(nestedPath => {
              const parent = nestedPath._parentPattern! as typeof Pattern;
              if (!nestedPathsByParent.has(parent)) {
                nestedPathsByParent.set(parent, []);
              }
              nestedPathsByParent.get(parent)!.push(nestedPath);
            });
            
            // Process each parent's nested paths in reverse index order
            // (highest index first to avoid index shifting issues)
            for (const [parent, nestedPaths] of nestedPathsByParent.entries()) {
              // Sort by index in reverse order (highest index first)
              nestedPaths.sort((a, b) => {
                const indexA = parent.subPatterns.indexOf(a);
                const indexB = parent.subPatterns.indexOf(b);
                return indexB - indexA; // Reverse order
              });
              
              // Ungroup each nested path
              for (const nestedPath of nestedPaths) {
                await surfaceManager.ungroupPatterns(nestedPath);
              }
            }
            
            if (selectedNestedPaths.length > 1) {
              toastSuccess(`Ungrouped ${selectedNestedPaths.length} nested paths`, 2000);
            }
            return;
          }
          
          // Check for multiple main pattern selection (not nested paths)
          if (checkMultiplePatternsSelected(surface)) {
            toastWarning("Please select only one pattern");
            return;
          }
          
          // Fall back to main pattern selection
          const selectedPattern = surface._Patterns.find(p => p._state === 'selected' || p._state === 'edition') || null;
          
          if (selectedPattern) {
            await surfaceManager.ungroupPatterns(selectedPattern);
          } else {
            toastWarning("Select a group to ungroup");
          }
        }, false, "Separate grouped patterns")}
        {tbItem('tb-mirror', "Mirror", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          
          // Check if a pattern is selected
          const selectedPattern = surface._Patterns.find(p => p._state === 'selected');
          if (!selectedPattern) {
            toastWarning("Select a pattern to mirror");
            return;
          }
          
          // Show mirroring popup
          const mainFrame = getUow<MainFrame>("mainFrame");
          let mirroringPopup = mainFrame.children.find(c => c instanceof MirroringPopup) as MirroringPopup;
          
          if (!mirroringPopup) {
            mirroringPopup = new MirroringPopup();
            mainFrame.children.push(mirroringPopup);
          }
          
          mirroringPopup.toggle();
          mainFrame.update();
         }, false, "Create mirrored copy of pattern")}
        {tbItem('tb-align-center', "Align Center", () => {
          if (checkFocalPivotBlock()) return;
          surfaceManager.alignPatternsByCenter();
        }, false, "Align two patterns by their centers")}
      </div>
      
      {/* Modify Group */}
      <div class="top-bar-group">
        <span class="top-bar-group-title">Modify</span>
        {tbItem("tb-nodes", "Nodes", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface!;
          
          // Check for multiple pattern selection
          if (checkMultiplePatternsSelected(surface)) {
            toastWarning("Please select only one pattern");
            return;
          }
          
          let selected = surface._Patterns.find(p => p._state === "edition");
          if (selected) {
            // Before exiting edit mode, complete any pending drag operations
            // This prevents losing changes when clicking the button after dragging
            if ((selected as any).onMouseUp_edition) {
              const hasUnsavedEdits = (selected as any)._stateBeforeNodeEdit;
              const isDraggingMultiple = surfaceManager.globalIsDraggingMultiple || 
                                          (selected as any).isDraggingMultiple ||
                                          (selected as any).isSelecting;
              
              if (isDraggingMultiple || hasUnsavedEdits) {
                // Get mouse position (use center of canvas if we can't determine)
                const canvas = surface._app.canvas;
                const rect = canvas.getBoundingClientRect();
                (selected as any).onMouseUp_edition({
                  x: rect.width / 2,
                  y: rect.height / 2
                });
                
                // Also handle sub-patterns
                selected.subPatterns.forEach(subPattern => {
                  const subHasUnsavedEdits = (subPattern as any)._stateBeforeNodeEdit;
                  if (subPattern._state === 'edition' && subHasUnsavedEdits && (subPattern as any).onMouseUp_edition) {
                    (subPattern as any).onMouseUp_edition({
                      x: rect.width / 2,
                      y: rect.height / 2
                    });
                  }
                });
              }
            }
            
            selected.setState("");
            surface._isEditing = false;
            waitForMs(100).then(() => {
              surfaceManager.currentSurface!.selectionBox!.isSelecting = false;
            });
            return;
          }
          
          // Find selected pattern
          selected = surface._Patterns.find(p => p._state === "selected");
          if (selected) {
            // Exit ALL patterns from edition mode first (enforce single edit mode)
            surface._Patterns.forEach((pattern) => {
              if (pattern._state === "edition") {
                (pattern as any).originalPath = "";
                pattern.setState("");
                
                // Also exit any subpatterns in edition mode
                pattern.subPatterns.forEach(subPattern => {
                  if (subPattern._state === "edition") {
                    (subPattern as any).originalPath = "";
                    subPattern.setState("");
                  }
                });
              }
            });
            
            // Now enter only the selected pattern into edition mode
            selected.setState("edition");
            surface._isEditing = true;
            toastInfo("Hold Ctrl + Click & Drag to select multiple nodes", 4000);
          }
        }, false, "Edit pattern nodes and curves")}

        {tbItem("tb-weld" , "Weld", () =>{
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface!;
          
          // Get selected patterns (either from multiSelection or find selected patterns)
          const selectedPatterns = surface.multiSelection.length > 0 
            ? surface.multiSelection 
            : surface._Patterns.filter(p => p._state === "selected");
          
          // Check if we have exactly 2 patterns
          if (selectedPatterns.length !== 2) {
            toastWarning("Select exactly 2 patterns to weld");
            return;
          }
          
          // Call weld function
          surfaceManager.weldPatterns(selectedPatterns[0], selectedPatterns[1]);
         }, false, "Join two patterns together")}
         {tbItem("tb-partial-wrap", "Partial Wrap", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface!;
          
          // Check for multiple pattern selection
          if (checkMultiplePatternsSelected(surface)) {
            toastWarning("Please select only one pattern");
            return;
          }
          
          const inWrap = surface._Patterns.find(p => p._state === "wrap") as typeof Pattern & TWrapPattern;
          if (inWrap) {
            // Clean up wrap points (same as ESC key handler)
            if (inWrap.wrapPoint1 || inWrap.wrapPoint2) {
              inWrap.wrapPoint1 = null;
              inWrap.wrapPoint2 = null;
              inWrap.wrapDistance1 = 0;
              inWrap.wrapDistance2 = 0;
              inWrap.wrapSeg1Idx = -1;
              inWrap.wrapSeg2Idx = -1;
            }
            // Hide point selection
            if (surface.pointSelection) {
              surface.pointSelection.visible = false;
            }
            // Deactivate wrap mode
            surface.activationWrap = false;
            // Reset pattern state
            inWrap.setState("");
            // Refresh display
            inWrap.display();
          }
          const selected = surface._Patterns.find(p => p._state === "selected");
          if (selected) {
            selected.setState("wrap");
            surface.activationWrap = true;
          } else {
            toastWarning("Select a pattern for partial wrap");
          }
        }, false, "Create partial wrap around pattern")}
        {tbItem("tb-bump", "Bump", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface!;
          
          // Toggle segment mode
          if (segmentManager.isActive()) {
            // Deactivate segment mode
            segmentManager.deactivate();
            toastInfo("Segment mode deactivated");
          } else {
            // Check for multiple pattern selection
            if (checkMultiplePatternsSelected(surface)) {
              toastWarning("Please select only one pattern");
              return;
            }
            
            // Find selected pattern
            const selected = surface._Patterns.find(p => p._state === "selected");
            if (selected) {
              // Clear selection state to remove blue overlay
              selected.setState('');
              
              // Activate segment mode on the selected pattern
              segmentManager.activate(selected);
              toastInfo("Click segments to select, then use arrows to move them");
            } else {
              toastWarning("Select a pattern to enter segment mode");
            }
          }
        }, false, "Edit pattern segments individually")}
        {tbItem("tb-outward", "Outward", async () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          
          // Check for multiple pattern selection
          if (checkMultiplePatternsSelected(surface)) {
            toastWarning("Please select only one pattern");
            return;
          }
          
          // Check for multiple nested path selection
          if (checkMultipleNestedPathsSelected(surface)) {
            toastWarning("Please select only one nested path");
            return;
          }
          
          let targetPattern: (_Pattern & TEditionPattern) | null = null;
          const editionPattern = surface._Patterns.find(p => p._state === "edition") as (_Pattern & TEditionPattern);
        
          if (editionPattern) {
              for (const subPattern of editionPattern.subPatterns as (_Pattern & TEditionPattern)[]) {
                  const subPatternHandlers = subPattern.handlerList;
                  // Check if ALL handlers of this subpattern are selected (regardless of what else is selected)
                  if (subPatternHandlers.length > 0 &&
                      subPatternHandlers.every(h => surfaceManager.globalSelectedHandlers.some(sh => sh.handler === h && sh.pattern === subPattern))) {
                      targetPattern = subPattern;
                      break; // Found a fully selected subpattern
                  }
              }
          }
        
          // Check for nested path selected via Shift+Click (has _parentPattern and _state === 'selected')
          if (!targetPattern) {
              // First check multiSelection for nested paths
              const selectedNestedPaths = surface.multiSelection.filter(p => p._parentPattern && p._state === 'selected');
              
              // Verify only one nested path is selected
              if (selectedNestedPaths.length > 1) {
                  toastWarning("Please select only one nested path for outward operation");
                  return;
              }
              
              if (selectedNestedPaths.length === 1) {
                  targetPattern = selectedNestedPaths[0] as (_Pattern & TEditionPattern);
              } else {
                  // Fall back to main pattern selection
                  targetPattern = surface._Patterns.find(p => p._state === "selected" && !p._parentPattern) as (_Pattern & TEditionPattern);
              }
          }
        
          if (targetPattern) {
              // Check if this is a nested path (selected via Shift+Click)
              if (targetPattern._parentPattern) {
                  // Handle nested path outward operation
                  const parentPattern = targetPattern._parentPattern;
                  const nestedIndex = parentPattern.subPatterns.indexOf(targetPattern);
                  
                  if (nestedIndex === -1) {
                      toastWarning("Could not find nested path in parent pattern");
                      return;
                  }
                  
                  // Capture state before outward operation for undo/redo
                  const beforeState = undoRedoManager.capturePatternState(parentPattern._guid);
                  
                  const wrapValue = liveConfig.unitOfMeasure === 3
                      ? liveConfig.wrapDistance * 25.4
                      : liveConfig.wrapDistance;
                  
                  // Get the current nested path
                  const oldNestedPath = targetPattern._vector.generatePathString();
                  
                  // Create the outward path
                  const newOutwardPath = createExternalOutwardPolygon(oldNestedPath, wrapValue);
                  
                  // Update the nested path's vector
                  const newVector = new VectorPath();
                  newVector.parse(newOutwardPath);
                  newVector.normalize(true);
                  
                  // Apply the parent's translation offset
                  const parentOriginalPos = parentPattern._vector.originalPosition;
                  newVector.translate(-parentOriginalPos.x, -parentOriginalPos.y);
                  newVector["_originalPosition"] = {
                      x: parentOriginalPos.x,
                      y: parentOriginalPos.y
                  };
                  
                  // Update the nested path
                  targetPattern._vector = newVector;
                  targetPattern._polyHit.setPath(newVector.generatePathString());
                  
                  // Update the parent pattern's paths array
                  parentPattern._vector.paths[nestedIndex] = newVector.generatePathString();
                  
                  // Update the nested path's display
                  targetPattern.setState('');
                  targetPattern.display();
                  
                  // Update parent pattern display
                  parentPattern.display();
                  
                  // Update parent pattern's data in surfaceCollection
                  const parentPatternData = surfaceCollection.selectedSurfaceData.getPattern(parentPattern._guid);
                  if (parentPatternData) {
                      parentPatternData.paths = [
                          parentPattern._vector.generatePathString(),
                          ...parentPattern.subPatterns.map(p => p._vector.generatePathString())
                      ];
                      surfaceCollection.selectedSurfaceData.setPattern(parentPatternData);
                  }
                  
                  // Capture state after outward operation and record for undo/redo
                  const afterState = undoRedoManager.capturePatternState(parentPattern._guid);
                  
                  if (beforeState && afterState) {
                      undoRedoManager.recordPatternAction({
                          type: 'outward',
                          patternGuid: parentPattern._guid,
                          beforeState: beforeState,
                          afterState: afterState,
                          metadata: { wrapValue: wrapValue, nestedPathIndex: nestedIndex }
                      });
                  }
                  
                  surfaceManager.saveSlectedSurface();
                  surfaceManager.currentSurface!.selectionBox!.isSelecting = false;
                  
              } else {
                  // Handle main pattern outward operation (existing code)
                  // For subpatterns, use parent pattern's GUID for undo/redo
                  const capturePattern = targetPattern._parentPattern || targetPattern;
                  
                  // Capture state before outward operation for undo/redo
                  const beforeState = undoRedoManager.capturePatternState(capturePattern._guid);
                  
                  const wrapValue = liveConfig.unitOfMeasure === 3
                      ? liveConfig.wrapDistance * 25.4
                      : liveConfig.wrapDistance;
                  
                  // 1. Capture all current data before modification
                  const oldGuid = targetPattern._guid;
                  const oldMainPath = targetPattern._vector.generatePathString();
                  const oldSubPaths = targetPattern.subPatterns.map(p => p._vector.generatePathString());
                  const oldRotation = targetPattern._rotation;
                  const oldUnzoomedX = targetPattern.unZoomed(targetPattern.x);
                  const oldUnzoomedY = targetPattern.unZoomed(targetPattern.y);
                  const oldOriginalPos = targetPattern._vector.originalPosition;
                  const baseX = oldUnzoomedX - oldOriginalPos.x;
                  const baseY = oldUnzoomedY - oldOriginalPos.y;
                  const isGroup = targetPattern.isGroup;
                  
                  // 2. Create the outward path
                  const newOutwardPath = createExternalOutwardPolygon(oldMainPath, wrapValue);
                  
                  // 3. Determine nested paths based on double cut setting
                  let nestedPaths: string[] = [];
                  if (liveConfig.doubleCut) {
                      // For double cut: old main path becomes first nested path, then any existing subpaths
                      nestedPaths = [oldMainPath, ...oldSubPaths];
                  } else {
                      // For single cut: just preserve existing subpaths
                      nestedPaths = oldSubPaths;
                  }
                  
                  // 4. Remove the old pattern
                  surface.removePattern(targetPattern as typeof Pattern);
                  surfaceCollection.selectedSurfaceData.removePattern(oldGuid);
                  
                  // 5. Create new pattern using proper addPath flow (like mirror/paste do)
                  const newPattern = surface.addPath(newOutwardPath, {
                      guid: oldGuid,
                      nestedPaths: nestedPaths,
                      noNormilize: false, // Force normalization
                  });
                  
                  // 6. Set position and rotation
                  const newOriginalPos = newPattern._vector.originalPosition;
                  newPattern.x = newPattern.zoomed(baseX + newOriginalPos.x);
                  newPattern.y = newPattern.zoomed(baseY + newOriginalPos.y);
                  newPattern._rotation = oldRotation;
                  newPattern._vectorRotation = oldRotation; // Sync both rotation values
                  newPattern.isGroup = isGroup;
                  
                  // 7. Call display() first to create subpatterns via initializeNestedPatterns()
                  newPattern.display();
                  
                  // 8. NOW sync rotation to subpatterns (after they've been created by display)
                  newPattern.subPatterns.forEach(subPattern => {
                      subPattern._rotation = oldRotation;
                      subPattern._vectorRotation = oldRotation;
                  });
                  
                  // 9. Add the new pattern to the data layer
                  surfaceCollection.selectedSurfaceData.addPattern({
                      ...beforeState!, // Spread all properties from beforeState
                      guid: oldGuid,
                      paths: [newOutwardPath, ...nestedPaths],
                      boardPosition: { x: newPattern.x, y: newPattern.y },
                      boardAngle: newPattern._rotation,
                  });
                  
                  // 10. Clear any selection state
                  if (editionPattern && editionPattern.clearGlobalSelection_edition) {
                      editionPattern.clearGlobalSelection_edition();
                  }
                 
                  // 11. Capture state after outward operation and record for undo/redo
                  const afterState = undoRedoManager.capturePatternState(oldGuid);
                  
                  if (beforeState && afterState) {
                    undoRedoManager.recordPatternAction({
                      type: 'outward',
                      patternGuid: oldGuid,
                      beforeState: beforeState,
                      afterState: afterState,
                      metadata: { wrapValue: wrapValue }
                    });
                  }
                 
                 surfaceManager.saveSlectedSurface();
                  surfaceManager.currentSurface!.selectionBox!.isSelecting = false;
              }
              
          } else {
            toastWarning("Select a pattern for outward");
          }
         }, false, "Expand pattern outward")}
        {tbItem("tb-inward", "inward", async () => {
            if (checkFocalPivotBlock()) return;
            const surface = surfaceManager.currentSurface;
            if (!surface) return;
            
            // Check for multiple pattern selection
            if (checkMultiplePatternsSelected(surface)) {
              toastWarning("Please select only one pattern");
              return;
            }
            
            // Check for multiple nested path selection
            if (checkMultipleNestedPathsSelected(surface)) {
              toastWarning("Please select only one nested path");
              return;
            }
            
            let targetPattern: (_Pattern & TEditionPattern) | null = null;
            const editionPattern = surface._Patterns.find(p => p._state === "edition") as (_Pattern & TEditionPattern);
        
            if (editionPattern) {
                for (const subPattern of editionPattern.subPatterns as (_Pattern & TEditionPattern)[]) {
                    const subPatternHandlers = subPattern.handlerList;
                    // Check if ALL handlers of this subpattern are selected (regardless of what else is selected)
                    if (subPatternHandlers.length > 0 &&
                        subPatternHandlers.every(h => surfaceManager.globalSelectedHandlers.some(sh => sh.handler === h && sh.pattern === subPattern))) {
                        targetPattern = subPattern;
                        break; // Found a fully selected subpattern
                    }
                }
            }
        
            // Check for nested path selected via Shift+Click (has _parentPattern and _state === 'selected')
            if (!targetPattern) {
                // First check multiSelection for nested paths
                const selectedNestedPaths = surface.multiSelection.filter(p => p._parentPattern && p._state === 'selected');
                
                // Verify only one nested path is selected
                if (selectedNestedPaths.length > 1) {
                    toastWarning("Please select only one nested path for inward operation");
                    return;
                }
                
                if (selectedNestedPaths.length === 1) {
                    targetPattern = selectedNestedPaths[0] as (_Pattern & TEditionPattern);
                } else {
                    // Fall back to main pattern selection
                    targetPattern = surface._Patterns.find(p => p._state === 'selected' && !p._parentPattern) as (_Pattern & TEditionPattern);
                }
            }
        
            if (targetPattern) {
                // Check if this is a nested path (selected via Shift+Click)
                if (targetPattern._parentPattern) {
                    // Handle nested path inward operation
                    const parentPattern = targetPattern._parentPattern;
                    const nestedIndex = parentPattern.subPatterns.indexOf(targetPattern);
                    
                    if (nestedIndex === -1) {
                        toastWarning("Could not find nested path in parent pattern");
                        return;
                    }
                    
                    // Capture state before inward operation for undo/redo
                    const beforeState = undoRedoManager.capturePatternState(parentPattern._guid);
                    
                    const wrapValue = liveConfig.unitOfMeasure === 3
                        ? liveConfig.wrapDistance * 25.4
                        : liveConfig.wrapDistance;
                    
                    // Shrink the nested path's vector
                    targetPattern._vector.shrink(wrapValue);
                    
                    // Update the parent pattern's paths array
                    parentPattern._vector.paths[nestedIndex] = targetPattern._vector.generatePathString();
                    
                    // Update the nested path's display
                    targetPattern.setState('');
                    targetPattern.display();
                    
                    // Update parent pattern display
                    parentPattern.display();
                    
                    // Update parent pattern's data in surfaceCollection
                    const parentPatternData = surfaceCollection.selectedSurfaceData.getPattern(parentPattern._guid);
                    if (parentPatternData) {
                        parentPatternData.paths = [
                            parentPattern._vector.generatePathString(),
                            ...parentPattern.subPatterns.map(p => p._vector.generatePathString())
                        ];
                        surfaceCollection.selectedSurfaceData.setPattern(parentPatternData);
                    }
                    
                    // Capture state after inward operation and record for undo/redo
                    const afterState = undoRedoManager.capturePatternState(parentPattern._guid);
                    
                    if (beforeState && afterState) {
                        undoRedoManager.recordPatternAction({
                            type: 'inward',
                            patternGuid: parentPattern._guid,
                            beforeState: beforeState,
                            afterState: afterState,
                            metadata: { wrapValue: wrapValue, nestedPathIndex: nestedIndex }
                        });
                    }
                    
                    surfaceManager.saveSlectedSurface();
                    surfaceManager.currentSurface!.selectionBox!.isSelecting = false;
                    
                } else {
                    // Handle main pattern inward operation (existing code)
                    // For subpatterns, use parent pattern's GUID for undo/redo
                    const capturePattern = targetPattern._parentPattern || targetPattern;
                    
                    // Capture state before inward operation for undo/redo
                    const beforeState = undoRedoManager.capturePatternState(capturePattern._guid);
                    
                    const wrapValue = liveConfig.unitOfMeasure === 3
                        ? liveConfig.wrapDistance * 25.4
                        : liveConfig.wrapDistance;
                    targetPattern._vector.shrink(wrapValue);
                  //  targetPattern.setState("edition");
                   // targetPattern.display();
                    targetPattern.setState("");
                    targetPattern.display();
            
                    // FIX: Clear the global selection list to remove stale handlers
                    if (editionPattern && editionPattern.clearGlobalSelection_edition) {
                        editionPattern.clearGlobalSelection_edition();
                       //  targetPattern.setState("edition");
                  targetPattern.display();
                    }
                    
                    // Capture state after inward operation and record for undo/redo
                    const afterState = undoRedoManager.capturePatternState(capturePattern._guid);
                    
                    if (beforeState && afterState) {
                      undoRedoManager.recordPatternAction({
                        type: 'inward',
                        patternGuid: capturePattern._guid,
                        beforeState: beforeState,
                        afterState: afterState,
                        metadata: { wrapValue: wrapValue }
                      });
                    }
                   
                    surfaceManager.saveSlectedSurface();
                    surfaceManager.currentSurface!.selectionBox!.isSelecting = false;
                }
            } else {
              toastWarning("Select a pattern for inward");
            }
        }, false, "Shrink pattern inward")}
        {tbItem("tb-split", "Split", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface!;
          
          const inSplit = surface._Patterns.find(p => p._state === "split");
          if (inSplit) {
            surface.splitLine!.canBeUsed = false;
            (surface as any).splitLine!.splitPoint1 = null;
            (surface as any).splitLine!.splitPoint2 = null;
            surface.splitLine!.clear();
            inSplit._state = "";
            inSplit.display();
            return;
          }
          
          // Check for multiple pattern selection
          if (checkMultiplePatternsSelected(surface)) {
            toastWarning("Please select only one pattern");
            return;
          }
          
          const selected = surface._Patterns.find(p => p._state === "selected");
          if (selected) {
            selected.setState("split");  // Use setState() to properly clean up previous state
            surface.splitLine!.canBeUsed = true;
          } else {
            toastWarning("Select a pattern to split");
          }
        }, false, "Split pattern with line")}
        {tbItem("tb-bikini" , "Split Down/UP", () =>{
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface!;
          // Check if already in bikini mode - if so, exit it
          const inBikini = surface._Patterns.find(p => p._state === "bikini");
          if (inBikini) {
            inBikini.setState("");
            // Update TopBar to hide curved split option
            $this.updateBikiniState();
            return;
          }
          // Otherwise, enter bikini mode
          const selectedItem = surface._Patterns.find(p => p._state === "selected");
          if (selectedItem) {
            selectedItem.setState("bikini");
            // Update TopBar to show curved split option
            $this.updateBikiniState();
            return;
          } else {
            toastWarning("Select a pattern for split down/up");
          }
        }, false, "Split pattern vertically")}
        {tbItem('tb-remove-sub-patterns', "Sub Pattern", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          const pattern = surface!._Patterns.find(p => p._state === "selected");
          if (pattern) {
            // Capture state before removing subpatterns for undo/redo
            const beforeState = undoRedoManager.capturePatternState(pattern._guid);
            
            pattern.subPatterns.forEach((subPattern) => {
              subPattern.container.visible = false;
              subPattern.container.parent.removeChild(subPattern.container);
            });
            pattern.subPatterns.length = 0;
            pattern._vector.paths.length = 0;
            surfaceCollection.selectedSurfaceData.setPattern({
              boardAngle: pattern._rotation,
              boardPosition: { x: pattern.x, y: pattern.y },
              paths: [pattern._vector["_path"]],
              patternColor: "",
              patternId: pattern._guid,
              patternName: pattern.name,
              guid: pattern._guid || guid(),
            });
            
            // Capture state after removing subpatterns and record for undo/redo
            const afterState = undoRedoManager.capturePatternState(pattern._guid);
            
            if (beforeState && afterState) {
              undoRedoManager.recordPatternAction({
                type: 'edit_nodes',
                patternGuid: pattern._guid,
                beforeState: beforeState,
                afterState: afterState,
                metadata: { operation: 'remove_all_subpatterns' }
              });
            }
            
            surfaceManager.saveSlectedSurface();
            toastSuccess("Sub-patterns removed successfully", 2000);
          } else {
            toastWarning("Select a pattern to remove sub-patterns");
          }
        }, false, "Remove all sub-patterns")}
      </div>
       {/* File Group */}
      <div class="top-bar-group">
        <span class="top-bar-group-title">File</span>
        {tbItem("tb-save", "Save Board", async () => {
          if (checkFocalPivotBlock()) return;
          if (surfaceManager.currentSurface?._Patterns.length === 0) {
            toastWarning("No items on board to save");
            return;
          }
          const boardItems = surfaceManager.currentSurface?._Patterns.map(item => {
            return {
              zoomLevel: item.zoomFactor,
              angle: item._rotation,
              x: item.zCtx,
              y: item.zCty,
              originalPath: item.originalPath,
              normalizePaths: [item._vector["_path"], ...item._vector.paths],
              workingPaths: [item._vector["_path"], ...item._vector.paths],
              carColor: item._color,
              rawPattern: surfaceCollection.selectedSurfaceData.getPattern(item._guid)
            }
          }) as any;
          
          // Get annotations from the current board
          const annotations = surfaceManager.currentSurface?._Board?.annotations || 
                             boardManager.boards[boardManager.currentBoardIndex]?.annotations || 
                             [];
          
          // Create a structured board object that includes both items and annotations
          const boardData = {
            items: boardItems,
            annotations: annotations
          };
          
          const vecImg = btoa(JSON.stringify(boardData));
          
          // Check if this board was loaded from a saved board
          const currentSurfaceData = surfaceCollection.selectedSurfaceData;
          const savedBoardId = currentSurfaceData?.savedBoardId;
          const savedBoardName = currentSurfaceData?.savedBoardName;
          
          if (savedBoardId && savedBoardName) {
            // Board was loaded from saved boards - ask user what to do
            const choice = await ppSaveChoice(savedBoardName);
            
            if (choice === "cancel") {
              return;
            }
            
            if (choice === "update") {
              // Update existing board using PATCH
              const payload = {
                "board_id": savedBoardId,
                "vector_image": vecImg,
                "name": savedBoardName,
              } as any;
              
              try {
                await sFetch("userboard", "patch", payload, true);
                toastSuccess(`Board "${savedBoardName}" updated successfully!`, 4000);
              } catch (error: any) {
                toastError(`Failed to update board: ${error.message || 'Unknown error'}`, 4000);
              }
              return;
            }
            
            // choice === "new" - fall through to create new board
          }
          
          // Save as new board
          const name = await ppPrompt("Name your board", `My Board ${new Date().toLocaleDateString()}-${new Date().toLocaleTimeString()}`, "OK", "Cancel");
          if (!name) return;
          
          const payload = {
            "vector_image": vecImg,
            "name": name,
          } as any;
          if (curProjectId.id !== "") {
            payload["projectId"] = curProjectId.id;
          }
          try {
            await sFetch("userboard", "post", payload, true);
            // Clear the saved board reference since this is now a new board
            // This prevents subsequent saves from mistakenly updating the original board
            if (currentSurfaceData) {
              currentSurfaceData.savedBoardId = "";
              currentSurfaceData.savedBoardName = "";
            }
            toastSuccess("Board saved! View in 'Saved Boards'", 4000);
          } catch (error: any) {
            toastError(`Failed to save board: ${error.message || 'Unknown error'}`, 4000);
          }
        }, false, "Save current board layout")}
         {tbItem("tp-export_photo", "Export Board", async () => {
            if (checkFocalPivotBlock()) return;
            annotationPopup.exportBoard();
        }, false, "Export board as image")}
        {tbItem('tb-exit', "Unload Project", () => {
          if (checkFocalPivotBlock()) return;
          if (curProjectId.id === "") {
            ppInfo("No Project", "There is no project loaded to unload");
            return;
          }
          ppConfirm("Unload Project", "Unload the project ? This will close all boards.", "Yes", "No").then(res => {
            if (res === "ok") {
              curProjectId.id = "";
              curProjectId.name = "";
            }
            searchResults.clear();
            currentPatternSelection.images = [];
            currentPatternSelection.selections = [];
            currentPatternSelection.selectionsDisp = [];
            currentPatternSelection.shouldBeProcessed = false;
            boardManager.boards.forEach((board, idx) => {
              boardManager.currentBoardIndex = 0;
              surfaceCollection.collection.length = 0;
              surfaceManager.currentSurface = null;
            });
            boardManager.boards.length = 0;
            surfaceManager.currentSurface?._app.canvas.remove();
            const btnSearch = getUow<ButtonBar>("btnSearch");
            _evtBus.emit(_evts.ButtonBar.Click, { id: btnSearch.guid, name: btnSearch.name });
          });
        }, false, "Close current project and return to search")}
      </div>
      {/* Tools Group */}
  
      <div class="top-bar-group">
        <span class="top-bar-group-title">Tools</span>
        {tbItem("tb-cut", "Cut", async () => {
          if (checkFocalPivotBlock()) return;
          surfaceManager.cut();
        }, false, "Cut patterns to plotter")}
        {tbItem("tb-overlap", "Overlap", () => {
          if (checkFocalPivotBlock()) return;
          surfaceManager.currentSurface?._Patterns.forEach(p => {
           // p.setState("edition");
           // p.setState("");
          });
          surfaceManager.checkCollision();
          for (let i = 0; i < 15; i++) {
            waitForMs(100 * i).then(() => { surfaceManager.currentSurface!.selectionBox!.isSelecting = false; });
          }
        }, false, "Check for pattern overlaps")}
        {tbItem("tb-nesting", "Nesting", async () => {
          if (checkFocalPivotBlock()) return;
          toastInfo("Processing your request... This may take a while...");
          surfaceManager.doNesting();
        }, false, "Auto-arrange patterns efficiently")}
      
        {tbItem('tb-ruler', "Ruler", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          
          // Show ruler popup
          const mainFrame = getUow<MainFrame>("mainFrame");
          let rulerPopup = mainFrame.children.find(c => c instanceof RulerPopup) as RulerPopup;
          
          if (!rulerPopup) {
            rulerPopup = new RulerPopup();
            mainFrame.children.push(rulerPopup);
          }
          
          rulerPopup.toggle();
          mainFrame.update();
        }, false, "Show measurement ruler")}
        {tbItem('grid', "Grid", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          
          surface._Board.toggleGrid();
        }, false, "Toggle grid visibility")}
        {tbItem('tb-material', "Cost", () => {
          if (checkFocalPivotBlock()) return;
          surfaceManager.currentSurface!._Board.toggleMaterialUsage();
        }, false, "Show material cost calculation")}
        {tbItem('tb-roll', "Roll", () => {
          if (checkFocalPivotBlock()) return;
          const mainFrame = getUow<MainFrame>("mainFrame");
          let rollPopup = mainFrame.children.find(c => c instanceof RollSelectionPopup) as RollSelectionPopup;
          
          if (!rollPopup) {
            rollPopup = new RollSelectionPopup();
            mainFrame.children.push(rollPopup);
          }
          
          rollPopup.toggle();
          mainFrame.update();
        }, false, "Select material roll width")}
        {tbItem('tb-geometry', "Geometry", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          
          // Check if we're in normal selection mode (no pattern selected or in special state)
          const hasSpecialState = surface._Patterns.some(p => 
            p._state !== "" && p._state !== "selected"
          );
          
          if (hasSpecialState) {
            ppInfo("Geometry", "Please exit current mode before using geometry");
            return;
          }
          
          // Show geometry popup
          const mainFrame = getUow<MainFrame>("mainFrame");
          let geometryPopup = mainFrame.children.find(c => c instanceof GeometryPopup) as GeometryPopup;
          
          if (!geometryPopup) {
            geometryPopup = new GeometryPopup();
            mainFrame.children.push(geometryPopup);
          }
          
          geometryPopup.show();
          mainFrame.update();
        }, false, "Add geometric shapes")}
        {tbItem('tb-annotate', "Labeling", () => {
          if (checkFocalPivotBlock()) return;
          const surface = surfaceManager.currentSurface;
          if (!surface) return;
          
          // Check if we're in normal selection mode (no special state)
          const hasSpecialState = surface._Patterns.some(p => 
            p._state !== "" && p._state !== "selected"
          );
          
          if (hasSpecialState) {
            ppInfo("Annotate", "Please exit current mode before using annotations");
            return;
          }
          
          // Show annotation popup
          const mainFrame = getUow<MainFrame>("mainFrame");
          let annotationPopup = mainFrame.children.find(c => c instanceof AnnotationPopup) as AnnotationPopup;
          
          if (!annotationPopup) {
            annotationPopup = new AnnotationPopup();
            mainFrame.children.push(annotationPopup);
            // Store reference on surface for zoom updates
            if (surface) {
              (surface as any)._annotationPopup = annotationPopup;
            }
          }
          
          annotationPopup.show();
          mainFrame.update();
        }, false, "Add text labels to patterns")}
      </div> 

      
      {/* Settings Group */}
      <div class="top-bar-group">
        <span class="top-bar-group-title">Tools Settings</span>
        
        {/* Box Selection */}
        <div class="top-bar-setting-item">
          <label for="tb-box-selection">Box Selection</label>
          <input id="tb-box-selection" class="top-bar-checkbox" type="checkbox"
            checked={liveConfig.boxSelectionMode}
            onClick={() => {
              liveConfig.boxSelectionMode = !liveConfig.boxSelectionMode;
              const surface = surfaceManager.currentSurface;
              if (surface) {
                surface.updateRotationSelectionBox();
              }
              $this.update();
            }}
          />
        </div>

        {/* Wrap Distance */}
        <div class="top-bar-setting-item">
          <label for="tb-wrap-distance">Wrap Distance ({liveConfig.unitOfMeasure === 3 ? "in" : "mm"})</label>
          <input id="tb-wrap-distance" class="top-bar-input" type="number"
            step="0.01"
            min={liveConfig.unitOfMeasure === 3 ? "0.039" : "1"}
            max={liveConfig.unitOfMeasure === 3 ? "10" : "254"}
            value={liveConfig.wrapDistance}
            onChange={(e) => {
              const inputValue = parseFloat(e.currentTarget.value);
              if (!isNaN(inputValue)) {
                liveConfig.wrapDistance = inputValue;
                $this.update();
              }
            }}
          />
        </div>

        {/* Double Cut */}
        <div class="top-bar-setting-item">
          <label for="tb-double-cut">Double Cut</label>
          <input id="tb-double-cut" class="top-bar-checkbox" type="checkbox"
            checked={liveConfig.doubleCut}
            onClick={() => {
              liveConfig.doubleCut = !liveConfig.doubleCut;
              $this.update();
            }}
          />
        </div>

        {/* Rotation */}
        <div class="top-bar-setting-item">
          <label for="tb-rotation">Rotation (°)</label>
          <input id="tb-rotation" class="top-bar-input" type="number"
            value={liveConfig.rotation}
            onInput={(e) => {
      
              liveConfig.rotation = Number(e.currentTarget.value);
              $this.update();
            }}
          />
        </div>

        {/* Curved Split */}
        <div class="top-bar-setting-item">
          <label for="tb-curved-split">Curved Split</label>
          <input id="tb-curved-split" class="top-bar-checkbox" type="checkbox"
            checked={liveConfig.curvedSplitEnabled}
            onClick={() => {
              liveConfig.curvedSplitEnabled = !liveConfig.curvedSplitEnabled;
              $this.update();
            }}
          />
        </div>

        {liveConfig.curvedSplitEnabled && (
          <div class="top-bar-setting-item">
            <label for="tb-curved-split-depth">Curve Depth</label>
            <input id="tb-curved-split-depth" class="top-bar-input" type="number"
              value={liveConfig.curvedSplitDepth}
              min="5"
              max="500"
              step="5"
              onChange={(e) => {
                const inputValue = Number(e.currentTarget.value);
                if (!isNaN(inputValue)) {
                  liveConfig.curvedSplitDepth = inputValue;
                  $this.update();
                }
              }}
            />
          </div>
        )}
          {/* Nodes/Curves Group */}
<div class="top-bar-setting-item">
  <label>Curve</label>
  {tbItem("tb-symmetric", "Symmetric", () => {
      const surface = surfaceManager.currentSurface!;
      let selected = surface._Patterns.find(p => p._state === "edition") as (_Pattern & TEditionPattern);
      if (selected) {
          selected.handlerMode = 'symmetrical';
          selected.subPatterns.forEach(subPattern => {
            (subPattern as _Pattern & TEditionPattern).handlerMode = 'symmetrical';
          });
      }
      
      $this.activeCurveMode = 'symmetrical';
      $this.update();
  }, $this.activeCurveMode === 'symmetrical', "Make curves symmetrical")} 

 {tbItem("tb-smooth", "Smooth", () => {
      const surface = surfaceManager.currentSurface!;
      let selected = surface._Patterns.find(p => p._state === "edition") as (_Pattern & TEditionPattern);
      if (selected) {
          selected.handlerMode = 'smooth';
          selected.subPatterns.forEach(subPattern => {
            (subPattern as _Pattern & TEditionPattern).handlerMode = 'smooth';
          });
      }
    
      $this.activeCurveMode = 'smooth';
      $this.update();
  }, $this.activeCurveMode === 'smooth', "Make curves smooth")} 

  {tbItem("tb-sharp", "Normal", () => {
      const surface = surfaceManager.currentSurface!;
      let selected = surface._Patterns.find(p => p._state === "edition") as (_Pattern & TEditionPattern);
      if (selected) {
          selected.handlerMode = 'normal';
          selected.subPatterns.forEach(subPattern => {
            (subPattern as _Pattern & TEditionPattern).handlerMode = 'normal';
          });
      }
   
      $this.activeCurveMode = 'normal';
      $this.update();
  }, $this.activeCurveMode === 'normal', "Make curves sharp/normal")}
</div>
        </div>
      <div class="top-bar-group">
        <span class="top-bar-group-title">Help</span>
        {tbItem("tb-help", "Shortcuts", () => { 
          const mainFrame = getUow<MainFrame>("mainFrame");
          let shortcutsPopup = mainFrame.children.find(c => c instanceof ShortcutsPopup) as ShortcutsPopup;

          if (!shortcutsPopup) {
            shortcutsPopup = new ShortcutsPopup();
            mainFrame.children.push(shortcutsPopup);
          }

          shortcutsPopup.show();
          mainFrame.update();
        }, false, "Show keyboard shortcuts")}
      </div>
    
    </div>
  </>;
}

const tbItem = (icon: TIcon, text: string, handler?: () => void, isActive?: boolean, tooltip?: string) => {
    const buttonClass = `top-bar-button ${isActive ? 'active' : ''}`;
    const tooltipText = tooltip || text;
  return <div class={buttonClass} onClick={handler} data-tooltip={tooltipText}>
    <div class="top-bar-icon" style={{ backgroundImage: `url(assets/svg/${icon}.svg)` }} />
    <span class="top-bar-text">{text}</span>
  </div>
}

TopBar.registerSystemDesign(systemDesign);