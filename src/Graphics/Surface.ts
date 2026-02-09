import { Application, ApplicationOptions, autoDetectRenderer, Container, Graphics, Point, RenderLayerClass } from "pixi.js";
import { DisplayObject } from "./DisplayObject";
import { CutBoard } from "./CutBoard";
import { Pattern } from "../Pattern/Pattern";
import { VectorPath } from "../VectorPath/VectorPath";
import { SelectionBox } from "../shared/SelectionBox";
import { RotationSelectionBox } from "../shared/RotationSelectionBox";
import { SplitLine } from "../shared/SplitLine";
import { CCommand } from "../VectorPath/Commands/CCommand";
import { QCommand } from "../VectorPath/Commands/QCommand";
import { TCommand } from "../VectorPath/Commands/TCommand";
import { VCommand } from "../VectorPath/Commands/VCommand";
import { ACommand } from "../VectorPath/Commands/ACommand";
import { MoveCommand } from "../VectorPath/Commands/MCommand";
import { LCommand } from "../VectorPath/Commands/LCommand";
import { IPoint } from "../VectorPath/Utils/IPoint";
import  paper from 'paper';
import { Segment } from "./Segment";
import {TWrapPattern} from "../Pattern/Extentions/PatternWrap";
import { ppConfirm, ppPartialWrapDirection } from "../ui/controls/popup/Popup";
import { toastInfo, toastSuccess, toastWarning } from "../ui/controls/Toast/Toast";
import { ShortcutsPopup } from "../ui/controls/shortcutsPopup/ShortcutsPopup";
import { getUow } from "../uof/UnitOfWork";
import { surfaceManager } from "./SurfaceManager";
import { MainFrame } from "../ui/layout/Frame";
import { MirroringPopup } from "../ui/controls/MirroringPopup/MirroringPopup";
import { createExternalOutwardPolygon } from "../outward/_Outward";
import { LineCommand } from "../mvd/LowLevel/LineCommand";
import { liveConfig } from "../core/LiveConfig";
import { surfaceCollection } from "../data/repository/SurfaceCollection";
import { undoRedoManager } from "../core/UndoRedoManager";
import { guid } from "../core/Guid";
import { boardManager } from "src/cutboard/BoardManager";
import { waitForMs } from "../core/Dom";
import { RulerTool } from "../shared/RulerTool";
import * as PIXI from 'pixi.js'; /// new for nesting
import { TEditionPattern } from "../Pattern/Extentions/PatternEdition";
import { ZCommand } from "../VectorPath/Commands/ZCommand";
import { _Pattern } from "../Pattern/Pattern";
import { _evtBus } from "../core/EventBus";
import { UndoRedoManager,PatternAction } from '../core/UndoRedoManager';
import { segmentManager } from "../Pattern/SegmentManager";
import { themeManager } from "../utils/ThemeManager";




(window as any).copyPaste = [];

// Create and append a canvas to the document so you can see the results.
const canvas = document.createElement('canvas');
canvas.width = 500;
canvas.height = 500;
document.body.appendChild(canvas);
paper.setup(canvas);

export class Surface {
  _app     !: Application;
  _options  : Partial<ApplicationOptions>;
  _registeredItems: DisplayObject[] = [];
  _isEditing: boolean = false;
  themeUnsubscribe: (() => void) | null = null;
  private _isPanning: boolean = false;
  private _lastMousePos: { x: number, y: number } = { x: 0, y: 0 };
  ctrlKey: boolean = false;
  shiftKey: boolean = false;
  selectionBox: SelectionBox  | null = null;
  rotationSelectionBox: RotationSelectionBox | null = null;
  splitLine : SplitLine | null = null;
  multiSelection: typeof Pattern[] = [];
  _isBtnLeftDown: boolean = false;
  _hasShownMultiSelectToast: boolean = false;
  _isDeleting: boolean = false;
  activatePointSelection: boolean = false;
  activationWrap: boolean = false;
  pointSelection: Graphics | null = null;
  activePatternForPointSelection: typeof Pattern | null = null;
  firstload : boolean;
   isPasting: boolean = false;
    pastePreview: PIXI.Container | null = null;
    spaceBarPressed: boolean = false;
  // Suppress accidental click after a drag operation
  _didDrag: boolean = false;
  _suppressNextClick: boolean = false;
  
  // Rotation undo/redo tracking
  private rotationBeforeStates: Map<string, any> = new Map();
  private rotationDebounceTimer: NodeJS.Timeout | null = null;
  private isRotating: boolean = false;


  // Ruler properties
  rulerMode: boolean = false;
  rulerTool: RulerTool | null = null;
  rulerUnit: 'metric' | 'imperial' = 'metric';
  rulerGraduation: number = 10;
  rulerKeepOnRelease: boolean = false;
  _rulerContainer: Container | null = null;
  customPivotMode: boolean = false;
  customPivotPoint: IPoint | null = null;
  customPivotGraphic: Graphics | null = null;
  private hasShownPivotHint: boolean = false;



  getpointSelection(point: IPoint, t: number) {}

  _BoardLayer !: RenderLayerClass;
  _ItemLayer  !: RenderLayerClass;
  _InfoLayer  !: RenderLayerClass;

  _Board!: CutBoard
  _Patterns: typeof Pattern[] = [];

  _zoomFactor: number = 1;
  isPanMode: boolean = false;

  get zoomFactor() {
    return this._zoomFactor;
  }

 set zoomFactor(value: number) {
    this._zoomFactor = value;
    // Apply to the board
    this._Board._zoomFactor = value;
    // Apply to all patterns
    this._Patterns.forEach(pattern => {
      pattern.zoomFactor = value;
    });

    this.selectionBox && (this.selectionBox._zoomFactor = value);
    this.rotationSelectionBox && (this.rotationSelectionBox._zoomFactor = value);
    if (this.splitLine) {
      this.splitLine.zoomFactor = value;  // Use the setter which handles zoom scaling
    }
     _evtBus.emit("zoomChanged", value);
    this.updateCustomPivotGraphic();
  }

  display() {
    this._Board.update();
    this._Patterns.forEach(pattern => {
      pattern._isDirty = true;
      pattern.subPatterns.forEach((subPattern) => {
        subPattern._isDirty = true;
        subPattern.zoomFactor = this.zoomFactor;
      });
      pattern.display();
    });
    if (!this.pointSelection) {
      this.pointSelection = new Graphics();
      this._app.stage.addChild(this.pointSelection);
      this.pointSelection.setStrokeStyle({color: 0xFF0000});
      this.pointSelection.circle(0,0,2);
      this.pointSelection.stroke();
      this.pointSelection.visible = false;
    }

    // Update ruler zoom if it exists
    if (this.rulerTool) {
      this.rulerTool.updateSettings(this.rulerUnit, this.rulerGraduation, this.rulerKeepOnRelease, this.zoomFactor);
    }

    // Refresh annotations with new zoom (like patterns)
    // Force refresh even if popup is closed
    this.refreshAnnotations();
    this.updateCustomPivotGraphic();
    this.updateRotationSelectionBox();
  }

  updateRotationSelectionBox() {
    if (!this.rotationSelectionBox) return;
    
    if (liveConfig.boxSelectionMode) {
      const selectedPatterns = this._Patterns.filter(p => p._state === 'selected' && !p._parentPattern);
      this.rotationSelectionBox.updateSelection(selectedPatterns);
    } else {
      this.rotationSelectionBox.visible = false;
      this.rotationSelectionBox.clear();
    }
  }

  constructor(options?: Partial<ApplicationOptions>) {
    // Get theme to set appropriate background (slightly dark for grid visibility)
    const isDark = themeManager.isDarkMode();
    const bgColor = isDark ? '#555555' : '#f5f5f5'; // Slightly dark backgrounds for better grid visibility
    
    // Merge options, but ensure background is always set from theme (not overridden by options)
    this._options = {
      resizeTo         : window,
      antialias        : true,
      eventMode        : 'dynamic',
      ...(options || {}),
      background       : bgColor, // Always override background with theme-based color
    };
   // this.init(); commented and called in connect to screen function to prevent memory leak and racing 
  }
  
  updateBackgroundColor() {
    // Update background color when theme changes
    const isDark = themeManager.isDarkMode();
    const bgColor = isDark ? '#555555' : '#ffffff';
    
    if (this._app && this._app.renderer) {
      try {
        // Update via renderer.background.color (PIXI v7+)
        if (this._app.renderer.background) {
          const hexNumber = parseInt(bgColor.replace('#', ''), 16);
          this._app.renderer.background.color = hexNumber;
        }
        // Also update canvas style as additional fallback
        if (this._app.canvas) {
          this._app.canvas.style.backgroundColor = bgColor;
        }
      } catch (e) {
        console.warn('Error updating PIXI background color:', e);
        // Fallback to canvas style only
        if (this._app.canvas) {
          this._app.canvas.style.backgroundColor = bgColor;
        }
      }
    }
    
    // Also update options for future initialization
    this._options.background = bgColor;
  }

  cleanupRuler() {
    if (this.rulerTool) {
      this.rulerTool.destroy();
      this.rulerTool = null;
    }
    this.rulerMode = false;
  }

  initializeRuler() {
    // Clean up existing ruler first
    if (this.rulerTool) {
      this.rulerTool.destroy();
      this.rulerTool = null;
    }

    // Create new ruler tool with current settings and zoom factor
    this.rulerTool = new RulerTool(
      this._app.stage,
      this.rulerUnit,
      this.rulerGraduation,
      this.rulerKeepOnRelease,
      this.zoomFactor
    );
  }

  updateRulerSettings(unit: 'metric' | 'imperial', graduation: number, keepOnRelease: boolean) {
    this.rulerUnit = unit;
    this.rulerGraduation = graduation;
    this.rulerKeepOnRelease = keepOnRelease;

    // If ruler mode is active, reinitialize the ruler with new settings
    if (this.rulerMode) {
      this.initializeRuler();
    }
  }

  enableCustomPivotMode(options?: { silent?: boolean }) {
    this.customPivotMode = true;
    if (this._app?.canvas) {
      this._app.canvas.style.cursor = 'crosshair';
    }
    this.ensureCustomPivotGraphic();
    if (!this.customPivotPoint) {
      this.updateCustomPivotGraphic();
    }

    if (!options?.silent && !this.hasShownPivotHint) {
      toastInfo("Click on the board to place the focal rotation point", 2500);
      this.hasShownPivotHint = true;
    }
  }

  disableCustomPivotMode(options?: { silent?: boolean }) {
    this.customPivotMode = false;
    this.customPivotPoint = null;
    this.removeCustomPivotGraphic();
    if (this._app?.canvas) {
      this._app.canvas.style.cursor = this.isPanMode ? 'grab' : 'default';
    }
    if (!options?.silent) {
      this.hasShownPivotHint = false;
    }
  }

  setCustomPivotPoint(point: IPoint) {
    this.customPivotPoint = point;
    this.ensureCustomPivotGraphic();
    this.updateCustomPivotGraphic();
  }

  getCustomPivotPoint(): IPoint | null {
    return this.getActivePivotPoint();
  }

  private ensureCustomPivotGraphic() {
    if (this.customPivotGraphic) {
      return;
    }

    this.customPivotGraphic = new Graphics();
    this.customPivotGraphic.zIndex = 9999;
    this.customPivotGraphic.eventMode = 'none';
    this._app.stage.addChild(this.customPivotGraphic);
  }

  private updateCustomPivotGraphic() {
    if (!this.customPivotGraphic) {
      return;
    }

    if (!this.customPivotMode || !this.customPivotPoint) {
      this.customPivotGraphic.visible = false;
      this.customPivotGraphic.clear();
      return;
    }

    const zoom = this.zoomFactor || 1;
    const size = 10 * zoom;
    const stroke = Math.max(0.75, 1.5 * zoom);

    this.customPivotGraphic.clear();
    this.customPivotGraphic.setStrokeStyle({ color: 0xd13f3f, width: stroke, alpha: 0.95 });
    this.customPivotGraphic.moveTo(-size, 0);
    this.customPivotGraphic.lineTo(size, 0);
    this.customPivotGraphic.moveTo(0, -size);
    this.customPivotGraphic.lineTo(0, size);
    this.customPivotGraphic.circle(0, 0, size * 0.5);
    this.customPivotGraphic.stroke();
    this.customPivotGraphic.position.set(this.customPivotPoint.x * zoom, this.customPivotPoint.y * zoom);
    this.customPivotGraphic.visible = true;
  }

  private removeCustomPivotGraphic(destroy: boolean = false) {
    if (!this.customPivotGraphic) {
      return;
    }

    this.customPivotGraphic.clear();
    this.customPivotGraphic.visible = false;

    if (destroy) {
      this.customPivotGraphic.parent?.removeChild(this.customPivotGraphic);
      this.customPivotGraphic.destroy();
      this.customPivotGraphic = null;
    }
  }

  private getWorldPointFromMouse(event: MouseEvent): IPoint {
    const stagePos = this._app.stage.position;
    return {
      x: (event.offsetX - stagePos.x) / this.zoomFactor,
      y: (event.offsetY - stagePos.y) / this.zoomFactor
    };
  }

  private getActivePivotPoint(): IPoint | null {
    if (!this.customPivotMode || !this.customPivotPoint) {
      return null;
    }
    return { ...this.customPivotPoint };
  }

  async init() {
    const app = new Application();
    // Ensure background is set correctly for the current theme
    const isDark = themeManager.isDarkMode();
    const bgColor = isDark ? '#555555' : '#ffffff';
    this._options.background = bgColor;
    
    await app.init(this._options);
    this._app = app;

    (window as any).app   = this._app;
    (window as any).curSF = this;
    
    // Subscribe to theme changes to update background dynamically
    this.themeUnsubscribe = themeManager.subscribe((theme: string) => {
      this.updateBackgroundColor();
    });

    // Adding the layers
    this._app.stage.addChild(this._BoardLayer = new RenderLayerClass());
    this._app.stage.addChild(this._ItemLayer  = new RenderLayerClass());
    this._app.stage.addChild(this._InfoLayer  = new RenderLayerClass());

    // Creates the Board
    this._Board = new CutBoard();
    this._app.stage.addChild(this._Board);
    this._BoardLayer.attach(this._Board);

    // Initialize the events
    this.attachCanvasEvents();

    setTimeout(() => {

      
      this.selectionBox = new SelectionBox();
      //this.registerForEvents(this.selectionBox);
      this._app.stage.addChild(this.selectionBox);
      this.selectionBox.onSelectionComplete = (rect) => {
        // if size of rect less than 10px x 10px, then return
        if (rect.width < 10 || rect.height < 10) {
          return;
        }
        
        // Block selection when custom pivot mode is active
        if (this.customPivotMode) {
          return;
        }
        
        // Block selection when in split mode, bikini mode, or wrap mode
        const hasSplitPattern = this._Patterns.some(p => p._state === 'split');
        const hasBikiniPattern = this._Patterns.some(p => p._state === 'bikini');
        const hasWrapPattern = this._Patterns.some(p => p._state === 'wrap');
        if (hasSplitPattern || hasBikiniPattern || hasWrapPattern) {
          return;
        }
        
        setTimeout(() => {
          // Clear previous multi-selection
          this.multiSelection = [];
          
          let selectedCount = 0;
          
          this._Patterns.forEach((pattern) => {
            // Get the points of the pattern
            const points = pattern._vector.getCommands().map((command) => {
              return { x: command.endingPoint.x * this.zoomFactor + pattern.x + this._app.stage.x, y: command.endingPoint.y * this.zoomFactor + pattern.y + this._app.stage.y };
            });

            // Check if the points are inside the rect
            const selected = points.filter((point) => {
              return point.x > rect.x && point.x < rect.x + rect.width && point.y > rect.y && point.y < rect.y + rect.height;
            });

            // If more than one point is inside the selection, select the pattern
            if (selected.length > 1) {
              pattern.setState('selected');
              this.multiSelection.push(pattern);
              selectedCount++;
            } else {
              // Deselect patterns not in the selection box
              if (pattern._state === 'selected') {
                pattern.setState('');
              }
            }
          });
          
          // Update rotation selection box
          this.updateRotationSelectionBox();
        }, 0);
      };

      // RotationSelectionBox
      this.rotationSelectionBox = new RotationSelectionBox();
      this.registerForEvents(this.rotationSelectionBox);
      this._InfoLayer.attach(this.rotationSelectionBox);
      this._app.stage.addChild(this.rotationSelectionBox);

      // SplitLine
      this.splitLine = new SplitLine();
      //this.registerForEvents(this.splitLine);
      this._InfoLayer.attach(this.splitLine);
      this._app.stage.addChild(this.splitLine);
    }, 1);
    
  }

  removePattern(pattern: typeof Pattern) {
    this._Patterns = this._Patterns.filter(p => p !== pattern);
    this._app.stage.removeChild(pattern.container);
    this._ItemLayer.detach(pattern.container);
    
    // Emit event for material usage update
    _evtBus.emit("patternDeleted");
  }

  _updateAnnotationContainerZoom() {
    if (!this._Board || !this._Board.annotationContainer || !this._Board.annotations) return;

    const container = this._Board.annotationContainer as Container;
    const zoomFactor = this.zoomFactor || 1;

    // Update each annotation container
    container.children.forEach((annotationContainer: Container, index: number) => {
      if (index < this._Board.annotations.length) {
        const annotation = this._Board.annotations[index];
        const boardX = annotation.boardX !== undefined ? annotation.boardX : annotation.x;
        const boardY = annotation.boardY !== undefined ? annotation.boardY : annotation.y;

        // Update position based on zoom
        annotationContainer.x = boardX * zoomFactor;
        annotationContainer.y = boardY * zoomFactor;

        // Update scale of inner container
        if (annotationContainer.children[0]) {
          annotationContainer.children[0].scale.set(zoomFactor, zoomFactor);
        }
      }
    });
  }

  refreshAnnotations() {
    // If board has annotations and they're visible, we need to redraw them with new zoom
    if (this._Board && this._Board.annotations && this._Board.annotations.length > 0
        && this._Board.annotationContainer && this._Board.annotationContainer.visible) {

      // Try to find annotation popup
      try {
        const { getUow } = require("../uof/UnitOfWork");
        const { AnnotationPopup } = require("../ui/controls/AnnotationPopup/AnnotationPopup");

        const mainFrame = getUow("mainFrame");
        if (mainFrame && mainFrame.children) {
          const popup = mainFrame.children.find((c: any) => c instanceof AnnotationPopup);
          if (popup) {
            // Update the reference
            (this as any)._annotationPopup = popup;

            // Sync annotations if needed
            if (!popup.annotations || popup.annotations.length === 0) {
              popup.annotations = [...this._Board.annotations];
            }

            // Redraw annotations with new zoom
            popup.showAllAnnotations();
          } else {
            // No popup, update zoom manually
            this._updateAnnotationContainerZoom();
          }
        }
      } catch (e) {
        console.error("Error refreshing annotations:", e);
        // Fallback to manual update
        this._updateAnnotationContainerZoom();
      }
    }
  }

  addPath(path: string, options?: {
    noNormilize     ?: boolean;
    restorePosition ?: boolean;
    guid            ?: string;
    nestedPaths     ?: string[];
  }) {

    const vectorPath = new VectorPath();
    vectorPath.parse(path)

    if (!options?.noNormilize) {
      vectorPath.normalize();
    }


    const pattern = new Pattern(vectorPath);
    pattern._guid = options?.guid || guid();
    pattern.zoomFactor = this._zoomFactor;

    if (this._Patterns.filter((p) => p._guid === pattern._guid).length > 0) {
      console.warn("Pattern with the same guid already exists", pattern._guid);
      return this._Patterns.find((p) => p._guid === pattern._guid)!;
    }
    this._Patterns.push(pattern);
    this._app.stage.addChild(pattern.container);
    this._ItemLayer.attach(pattern.container);

    if (options?.restorePosition) {
      pattern.x = pattern.zoomed(pattern._vector.originalPosition.x);
      pattern.y = pattern.zoomed(pattern._vector.originalPosition.y);
      pattern.display();
    } else {
      pattern.x = 0;
      pattern.y = 0;
      pattern.display();
    }

    pattern._vector.paths = options?.nestedPaths || [];
    
    // Emit event for material usage update
    _evtBus.emit("patternAdded");
    
    return pattern;
  }

  private attachCanvasEvents() {
    //window.attach = window.attach || 0;
    //window.attach++;
    this._app.canvas.addEventListener("mousemove"  , this.mousemoveHandler);
    this._app.canvas.addEventListener("mousedown"  , this.mousedownHandler);
    this._app.canvas.addEventListener("mouseup"    , this.mouseupHandler);
    this._app.canvas.addEventListener("click"      , this.clickHandler);
    this._app.canvas.addEventListener("dblclick"   , this.dblclickHandler);
    this._app.canvas.addEventListener("wheel"      , this.wheelHandler);

    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup"  , this.keyUpHandler);
    //console.log('Events attached', window.attach, window.detach);
  }

  private detachCanvasEvents() {
    //window.detach = window.detach || 0;
    //window.detach++;
    this._app.canvas.removeEventListener("mousemove"  , this.mousemoveHandler);
    this._app.canvas.removeEventListener("mousedown"  , this.mousedownHandler);
    this._app.canvas.removeEventListener("mouseup"    , this.mouseupHandler);
    this._app.canvas.removeEventListener("click"      , this.clickHandler);
    this._app.canvas.removeEventListener("dblclick"   , this.dblclickHandler);
    this._app.canvas.removeEventListener("wheel"      , this.wheelHandler);

    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup"  , this.keyUpHandler);
    //console.log('Events detached', window.attach, window.detach);
  }

  registerForEvents(item: DisplayObject) {
    this._registeredItems.push(item);

    return {off: () => {
      this._registeredItems = this._registeredItems.filter(i => i.id !== item.id);
    }}
  }

  updateMouseEvent(event: MouseEvent) {
    // We need to substract the offset of teh stage position x and y
    return {
      offsetX: event.offsetX - this._app.stage.x,
      offsetY: event.offsetY - this._app.stage.y,
      button: event.button,
      buttons: event.buttons
    };
  }

  keyDownHandler = (event: KeyboardEvent) => {
     if (surfaceManager.isSwitchingBoards) return;
     
     // Always update ctrlKey and shiftKey state first (needed for Ctrl+Mouse Wheel rotation)
     if (event.ctrlKey) {
       this.ctrlKey = true;
     }
     // check if Shift key is pressed
     if (event.shiftKey) {
       this.shiftKey = true;
     }
     if (event.code === 'Space') {
       this.spaceBarPressed = true;
     }
     
     // Prevent hotkeys when typing in input fields (except F1 for help and Escape)
     // This check must come before focal pivot blocking to allow normal typing
     const target = event.target as HTMLElement;
     const isTypingInInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
     if (event.key !== 'F1' && event.key !== 'Escape' && isTypingInInput) {
       return;
     }
     
     // Handle Escape key - can exit focal pivot mode or other modes
     if (event.key === 'Escape') {
       // Exit focal pivot mode first (highest priority)
       if (this.customPivotMode) {
         event.preventDefault();
         surfaceManager.disableFocalPivotMode();
         return;
       }
       
       // Check for bikini split mode
        const bikiniPattern = this._Patterns.find(p => p._state === 'bikini');
        if (bikiniPattern) {
          event.preventDefault();
          bikiniPattern.setState("");
          return;
        }
        
        // Check for normal split mode
        const splitPattern = this._Patterns.find(p => p._state === 'split');
        if (splitPattern) {
          event.preventDefault();
          // Clean up split line
          if (this.splitLine) {
            this.splitLine.canBeUsed = false;
            this.splitLine.splitPoint1 = null;
            this.splitLine.splitPoint2 = null;
            this.splitLine.clear();
          }
          splitPattern.setState("");
          return;
        }
        
        // Check for wrap mode (partial wrap)
        const wrapPattern = this._Patterns.find(p => p._state === 'wrap') as typeof Pattern & TWrapPattern;
        if (wrapPattern) {
          event.preventDefault();
          // Clean up wrap points
          if (wrapPattern.wrapPoint1 || wrapPattern.wrapPoint2) {
            wrapPattern.wrapPoint1 = null;
            wrapPattern.wrapPoint2 = null;
            wrapPattern.wrapDistance1 = 0;
            wrapPattern.wrapDistance2 = 0;
            wrapPattern.wrapSeg1Idx = -1;
            wrapPattern.wrapSeg2Idx = -1;
          }
          // Hide point selection
          if (this.pointSelection) {
            this.pointSelection.visible = false;
          }
          // Deactivate wrap mode
          this.activationWrap = false;
          // Reset pattern state
          wrapPattern.setState("");
          // Refresh display
          wrapPattern.display();
          return;
        }
      }
      
      // Block all other keyboard shortcuts when focal pivot mode is active
      // This blocks ALL shortcuts except Escape (which is handled above) and F1 (help)
      // Input field typing is already handled above, so we won't block normal typing
      if (this.customPivotMode) {
        // Allow F1 (help) even in focal pivot mode
        if (event.key === 'F1') {
          // F1 handler is below, let it proceed
        } else {
          event.preventDefault(); // Prevent any default behavior
          return;
        }
      }

      // Handle Shift + Arrow keys for moving selected points in edit mode
      if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || 
                              event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        // Check if we're in edit mode and have selected handlers
        if (this._isEditing && surfaceManager.globalSelectedHandlers.length > 0) {
          event.preventDefault(); // Prevent default browser behavior

          // Get wrap distance from config (convert to pixels)
          let wrapDistance = liveConfig.wrapDistance;
          if (liveConfig.unitOfMeasure === 3) {
            wrapDistance *= 25.4; // Convert inches to mm
          }
          
          // Convert mm to pixels using zoom factor
          const moveDistancePixels = wrapDistance * this.zoomFactor;

          // Determine movement direction based on arrow key
          let deltaX = 0;
          let deltaY = 0;
          
          switch(event.key) {
            case 'ArrowUp':
              deltaY = -moveDistancePixels;
              break;
            case 'ArrowDown':
              deltaY = moveDistancePixels;
              break;
            case 'ArrowLeft':
              deltaX = -moveDistancePixels;
              break;
            case 'ArrowRight':
              deltaX = moveDistancePixels;
              break;
          }

          // Capture states before modification for undo/redo
          const uniquePatternGuids = new Set<string>();
          surfaceManager.globalSelectedHandlers.forEach(item => {
            const pattern = item.pattern as _Pattern & TEditionPattern;
            // For subpatterns, use the parent pattern's GUID instead since subpatterns don't exist independently
            const targetGuid = pattern._parentPattern ? pattern._parentPattern._guid : pattern._guid;
            uniquePatternGuids.add(targetGuid);
          });

          const capturedStates = new Map<string, any>();
          uniquePatternGuids.forEach(guid => {
            const state = undoRedoManager.capturePatternState(guid);
            if (state) {
              capturedStates.set(guid, state);
            }
          });

          // Move each selected handler
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
              handler.update();

              // Update command ending point
              const newX = pattern.unZoomed(handler.position.x);
              const newY = pattern.unZoomed(handler.position.y);
              command?.updateEndingPoint({ x: newX, y: newY });

              // When moving an endpoint, update attached control points
              if (command instanceof CCommand) {
                // Update control point 2 (attached to this endpoint)
                command.x2 += pattern.unZoomed(deltaX);
                command.y2 += pattern.unZoomed(deltaY);
              }

              // Update control point 1 of the NEXT segment
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
          const editionPattern = this._Patterns.find(p => p._state === 'edition') as _Pattern & TEditionPattern;
          if (editionPattern && editionPattern.currentSegment && editionPattern.currentSegment.command instanceof CCommand) {
            if (editionPattern.control1) {
              editionPattern.control1.x = editionPattern.zoomed((editionPattern.currentSegment.command as CCommand).x1);
              editionPattern.control1.y = editionPattern.zoomed((editionPattern.currentSegment.command as CCommand).y1);
              editionPattern.control1.update();
            }
            if (editionPattern.control2) {
              editionPattern.control2.x = editionPattern.zoomed((editionPattern.currentSegment.command as CCommand).x2);
              editionPattern.control2.y = editionPattern.zoomed((editionPattern.currentSegment.command as CCommand).y2);
              editionPattern.control2.update();
            }
          }

          // Record the action in undo/redo manager
          capturedStates.forEach((beforeState, guid) => {
            const afterState = undoRedoManager.capturePatternState(guid);
            if (afterState) {
              undoRedoManager.recordPatternAction({
                type: 'edit_nodes',
                patternGuid: guid,
                beforeState,
                afterState,
                metadata: {
                  action: 'keyboard_move',
                  direction: event.key,
                  distance: wrapDistance,
                  // Store info about which subpatterns were moved for proper restoration
                  movedSubpatterns: surfaceManager.globalSelectedHandlers
                    .filter(item => item.pattern._parentPattern && item.pattern._parentPattern._guid === guid)
                    .map(item => item.pattern._guid)
                }
              });
            }
          });

          // Save immediately after recording all undo/redo actions
          surfaceManager.saveSlectedSurface();

          // Update the surface
          this._app.render();
          toastInfo(`Moved ${surfaceManager.globalSelectedHandlers.length} point(s) ${event.key.replace('Arrow', '')}`, 1000);
        }
      }
  }

  keyUpHandler = (event: KeyboardEvent) => {
     if (surfaceManager.isSwitchingBoards) return;
     
     // Prevent actions when typing in input fields
     const target = event.target as HTMLElement;
     const isTypingInInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
     if (isTypingInInput) {
       // Still allow modifier key state updates even when typing
       if (!event.ctrlKey) {
         this.ctrlKey = false;
       }
       if (!event.shiftKey) {
         this.shiftKey = false;
       }
       if (event.code === 'Space') {
         this.spaceBarPressed = false;
       }
       return;
     }
     
     // Block all actions when focal pivot mode is active (except modifier key state updates)
     if (this.customPivotMode) {
       // Still allow modifier key state updates
       if (!event.ctrlKey) {
         this.ctrlKey = false;
       }
       if (!event.shiftKey) {
         this.shiftKey = false;
       }
       if (event.code === 'Space') {
         this.spaceBarPressed = false;
       }
       return;
     }
     
    // check if Ctrl or Cmd key is released
    // check if Ctrl or Cmd key is pressed
    if (!event.ctrlKey) {
      this.ctrlKey = false;
    }
    // check if Shift key is pressed
    if (!event.shiftKey) {
      this.shiftKey = false;
    }

    // check delete key
    if (event.key === 'Delete') {

      
      if (this._isEditing && surfaceManager.globalSelectedHandlers.length > 0) {
        ppConfirm('Delete', 'Do you want to delete the selected points?').then((result) => {
            if (result === "ok") {
                const editionPattern = this._Patterns.find(p => p._state === 'edition');
                if (editionPattern && (editionPattern as any).deleteSelectedHandlers_edition) {
                    (editionPattern as any).deleteSelectedHandlers_edition();
                     surfaceManager.saveSlectedSurface(); // added for undo redo 
                }
            }
        });
      }
      
      else {
      this._isBtnLeftDown = false;
      
      // Check for selected nested paths
      const selectedNestedPaths = this.multiSelection.filter(p => p._parentPattern && p._state === 'selected');
      const hasMainPatternsSelected = this._Patterns.filter((pattern) => pattern._state === 'selected' && !pattern._parentPattern).length > 0;
      const hasSelected = hasMainPatternsSelected || selectedNestedPaths.length > 0;
      
      if (hasSelected && !this._isDeleting) {
        this._isDeleting = true;
        const confirmMessage = selectedNestedPaths.length > 0 && hasMainPatternsSelected
          ? 'Do you want to delete the selected patterns and nested paths?'
          : selectedNestedPaths.length > 0
          ? 'Do you want to delete the selected nested paths?'
          : 'Do you want to delete the selected patterns?';
          
        ppConfirm('Delete', confirmMessage).then((result) => {
          this._isDeleting = false;
          this.selectionBox!.isSelecting = false;
          this.selectionBox!.clear();
          if (result === "ok") {
            // Handle nested path deletion
            if (selectedNestedPaths.length > 0) {
              // Group nested paths by parent to handle index shifting correctly
              const nestedPathsByParent = new Map<typeof Pattern, typeof Pattern[]>();
              
              selectedNestedPaths.forEach(nestedPath => {
                const parent = nestedPath._parentPattern! as typeof Pattern;
                if (!nestedPathsByParent.has(parent)) {
                  nestedPathsByParent.set(parent, []);
                }
                nestedPathsByParent.get(parent)!.push(nestedPath);
              });
              
              // Process each parent's nested paths in reverse index order
              nestedPathsByParent.forEach((nestedPaths, parent) => {
                // Capture parent pattern state before deletion for undo/redo
                const parentBeforeState = undoRedoManager.capturePatternState(parent._guid);
                
                // Sort by index in reverse order (highest index first) to avoid index shifting issues
                nestedPaths.sort((a, b) => {
                  const indexA = parent.subPatterns.indexOf(a);
                  const indexB = parent.subPatterns.indexOf(b);
                  return indexB - indexA; // Reverse order
                });
                
                // Delete each nested path
                nestedPaths.forEach(nestedPath => {
                  const nestedIndex = parent.subPatterns.indexOf(nestedPath);
                  if (nestedIndex > -1) {
                    // Remove from parent's subPatterns and paths array
                    parent.subPatterns.splice(nestedIndex, 1);
                    parent._vector.paths.splice(nestedIndex, 1);
                    
                    // Dispose the nested path
                    nestedPath.dispose();
                    
                    // Remove from multiSelection
                    this.multiSelection = this.multiSelection.filter(p => p !== nestedPath);
                  }
                });
                
                // Update parent pattern display
                parent.display();
                
                // Update parent pattern's data in surfaceCollection
                const parentPatternData = surfaceCollection.selectedSurfaceData.getPattern(parent._guid);
                if (parentPatternData) {
                  parentPatternData.paths = [
                    parent._vector.generatePathString(),
                    ...parent.subPatterns.map(p => p._vector.generatePathString())
                  ];
                  surfaceCollection.selectedSurfaceData.setPattern(parentPatternData);
                }
                
                // Record undo/redo action for parent pattern
                if (parentBeforeState) {
                  const parentAfterState = undoRedoManager.capturePatternState(parent._guid);
                  if (parentAfterState) {
                    undoRedoManager.recordPatternAction({
                      type: 'delete',
                      patternGuid: parent._guid,
                      beforeState: parentBeforeState,
                      afterState: parentAfterState,
                      metadata: { 
                        isNestedPathDeletion: true,
                        deletedNestedPaths: nestedPaths.length
                      }
                    });
                  }
                }
              });
            }
            
            // Handle main pattern deletion
            const selectedMainPatterns = this._Patterns.filter((pattern) => pattern._state === 'selected' && !pattern._parentPattern);
            selectedMainPatterns.forEach((pattern) => {
              // Capture pattern state before deleting
              const patternState = undoRedoManager.capturePatternState(pattern._guid);
              
              if (patternState) {
                // Record delete action
                undoRedoManager.recordPatternAction({
                  type: 'delete',
                  patternGuid: pattern._guid,
                  beforeState: patternState,
                  afterState: undefined,
                  metadata: {}
                });
              }
              
              this.removePattern(pattern);
              surfaceCollection.removePatternFromSelectedSurface(pattern._guid);
            });
            
            // Clear multiSelection
            this.multiSelection = [];
            
            surfaceManager.saveSlectedSurface();
            this._Board.update();
          }
        });
      } 
    }
  }
if (event.code === 'Space') {
  this.spaceBarPressed = false;
  // Only revert cursor if not in the middle of a pan action
  if (!this._isPanning) {
    this._app.canvas.style.cursor = 'default';
  }
}
////////////////////////////////////////////
//copy paste 
if (event.ctrlKey) {
        switch (event.key.toLowerCase()) {
            case 'c':
                surfaceManager.copySelectedPatterns();
                event.preventDefault();
                break;
            case 'v':
                surfaceManager.initiatePaste();
                event.preventDefault();
                break;
        }
    }

//////////////////////////////c center board/////////////////////

if (event.key === 'b' && event.ctrlKey) {
surfaceManager.centerBoard()
}
/////////////////////////
if (event.key === 'g' && event.ctrlKey) {
    const selectedPatterns = this._Patterns.filter(p => p._state === 'selected');
    if (selectedPatterns.length >= 2) {
      surfaceManager.groupPatterns(selectedPatterns);
    }
  }


if (event.key === 'u' &&  event.ctrlKey) {
    // Get all selected nested paths (from multiSelection)
    const selectedNestedPaths = this.multiSelection.filter(p => p._parentPattern && p._state === 'selected');
    
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
      (async () => {
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
      })().catch(err => {
        console.error("Error ungrouping nested paths:", err);
        toastWarning("Error ungrouping nested paths");
      });
      
      event.preventDefault();
      return;
    }
    
    // Fall back to main pattern selection
    const selectedPattern = this._Patterns.find(p => p._state === 'selected' || p._state === 'edition');
    if (selectedPattern) {
      surfaceManager.ungroupPatterns(selectedPattern).catch(err => {
        console.error("Error ungrouping pattern:", err);
        toastWarning("Error ungrouping pattern");
      });
      event.preventDefault();
    }
  }

  // Handle Ctrl + Z for undo
  if (event.key === 'z' && event.ctrlKey) {
    const action = undoRedoManager.undo();
    if (action) {
      undoRedoManager.applyPatternAction(action, true);
      toastSuccess("Undo completed", 1500);
    } else {
      toastInfo("Nothing to undo", 1500);
    }
    event.preventDefault();
  }

  // Handle Ctrl + Y for redo
  if (event.key === 'y' && event.ctrlKey) {
    const action = undoRedoManager.redo();
    if (action) {
      undoRedoManager.applyPatternAction(action, false);
      toastSuccess("Redo completed", 1500);
    } else {
      toastInfo("Nothing to redo", 1500);
    }
    event.preventDefault();
  }

  // Handle F1 for help (input field check is now at the top of keyDownHandler)
  if (event.key === 'F1') {
    const shortcutsPopup = getUow<ShortcutsPopup>("shortcutsPopup");
    if (shortcutsPopup) {
      shortcutsPopup.show();
    }
    event.preventDefault();
  }

  // Zoom In: Ctrl + Plus or Ctrl + =
  if (event.ctrlKey && (event.key === '+' || event.key === '=' || event.code === 'Equal')) {
    if ((window as any).noAction === true) return;
    let newScale = this.zoomFactor * Math.exp(1 * 0.3);
    newScale = Math.max(0.1, Math.min(100, newScale));
    if (newScale > 100) {
      newScale = 100;
    }
    this.zoomFactor = newScale;
    this.display();
    event.preventDefault();
  }

  // Zoom Out: Ctrl + Minus
  if (event.ctrlKey && (event.key === '-' || event.code === 'Minus')) {
    if ((window as any).noAction === true) return;
    let newScale = this.zoomFactor / Math.exp(1 * 0.3);
    newScale = Math.max(0.1, Math.min(100, newScale));
    if (newScale < 0.1) {
      newScale = 0.1;
    }
    this.zoomFactor = newScale;
    this.display();
    event.preventDefault();
  }

  // Rotate: R (only when not in edit mode and pattern selected)
  if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    if ((window as any).noAction === true) return;
    const selected = this._Patterns.find(p => p._state === "selected");
    
    if (selected) {
      // Store before states for undo/redo
      const beforeState = undoRedoManager.capturePatternState(selected._guid);
      
      // Perform rotation
      selected._rotation += liveConfig._rotation;
      selected.applyTransformations({ rotate: true, translate: false });
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
      
      surfaceManager.saveSlectedSurface();
      event.preventDefault();
    }
  }

  // Mirror: M (only when not in edit mode)
  if (event.key.toLowerCase() === 'm' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    const selectedPattern = this._Patterns.find(p => p._state === 'selected');
    if (selectedPattern) {
      const mainFrame = getUow<MainFrame>("mainFrame");
      let mirroringPopup = mainFrame.children.find(c => c instanceof MirroringPopup) as MirroringPopup;
      
      if (!mirroringPopup) {
        mirroringPopup = new MirroringPopup();
        mainFrame.children.push(mirroringPopup);
      }
      
      mirroringPopup.toggle();
      mainFrame.update();
      event.preventDefault();
    } else {
      toastWarning("Select a pattern to mirror");
    }
  }

  // Align Center: Ctrl + Shift + C
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c') {
    surfaceManager.alignPatternsByCenter();
    event.preventDefault();
  }

  // Weld: W (only when not in edit mode)
  if (event.key.toLowerCase() === 'w' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    const selectedPatterns = this.multiSelection.length > 0 
      ? this.multiSelection 
      : this._Patterns.filter(p => p._state === "selected");
    
    if (selectedPatterns.length === 2) {
      surfaceManager.weldPatterns(selectedPatterns[0], selectedPatterns[1]);
      event.preventDefault();
    } else {
      toastWarning("Select exactly 2 patterns to weld");
    }
  }

  // Partial Wrap: P (only when not in edit mode)
  if (event.key.toLowerCase() === 'p' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    const inWrap = this._Patterns.find(p => p._state === "wrap");
    if (inWrap) {
      inWrap.setState("");
      this.activationWrap = false;
      event.preventDefault();
      return;
    }
    
    const selected = this._Patterns.find(p => p._state === "selected");
    if (selected) {
      selected.setState("wrap");
      this.activationWrap = true;
      event.preventDefault();
    } else {
      toastWarning("Select a pattern for partial wrap");
    }
  }

  // Bump (Segment Mode): B (only when not in edit mode)
  if (event.key.toLowerCase() === 'b' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    if (segmentManager.isActive()) {
      segmentManager.deactivate();
      toastInfo("Segment mode deactivated");
      event.preventDefault();
    } else {
      const selected = this._Patterns.find(p => p._state === "selected");
      if (selected) {
        selected.setState('');
        segmentManager.activate(selected);
        toastInfo("Click segments to select, then use arrows to move them");
        event.preventDefault();
      } else {
        toastWarning("Select a pattern to enter segment mode");
      }
    }
  }

  // Outward: O (only when not in edit mode)
  if (event.key.toLowerCase() === 'o' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    // Check for nested path selected via Shift+Click
    const selectedNestedPaths = this.multiSelection.filter(p => p._parentPattern && p._state === 'selected');
    
    // Verify only one nested path is selected
    if (selectedNestedPaths.length > 1) {
      toastWarning("Please select only one nested path for outward operation");
      event.preventDefault();
      return;
    }
    
    let targetPattern: typeof Pattern | null = null;
    
    if (selectedNestedPaths.length === 1) {
      targetPattern = selectedNestedPaths[0];
    } else {
      // Fall back to main pattern selection
      targetPattern = this._Patterns.find(p => p._state === "selected" && !p._parentPattern) || null;
    }
    
    if (targetPattern) {
      // Check if this is a nested path (selected via Shift+Click)
      if (targetPattern._parentPattern) {
        // Handle nested path outward operation
        const parentPattern = targetPattern._parentPattern;
        const nestedIndex = parentPattern.subPatterns.indexOf(targetPattern);
        
        if (nestedIndex === -1) {
          toastWarning("Could not find nested path in parent pattern");
          event.preventDefault();
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
        this.selectionBox!.isSelecting = false;
        event.preventDefault();
        return;
      }
      
      // Handle main pattern outward operation (existing code)
      const selected = targetPattern;
      if (selected) {
      const beforeState = undoRedoManager.capturePatternState(selected._guid);
      const wrapValue = liveConfig.unitOfMeasure === 3
        ? liveConfig.wrapDistance * 25.4
        : liveConfig.wrapDistance;
      
      const oldGuid = selected._guid;
      const oldMainPath = selected._vector.generatePathString();
      const oldSubPaths = selected.subPatterns.map(p => p._vector.generatePathString());
      const oldRotation = selected._rotation;
      const oldUnzoomedX = selected.unZoomed(selected.x);
      const oldUnzoomedY = selected.unZoomed(selected.y);
      const oldOriginalPos = selected._vector.originalPosition;
      const baseX = oldUnzoomedX - oldOriginalPos.x;
      const baseY = oldUnzoomedY - oldOriginalPos.y;
      const isGroup = selected.isGroup;
      
      const newOutwardPath = createExternalOutwardPolygon(oldMainPath, wrapValue);
      let nestedPaths: string[] = [];
      if (liveConfig.doubleCut) {
        nestedPaths = [oldMainPath, ...oldSubPaths];
      } else {
        nestedPaths = oldSubPaths;
      }
      
      this.removePattern(selected as typeof Pattern);
      surfaceCollection.selectedSurfaceData.removePattern(oldGuid);
      
      const newPattern = this.addPath(newOutwardPath, {
        guid: oldGuid,
        nestedPaths: nestedPaths,
        noNormilize: false,
      });
      
      const newOriginalPos = newPattern._vector.originalPosition;
      newPattern.x = newPattern.zoomed(baseX + newOriginalPos.x);
      newPattern.y = newPattern.zoomed(baseY + newOriginalPos.y);
      newPattern._rotation = oldRotation;
      newPattern._vectorRotation = oldRotation;
      newPattern.isGroup = isGroup;
      
      newPattern.display();
      newPattern.subPatterns.forEach(subPattern => {
        subPattern._rotation = oldRotation;
        subPattern._vectorRotation = oldRotation;
      });
      
      surfaceCollection.selectedSurfaceData.addPattern({
        ...beforeState!,
        guid: oldGuid,
        paths: [newOutwardPath, ...nestedPaths],
        boardPosition: { x: newPattern.x, y: newPattern.y },
        boardAngle: newPattern._rotation,
      });
      
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
      this.selectionBox!.isSelecting = false;
      event.preventDefault();
    } else {
      toastWarning("Select a pattern for outward");
    }
  }
  }
  // Inward: I (only when not in edit mode)
  if (event.key.toLowerCase() === 'i' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    // Check for nested path selected via Shift+Click
    const selectedNestedPaths = this.multiSelection.filter(p => p._parentPattern && p._state === 'selected');
    
    // Verify only one nested path is selected
    if (selectedNestedPaths.length > 1) {
      toastWarning("Please select only one nested path for inward operation");
      event.preventDefault();
      return;
    }
    
    let targetPattern: typeof Pattern | null = null;
    
    if (selectedNestedPaths.length === 1) {
      targetPattern = selectedNestedPaths[0];
    } else {
      // Fall back to main pattern selection
      targetPattern = this._Patterns.find(p => p._state === "selected" && !p._parentPattern) || null;
    }
    
    if (targetPattern) {
      // Check if this is a nested path (selected via Shift+Click)
      if (targetPattern._parentPattern) {
        // Handle nested path inward operation
        const parentPattern = targetPattern._parentPattern;
        const nestedIndex = parentPattern.subPatterns.indexOf(targetPattern);
        
        if (nestedIndex === -1) {
          toastWarning("Could not find nested path in parent pattern");
          event.preventDefault();
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
        this.selectionBox!.isSelecting = false;
        event.preventDefault();
        return;
      }
      
      // Handle main pattern inward operation (existing code)
      const selected = targetPattern;
      if (selected) {
        const beforeState = undoRedoManager.capturePatternState(selected._guid);
        const wrapValue = liveConfig.unitOfMeasure === 3
          ? liveConfig.wrapDistance * 25.4
          : liveConfig.wrapDistance;
        
        selected._vector.shrink(wrapValue);
        selected.setState("");
        selected.display();
        
        const afterState = undoRedoManager.capturePatternState(selected._guid);
        if (beforeState && afterState) {
          undoRedoManager.recordPatternAction({
            type: 'inward',
            patternGuid: selected._guid,
            beforeState: beforeState,
            afterState: afterState,
            metadata: { wrapValue: wrapValue }
          });
        }
        
        surfaceManager.saveSlectedSurface();
        this.selectionBox!.isSelecting = false;
        event.preventDefault();
      }
    } else {
      toastWarning("Select a pattern for inward");
    }
  }

  // Split: S (only when not in edit mode)
  if (event.key.toLowerCase() === 's' && !event.ctrlKey && !event.shiftKey && !this._isEditing) {
    const inSplit = this._Patterns.find(p => p._state === "split");
    if (inSplit) {
      this.splitLine!.canBeUsed = false;
      (this as any).splitLine!.splitPoint1 = null;
      (this as any).splitLine!.splitPoint2 = null;
      this.splitLine!.clear();
      inSplit._state = "";
      inSplit.display();
      event.preventDefault();
      return;
    }
    
    const selected = this._Patterns.find(p => p._state === "selected");
    if (selected) {
      selected.setState("split");
      this.splitLine!.canBeUsed = true;
      event.preventDefault();
    } else {
      toastWarning("Select a pattern to split");
    }
  }

  // Remove Sub Patterns: Ctrl + Shift + P
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
    const pattern = this._Patterns.find(p => p._state === "selected");
    if (pattern) {
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
      event.preventDefault();
    } else {
      toastWarning("Select a pattern to remove sub-patterns");
    }
  }



  }


  mousemoveHandler = (_event: MouseEvent) => {
     if (surfaceManager.isSwitchingBoards) return;

      if (this._isPanning) {
      const dx = _event.offsetX - this._lastMousePos.x;
      const dy = _event.offsetY - this._lastMousePos.y;
      this._lastMousePos = { x: _event.offsetX, y: _event.offsetY };

        this._app.stage.position.x += dx;
        this._app.stage.position.y += dy;
        this._app.render();
        
        // Mark as dragged if we actually moved (to suppress accidental clicks after panning)
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          this._didDrag = true;
        }
        
        return;
    }

    if (this._isBtnLeftDown) {
      if (this.shiftKey) return;
      
      // Block pattern dragging if RotationSelectionBox is currently interacting (rotating or dragging)
      if (this.rotationSelectionBox && this.rotationSelectionBox.isInteracting()) {
        // Don't process pattern dragging during rotation/rotation-box-drag
        // Clear any ready for drag state to prevent accidental drags
        this._Patterns.forEach((pattern) => {
          pattern._readyForDrag = false;
        });
      } else {
      let multiPatternSelected: typeof Pattern | null = null;
      let deltaX = 0;
      let deltaY = 0;

      this._Patterns.forEach((pattern) => {
        if (pattern._readyForDrag || pattern._dragging) {
          const evt = this.updateMouseEvent(_event);
          pattern.x += evt.offsetX - pattern._dragStartPoint.x;
          pattern.y += evt.offsetY - pattern._dragStartPoint.y;
          deltaX = evt.offsetX - pattern._dragStartPoint.x;
          deltaY = evt.offsetY - pattern._dragStartPoint.y;
          pattern._dragStartPoint = { x: evt.offsetX, y: evt.offsetY };
          pattern._dragging = true;
          this._didDrag = true;
          multiPatternSelected = pattern;
          clearTimeout(pattern._timeoutDragIdx);
          pattern._timeoutDragIdx = setTimeout(() => {
           surfaceManager.saveSlectedSurface();
          }, 350) as any;
        }
      });

      if (this.multiSelection.length > 0 && multiPatternSelected) {
        this.multiSelection.forEach((pattern) => {
          if (pattern !== multiPatternSelected) {
            pattern.x += deltaX;
            pattern.y += deltaY;
            clearTimeout(pattern._timeoutDragIdx);
            pattern._timeoutDragIdx = setTimeout(() => {
              surfaceManager.saveSlectedSurface();
            }, 350) as any;
          }
        });
      }

      if (this._Board._displayMaterialUsage) {
        this._Board.update();
      }
      } // End of else block for rotation box check


    }

    // Handle ruler mode first
    if (this.rulerMode && this.rulerTool) {
      const evt = this.updateMouseEvent(_event);
      this.rulerTool.updateMeasuring(evt.offsetX, evt.offsetY);
    }

    // Check for edition mode patterns first (for multi-selection)
    const editionPattern = this._Patterns.find((pattern) => pattern._state === 'edition');
    if (editionPattern && (editionPattern as any).onMouseMove_edition) {
      const evt = this.updateMouseEvent(_event);
      (editionPattern as any).onMouseMove_edition({
        x: evt.offsetX,
        y: evt.offsetY
      });

      // Also handle sub-patterns in edition mode
      editionPattern.subPatterns.forEach(subPattern => {
        if (subPattern._state === 'edition' && (subPattern as any).onMouseMove_edition) {
          (subPattern as any).onMouseMove_edition({
            x: evt.offsetX,
            y: evt.offsetY
          });
        }
      });
    }

    // Check for bikini mode
    const bikiniPattern = this._Patterns.find((pattern) => pattern._state === 'bikini');
    if (bikiniPattern) {
      const evt = this.updateMouseEvent(_event);
      if ((bikiniPattern as any).onMouseMove_bikini) {
        (bikiniPattern as any).onMouseMove_bikini(evt.offsetX, evt.offsetY);
      }
    }

    if (this.activationWrap) {
      this.pointSelection!.visible = true;
      //this.pointSelection!.x = _event.offsetX;
      //this.pointSelection!.y = _event.offsetY;

      const getEdited = this._Patterns.find((pattern) => pattern._state === 'wrap');
      if (getEdited) {
        let closestPoint = null as IPoint | null;
        let closestDistance = 1000000;
        getEdited._vector.getCommands().forEach((command) => {
          if (command instanceof MoveCommand) return;
              const p = (command as LCommand).getNearestPoint({
                x: (_event.offsetX  - getEdited.x - this._app.stage.x) / this.zoomFactor,
                y: (_event.offsetY - getEdited.y - this._app.stage.y) / this.zoomFactor
              },0.1);
              const distance = p[1];
              if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = p[0];
              }
        });

        /*const mousePoint = {
          x: (_event.offsetX  - getEdited.x - this._app.stage.x),
          y: (_event.offsetY - getEdited.y - this._app.stage.y)
        };

        const finalPoint = {
          x: closestPoint!.x * this.zoomFactor + getEdited.x,
          y: closestPoint!.y * this.zoomFactor + getEdited.y
        };*/

        //const distance = Math.sqrt((finalPoint.x - mousePoint.x) ** 2 + (finalPoint.y - mousePoint.y) ** 2);
        //if (distance < 10) {
          this.pointSelection!.x = (closestPoint!.x ) * this.zoomFactor + getEdited.x,
          this.pointSelection!.y = (closestPoint!.y ) * this.zoomFactor + getEdited.y;
        //}
      }
      return;
    }

    this._registeredItems.forEach(item => { 
      if (item.destroyed) return;
      item.onRawEventMouseMove?.({ x: _event.offsetX, y: _event.offsetY, button: _event.button });
    });
    // Surface events first
   


    const event = this.updateMouseEvent(_event);
    let hasBeenProcessed = false;
    this._registeredItems.forEach(item => {
      if (item.destroyed) return;
      if (!item.interactive) return;
      if (!item.visible) return;
      if (hasBeenProcessed) return;
      const localPoint = item.toLocal(new Point(_event.offsetX, _event.offsetY));
      // dragging
      if (item._isDragging && event.buttons === 1) {
        item.onEventDrag({x: event.offsetX, y: event.offsetY});
        hasBeenProcessed = true;

        return;
      }

      // Drag start
      if (item._readyForDrag && item.hitArea?.contains?.(localPoint.x, localPoint.y) && event.buttons === 1) {
        item._readyForDrag = false;
        item._isDragging = true;
        item.onEventDrag({x: event.offsetX, y: event.offsetY});
        return;
      }

      // Over In / out
      if (item.hitArea?.contains?.(localPoint.x, localPoint.y)) {
        item._isOut && (item._isOut = false);
        if (!item._isOver) {
          item._isOver = true;
          item.onEventOver();
        }
      } else {
        item._isOver && (item._isOver = false);
        if (!item._isOut) {
          item._isOut = true;
          item.onEventOut();
        }
      }
    });
  }
  
  mousedownHandler = (_event: MouseEvent) => {
     if (surfaceManager.isSwitchingBoards) return;

if (this.isPanMode && _event.button === 0) {
        this._isPanning = true;
        this._lastMousePos = { x: _event.offsetX, y: _event.offsetY };
        this._app.canvas.style.cursor = 'grabbing';
        return;
    }


       if (_event.button === 2 || (_event.button === 0 && this.spaceBarPressed)) {
      this._isPanning = true;
      this._lastMousePos = { x: _event.offsetX, y: _event.offsetY };
   this._app.canvas.style.cursor = 'grabbing';
     
      return;
    }
     this._app.canvas.style.cursor = 'default';
    this._isBtnLeftDown = _event.button === 0;

    // Handle ruler mode - don't process other events when in ruler mode
    if (this.rulerMode && this._isBtnLeftDown && this.rulerTool) {
      const evt = this.updateMouseEvent(_event);
      this.rulerTool.startMeasuring(evt.offsetX, evt.offsetY);
      _event.stopPropagation();
      _event.preventDefault();
      return;
    }

    // Check if annotation popup is active - disable pattern selection
    if ((this as any)._annotationPopup && (this as any)._annotationPopup.isVisible) {
      // Still allow annotation placement
      return;
    }
////////////////////////////
    // Pass mouse down event to registered items (including SelectionBox)
    this._registeredItems.forEach(item => { 
      if (item.destroyed) return;
      item.onRawEventMouseDown?.({ 
        x: _event.offsetX, 
        y: _event.offsetY, 
        button: _event.button,
        ctrlKey: _event.ctrlKey,
        shiftKey: _event.shiftKey
      });
    });

    // Check for edition mode patterns first (for multi-selection)
    // Skip edition mode handlers when activatePointSelection is true
    if (!this.activatePointSelection) {
      const editionPattern = this._Patterns.find((pattern) => pattern._state === 'edition');
      if (editionPattern && (editionPattern as any).onMouseDown_edition) {
        const evt = this.updateMouseEvent(_event);
        (editionPattern as any).onMouseDown_edition({
          x: evt.offsetX,
          y: evt.offsetY,
          shiftKey: _event.shiftKey,
          ctrlKey: _event.ctrlKey
        });

        // Also handle sub-patterns in edition mode
        editionPattern.subPatterns.forEach(subPattern => {
          if (subPattern._state === 'edition' && (subPattern as any).onMouseDown_edition) {
            (subPattern as any).onMouseDown_edition({
              x: evt.offsetX,
              y: evt.offsetY,
              shiftKey: _event.shiftKey,
              ctrlKey: _event.ctrlKey
            });
          }
        });
      }
    }

    // Surface events first
  
    // Check if any pattern is in edition mode - if so, skip pattern selection entirely
    const hasEditionPattern = this._Patterns.some(p => p._state === 'edition');

    // Block pattern selection when pan mode is active
    if (this.isPanMode) {
      return;
    }
    
    // Block pattern selection when segment mode is active
    if (segmentManager.isActive()) {
      return;
    }

    // Block pattern selection when custom pivot mode is active
    if (this.customPivotMode) {
      return;
    }

    // Block pattern selection when split mode, bikini mode, or wrap mode is active
    const hasSplitPattern = this._Patterns.some(p => p._state === 'split');
    const hasBikiniPattern = this._Patterns.some(p => p._state === 'bikini');
    const hasWrapPattern = this._Patterns.some(p => p._state === 'wrap');
    if (hasSplitPattern || hasBikiniPattern || hasWrapPattern) {
      return;
    }

    if (_event.button === 0 && !_event.ctrlKey && !this.activatePointSelection && !hasEditionPattern) {
      // Only handle drag preparation when Ctrl is NOT held
      // (Ctrl+Click is handled in clickHandler for multi-selection)
      // Skip when in point insertion mode or edit mode
      
      // Block pattern selection if clicking on RotationSelectionBox
      if (this.rotationSelectionBox && this.rotationSelectionBox.isClickOnBox({ x: _event.offsetX, y: _event.offsetY })) {
        return; // Don't process pattern selection when clicking on rotation box
      }
      
      // Block pattern selection if RotationSelectionBox is currently interacting
      if (this.rotationSelectionBox && this.rotationSelectionBox.isInteracting()) {
        return; // Don't process pattern selection during rotation/drag
      }
      
      const evt = this.updateMouseEvent(_event);
      const hitPatterns: typeof Pattern[] = [];
      
      this._Patterns.forEach((pattern) => {
        const hitted = pattern.hitTest({
          x: evt.offsetX,
          y: evt.offsetY
        });
        if (hitted && (pattern._state === '' || pattern._state === 'selected')) {
          hitPatterns.push(pattern);
        } else {
         pattern._readyForDrag = false;
       }
      });
      
      // If we have hit patterns, select only the LAST one (topmost in z-order)
      if (hitPatterns.length > 0) {
        // The last pattern in the array is the topmost (rendered last, so on top)
        const selectedPattern = hitPatterns[hitPatterns.length - 1];
        
        selectedPattern.setState('selected');
        
        // Capture state before starting drag for undo/redo
        (selectedPattern as any)._stateBeforeTransform = undoRedoManager.capturePatternState(selectedPattern._guid);
        
        selectedPattern._readyForDrag = true;
        selectedPattern._dragStartPoint = { x: evt.offsetX, y: evt.offsetY };
        
        // Deselect all other patterns
        
        if (this.multiSelection.length === 0 || this.multiSelection.filter((p) => p === selectedPattern).length === 0) {
          this.multiSelection.forEach(_ => {
            _.setState('');
          })
          this.multiSelection = [];
          this._Patterns.forEach((_pattern) => {
            if (_pattern !== selectedPattern && _pattern._state === 'selected') {
              _pattern.setState('');
            }
          });
        }
      }
     
    } else if (_event.button === 0 && _event.ctrlKey && !this.activatePointSelection && !hasEditionPattern) {
      // When Ctrl is held, just mark patterns as ready for drag if they're already selected
      // Don't change selection state - let clickHandler handle it
      // Skip when in point insertion mode or edit mode
      const evt = this.updateMouseEvent(_event);
      
      this._Patterns.forEach((pattern) => {
        const hitted = pattern.hitTest({
          x: evt.offsetX,
          y: evt.offsetY
        });
        if (hitted && pattern._state === 'selected') {
          // Pattern is already selected and being clicked with Ctrl
          pattern._readyForDrag = true;
          pattern._dragStartPoint = { x: evt.offsetX, y: evt.offsetY };
          (pattern as any)._stateBeforeTransform = undoRedoManager.capturePatternState(pattern._guid);
        } else if (!hitted) {
          pattern._readyForDrag = false;
        }
      });
    }

    this.updateMouseEvent(_event);
    let hasBeenProcessed = false;

    this._registeredItems.forEach(item => {
      if (item.destroyed) return;
      if (!item.interactive) return;
      if (!item.visible) return;
      if (hasBeenProcessed) return;

      const localPoint = item.toLocal(new Point(_event.offsetX, _event.offsetY));
      if (item.hitArea?.contains?.(localPoint.x, localPoint.y)) {
        if (!item._isDragging  && !item._readyForDrag) {
          item._readyForDrag = true;
          hasBeenProcessed = true;
          return;
        }
      }
    });
  }


  mouseupHandler = (_event: MouseEvent) => {
     if (surfaceManager.isSwitchingBoards) return;
    this._isBtnLeftDown = false;

    if (this.isPanMode) {
        this._isPanning = false;
        this._app.canvas.style.cursor = 'grab';
    }
    // Handle ruler mode only for left button
    if (this.rulerMode && this.rulerTool && _event.button === 0) {
      this.rulerTool.endMeasuring();
      _event.stopPropagation();
      _event.preventDefault();
      return;
    }

    this._registeredItems.forEach(item => { 
      if (item.destroyed) return;
      item.onRawEventMouseUp?.({ x: _event.offsetX, y: _event.offsetY, button: _event. button });
    });

    // Check for edition mode patterns first (for multi-selection)
    // Skip edition mode handlers when activatePointSelection is true
    if (!this.activatePointSelection) {
      const editionPattern = this._Patterns.find((pattern) => pattern._state === 'edition');
      if (editionPattern && (editionPattern as any).onMouseUp_edition) {
        const evt = this.updateMouseEvent(_event);
        (editionPattern as any).onMouseUp_edition({
          x: evt.offsetX,
          y: evt.offsetY
        });
   
        // Also handle sub-patterns in edition mode
        editionPattern.subPatterns.forEach(subPattern => {
          if (subPattern._state === 'edition' && (subPattern as any).onMouseUp_edition) {
            (subPattern as any).onMouseUp_edition({
              x: evt.offsetX,
              y: evt.offsetY
            });
          }
        });
      }
    }

    // Surface events first
    this._isPanning = false;
    const hadPatternDragging = this._Patterns.some(p => p._dragging);
    this._Patterns.forEach((pattern) => {
      if (pattern._state === 'selected') {
        // If pattern was being dragged, record the transformation for undo/redo
        if (pattern._dragging && (pattern as any)._stateBeforeTransform) {
          const stateAfter = undoRedoManager.capturePatternState(pattern._guid);
          
          if (stateAfter) {
            undoRedoManager.recordPatternAction({
              type: 'move',
              patternGuid: pattern._guid,
              beforeState: (pattern as any)._stateBeforeTransform,
              afterState: stateAfter,
              metadata: {}
            });
          }
          
          delete (pattern as any)._stateBeforeTransform;
        }
        
        pattern._readyForDrag = false;
        pattern._dragging = false;
      }
    });

    if (hadPatternDragging || this._didDrag) {
      this._suppressNextClick = true;
      this._didDrag = false;
      // Emit event for material usage update
      _evtBus.emit("patternMoved");
    }

    const event = this.updateMouseEvent(_event);
    let hasBeenProcessed = false;

    this._registeredItems.forEach(item => {
      if (item.destroyed) return;
      if (!item.interactive) return;
      if (!item.visible) return;

      if (item._isDragging) {
        item._isDragging = false;
        hasBeenProcessed = true;
        item.onEventDrop({x: event.offsetX, y: event.offsetY});
        return;
      }

      if (item._readyForDrag) {
        item._readyForDrag = false;
        hasBeenProcessed = true;
        return;
      }
    });
  }

  /**
   * Recursively finds the deepest nested subpattern that contains the click point
   * @param pattern The pattern to check
   * @param point The click coordinates (in global/surface space)
   * @returns The deepest subpattern clicked, or null if none found
   */
  private findDeepestClickedSubPattern(pattern: typeof Pattern, point: IPoint): typeof Pattern | null {
    // Check if this pattern has subpatterns
    if (!pattern.subPatterns || pattern.subPatterns.length === 0) {
      return null;
    }

    // Get the parent's absolute position for calculating subpattern positions
    const parentAbsPos = pattern.getAbsolutePosition();

    // Check each subpattern (in reverse order to respect z-order - last drawn is topmost)
    for (let i = pattern.subPatterns.length - 1; i >= 0; i--) {
      const subPattern = pattern.subPatterns[i];
      
      // For consistent hit testing, use the same approach as main patterns:
      // The point coordinates passed in have stage offset already subtracted (from updateMouseEvent)
      // So we need to add stage offset back when comparing with container bounds
      const bounds = subPattern.container.getBounds();
      
      // Get stage offset
      const stageX = this._app.stage.x;
      const stageY = this._app.stage.y;
      
      // Convert click point back to screen space to match bounds
      const clickXScreen = point.x + stageX;
      const clickYScreen = point.y + stageY;
      
      if (bounds.width > 0 && bounds.height > 0) {
        const inBounds = clickXScreen >= bounds.x && clickXScreen <= bounds.x + bounds.width &&
                        clickYScreen >= bounds.y && clickYScreen <= bounds.y + bounds.height;
        
        if (inBounds) {
          // Now do precise polygon hit test using the same coordinates as main patterns
          // Use the transformed coordinates (with stage offset subtracted)
          const absolutePos = subPattern.getAbsolutePosition();
          
          // Use subPattern's hitTest method directly (it expects transformed coordinates)
          const isHit = subPattern.hitTest(point);
          
          if (isHit) {
            // Recursively check if there's an even deeper nested pattern
            const deeperPattern = this.findDeepestClickedSubPattern(subPattern as typeof Pattern, point);
            
            // Return the deepest nested pattern found, or this subpattern if no deeper one exists
            return deeperPattern || (subPattern as typeof Pattern);
          }
        }
      }
    }

    return null;
  }

  /**
   * Clears selection state from a pattern and all its subpatterns recursively
   * @param pattern The pattern to clear
   */
  private clearPatternSelectionRecursive(pattern: typeof Pattern): void {
    if (pattern._state === 'selected') {
      pattern.setState('');
    }
    
    // Recursively clear subpatterns
    if (pattern.subPatterns && pattern.subPatterns.length > 0) {
      pattern.subPatterns.forEach(subPattern => {
        this.clearPatternSelectionRecursive(subPattern as typeof Pattern);
      });
    }
  }

  /**
   * Calculates the nesting depth of a pattern
   * @param pattern The pattern to check
   * @returns The nesting depth (0 for main patterns, 1+ for nested)
   */
  private getPatternDepth(pattern: typeof Pattern): number {
    let depth = 0;
    let current: typeof Pattern = pattern;
    
    // Walk up the parent chain to count depth
    while (current._parentPattern) {
      depth++;
      current = current._parentPattern as typeof Pattern;
    }
    
    return depth;
  }

  clickHandler = (_event: MouseEvent) => {
     if (surfaceManager.isSwitchingBoards) return;
    // Don't process clicks when ruler mode is active
    if (this.rulerMode) {
      return;
    }
    
    // Don't process clicks when pan mode is active
    if (this.isPanMode) {
      return;
    }
    
    // Don't process clicks when segment mode is active
    if (segmentManager.isActive()) {
      return;
    }

    if (this._suppressNextClick) {
      this._suppressNextClick = false;
      return;
    }
    
    if (this.customPivotMode) {
      // Don't place pivot if RotationSelectionBox is handling rotation
      // (user clicked on rotation handle/corner to rotate using the custom pivot)
      if (this.rotationSelectionBox && this.rotationSelectionBox.isInteracting()) {
        return;
      }
      if (_event.button === 0) {
        const worldPoint = this.getWorldPointFromMouse(_event);
        this.setCustomPivotPoint(worldPoint);
      }
      return;
    }

    // Check for bikini mode
    const bikiniPattern = this._Patterns.find((pattern) => pattern._state === 'bikini');
    if (bikiniPattern) {
      const evt = this.updateMouseEvent(_event);
      if ((bikiniPattern as any).onMouseClick_bikini) {
        (bikiniPattern as any).onMouseClick_bikini(evt.offsetX, evt.offsetY);
      }
      return;
    }

    // Check for split mode - block pattern selection
    const splitPattern = this._Patterns.find((pattern) => pattern._state === 'split');
    if (splitPattern) {
      // Block pattern selection when in split mode
      return;
    }

//////////////////////////////////////////////////



if (this.activatePointSelection) {
  this.activatePointSelection = false; // Turn off point selection mode
  this._app.canvas.style.cursor = 'default'; // Reset cursor

  // Ensure pointSelection graphics exist if needed later, but hide it initially
  if (this.pointSelection) {
      this.pointSelection.visible = false;
  }

  // Find the pattern currently in edition mode
  const editionPatternRoot = this._Patterns.find((pattern) => pattern._state === 'edition') as (_Pattern & TEditionPattern); // Cast for type safety

  if (editionPatternRoot) {
      // --- Find the closest segment and point info across main pattern AND subpatterns ---
      let closestPointInfo: [IPoint, number, number] | null = null; // Stores [point, distance, lengthAlongSegment]
      let closestDistance = Infinity;
      let segmentIdx = -1;
      let commandToSplit: LCommand | CCommand | QCommand | TCommand | ACommand | VCommand | null = null;
      let targetPattern: (_Pattern & TEditionPattern) | null = null; // Track which pattern (main or sub) has the closest segment

      // Check both main pattern and all subpatterns
      const patternsToCheck = [editionPatternRoot, ...editionPatternRoot.subPatterns];

      patternsToCheck.forEach(pattern => {
          const currentCommands = pattern._vector.getCommands(); // Get commands by traversing the linked list

          currentCommands.forEach((command, idx) => {
              // Skip Move commands and Close Path commands as they don't represent drawable segments to split
              if (command instanceof MoveCommand || command instanceof ZCommand) {
                  return;
              }

              // Make sure the command has the necessary method
              if (typeof (command as any).getNearestPoint !== 'function') {
                  console.warn(`Command at index ${idx} type ${command.type} does not have getNearestPoint`);
                  return; // Skip commands that can't calculate nearest point
              }

              // Calculate mouse click position relative to the pattern's origin (in unzoomed coordinates)
              const patternAbsolutePos = pattern.getAbsolutePosition(); // Get pattern's screen position
              const mouseXInPatternSpace = (_event.offsetX - patternAbsolutePos.x - this._app.stage.x) / this.zoomFactor;
              const mouseYInPatternSpace = (_event.offsetY - patternAbsolutePos.y - this._app.stage.y) / this.zoomFactor;

              // Find the nearest point on this command's segment
              // We expect [IPoint, number, number] -> [closestPoint, distanceToMouse, lengthAlongSegment]
              const p = (command as any).getNearestPoint({ x: mouseXInPatternSpace, y: mouseYInPatternSpace }, 0.01); // Use a smaller step for better precision if needed

              // Validate the result
              if (p && Array.isArray(p) && p.length >= 2 && typeof p[1] === 'number' && isFinite(p[1])) {
                  const distance = p[1]; // Distance from mouse click to the nearest point on the segment
                  if (distance < closestDistance) {
                      closestDistance = distance;
                      closestPointInfo = p as [IPoint, number, number]; // Store the full result
                      segmentIdx = idx;
                      commandToSplit = command as any; // Keep track of the command instance itself
                      targetPattern = pattern as (_Pattern & TEditionPattern); // Track which pattern this segment belongs to
                  }
              } else {
                   console.warn(`getNearestPoint returned invalid data for command at index ${idx}, type ${command.type}`, p);
              }
          });
      });

      // --- Check if a suitable segment was found within tolerance ---
      const clickTolerance = 10 / this.zoomFactor; // Tolerance in unzoomed coordinates
      if (commandToSplit && closestPointInfo && closestDistance < clickTolerance && targetPattern) {
          // Capture state BEFORE modification for undo/redo
          const patternForUndo = targetPattern._parentPattern || targetPattern; // Use parent if it's a subpattern
          const beforeState = undoRedoManager.capturePatternState(patternForUndo._guid);

          try {
              // --- Split the identified command ---
              let splitResult: { left: LCommand | CCommand | QCommand | TCommand | ACommand | VCommand; right: LCommand | CCommand | QCommand | TCommand | ACommand | VCommand } | null = null;

              // Check if the command has a 'split' method
              if (typeof (commandToSplit as any).split !== 'function') {
                   throw new Error(`Command type ${commandToSplit.type} does not support splitting.`);
              }

              // Split based on command type: L/C use length, others use point coordinates
              if ((commandToSplit instanceof LCommand || commandToSplit instanceof CCommand)) {
                  const lengthAlongSegment = closestPointInfo[2]; // Use the third element: length along segment
                  if (typeof lengthAlongSegment !== 'number' || !isFinite(lengthAlongSegment)) {
                      throw new Error(`Invalid lengthAlongSegment (${lengthAlongSegment}) for splitting ${commandToSplit.type}`);
                  }
                  splitResult = (commandToSplit as any).split(lengthAlongSegment);
              } else {
                  // For Q, T, S, A, etc., use the closest point coordinates
                  const closestPointCoords = closestPointInfo[0]; // Use the first element: {x, y}
                  if (!closestPointCoords || typeof closestPointCoords.x !== 'number' || typeof closestPointCoords.y !== 'number') {
                       throw new Error(`Invalid closestPoint coordinates for splitting ${commandToSplit.type}`);
                  }
                  splitResult = (commandToSplit as any).split(closestPointCoords);
              }


              if (!splitResult || !splitResult.left || !splitResult.right) {
                  throw new Error("Command split failed or returned invalid result.");
              }

              // --- Update the linked list ---
              commandToSplit.replaceWith(splitResult.right); // Replace original with the right part
              splitResult.right.insertbefore(splitResult.left); // Insert the left part before the right part

              // --- Crucial Fix: Ensure the internal commands[0] reference is correct ---
              const updatedCommands = targetPattern._vector.getCommands(); // Traverse the *updated* list
               // Access the internal array directly ONLY for comparison and potential update
               // Note: This assumes _vector has an internal array named "commands" storing the start reference. Adjust if named differently.
              if (targetPattern._vector["commands"] && updatedCommands[0] !== targetPattern._vector["commands"][0]) {
                 // If getCommands() derived a different start after modification, update the internal reference.
                 targetPattern._vector["commands"][0] = updatedCommands[0];
              }

              // --- Destroy old visuals and recreate ---
              targetPattern.destroySegments_edition(); // Destroy old PIXI Graphics objects for segments/handlers

              targetPattern.display(); // Recreate PIXI Graphics based on the updated command list (via getCommands)

               // --- Record undo/redo action ---
               const afterState = undoRedoManager.capturePatternState(patternForUndo._guid);
               if (afterState && beforeState) {
                  undoRedoManager.recordPatternAction({
                      type: 'edit_nodes',
                      patternGuid: patternForUndo._guid,
                      beforeState,
                      afterState,
                      metadata: { action: 'insert_point' }
                  });
               }

              surfaceManager.saveSlectedSurface(); // Persist the changes
              toastInfo('Point inserted successfully!', 1500);

          } catch (error: any) {
              console.error('❌ Error during point insertion process:', error);
               toastInfo('Failed to insert point: ' + (error?.message || 'Unknown error'), 3000);
               // Attempt to refresh display even on error to reflect any partial changes or reset visuals
               targetPattern.destroySegments_edition();
               targetPattern.display();
          }

      } else {
           // If no suitable segment was found or click was too far
           toastInfo('Click closer to the path to insert a point.', 2000);
      }
  }}
///////////////////////////////////////////
  
    if (this.activationWrap) {
      this.activationWrap = false;
      this.pointSelection!.visible = false;
      this.pointSelection!.x = _event.offsetX;
      this.pointSelection!.y = _event.offsetY;

      const getEdited = this._Patterns.find((pattern) => pattern._state === 'wrap') as typeof Pattern & TWrapPattern;
      if (getEdited && getEdited.isGroup) {
    surfaceManager.ungroupPatterns(getEdited);
      }
      if (getEdited) {
        let closestPoint = null as IPoint | null;
        let closestDistance = 1000000;
        let totalDistance = 0;
        let segmentIdx = 0;
        totalDistance = 0;
        getEdited._vector.getCommands().forEach((command, segidx) => {
        
          if (command instanceof MoveCommand) return;
              const p = (command as LCommand).getNearestPoint({
                x: (_event.offsetX  - getEdited.x - this._app.stage.x) / this.zoomFactor,
                y: (_event.offsetY - getEdited.y - this._app.stage.y) / this.zoomFactor
              },0.1);
              const distance = p[1];
              if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = p[0];
                segmentIdx = segidx;
                totalDistance = p[2];
              }
        });
        this.pointSelection!.x = 0;
        this.pointSelection!.y = 0;

        if (!getEdited.wrapPoint1) {
          getEdited.wrapPoint1 = closestPoint;
          getEdited.wrapDistance1 = totalDistance;
          getEdited.wrapSeg1Idx = segmentIdx;
          this.activationWrap = true;
          this.pointSelection!.visible = true;
          getEdited.display();
        } else if (!getEdited.wrapPoint2) {
          getEdited.wrapPoint2 = closestPoint;
          getEdited.wrapDistance2 = totalDistance;
          getEdited.wrapSeg2Idx = segmentIdx;
          getEdited.display();
        }

        if (getEdited.wrapPoint1 && getEdited.wrapPoint2) {
          // Calculate wrap distance display string
          let wrapDistance = liveConfig.wrapDistance;
          const unit = liveConfig.unitOfMeasure === 3 ? "in" : "mm";
          const wrapDistanceStr = `${wrapDistance}${unit}`;
          
          // Ask for direction and apply immediately (no confirmation popup)
          ppPartialWrapDirection(wrapDistanceStr).then((direction) => {
            if (direction === "cancel") {
              getEdited.wrapPoint1 = null;
              getEdited.wrapPoint2 = null;
              this.activationWrap = true;
              getEdited.display();
              return;
            }

            // Apply wrap directly without additional confirmation
            const splitPoint1 = getEdited.wrapPoint1;
            const splitPoint2 = getEdited.wrapPoint2;

            // Capture pattern state BEFORE partial wrap for undo/redo
            const beforeState = undoRedoManager.capturePatternState(getEdited._guid);
            
            let commands = getEdited._vector.getCommands();

                // First Point
                const res1 = (commands[getEdited.wrapSeg1Idx] as LCommand).split(getEdited.wrapDistance1);
                let res2 = (commands[getEdited.wrapSeg2Idx] as LCommand).split(getEdited.wrapDistance2);
                //if (getEdited.wrapSeg1Idx === getEdited.wrapSeg2Idx) {
                //  res2 = res1.right.split(getEdited.wrapDistance2);
               // }

                const command1 = getEdited._vector.getCommands()[getEdited.wrapSeg1Idx] as LCommand;
                let command2 = getEdited._vector.getCommands()[getEdited.wrapSeg2Idx] as LCommand;
                //if (getEdited.wrapSeg1Idx === getEdited.wrapSeg2Idx) {
                //  command2 = res1.right;
               // }

                const newCmd1 = new LCommand(splitPoint1!.x, splitPoint1!.y);
                const newCmd2 = new LCommand(splitPoint2!.x, splitPoint2!.y);

                // As path is clockwise, we need to know if we need to go from newCmd1 to newCmd2 or from newCmd2 to newCmd1
                // Get the list of commands from the vector path
                commands = getEdited._vector.getCommands();

                const cmdIndexOf = (cmdStart: LCommand, cmdEnd: LCommand) => {
                  // find the length of the path
                  let length = 0;
                  let cmdCursor = cmdStart;
                  while (cmdCursor !== cmdEnd) {
                    length += 1;
                    cmdCursor = cmdCursor.nextCommand as LCommand;
                    if (length > commands.length) {
                      return commands.length;
                    }
                  }
                  return length;
                }




                command1.replaceWith(res1.right);
                res1.right.insertbefore(res1.left);
                res1.right.insertbefore(newCmd1);

                // check if segment 1 and segment 2 are the same
                if (getEdited.wrapSeg1Idx === getEdited.wrapSeg2Idx) {
                  let closestPoint = null as IPoint | null;
                  let closestDistance = 1000000;
                  let totalDistance = 0;
                  let segmentIdx = 0;
                  totalDistance = 0;
                  getEdited._vector.getCommands().forEach((command, segidx) => {
                    if (command instanceof MoveCommand) return;
                        const p = (command as LCommand).getNearestPoint({
                          x: (_event.offsetX  - getEdited.x - this._app.stage.x) / this.zoomFactor,
                          y: (_event.offsetY - getEdited.y - this._app.stage.y) / this.zoomFactor
                        },0.1);
                        const distance = p[1];
                        if (distance < closestDistance) {
                          closestDistance = distance;
                          closestPoint = p[0];
                          segmentIdx = segidx;
                          totalDistance = p[2];
                        }
                      });
                      getEdited.wrapPoint2 = closestPoint;
                      getEdited.wrapDistance2 = totalDistance;
                      getEdited.wrapSeg2Idx = segmentIdx;
                      getEdited.display();
                      // We need to reload teh list of commands as we inserted some
                      commands = getEdited._vector.getCommands();
                      // We split the segment again
                      res2 = (commands[getEdited.wrapSeg2Idx] as LCommand).split(getEdited.wrapDistance2);
                      command2 = getEdited._vector.getCommands()[getEdited.wrapSeg2Idx] as LCommand;
                }



                command2.replaceWith(res2.right);
                res2.right.insertbefore(res2.left);
                res2.right.insertbefore(newCmd2);

                // Identify the index of newCmd1 and newCmd2 in the command list
                const index1 = cmdIndexOf(newCmd1, newCmd2);
                const index2 = cmdIndexOf(newCmd2, newCmd1);

                debugger

                let wrapDistance = liveConfig.wrapDistance;
                if (liveConfig.unitOfMeasure === 3) {
                  wrapDistance *= 25.4;
                }

                // Determine direction multiplier: 1 for outward (current behavior), -1 for inward
                const directionMultiplier = direction === "outward" ? 1 : -1;

                // Ensure both points exist in the sequence
                if (index1 !== -1 && index2 !== -1) {
                  const [start, end] = index1 < index2 ? [newCmd1, newCmd2] : [newCmd2, newCmd1];
                  let cmdCursor = start;

                  // Compute direction vector from start to end
                  const dx = end.endingPoint.x - start.endingPoint.x;
                  const dy = end.endingPoint.y - start.endingPoint.y;

                  // Compute the normalized perpendicular vector (-dy, dx)
                  // Apply direction multiplier to invert for inward wraps
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const perpX = (-dy / length) * wrapDistance * directionMultiplier;
                  const perpY = (dx / length) * wrapDistance * directionMultiplier;

                  // Move all points between start and end along the perpendicular vector
                  let outOfRange = getEdited._vector.getCommands().length;

                  while (cmdCursor !== end && outOfRange > 0) {
                    cmdCursor.translate(-perpX, -perpY);
                    cmdCursor = cmdCursor.nextCommand as LCommand;
                    outOfRange--;
                  }

                  const oldVector = getEdited._vector;
                  const newVector = new VectorPath();
                  newVector.parse(getEdited._vector.generatePathString());
                  newVector.paths = getEdited._vector.paths;
                  getEdited._vector = newVector;

                  const curPatternData = surfaceCollection.selectedSurfaceData.getPattern(getEdited._guid)!;
                  curPatternData.paths = [newVector.generatePathString(), ...newVector.paths];
                  curPatternData.boardAngle = getEdited._rotation;
                  curPatternData.boardPosition = { x: getEdited.x, y: getEdited.y };
                  surfaceCollection.selectedSurfaceData.setPattern(curPatternData);
                  getEdited.setState('edition');
                  getEdited.display();
                  getEdited.setState('');
                  getEdited.display();
                  getEdited.x = getEdited.x!;
                  getEdited.y = getEdited.y!;
                  getEdited.display();
                }

                getEdited.setState("");
                
                // Capture state AFTER partial wrap and record for undo/redo
                const afterState = undoRedoManager.capturePatternState(getEdited._guid);
                
                if (beforeState && afterState) {
                  undoRedoManager.recordPatternAction({
                    type: 'partial_wrap',
                    patternGuid: getEdited._guid,
                    beforeState: beforeState,
                    afterState: afterState,
                    metadata: {
                      wrapPoint1: splitPoint1,
                      wrapPoint2: splitPoint2,
                      wrapDistance: liveConfig.wrapDistance,
                      direction: direction
                    }
                  });
                }
                
                waitForMs(250).then(() => {
                 surfaceManager.saveSlectedSurface();
                });
          });

        }

       

      }
      return;
    }
  
    // ========================================================================
    // UNIFIED SELECTION LOGIC
    // ========================================================================
    
    // Don't process selection when in edit mode - let edit mode handle its own clicks
    const hasEditionPattern = this._Patterns.some(p => p._state === 'edition');
    
    if (this._isEditing && hasEditionPattern) {
      // Handle registered items (UI elements) first
      const event = this.updateMouseEvent(_event);
      let hasBeenProcessed = false;

      this._registeredItems.forEach(item => {
        if (item.destroyed) return;
        if (!item.visible) return;
        if (!item.interactive) return;
        if (item._isDragging) return;

        const localPoint = item.toLocal(new Point(_event.offsetX, _event.offsetY));
        if (item.hitArea?.contains?.(localPoint.x, localPoint.y) && !hasBeenProcessed) {
          item.onEventClick({
            x: event.offsetX,
            y: event.offsetY
          });
          hasBeenProcessed = true;
        } else {
          item.onEventClickOut();
          if (hasBeenProcessed) {
            return;
          }
        }
      });

      // CRITICAL: Block pattern selection entirely during edit mode
      // This prevents the fallthrough to normal selection logic that was causing edit mode to exit
      return;
    }
    
    // Block pattern selection when custom pivot mode is active
    if (this.customPivotMode) {
      return;
    }
    
    // Block pattern selection when in split mode, bikini mode, or wrap mode
    const hasSplitPattern = this._Patterns.some(p => p._state === 'split');
    const hasBikiniPattern = this._Patterns.some(p => p._state === 'bikini');
    const hasWrapPattern = this._Patterns.some(p => p._state === 'wrap');
    if (hasSplitPattern || hasBikiniPattern || hasWrapPattern) {
      // Block pattern selection entirely during split/bikini/wrap mode
      return;
    }
    
    const evt = this.updateMouseEvent(_event);
    const isCtrlHeld = _event.ctrlKey || _event.metaKey;
    const isShiftHeld = _event.shiftKey;
    
    // Find all patterns under click point (z-order matters - last is topmost)
    const hitPatterns: typeof Pattern[] = [];
    this._Patterns.forEach((pattern) => {
      if (pattern.hitTest({ x: evt.offsetX, y: evt.offsetY })) {
        hitPatterns.push(pattern);
      }
    });
    
    // Get the topmost pattern if any
    const clickedPattern = hitPatterns.length > 0 ? hitPatterns[hitPatterns.length - 1] : null;
    
    if (clickedPattern) {
      // ===== CLICKED ON A PATTERN =====
      
      // Determine the target pattern (main pattern or nested subpattern)
      let targetPattern: typeof Pattern = clickedPattern;
      
      if (isShiftHeld) {
        // Shift held: Try to find nested subpattern under click
        const nestedPattern = this.findDeepestClickedSubPattern(clickedPattern, { x: evt.offsetX, y: evt.offsetY });
        if (nestedPattern) {
          targetPattern = nestedPattern;
        } else {
          // No nested pattern found - do nothing (don't select main pattern)
          toastInfo("No nested path found. Shift+Click only selects nested paths.", 2000);
          return;
        }
      }
      
      // Handle selection based on modifier keys
      if (isCtrlHeld && isShiftHeld) {
        // Ctrl+Shift+Click: Toggle nested pattern in/out of multi-selection
        // Only works if we found a nested pattern (targetPattern will be nested at this point)
        if (targetPattern._state === 'selected') {
          // Deselect: Remove from selection
          targetPattern.setState('');
          this.multiSelection = this.multiSelection.filter(p => p !== targetPattern);
          toastSuccess(`Deselected nested path (depth: ${this.getPatternDepth(targetPattern)})`, 1500);
        } else {
          // Select: Add to selection
          targetPattern.setState('selected');
          
          // Deselect all main patterns when selecting a nested path
          const mainPatternsToDeselect = this.multiSelection.filter(p => !p._parentPattern);
          mainPatternsToDeselect.forEach(mainPattern => {
            mainPattern.setState('');
          });
          this.multiSelection = this.multiSelection.filter(p => p._parentPattern);
          
          // Deselect parent pattern chain if the target is a nested path
          if (targetPattern._parentPattern) {
            let parent = targetPattern._parentPattern;
            while (parent) {
              if (parent._state === 'selected') {
                parent.setState('');
                // Remove parent from multiSelection if present
                this.multiSelection = this.multiSelection.filter(p => p !== parent);
              }
              parent = parent._parentPattern;
            }
          }
          
          // Add to multiSelection if not already there
          if (!this.multiSelection.includes(targetPattern)) {
            this.multiSelection.push(targetPattern);
          }
          
          toastSuccess(`Selected nested path (depth: ${this.getPatternDepth(targetPattern)})`, 1500);
          
          // Show helpful toast on first nested multi-selection
          if (!this._hasShownMultiSelectToast && this.multiSelection.length > 1) {
            toastInfo("Hold Ctrl+Shift and click to select multiple nested paths", 3500);
            this._hasShownMultiSelectToast = true;
          }
        }
      } else if (isCtrlHeld) {
        // Ctrl+Click: Toggle pattern in/out of selection (main patterns only for backward compatibility)
        if (clickedPattern._state === 'selected') {
          // Deselect: Remove from selection
          clickedPattern.setState('');
          this.multiSelection = this.multiSelection.filter(p => p !== clickedPattern);
        } else {
          // Select: Add to selection
          clickedPattern.setState('selected');
          
          // If selecting a main pattern (not a nested path), deselect all nested paths
          if (!clickedPattern._parentPattern) {
            // Deselect all nested paths from multiSelection
            const nestedPathsToDeselect = this.multiSelection.filter(p => p._parentPattern);
            nestedPathsToDeselect.forEach(nestedPath => {
              nestedPath.setState('');
            });
            this.multiSelection = this.multiSelection.filter(p => !p._parentPattern);
          }
          
          // Add to multiSelection if not already there
          if (!this.multiSelection.includes(clickedPattern)) {
            this.multiSelection.push(clickedPattern);
          }
          
          // Show helpful toast on first multi-selection
          if (!this._hasShownMultiSelectToast && this.multiSelection.length > 1) {
            toastInfo("Hold Ctrl and click patterns to select multiple", 3500);
            this._hasShownMultiSelectToast = true;
          }
        }
      } else if (isShiftHeld) {
        // Shift+Click: Select nested pattern (clear others)
        // Clear all main patterns and their subpatterns
        this._Patterns.forEach((pattern) => {
          this.clearPatternSelectionRecursive(pattern);
        });
        
        // Clear all nested paths from multiSelection (in case there are any remaining)
        this.multiSelection.forEach(nestedPath => {
          if (nestedPath._parentPattern && nestedPath._state === 'selected') {
            nestedPath.setState('');
          }
        });
        
        // Explicitly deselect the parent pattern chain if the target is a nested path
        if (targetPattern._parentPattern) {
          let parent = targetPattern._parentPattern;
          while (parent) {
            if (parent._state === 'selected') {
              parent.setState('');
            }
            parent = parent._parentPattern;
          }
        }
        
        // Select the target nested pattern
        targetPattern.setState('selected');
        this.multiSelection = [targetPattern];
        toastSuccess(`Selected nested path (depth: ${this.getPatternDepth(targetPattern)})`, 1500);
        
        // Show helpful toast on first nested selection
        if (!this._hasShownMultiSelectToast) {
          toastInfo("Hold Shift and click to select nested paths. Use Ctrl+Shift to select multiple.", 4000);
          this._hasShownMultiSelectToast = true;
        }
      } else {
        // Normal Click: Select only this pattern (clear others)
        this._Patterns.forEach((pattern) => {
          if (pattern === clickedPattern) {
            pattern.setState('selected');
          } else if (pattern._state === 'selected') {
            pattern.setState('');
          }
        });
        this.multiSelection = [clickedPattern];
      }
      
      // Update rotation selection box
      this.updateRotationSelectionBox();
    } else {
      // ===== CLICKED ON EMPTY SPACE =====
      
      // Don't deselect if clicking on the rotation selection box
      if (this.rotationSelectionBox && this.rotationSelectionBox.isClickOnBox({ x: _event.offsetX, y: _event.offsetY })) {
        // Clicked on rotation box - don't deselect, just update it
        this.updateRotationSelectionBox();
        return;
      }
      
      if (!isCtrlHeld) {
        // Clear all selections (unless Ctrl is held to keep existing selections)
        this._Patterns.forEach((pattern) => {
          this.clearPatternSelectionRecursive(pattern);
        });
        this.multiSelection = [];
      }
      
      // Update rotation selection box
      this.updateRotationSelectionBox();
    }



    const event = this.updateMouseEvent(_event);
    let hasBeenProcessed = false;

    this._registeredItems.forEach(item => {
      if (item.destroyed) return;
      if (!item.visible) return;
      if (!item.interactive) return;
      if (item._isDragging) return;

      const localPoint = item.toLocal(new Point(_event.offsetX, _event.offsetY));
      if (item.hitArea?.contains?.(localPoint.x, localPoint.y) && !hasBeenProcessed) {
        item.onEventClick({
          x: event.offsetX,
          y: event.offsetY
        });
        hasBeenProcessed = true;
      } else {
        item.onEventClickOut();
        if (hasBeenProcessed) {
          return;
        }
      }
    });

    if (!hasBeenProcessed) {
      this._registeredItems.forEach(item => {
        if (item.destroyed) return;
        if (!item.interactive) return;
        if (!item.visible) return;
        item.onVoidClickOut();
      });
    }
  }

  dblclickHandler = (_event: MouseEvent) => {
     if (surfaceManager.isSwitchingBoards) return;
     
    // Don't process double-clicks when pan mode is active
    if (this.isPanMode) {
      return;
    }
    
    // Don't process double-clicks when segment mode is active
    if (segmentManager.isActive()) {
      return;
    }
    
    // Don't process double-clicks when focal pivot mode is active
    if (this.customPivotMode) {
      return;
    }
     
    // Surface events first
    const evt = this.updateMouseEvent(_event);
    const event = this.updateMouseEvent(_event);

    // Before changing pattern states, ensure any pending drag operations are completed
    // This prevents losing changes when user double-clicks to exit edit mode while/after dragging
    
    // Step 1: Complete any individual handler drag operations
    let hadPendingDrag = false;
    this._registeredItems.forEach(item => {
      if (item.destroyed) return;
      if (item._isDragging) {
        item._isDragging = false;
        item.onEventDrop({x: event.offsetX, y: event.offsetY});
        hadPendingDrag = true;
      }
    });
    
    // Step 2: Complete any pattern-level multi-drag operations
    // Only if there's actual dragging happening (check for global or local drag states)
    const editionPattern = this._Patterns.find((pattern) => pattern._state === 'edition');
    if (editionPattern) {
      // Check if there's any active drag state or unsaved node edits
      const hasUnsavedEdits = (editionPattern as any)._stateBeforeNodeEdit;
      const isDraggingMultiple = surfaceManager.globalIsDraggingMultiple || 
                                  (editionPattern as any).isDraggingMultiple ||
                                  (editionPattern as any).isSelecting;
      
      // Only call onMouseUp_edition if there's actual drag state to complete
      if ((isDraggingMultiple || hasUnsavedEdits) && (editionPattern as any).onMouseUp_edition) {
        // Force complete any pending drag operations
        (editionPattern as any).onMouseUp_edition({
          x: evt.offsetX,
          y: evt.offsetY
        });
        hadPendingDrag = true;
        
        // Also handle sub-patterns
        editionPattern.subPatterns.forEach(subPattern => {
          const subHasUnsavedEdits = (subPattern as any)._stateBeforeNodeEdit;
          if (subPattern._state === 'edition' && subHasUnsavedEdits && (subPattern as any).onMouseUp_edition) {
            (subPattern as any).onMouseUp_edition({
              x: evt.offsetX,
              y: evt.offsetY
            });
          }
        });
      }
    }

    // ========== SINGLE PATTERN EDIT MODE ENFORCEMENT ==========
    // Collect ALL patterns that were hit (including via subpatterns)
    const hitPatterns: typeof Pattern[] = [];
    
    this._Patterns.forEach((pattern) => {
      let isHit = false;
      
      // Check main pattern hit
      const hitted = pattern.hitTest({
        x: evt.offsetX,
        y: evt.offsetY
      });
      
      if (hitted) {
        isHit = true;
      }
      
      // Also check sub-patterns
      pattern.subPatterns.forEach(subPattern => {
        const subHitted = subPattern.hitTest({
          x: evt.offsetX,
          y: evt.offsetY
        });
        if (subHitted) {
          isHit = true;
        }
      });
      
      if (isHit) {
        hitPatterns.push(pattern);
      }
    });
    
    // Select the TOPMOST pattern (last in array = highest z-index)
    const topmostPattern = hitPatterns.length > 0 
      ? hitPatterns[hitPatterns.length - 1] 
      : null;
    
    
    // Exit ALL patterns from edition mode (enforce single edit mode)
    this._Patterns.forEach((pattern) => {
      if (pattern._state === "edition") {
        // Exit main pattern from edition mode
        (pattern as any).originalPath = "";
        pattern.setState("");
        
        // Also exit any subpatterns in edition mode
        pattern.subPatterns.forEach(subPattern => {
          if (subPattern._state === "edition") {
            (subPattern as any).originalPath = "";
            subPattern.setState("");
          }
        });
      } else {
        // For non-edition states, reset state
        (pattern as any).originalPath = "";
        pattern.setState("");
      }
    });
    
    // Enter ONLY the topmost pattern into edition mode
    if (topmostPattern) {
      // Check if pattern is in a state that can enter edition
      if (topmostPattern._state === "" || topmostPattern._state === "selected") {
        topmostPattern.setState('edition');
        this._isEditing = true;
        toastInfo("Hold Ctrl + Click & Drag to select multiple nodes", 4000);
        
        // Show feedback for overlapping patterns
        if (hitPatterns.length > 1) {
          toastInfo(`Editing topmost pattern (${hitPatterns.length} patterns overlapping)`, 2000);
        }
      }
    }
    
    // Update surface edit state
    if (!topmostPattern) {
      this._isEditing = false;
    }


    let hasBeenProcessed = false;

    this._registeredItems.forEach(item => {
      if (item.destroyed) return;
      if (!item.interactive) return;
      if (!item.visible) return;
      if (hasBeenProcessed) return;

      const localPoint = item.toLocal(new Point(_event.offsetX, _event.offsetY));
      if (item.hitArea?.contains?.(localPoint.x, localPoint.y)) {
        item.onEventDblClick({
          x: event.offsetX,
          y: event.offsetY
        });
        hasBeenProcessed = true;
      }
    });

    if (!hasBeenProcessed) {
      this._registeredItems.forEach(item => {
        if (item.destroyed) return;
        if (!item.interactive) return;
        if (!item.visible) return;
        item.onVoidDblClickOut();
      });
    }

    // check how many patterns are edited
    let editedPatterns = 0;
    this._Patterns.forEach((pattern) => {
      if (pattern._state === 'edition') {
        editedPatterns++;
      }
    });
    if (editedPatterns === 0) {
      this._isEditing = false;
    }
  }

  getCenterPoint(points: {x: number, y: number }[]): { x: number, y: number } {
    if (points.length === 0) throw new Error("Array of points is empty.");

    const sum = points.reduce(
      (acc, p) => {
        acc.x += p.x;
        acc.y += p.y;
        return acc;
      },
      { x: 0, y: 0 }
    );

    return {
      x: sum.x / points.length,
      y: sum.y / points.length
    };
  }

  getRotatedPosition(
    item: { x: number, y: number },
    rotationPoint: { x: number, y: number },
    rotationDeltaDeg: number
  ): { x: number, y: number } {
    const rotationDelta = (rotationDeltaDeg * Math.PI) / 180;

    const dx = item.x - rotationPoint.x;
    const dy = item.y - rotationPoint.y;

    const cos = Math.cos(rotationDelta);
    const sin = Math.sin(rotationDelta);

    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;

    return {
      x: rotatedX + rotationPoint.x,
      y: rotatedY + rotationPoint.y,
    };
  }

   
   /**
    * Record rotation action for undo/redo after rotation completes
    */
   private recordRotationEnd(): void {
     if (this.rotationDebounceTimer) {
       clearTimeout(this.rotationDebounceTimer);
     }
     
     this.rotationDebounceTimer = setTimeout(() => {
       // Rotation has ended, record undo/redo actions
       this.rotationBeforeStates.forEach((beforeState, patternGuid) => {
         const afterState = (undoRedoManager as any).capturePatternState(patternGuid);
         
         if (afterState) {
           (undoRedoManager as any).recordPatternAction({
             type: 'rotate',
             patternGuid: patternGuid,
             beforeState: beforeState,
             afterState: afterState,
             metadata: {}
           });
         }
       });
       
       // Clear the before states
       this.rotationBeforeStates.clear();
       this.isRotating = false;
       
       // Save to data layer
       (surfaceManager as any).saveSlectedSurface();
     }, 300); // 300ms debounce - waits for rotation to complete
   }
   
   //new for nesting more accurate 
  wheelHandler = (event: WheelEvent) => {
     if (surfaceManager.isSwitchingBoards) return;
  if ((window as any).noAction === true) return;
  const pivotPoint = this.getActivePivotPoint();
  if (this.ctrlKey && this.multiSelection.length === 0) {
    // Check if any nested paths are selected
    const hasNestedPathSelected = this._Patterns.some((pattern) => 
      pattern._state === 'selected' && pattern._parentPattern
    );
    
    if (hasNestedPathSelected) {
      return; // Prevent rotation if nested paths are selected
    }
    
    // Rotate the selected pattern
    this._Patterns.forEach((pattern) => {
      if (pattern._state === 'selected') {
        // Capture before state on first rotation
        if (!this.isRotating) {
          const beforeState = (undoRedoManager as any).capturePatternState(pattern._guid);
          if (beforeState) {
            this.rotationBeforeStates.set(pattern._guid, beforeState);
          }
          this.isRotating = true;
        }
        
        const rotationDelta = event.deltaY > 0 ? liveConfig._rotation : -liveConfig._rotation;
        const currentCenter = { x: pattern.zCtx, y: pattern.zCty };
        pattern._rotation += rotationDelta;
        pattern.applyTransformations({ rotate: true, translate: false });
        if (pivotPoint) {
          const finalRotation = this.getRotatedPosition(currentCenter, pivotPoint, rotationDelta);
          pattern.zCtx = finalRotation.x;
          pattern.zCty = finalRotation.y;
        }
        pattern.display();
      }
    });
    
    // Debounced save and undo/redo recording
    this.recordRotationEnd();
    return;
  } else if (this.ctrlKey && this.multiSelection.length > 0) {
    // Check if any nested paths are selected
    const hasNestedPathSelected = this.multiSelection.some((pattern) => 
      pattern._state === 'selected' && pattern._parentPattern
    );
    
    if (hasNestedPathSelected) {
      return; // Prevent rotation if nested paths are selected
    }
    // Rotate multiple selected patterns around their collective center
    
    // Capture before state on first rotation
    if (!this.isRotating) {
      this.multiSelection.forEach((pattern) => {
        if (pattern._state === 'selected' && !pattern._parentPattern) {
          const beforeState = (undoRedoManager as any).capturePatternState(pattern._guid);
          if (beforeState) {
            this.rotationBeforeStates.set(pattern._guid, beforeState);
          }
        }
      });
      this.isRotating = true;
    }
    
    // Filter out nested paths for rotation
    const mainPatterns = this.multiSelection.filter((pattern) => 
      pattern._state === 'selected' && !pattern._parentPattern
    );
    
    if (mainPatterns.length === 0) {
      return; // No main patterns to rotate
    }
    
    const points = mainPatterns.map((pattern) => ({
      x: pattern.zCtx,
      y: pattern.zCty
    }));
   
    const rotationCenter = pivotPoint ?? this.getCenterPoint(points);
    const rotationDelta = event.deltaY > 0 ? liveConfig._rotation : -liveConfig._rotation;


    mainPatterns.forEach((pattern) => {
      pattern._rotation += rotationDelta;
      const finalRotation = this.getRotatedPosition(
        { x: pattern.zCtx, y: pattern.zCty },
        rotationCenter,
        rotationDelta
      );
      pattern.applyTransformations({ rotate: true, translate: false });
      pattern.zCtx = finalRotation.x;
      pattern.zCty = finalRotation.y;
      pattern.display();
    });
    
    // Debounced save and undo/redo recording
    this.recordRotationEnd();
    return;
  }

  event.preventDefault(); // Prevent default scrolling behavior

  const zoomDirection = event.deltaY < 0 ? 1 : -1;
  let newScale = this.zoomFactor * Math.exp(zoomDirection * 0.3); // Exponential zoom

  // Clamp zoom level
  newScale = Math.max(0.1, Math.min(100, newScale));

  // Get mouse position in world coordinates (relative to stage)
  const mouseWorldPos = {
    x: (event.offsetX - this._app.stage.position.x) / this.zoomFactor,
    y: (event.offsetY - this._app.stage.position.y) / this.zoomFactor
  };

  // Apply new zoom factor
  this.zoomFactor = newScale;
  this.display();

  // Adjust stage position to keep zoom centered at the mouse point
  this._app.stage.position.x = event.offsetX - mouseWorldPos.x * this.zoomFactor;
  this._app.stage.position.y = event.offsetY - mouseWorldPos.y * this.zoomFactor;

  // Update hitArea if in nesting placement mode
  if (surfaceManager.isReadyToPlaceNested && this === surfaceManager.currentSurface) {
    this._app.stage.hitArea = new PIXI.Rectangle(
      -this._app.stage.position.x,
      -this._app.stage.position.y,
      this._app.screen.width,
      this._app.screen.height
    );
  }
  if (surfaceManager.isPasting && this === surfaceManager.currentSurface) {
    const stage = this._app.stage;
    const screen = this._app.screen;
    const zoom = this.zoomFactor;
    stage.hitArea = new PIXI.Rectangle(
        -stage.position.x / zoom,
        -stage.position.y / zoom,
        screen.width / zoom,
        screen.height / zoom
    );
  }
}

 
  dispose() {
    // Clean up theme subscription
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
    
    this.detachCanvasEvents();

    this._registeredItems.forEach(item => {
      item?.dispose();
    });

    this.removeCustomPivotGraphic(true);

    // Dispose the application
    this._app.destroy({
      removeView : true
    },{
      children      : true,
      texture       : true,
      style         : true,
      context       : true,
      textureSource : true
    });
  }




  
}

