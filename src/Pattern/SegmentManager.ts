/**
 * SegmentManager - Clean standalone segment management system
 * 
 * This is NOT a pattern extension. It's a separate manager that can work
 * with any pattern to provide segment selection and movement functionality.
 */

import { Container, Graphics } from "pixi.js";
import { Segment } from "../Graphics/Segment";
import { _Pattern, Pattern } from "./Pattern";
import { LCommand } from "../VectorPath/Commands/LCommand";
import { CCommand } from "../VectorPath/Commands/CCommand";
import { IPoint } from "../VectorPath/Utils/IPoint";
import { liveConfig } from "../core/LiveConfig";
import { undoRedoManager } from "../core/UndoRedoManager";
import { surfaceManager } from "../Graphics/SurfaceManager";
import { surfaceCollection } from "../data/repository/SurfaceCollection";
import { toastSuccess, toastError } from "../ui/controls/Toast/Toast";
import { _evtBus } from "../core/EventBus";
import { QCommand } from "../VectorPath/Commands/QCommand";

export class SegmentManager {
  private pattern: _Pattern | null = null;
  private segments: Segment[] = [];
  private selectedSegments: Set<Segment> = new Set();
  private container: Container | null = null;
  private arrowsContainer: Graphics | null = null;
  private originalVectorPath: string = ''; // Store original path for comparison
  private hasChanges: boolean = false; // Track if any changes were made
  private zoomListener: any = null; // Store zoom event listener for cleanup
  
  // Drag-to-select properties
  private selectionBox: Graphics | null = null;
  private isSelecting: boolean = false;
  private selectionStart: IPoint | null = null;
  
  // Arrow positions for click detection
  private outwardArrowPos: { x: number, y: number } | null = null;
  private inwardArrowPos: { x: number, y: number } | null = null;
  private arrowSize: number = 16;
  
  constructor() {
    // Empty constructor - manager starts inactive
  }

  /**
   * Activate segment mode on a pattern
   */
  activate(pattern: _Pattern): void {
    if (this.pattern) {
      this.deactivate();
    }

    this.pattern = pattern;
    this.container = new Container();
    this.arrowsContainer = new Graphics();
    this.selectionBox = new Graphics();
    this.hasChanges = false;
    
    // Store original vector path for comparison
    this.originalVectorPath = pattern._vector.generatePathString();
    
    pattern.container.addChild(this.container);
    pattern.container.addChild(this.arrowsContainer);
    pattern.container.addChild(this.selectionBox);

    // Create segments from the pattern's vector path
    this.createSegments();
    
    // Set up drag-to-select event handlers
    this.setupDragToSelect();
    
    // Subscribe to zoom changes to keep segments in sync
    this.zoomListener = _evtBus.on("zoomChanged", (newZoom: number) => {
      this.onZoomChanged(newZoom);
    });
    
    console.log(`SegmentManager: Activated on pattern ${pattern._guid} with ${this.segments.length} segments`);
  }

  /**
   * Deactivate segment mode and cleanup
   */
  deactivate(): void {
    if (!this.pattern) return;

    console.log('SegmentManager: Deactivating');

    // Unsubscribe from zoom changes
    if (this.zoomListener) {
      this.zoomListener.off();
      this.zoomListener = null;
    }

    const patternToCleanup = this.pattern;

    // Clear selection
    this.selectedSegments.clear();

    // Destroy all segments
    this.segments.forEach(segment => {
      segment.removeAllListeners();
      segment.destroy();
    });
    this.segments = [];

    // Remove containers
    if (this.container) {
      patternToCleanup.container.removeChild(this.container);
      this.container.destroy();
      this.container = null;
    }

    if (this.arrowsContainer) {
      patternToCleanup.container.removeChild(this.arrowsContainer);
      this.arrowsContainer.destroy();
      this.arrowsContainer = null;
    }

    if (this.selectionBox) {
      patternToCleanup.container.removeChild(this.selectionBox);
      this.selectionBox.destroy();
      this.selectionBox = null;
    }
    
    // Reset drag-to-select state
    this.isSelecting = false;
    this.selectionStart = null;
    
    // Clean up drag-select event listeners
    if ((this as any)._dragSelectHandlers && surfaceManager.currentSurface) {
      const handlers = (this as any)._dragSelectHandlers;
      const surface = surfaceManager.currentSurface;
      surface._app.canvas.removeEventListener('mousedown', handlers.onMouseDown);
      surface._app.canvas.removeEventListener('mousemove', handlers.onMouseMove);
      surface._app.canvas.removeEventListener('mouseup', handlers.onMouseUp);
      (this as any)._dragSelectHandlers = null;
    }

    // If changes were made, recreate the pattern (following copy/paste pattern)
    if (this.hasChanges) {
      console.log('SegmentManager: Recreating pattern with segment changes');
      
      const surface = surfaceManager.currentSurface;
      if (!surface) {
        console.error('SegmentManager: No current surface');
        this.pattern = null;
        this.originalVectorPath = '';
        this.hasChanges = false;
        return;
      }

      // 1. Capture all data from the old pattern
      const oldPatternDataJSON = surfaceCollection.selectedSurfaceData.getPattern(patternToCleanup._guid);
      if (!oldPatternDataJSON) {
        console.error('SegmentManager: Could not find pattern data for guid:', patternToCleanup._guid);
        this.pattern = null;
        this.originalVectorPath = '';
        this.hasChanges = false;
        return;
      }
      const oldPatternData = JSON.parse(JSON.stringify(oldPatternDataJSON));

      // 2. Calculate the true "base" position
      const oldUnzoomedX = patternToCleanup.unZoomed(patternToCleanup.x);
      const oldUnzoomedY = patternToCleanup.unZoomed(patternToCleanup.y);
      const oldOriginalPos = patternToCleanup._vector.originalPosition;
      const baseX = oldUnzoomedX - oldOriginalPos.x;
      const baseY = oldUnzoomedY - oldOriginalPos.y;

      const oldRotation = patternToCleanup._rotation;
      const oldGuid = patternToCleanup._guid;
      const isGroup = patternToCleanup.isGroup;

      // 3. Get the edited geometry (main path + sub-paths)
      const editedMainPath = patternToCleanup._vector.generatePathString();
      const editedSubPaths = patternToCleanup.subPatterns.map(p => p._vector.generatePathString());

      console.log('SegmentManager: Removing old pattern from surface and data');

      // 4. Destroy the old pattern completely
      surface.removePattern(patternToCleanup as typeof Pattern);
      surfaceCollection.selectedSurfaceData.removePattern(oldGuid);

      console.log('SegmentManager: Creating new pattern with edited paths');

      // 5. Create the new pattern (Visual Layer)
      const newPattern = surface.addPath(editedMainPath, {
        guid: oldGuid, // Use the same GUID
        nestedPaths: editedSubPaths,
        noNormilize: false, // Force normalization
      });

      if (!newPattern) {
        console.error('SegmentManager: Failed to create new pattern');
        this.pattern = null;
        this.originalVectorPath = '';
        this.hasChanges = false;
        toastError("Failed to apply segment changes", 3000);
        return;
      }

      // 6. Set its position and state correctly
      const newOriginalPos = newPattern._vector.originalPosition;
      newPattern.x = newPattern.zoomed(baseX + newOriginalPos.x);
      newPattern.y = newPattern.zoomed(baseY + newOriginalPos.y);
      newPattern._rotation = oldRotation;
      newPattern.isGroup = isGroup; // Preserve group status
      newPattern.display(); // Display the new, consistent pattern

      console.log('SegmentManager: Adding new pattern to surface data');

      // 7. Add the new pattern back to the Data Model
      surfaceCollection.selectedSurfaceData.addPattern({
        ...oldPatternData, // Re-use all old data
        guid: oldGuid, // Use the same GUID
        paths: [newPattern._vector.generatePathString(), ...editedSubPaths], // Save the new paths
        boardPosition: { x: baseX, y: baseY }, // Save the true base position
        boardAngle: oldRotation,
      });

      // 8. Call the main save function (this is now safe and will find a 100% consistent pattern)
      surfaceManager.saveSlectedSurface();

      console.log('SegmentManager: Pattern recreated and saved successfully');
      toastSuccess("Segment changes applied successfully", 2000);
    }

    // Reset tracking
    this.originalVectorPath = '';
    this.hasChanges = false;
    this.pattern = null;
  }

  /**
   * Create visual segments from the pattern's commands
   */
  private createSegments(): void {
    if (!this.pattern || !this.container) return;

    const commands = this.pattern._vector.getCommands();
    
    commands.forEach((command: any) => {
      // Skip move and close commands
      if (command.type === 'M' || command.type === 'Z') return;

      const segment = new Segment(command);
      segment.strokeNormalColor = 0x0096c8;
      segment.strokeColor = 0x0096c8;
      segment.zoomFactor = this.pattern!.zoomFactor;
      segment.setInteractivity(true);

      // Add click handler
      segment.on('click', (event: any) => {
        event.stopPropagation();
        this.toggleSegmentSelection(segment);
      });

      // Add hover effects
      segment.on('pointerover', () => {
        if (!this.selectedSegments.has(segment)) {
          segment.updateStyle({ color: 0x3399ff, width: 6 });  // Increased from 3 to 6
        }
      });

      segment.on('pointerout', () => {
        if (!this.selectedSegments.has(segment)) {
          segment.updateStyle({ color: 0x000000, width: 4 });  // Increased from 2 to 4
        }
      });

      this.container.addChild(segment);
      this.segments.push(segment);
    });

    // Link segments for prev/next references
    this.segments.forEach((segment, idx) => {
      segment.previousSegment = this.segments[(idx - 1 + this.segments.length) % this.segments.length];
      segment.nextSegment = this.segments[(idx + 1) % this.segments.length];
    });
  }

  /**
   * Handle zoom changes - update all segments and arrows
   */
  private onZoomChanged(newZoom: number): void {
    if (!this.pattern) return;

    // Update all segments with the new zoom factor
    this.segments.forEach(segment => {
      segment.zoomFactor = newZoom;
    });

    // Update arrows to match new zoom
    this.updateArrows();
  }

  /**
   * Toggle segment selection
   */
  private toggleSegmentSelection(segment: Segment): void {
    if (this.selectedSegments.has(segment)) {
      this.selectedSegments.delete(segment);
      segment.updateStyle({ color: 0x000000, width: 4 });  // Increased from 2 to 4
    } else {
      this.selectedSegments.add(segment);
      segment.updateStyle({ color: 0xff6600, width: 8 });  // Increased from 4 to 8
    }

    console.log(`SegmentManager: ${this.selectedSegments.size} segments selected`);
    this.updateArrows();
  }

  /**
   * Update direction arrows
   */
  private updateArrows(): void {
    if (!this.arrowsContainer || !this.pattern) return;

    this.arrowsContainer.clear();
    
    // Remove old click listener
    this.arrowsContainer.removeAllListeners('click');

    if (this.selectedSegments.size === 0) {
      this.outwardArrowPos = null;
      this.inwardArrowPos = null;
      return;
    }

    // Get representative segment for arrow placement (middle segment if multiple selected)
    const selectedArray = Array.from(this.selectedSegments);
    const repSegment = selectedArray[Math.floor(selectedArray.length / 2)];
    
    if (!repSegment.command) return;

    // Calculate segment center and direction
    const start = repSegment.command.startingPoint;
    const end = repSegment.command.endingPoint;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;

    // Use the same pattern-aware perpendicular calculation
    const outwardPerp = this.calculateCorrectPerpendicular(repSegment, 'outward');
    const inwardPerp = this.calculateCorrectPerpendicular(repSegment, 'inward');

    if (!outwardPerp || !inwardPerp) return;

    const zoomFactor = this.pattern.zoomFactor;
    const arrowOffset = 30; // pixels from segment center

    // Calculate and store arrow positions using the correct perpendicular directions
    const outwardX = (centerX + outwardPerp.x * arrowOffset) * zoomFactor;
    const outwardY = (centerY + outwardPerp.y * arrowOffset) * zoomFactor;
    const inwardX = (centerX + inwardPerp.x * arrowOffset) * zoomFactor;
    const inwardY = (centerY + inwardPerp.y * arrowOffset) * zoomFactor;
    
    this.outwardArrowPos = { x: outwardX, y: outwardY };
    this.inwardArrowPos = { x: inwardX, y: inwardY };

    // Draw both arrows using the correct angles
    this.drawArrow(outwardX, outwardY, 'outward', Math.atan2(outwardPerp.y, outwardPerp.x));
    this.drawArrow(inwardX, inwardY, 'inward', Math.atan2(inwardPerp.y, inwardPerp.x));
    
    // Set up ONE click listener for both arrows
    this.arrowsContainer.eventMode = 'static';
    this.arrowsContainer.cursor = 'pointer';
    this.arrowsContainer.on('click', (event: any) => {
      event.stopPropagation();
      
      // Determine which arrow was clicked based on distance
      const localPos = this.arrowsContainer!.toLocal(event.global);
      
      const distToOutward = this.outwardArrowPos 
        ? Math.hypot(localPos.x - this.outwardArrowPos.x, localPos.y - this.outwardArrowPos.y)
        : Infinity;
      const distToInward = this.inwardArrowPos
        ? Math.hypot(localPos.x - this.inwardArrowPos.x, localPos.y - this.inwardArrowPos.y)
        : Infinity;
      
      const clickThreshold = this.arrowSize * 2;
      
      if (distToOutward < clickThreshold && distToOutward <= distToInward) {
        console.log('Outward arrow clicked');
        this.moveSelected('outward');
      } else if (distToInward < clickThreshold) {
        console.log('Inward arrow clicked');
        this.moveSelected('inward');
      }
    });
  }

  /**
   * Draw a single direction arrow
   */
  private drawArrow(x: number, y: number, direction: 'inward' | 'outward', angle: number): void {
    if (!this.arrowsContainer) return;

    const color = direction === 'outward' ? 0xff4444 : 0x44ff44;
    const bgColor = direction === 'outward' ? 0xfff0f0 : 0xf0fff0;
    const size = 16;

    // Background circle
    this.arrowsContainer.setFillStyle({ color: bgColor, alpha: 0.9 });
    this.arrowsContainer.setStrokeStyle({ color, width: 2 });
    this.arrowsContainer.circle(x, y, size);
    this.arrowsContainer.fill();
    this.arrowsContainer.stroke();

    // Arrow line
    this.arrowsContainer.setStrokeStyle({ color, width: 3 });
    const arrowLength = size * 0.6;
    const startX = x + Math.cos(angle + Math.PI) * arrowLength * 0.3;
    const startY = y + Math.sin(angle + Math.PI) * arrowLength * 0.3;
    const endX = x + Math.cos(angle) * arrowLength;
    const endY = y + Math.sin(angle) * arrowLength;

    this.arrowsContainer.moveTo(startX, startY);
    this.arrowsContainer.lineTo(endX, endY);

    // Arrow head
    const headSize = 8;
    const headAngle1 = angle + Math.PI * 0.8;
    const headAngle2 = angle - Math.PI * 0.8;
    
    this.arrowsContainer.moveTo(endX, endY);
    this.arrowsContainer.lineTo(endX + Math.cos(headAngle1) * headSize, endY + Math.sin(headAngle1) * headSize);
    this.arrowsContainer.moveTo(endX, endY);
    this.arrowsContainer.lineTo(endX + Math.cos(headAngle2) * headSize, endY + Math.sin(headAngle2) * headSize);
    
    this.arrowsContainer.stroke();
  }

  /**
   * Move selected segments in a direction
   */
  moveSelected(direction: 'inward' | 'outward'): void {
    if (!this.pattern || this.selectedSegments.size === 0) {
      console.warn('SegmentManager: No pattern or no selected segments');
      return;
    }

    // Capture state BEFORE movement for undo/redo
    const beforeState = undoRedoManager?.capturePatternState(this.pattern._guid);

    // Get wrap distance from config
    let distance = liveConfig.wrapDistance;
    if (liveConfig.unitOfMeasure === 3) {
      distance *= 25.4; // Convert inches to mm
    }

    console.log(`SegmentManager: Moving ${this.selectedSegments.size} segments ${direction} by ${distance}mm`);

    const selectedArray = Array.from(this.selectedSegments);
    const selectedSet = new Set(selectedArray);

    console.log(`Calculating offset for ${selectedArray.length} segments`);

    // Collect movement data
    interface MoveData {
      segment: Segment;
      cmd: any;
      oldStart: IPoint;
      oldEnd: IPoint;
      newStart: IPoint;
      newEnd: IPoint;
      offsetX: number;
      offsetY: number;
      needBeforeBridge: boolean;
      needAfterBridge: boolean;
      nextSegmentOldStart: IPoint | null;
    }

    const moveData: MoveData[] = [];

    selectedArray.forEach(segment => {
      const cmd = segment.command;
      if (!cmd) return;

      // Calculate the correct perpendicular for THIS segment
      const correctPerp = this.calculateCorrectPerpendicular(segment, direction);
      if (!correctPerp) return;

      const offsetX = correctPerp.x * distance;
      const offsetY = correctPerp.y * distance;

      const oldStart = { x: cmd.startingPoint.x, y: cmd.startingPoint.y };
      const oldEnd = { x: cmd.endingPoint.x, y: cmd.endingPoint.y };
      const newStart = { x: oldStart.x + offsetX, y: oldStart.y + offsetY };
      const newEnd = { x: oldEnd.x + offsetX, y: oldEnd.y + offsetY };

      // Check if bridges are needed
      const prevSelected = segment.previousSegment && selectedSet.has(segment.previousSegment);
      const nextSelected = segment.nextSegment && selectedSet.has(segment.nextSegment);
      
      const nextSegmentOldStart = !nextSelected && segment.nextSegment 
        ? { x: segment.nextSegment.command.startingPoint.x, y: segment.nextSegment.command.startingPoint.y }
        : null;

      moveData.push({
        segment,
        cmd,
        oldStart,
        oldEnd,
        newStart,
        newEnd,
        offsetX,
        offsetY,
        needBeforeBridge: !prevSelected,
        needAfterBridge: !nextSelected,
        nextSegmentOldStart
      });
    });

    // Move segments
    moveData.forEach(data => {
      const { cmd, newStart, newEnd, needBeforeBridge, offsetX, offsetY } = data;

      // Move endpoint
      cmd.updateEndingPoint(newEnd);

      // Move startpoint only if previous segment is also selected
      if (!needBeforeBridge && cmd.previousCommand) {
        cmd.previousCommand.updateEndingPoint(newStart);
      }

      // Handle different curve types - use the same offset calculated for endpoints
      if (cmd instanceof CCommand) {
        // For cubic Bezier curves, apply the same offset to control points
        cmd.x1 += offsetX;
        cmd.y1 += offsetY;
        cmd.x2 += offsetX;
        cmd.y2 += offsetY;
      } else if (cmd instanceof QCommand) {
        // For quadratic Bezier curves, apply the same offset to control point
        cmd.cx += offsetX;
        cmd.cy += offsetY;
      }
    });

    // Create bridges
    let bridgesCreated = 0;
    moveData.forEach(data => {
      const { cmd, oldStart, newStart, newEnd, needBeforeBridge, needAfterBridge, nextSegmentOldStart } = data;

      if (needBeforeBridge) {
        const bridgeCmd = new LCommand(newStart.x, newStart.y, false);
        const prevCmd = cmd.previousCommand;
        if (prevCmd) {
          prevCmd.linkAfter(bridgeCmd);
          bridgeCmd.linkAfter(cmd);
          bridgesCreated++;
        }
      }

      if (needAfterBridge && nextSegmentOldStart) {
        const bridgeCmd = new LCommand(nextSegmentOldStart.x, nextSegmentOldStart.y, false);
        const nextCmd = cmd.nextCommand;
        if (nextCmd) {
          cmd.linkAfter(bridgeCmd);
          bridgeCmd.linkAfter(nextCmd);
          bridgesCreated++;
        }
      }
    });

    console.log(`Created ${bridgesCreated} bridge segments`);

    // Preserve sub-pattern positions BEFORE any rebuild/display
    const subPatternStates = this.pattern.subPatterns.map(subPattern => ({
      pattern: subPattern,
      x: subPattern.x,
      y: subPattern.y,
      rotation: subPattern._rotation,
      vectorPath: subPattern._vector.generatePathString()
    }));

    // Mark that changes were made
    this.hasChanges = true;

    // Rebuild segments if bridges were created
    if (bridgesCreated > 0) {
      this.rebuildSegments();
    } else {
      // Just update existing segments
      this.segments.forEach(seg => seg.update());
    }

    // Update pattern display
    this.pattern._isDirty = true;
    this.pattern.display();

    // Restore sub-pattern positions AFTER display
    subPatternStates.forEach(state => {
      state.pattern.x = state.x;
      state.pattern.y = state.y;
      state.pattern._rotation = state.rotation;
      // Ensure sub-pattern vector path is unchanged
      if (state.pattern._vector.generatePathString() !== state.vectorPath) {
        console.warn('SegmentManager: Sub-pattern vector path changed - restoring');
        state.pattern._vector.parse(state.vectorPath);
        state.pattern.display();
      }
    });
    
    if (subPatternStates.length > 0) {
      console.log(`SegmentManager: Preserved ${subPatternStates.length} sub-pattern positions`);
    }

    // Capture state AFTER movement and record for undo/redo
    if (undoRedoManager && beforeState) {
      const afterState = undoRedoManager.capturePatternState(this.pattern._guid);
      if (afterState) {
        undoRedoManager.recordPatternAction({
          type: 'edit_nodes',
          patternGuid: this.pattern._guid,
          beforeState: beforeState,
          afterState: afterState,
          metadata: { action: 'segment_move', direction }
        });
        console.log('SegmentManager: Segment move recorded for undo/redo');
      }
    }
  }

  /**
   * Rebuild segments after path modifications
   */
  private rebuildSegments(): void {
    if (!this.pattern || !this.container) return;

    console.log('SegmentManager: Rebuilding segments after bridge creation');

    // Clear selection
    this.selectedSegments.clear();

    // Destroy old segments
    this.segments.forEach(segment => {
      segment.removeAllListeners();
      segment.destroy();
    });
    this.segments = [];

    // Recreate segments
    this.createSegments();

    // Clear arrows (no selection after rebuild)
    this.updateArrows();
  }

  /**
   * Set up drag-to-select event handlers
   */
  private setupDragToSelect(): void {
    if (!this.pattern || !surfaceManager.currentSurface) return;

    const surface = surfaceManager.currentSurface;
    
    // Mouse down - start selection
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return; // Only left click
      if (!this.pattern) return;

      const absolutePos = this.pattern.getAbsolutePosition();
      const stageX = surface._app.stage.x;
      const stageY = surface._app.stage.y;
      
      // Check if clicking on a segment
      const clickX = event.offsetX - absolutePos.x - stageX;
      const clickY = event.offsetY - absolutePos.y - stageY;
      
      let clickedOnSegment = false;
      for (const segment of this.segments) {
        // Check if click is near any segment (simple bounds check)
        if (segment.command) {
          const start = segment.command.startingPoint;
          const end = segment.command.endingPoint;
          const threshold = 10 / this.pattern!.zoomFactor; // 10px hit tolerance
          
          // Check if click is near the segment line
          const distance = this.pointToLineDistance(
            { x: clickX / this.pattern!.zoomFactor, y: clickY / this.pattern!.zoomFactor },
            start,
            end
          );
          
          if (distance < threshold) {
            clickedOnSegment = true;
            break;
          }
        }
      }
      
      // If not clicking on a segment, start drag-to-select
      if (!clickedOnSegment) {
        this.isSelecting = true;
        this.selectionStart = { x: clickX, y: clickY };
      }
    };

    // Mouse move - update selection box
    const onMouseMove = (event: MouseEvent) => {
      if (!this.isSelecting || !this.selectionStart || !this.pattern) return;

      const absolutePos = this.pattern.getAbsolutePosition();
      const stageX = surface._app.stage.x;
      const stageY = surface._app.stage.y;
      
      const currentX = event.offsetX - absolutePos.x - stageX;
      const currentY = event.offsetY - absolutePos.y - stageY;
      
      // Draw selection box
      if (this.selectionBox) {
        this.selectionBox.clear();
        this.selectionBox.rect(
          Math.min(this.selectionStart.x, currentX),
          Math.min(this.selectionStart.y, currentY),
          Math.abs(currentX - this.selectionStart.x),
          Math.abs(currentY - this.selectionStart.y)
        );
        this.selectionBox.stroke({ width: 2, color: 0x3399ff, alpha: 0.8 });
        this.selectionBox.fill({ color: 0x3399ff, alpha: 0.1 });
      }
    };

    // Mouse up - finalize selection
    const onMouseUp = (event: MouseEvent) => {
      if (!this.isSelecting || !this.selectionStart || !this.pattern) return;

      const absolutePos = this.pattern.getAbsolutePosition();
      const stageX = surface._app.stage.x;
      const stageY = surface._app.stage.y;
      
      const currentX = event.offsetX - absolutePos.x - stageX;
      const currentY = event.offsetY - absolutePos.y - stageY;
      
      // Calculate selection box bounds
      const selectionBounds = {
        left: Math.min(this.selectionStart.x, currentX),
        right: Math.max(this.selectionStart.x, currentX),
        top: Math.min(this.selectionStart.y, currentY),
        bottom: Math.max(this.selectionStart.y, currentY)
      };
      
      // Select all segments that intersect with the selection box
      this.segments.forEach(segment => {
        if (!segment.command) return;
        
        const start = segment.command.startingPoint;
        const end = segment.command.endingPoint;
        const centerX = (start.x + end.x) / 2;
        const centerY = (start.y + end.y) / 2;
        
        // Check if segment center is within selection box
        if (centerX >= selectionBounds.left && centerX <= selectionBounds.right &&
            centerY >= selectionBounds.top && centerY <= selectionBounds.bottom) {
          if (!this.selectedSegments.has(segment)) {
            this.selectedSegments.add(segment);
            segment.updateStyle({ color: 0xff6600, width: 8 });
          }
        }
      });
      
      // Clear selection box
      if (this.selectionBox) {
        this.selectionBox.clear();
      }
      
      this.isSelecting = false;
      this.selectionStart = null;
      
      // Update arrows for new selection
      this.updateArrows();
      
      console.log(`SegmentManager: Selected ${this.selectedSegments.size} segments via drag`);
    };

    // Attach event listeners to the canvas
    surface._app.canvas.addEventListener('mousedown', onMouseDown);
    surface._app.canvas.addEventListener('mousemove', onMouseMove);
    surface._app.canvas.addEventListener('mouseup', onMouseUp);
    
    // Store references for cleanup (we'll add cleanup in deactivate)
    (this as any)._dragSelectHandlers = { onMouseDown, onMouseMove, onMouseUp };
  }

  /**
   * Calculate distance from a point to a line segment
   */
  private pointToLineDistance(point: IPoint, lineStart: IPoint, lineEnd: IPoint): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      // Line segment is a point
      const pdx = point.x - lineStart.x;
      const pdy = point.y - lineStart.y;
      return Math.sqrt(pdx * pdx + pdy * pdy);
    }
    
    // Calculate projection parameter
    const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared));
    
    // Calculate closest point on line segment
    const closestX = lineStart.x + t * dx;
    const closestY = lineStart.y + t * dy;
    
    // Calculate distance
    const distX = point.x - closestX;
    const distY = point.y - closestY;
    return Math.sqrt(distX * distX + distY * distY);
  }

  /**
   * Check if segment mode is active
   */
  isActive(): boolean {
    return this.pattern !== null;
  }

  /**
   * Get the active pattern
   */
  getActivePattern(): _Pattern | null {
    return this.pattern;
  }

  /**
   * Calculate the correct perpendicular direction for a segment considering the pattern's orientation
   * This ensures that "outward" always means away from the pattern interior
   */
  private calculateCorrectPerpendicular(segment: Segment, direction: 'inward' | 'outward'): { x: number, y: number } | null {
    const cmd = segment.command;
    if (!cmd) return null;

    const start = cmd.startingPoint;
    const end = cmd.endingPoint;

    // Calculate perpendicular from segment
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return null;

    // Perpendicular vector: rotate 90 degrees counterclockwise
    let perpX = -dy / length;
    let perpY = dx / length;

    // Now we need to determine which side is "inside" vs "outside"
    // Use the pattern's center as a reference point
    if (this.pattern) {
      const bbox = this.pattern.getBounds();
      const patternCenterX = bbox.x + bbox.width / 2;
      const patternCenterY = bbox.y + bbox.height / 2;

      // Get segment midpoint
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;

      // Vector from segment midpoint to pattern center
      const toCenterX = patternCenterX - midX;
      const toCenterY = patternCenterY - midY;

      // Dot product to determine which side of the segment the center is on
      const dot = perpX * toCenterX + perpY * toCenterY;

      // If dot product is positive, perpendicular points toward center (inside)
      // If negative, perpendicular points away from center (outside)
      if (dot < 0) {
        // Perpendicular points outside, flip it
        perpX = -perpX;
        perpY = -perpY;
      }

      // Now perpX, perpY points toward the interior
      // Flip if we want outward
      if (direction === 'outward') {
        perpX = -perpX;
        perpY = -perpY;
      }
    }

    return { x: perpX, y: perpY };
  }
}

// Export singleton instance
export const segmentManager = new SegmentManager();

