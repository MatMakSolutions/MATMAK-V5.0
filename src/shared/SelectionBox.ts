import { DisplayObject } from "../Graphics/DisplayObject";
import { surfaceManager } from "../Graphics/SurfaceManager";

export class SelectionBox extends DisplayObject {
    isSelecting: boolean = false;
    private startX: number = 0;
    private startY: number = 0;

    public onSelectionComplete?: (rect: { x: number; y: number; width: number; height: number }) => void;

    constructor() {
        super();
        this.setInteractivity(true);  // Enable interaction using the inherited method
    }

    // Override raw mouse event handling methods from DisplayObject
    override onRawEventMouseDown(eventData: { x: number, y: number, button: number, ctrlKey?: boolean, shiftKey?: boolean }): void {
      // Don't start selection in these cases:
      // Block when focal pivot mode is active
      if (surfaceManager.currentSurface?.customPivotMode) {
        console.log('SelectionBox: Blocked - Focal pivot mode active');
        return;
      }
      
      // Block when RotationSelectionBox is active (rotating or dragging)
      const rotationBox = surfaceManager.currentSurface?.rotationSelectionBox;
      if (rotationBox && rotationBox.isInteracting()) {
        console.log('SelectionBox: Blocked - RotationSelectionBox is active');
        this.isSelecting = false;
        return;
      }
      
      // Block when clicking on the RotationSelectionBox elements (handles, box, rotation zones)
      if (rotationBox && rotationBox.isClickOnBox(eventData)) {
        console.log('SelectionBox: Blocked - Clicking on RotationSelectionBox');
        this.isSelecting = false;
        return;
      }
      
      // Check if in edition mode
      const hasEditionPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'edition');
      
      // Allow clicks to pass through when activatePointSelection is true (inserting new point)
      if (surfaceManager.currentSurface?.activatePointSelection) {
        console.log('SelectionBox: Allowing click - Point insertion mode active');
        return;
      }
      
      if (surfaceManager.currentSurface?._isEditing && hasEditionPattern) {
        console.log('SelectionBox: Blocked - Edit mode active');
        return; // Edit mode
      }
      
      // Check if in split mode, bikini mode, or wrap mode
      const hasSplitPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'split');
      const hasBikiniPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'bikini');
      const hasWrapPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'wrap');
      
      if (hasSplitPattern) {
        console.log('SelectionBox: Blocked - Split mode active');
        return; // Split mode
      }
      
      if (hasBikiniPattern) {
        console.log('SelectionBox: Blocked - Bikini mode active');
        return; // Bikini mode
      }
      
      if (hasWrapPattern) {
        console.log('SelectionBox: Blocked - Wrap mode active');
        return; // Wrap mode
      }
      
      if ((surfaceManager.currentSurface as any)?._annotationPopup?.isVisible) {
        console.log('SelectionBox: Blocked - Annotation popup active');
        return; // Annotation active
      }
      
      if (eventData.button !== 0) {
        console.log('SelectionBox: Blocked - Not left click');
        return; // Not left click
      }
      
      if (eventData.ctrlKey) {
        console.log('SelectionBox: Blocked - Ctrl key held (for Ctrl+Click)');
        this.isSelecting = false;
        return; // Ctrl held (for Ctrl+Click multi-select)
      }
      
      if (eventData.shiftKey) {
        console.log('SelectionBox: Blocked - Shift key held (for Shift+Click nested path selection)');
        this.isSelecting = false;
        return; // Shift held (for Shift+Click nested path selection)
      }
      
      // Check if clicking on a pattern - if so, don't start drag selection
      // Adjust coordinates for stage position (same as pattern selection logic does)
      const surface = surfaceManager.currentSurface;
      const adjustedX = eventData.x - (surface?._app.stage.x || 0);
      const adjustedY = eventData.y - (surface?._app.stage.y || 0);
      const clickedOnPattern = surface?._Patterns.some((pattern) => {
        return pattern.hitTest({ x: adjustedX, y: adjustedY });
      });
      
      if (clickedOnPattern) {
        console.log('SelectionBox: Blocked - Clicked on pattern');
        this.isSelecting = false;
        return;
      }
      
      // All clear - start drag selection on empty space
      console.log('SelectionBox: Started drag selection at', eventData.x, eventData.y);
      const { x, y } = eventData;
      this.startX = x;
      this.startY = y;
      this.isSelecting = true;
      this.clear();  // Start fresh
    }

    override onRawEventMouseMove(eventData: { x: number, y: number }): void {
      // Allow mouse move to pass through when activatePointSelection is true
      if (surfaceManager.currentSurface?.activatePointSelection) {
        return;
      }
      
      if (surfaceManager.currentSurface?._isEditing) return;
      
      // Block selection during split, bikini, or wrap mode
      const hasSplitPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'split');
      const hasBikiniPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'bikini');
      const hasWrapPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'wrap');
      
      if (hasSplitPattern || hasBikiniPattern || hasWrapPattern) {
        this.isSelecting = false;
        this.clear();
        return;
      }
      // Stop selection if annotation popup becomes active
      if ((surfaceManager.currentSurface as any)?._annotationPopup?.isVisible) {
        this.isSelecting = false;
        this.clear();
        return;
      }
      
      // Stop selection if any pattern is currently being dragged
      const isAnyPatternDragging = surfaceManager.currentSurface?._Patterns.some((pattern) => {
        return pattern._readyForDrag || pattern._dragging;
      });
      
      if (isAnyPatternDragging) {
        this.isSelecting = false;
        this.clear();
        return;
      }
      
      // Stop selection if RotationSelectionBox is active
      const rotationBox = surfaceManager.currentSurface?.rotationSelectionBox;
      if (rotationBox && rotationBox.isInteracting()) {
        this.isSelecting = false;
        this.clear();
        return;
      }
      
      // Don't continue drag selection if it was never started
      if (!this.isSelecting) {
        return;
      }

        const { x, y } = eventData;

        // Calculate the correct top-left corner and size
        const rectX = Math.min(this.startX, x);
        const rectY = Math.min(this.startY, y);
        const width = Math.abs(x - this.startX);
        const height = Math.abs(y - this.startY);

        this.clear();
        this.setFillStyle({color: 0x66ccff, alpha: 0.2});
        this.setStrokeStyle({width: 1, color: 0x66ccff, alpha: 0.8});
        this.rect(
          rectX - surfaceManager.currentSurface!._app.stage.x,
          rectY - surfaceManager.currentSurface!._app.stage.y,
          width,
          height
        );
        this.stroke();
        this.fill();
    }

    override onRawEventMouseUp(eventData: { x: number, y: number }): void {
      // Allow clicks to pass through when activatePointSelection is true (inserting new point)
      if (surfaceManager.currentSurface?.activatePointSelection) {
        console.log('SelectionBox: Allowing click - Point insertion mode active');
        return;
      }
      
      // Check if in edition mode
      const hasEditionPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'edition');
      
      if (surfaceManager.currentSurface?._isEditing && hasEditionPattern) {
        console.log('SelectionBox: MouseUp blocked - Edit mode');
        return;
      }
      
      // Block selection during split, bikini, or wrap mode
      const hasSplitPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'split');
      const hasBikiniPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'bikini');
      const hasWrapPattern = surfaceManager.currentSurface?._Patterns.some(p => p._state === 'wrap');
      
      if (hasSplitPattern || hasBikiniPattern || hasWrapPattern) {
        console.log('SelectionBox: MouseUp blocked - Split/Bikini/Wrap mode');
        this.isSelecting = false;
        this.clear();
        return;
      }
      
      if (!this.isSelecting) {
        console.log('SelectionBox: MouseUp - Not selecting, ignoring');
        return;
      }
      
      const { x, y } = eventData;
      this.isSelecting = false;

      // Calculate the final selection bounds
      const selectionRect = {
          x: Math.min(this.startX, x),
          y: Math.min(this.startY, y),
          width: Math.abs(x - this.startX),
          height: Math.abs(y - this.startY),
      };

      if (selectionRect.width < 10 || selectionRect.height < 10) {
          // Ignore small selections (probably a click, not drag)
          console.log('SelectionBox: MouseUp - Selection too small (click not drag)', selectionRect);
          this.clear();  // Clear after selection is complete
          return;
      }

      console.log('SelectionBox: MouseUp - Completing selection', selectionRect);
      this.onSelectionComplete?.(selectionRect);
      this.clear();  // Clear after selection is complete
    }

    // Optional: Allow custom destruction if needed
    override dispose(): void {
        super.dispose();
    }
}
