/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { Graphics, Container, Text, TextStyle } from "pixi.js";
import { surfaceManager } from "../../../Graphics/SurfaceManager";
import { guid } from "../../../core/Guid";
import { ppInfo, ppPrompt,ppWait } from "../popup/Popup";
import { liveConfig } from "../../../core/LiveConfig";
import { boardManager } from "../../../cutboard/BoardManager";
import * as PIXI from 'pixi.js';

export interface Annotation {
  id: string;
  text: string;
  x: number;  // Board coordinates (unzoomed)
  y: number;  // Board coordinates (unzoomed) 
  width: number;  // Base width (unzoomed)
  height: number;  // Base height (unzoomed)
  color: string;
  fontSize: number;  // Base font size (unzoomed)
  createdAtZoom?: number; // Deprecated - for legacy compatibility
  // These ensure we handle coordinates the same way as patterns
  boardX?: number;  // Board X position (unzoomed) - same as x
  boardY?: number;  // Board Y position (unzoomed) - same as y
}

export class AnnotationPopup extends BaseComponent {
  isVisible: boolean = false;
  annotations: Annotation[] = [];
  selectedAnnotation: Annotation | null = null;
  
  // Popup position
  popupX: number = 100;
  popupY: number = 100;
  isDragging: boolean = false;
  dragOffsetX: number = 0;
  dragOffsetY: number = 0;
  
  // New annotation
  newText: string = "New Annotation";
  newColor: string = "#25A9E0";
  newFontSize: number = 25;
  newWidth: number = 350;
  newHeight: number = 450;
  
  // Preview
  isPlacing: boolean = false;
  previewContainer: Container | null = null;
  previewGraphics: Graphics | null = null;
  
  constructor() {
    super("AnnotationPopup");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isVisible", "annotations", "selectedAnnotation", "newText", "newColor", "newFontSize", "newWidth", "newHeight", "isPlacing"]);
  }
  
  show() {
    // Unselect all patterns and clear any selection state
    const surface = surfaceManager.currentSurface;
    if (surface) {
      // Clear all pattern states
      surface._Patterns.forEach(p => {
        if (p._state !== "") {
          p.setState("");
        }
        p._readyForDrag = false;
      });
      
      // Clear multi-selection
      surface.multiSelection = [];
      
      // Clear selection box state
      if (surface.selectionBox) {
        surface.selectionBox.isSelecting = false;
        surface.selectionBox.clear();
      }
      
      // Clear any global selection state from surface manager
      if ((surfaceManager as any).globalSelectedHandlers) {
        (surfaceManager as any).globalSelectedHandlers = [];
      }
      
      // Load existing annotations from board - prefer BoardManager as source of truth
      if (boardManager.boards[boardManager.currentBoardIndex] && boardManager.boards[boardManager.currentBoardIndex].annotations) {
        this.annotations = [...boardManager.boards[boardManager.currentBoardIndex].annotations];
        // Also sync to the CutBoard
        if (surface._Board) {
          surface._Board.annotations = [...this.annotations];
        }
      } else if (surface._Board && surface._Board.annotations) {
        this.annotations = [...surface._Board.annotations];
      } else {
        this.annotations = [];
      }
    }
    
    this.isVisible = true;
    this.setupPreview();
    this.updateAnnotationInteractivity(true);
    
    // Store reference on surface for zoom updates
    if (surface) {
      (surface as any)._annotationPopup = this;
    }
    
    this.update();
  }
  
  hide() {
    this.isVisible = false;
    this.isPlacing = false;
    this.cleanupPreview();
    
    // Hide all annotations when closing popup
    this.hideAllAnnotations();
    
    // Remove reference from surface
    const surface = surfaceManager.currentSurface;
    if (surface && (surface as any)._annotationPopup === this) {
      (surface as any)._annotationPopup = null;
    }
    
    this.update();
  }
  
  setupPreview() {
    const surface = surfaceManager.currentSurface;
    if (!surface || !surface._Board) return;
    
    this.previewContainer = new Container();
    this.previewGraphics = new Graphics();
    // Add preview to stage, not board
    surface._app.stage.addChild(this.previewContainer);
    
    // Add mouse event listeners
    surface._app.canvas.addEventListener("mousemove", this.handleMouseMove);
    surface._app.canvas.addEventListener("mousedown", this.handleMouseDown);
    
    // Store reference on surface for zoom updates
    (surface as any)._annotationPopup = this;
    
    // Always show existing annotations
    this.showAllAnnotations();
  }
  
  cleanupPreview() {
    const surface = surfaceManager.currentSurface;
    if (surface) {
      surface._app.canvas.removeEventListener("mousemove", this.handleMouseMove);
      surface._app.canvas.removeEventListener("mousedown", this.handleMouseDown);
      
      if (this.previewContainer) {
        surface._app.stage.removeChild(this.previewContainer);
        this.previewContainer.destroy();
        this.previewContainer = null;
        this.previewGraphics = null;
      }
    }
  }
  
  showAllAnnotations() {
    const surface = surfaceManager.currentSurface;
    if (!surface || !surface._Board) return;
    
    // If we don't have annotations in the popup but the board does, load them
    if ((!this.annotations || this.annotations.length === 0) && surface._Board.annotations && surface._Board.annotations.length > 0) {
      this.annotations = [...surface._Board.annotations];
    }
    

    
    // Always recreate annotation container to ensure proper placement
    if (surface._Board.annotationContainer) {
      surface._app.stage.removeChild(surface._Board.annotationContainer);
      surface._Board.annotationContainer.destroy();
      surface._Board.annotationContainer = null;
    }
    
    surface._Board.annotationContainer = new Container();
    // Add to the app stage, not the board - annotations need to be at the same level as patterns
    surface._app.stage.addChild(surface._Board.annotationContainer);
    
    const container = surface._Board.annotationContainer as Container;
    
    // Get current zoom factor
    const zoomFactor = surface.zoomFactor || 1;
    
    // Draw all annotations
    this.annotations.forEach(annotation => {
      // Use boardX/boardY if available (new format), otherwise fall back to x/y
      const boardX = annotation.boardX !== undefined ? annotation.boardX : annotation.x;
      const boardY = annotation.boardY !== undefined ? annotation.boardY : annotation.y;
      
      // Create a container for each annotation - like pattern container
      const annotationContainer = new Container();
      annotationContainer.interactive = this.isVisible;
      annotationContainer.cursor = this.isVisible ? 'move' : 'default';
      
      // Create inner container for graphics that will be scaled
      const innerContainer = new Container();
      
      // The graphics are drawn at base size, then scaled
      const g = new Graphics();
      g.beginFill(parseInt(annotation.color.replace('#', '0x')), 0.2);
      g.lineStyle(2, parseInt(annotation.color.replace('#', '0x')), 1);
      g.drawRect(0, 0, annotation.width, annotation.height);
      g.endFill();
      
      const text = new Text(annotation.text, {
        fontSize: annotation.fontSize,
        fill: parseInt(annotation.color.replace('#', '0x')),
        wordWrap: true,
        wordWrapWidth: annotation.width - 10,
        align: 'center'
      });
      text.x = annotation.width / 2;
      text.y = annotation.height / 2;
      text.anchor.set(0.5, 0.5);
      
      innerContainer.addChild(g);
      innerContainer.addChild(text);
      
      // Apply zoom as scale to inner container - exactly like patterns
      innerContainer.scale.set(zoomFactor, zoomFactor);
      
      annotationContainer.addChild(innerContainer);
      
      // Position the container with zoomed coordinates - exactly like patterns do
      // Board coordinates (unzoomed) * current zoom = screen position
      annotationContainer.x = boardX * zoomFactor;
      annotationContainer.y = boardY * zoomFactor;
      
      // Make it draggable
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };
      
      annotationContainer.on('pointerdown', (event: any) => {
        // Only allow dragging if annotation popup is visible
        if (!this.isVisible) return;
        
        isDragging = true;
        annotationContainer.alpha = 0.7;
        
        // Get the global position of the pointer
        const globalPos = event.global;
        // Convert to local position relative to parent
        const localPos = annotationContainer.parent.toLocal(globalPos);
        
        // Calculate offset from annotation position
        dragOffset.x = localPos.x - annotationContainer.x;
        dragOffset.y = localPos.y - annotationContainer.y;
        
        // Stop propagation to prevent board panning and selection
        event.stopPropagation();
        
        // Disable selection box while dragging
        if (surface.selectionBox) {
          surface.selectionBox.isSelecting = false;
        }
      });
      
      // Use global stage events for move and up
      const onPointerMove = (event: any) => {
        if (isDragging) {
          const globalPos = event.global;
          const localPos = annotationContainer.parent.toLocal(globalPos);
          
          annotationContainer.x = localPos.x - dragOffset.x;
          annotationContainer.y = localPos.y - dragOffset.y;
        }
      };
      
      const onPointerUp = () => {
        if (isDragging) {
          isDragging = false;
          annotationContainer.alpha = 1;
          
          // Update annotation position (convert back to unzoomed board coordinates)
          const newBoardX = annotationContainer.x / zoomFactor;
          const newBoardY = annotationContainer.y / zoomFactor;
          annotation.x = newBoardX;
          annotation.y = newBoardY;
          annotation.boardX = newBoardX;
          annotation.boardY = newBoardY;
          this.saveAnnotations();
          
          // Remove global listeners
          surface._app.stage.off('pointermove', onPointerMove);
          surface._app.stage.off('pointerup', onPointerUp);
          surface._app.stage.off('pointerupoutside', onPointerUp);
        }
      };
      
      // Add global listeners when dragging starts
      annotationContainer.on('pointerdown', () => {
        surface._app.stage.on('pointermove', onPointerMove);
        surface._app.stage.on('pointerup', onPointerUp);
        surface._app.stage.on('pointerupoutside', onPointerUp);
      });
      
      container.addChild(annotationContainer);
    });
    
    // Make sure container is visible
    container.visible = true;
  }
  
  hideAllAnnotations() {
    const surface = surfaceManager.currentSurface;
    if (surface && surface._Board && surface._Board.annotationContainer) {
      surface._Board.annotationContainer.visible = false;
      surface._Board.annotationContainer.removeChildren();
      surface._app.stage.removeChild(surface._Board.annotationContainer);
      surface._Board.annotationContainer.destroy();
      surface._Board.annotationContainer = null;
    }
  }
  
  updateAnnotationInteractivity(interactive: boolean) {
    const surface = surfaceManager.currentSurface;
    if (surface && surface._Board && surface._Board.annotationContainer) {
      const container = surface._Board.annotationContainer as Container;
      container.children.forEach(child => {
        child.interactive = interactive;
        child.cursor = interactive ? 'move' : 'default';
      });
    }
  }
  
  handleMouseMove = (event: MouseEvent) => {
    if (this.isPlacing && this.previewGraphics && this.previewContainer) {
      const surface = surfaceManager.currentSurface;
      if (!surface) return;
      
      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Convert to board coordinates
      const boardX = (x - surface._app.stage.x) / surface.zoomFactor;
      const boardY = (y - surface._app.stage.y) / surface.zoomFactor;
      
      const g = this.previewGraphics;
      g.clear();
      
      // Calculate text dimensions
      const tempText = new Text(this.newText, {
        fontSize: this.newFontSize,
        wordWrap: true,
        wordWrapWidth: 200
      });
      const textBounds = tempText.getBounds();
      const width = Math.max(textBounds.width + 20, 150);
      const height = Math.max(textBounds.height + 20, 50);
      tempText.destroy();
      
      // Draw preview at board coordinates with zoom
      const zoomFactor = surface.zoomFactor || 1;
      const scaledWidth = width * zoomFactor;
      const scaledHeight = height * zoomFactor;
      const scaledFontSize = this.newFontSize * zoomFactor;
      const scaledLineWidth = 2 * zoomFactor;
      
      g.beginFill(parseInt(this.newColor.replace('#', '0x')), 0.2);
      g.lineStyle(scaledLineWidth, parseInt(this.newColor.replace('#', '0x')), 1);
      g.drawRect((boardX - width/2) * zoomFactor, (boardY - height/2) * zoomFactor, scaledWidth, scaledHeight);
      g.endFill();
      
      // Show preview text
      const previewText = new Text(this.newText, {
        fontSize: scaledFontSize,
        fill: parseInt(this.newColor.replace('#', '0x')),
        wordWrap: true,
        wordWrapWidth: scaledWidth - 10 * zoomFactor,
        align: 'center'
      });
      previewText.x = boardX * zoomFactor;
      previewText.y = boardY * zoomFactor;
      previewText.anchor.set(0.5, 0.5);
      
      // Clear and add preview
      this.previewContainer.removeChildren();
      this.previewContainer.addChild(g);
      this.previewContainer.addChild(previewText);
    }
  }
  
  handleMouseDown = (event: MouseEvent) => {
    if (this.isPlacing && event.button === 0) {
      const surface = surfaceManager.currentSurface;
      if (!surface) return;
      
      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Calculate text dimensions at base size
      const tempText = new Text(this.newText, {
        fontSize: this.newFontSize,
        wordWrap: true,
        wordWrapWidth: 200
      });
      const textBounds = tempText.getBounds();
      const width = Math.max(textBounds.width + 20, 150);
      const height = Math.max(textBounds.height + 20, 50);
      tempText.destroy();
      
      // Convert screen to board coordinates (unzoomed)
      const boardX = (x - surface._app.stage.x) / surface.zoomFactor;
      const boardY = (y - surface._app.stage.y) / surface.zoomFactor;
      
      // Create annotation - all values in board coordinates (unzoomed)
      const annotation: Annotation = {
        id: guid(),
        text: this.newText,
        x: boardX - width/2,  // Board coordinates
        y: boardY - height/2,  // Board coordinates
        width: width,  // Base width
        height: height,  // Base height
        color: this.newColor,
        fontSize: this.newFontSize,  // Base font size
        boardX: boardX - width/2,  // Explicit board coordinates
        boardY: boardY - height/2   // Explicit board coordinates
      };
      
      this.annotations.push(annotation);
      this.saveAnnotations();
      this.showAllAnnotations();
      this.update();
      
      this.isPlacing = false;
      // Clear preview completely
      if (this.previewGraphics) {
        this.previewGraphics.clear();
      }
      if (this.previewContainer) {
        this.previewContainer.removeChildren();
      }
    }
  }
  
  saveAnnotations() {
    const surface = surfaceManager.currentSurface;
    if (surface && surface._Board) {
      surface._Board.annotations = [...this.annotations];
      
      // Also save to the current board in BoardManager
      if (boardManager.boards[boardManager.currentBoardIndex]) {
        boardManager.boards[boardManager.currentBoardIndex].annotations = [...this.annotations];
      }
      
      // Trigger surface save to persist annotations
      surfaceManager.saveSlectedSurface();
    }
  }
  
  selectAnnotation(annotation: Annotation) {
    this.selectedAnnotation = annotation;
    this.newText = annotation.text;
    this.newColor = annotation.color;
    this.newFontSize = annotation.fontSize;
    this.newWidth = annotation.width;
    this.newHeight = annotation.height;
    this.update();
  }
  
  updateSelectedAnnotation() {
    if (this.selectedAnnotation) {
      this.selectedAnnotation.text = this.newText;
      this.selectedAnnotation.color = this.newColor;
      this.selectedAnnotation.fontSize = this.newFontSize;
      this.selectedAnnotation.width = this.newWidth;
      this.selectedAnnotation.height = this.newHeight;
      this.saveAnnotations();
      this.showAllAnnotations();
      this.update();
    }
  }
  
  deleteAnnotation(annotation: Annotation) {
    this.annotations = this.annotations.filter(a => a.id !== annotation.id);
    if (this.selectedAnnotation?.id === annotation.id) {
      this.selectedAnnotation = null;
    }
    this.saveAnnotations();
    this.showAllAnnotations();
    this.update();
  }

  async exportBoard() {
    const surface = surfaceManager.currentSurface;
    if (!surface) return;
    
    try {
      // Get the app and renderer
      const app = surface._app;
      const renderer = app.renderer;
      /////////////////////////get bounds only of patterns that are going to get cut 
       // Get valid items that are inside or intersecting the board
      const boardWidth = surface._Board._boardWidth;
      const boardLength = surface._Board._boardLength;

      const validItems = surface._Patterns.filter(item => {
        const hull = item._polyHit["points"];
        if (!hull || hull.length === 0) return false;

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

        return intersects;
      });

      // Store original values
      const originalBg = renderer.background.color;
      const originalAlpha = renderer.background.alpha;
      const originalScale = app.stage.scale.x;
      const originalPos = { x: app.stage.x, y: app.stage.y };

      // Set white opaque background
      renderer.background.color = 0xFFFFFF;
      renderer.background.alpha = 1;

      // Reset transform to capture at 1:1 scale
      app.stage.scale.set(1, 1);
      app.stage.position.set(0, 0);

      // Calculate the combined bounds of valid items and annotations
      let exportBounds;
      if (validItems.length > 0 || (surface._Board.annotationContainer && surface._Board.annotationContainer.children.length > 0)) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          
          validItems.forEach(item => {
              const bounds = item.container.getBounds();
              minX = Math.min(minX, bounds.x);
              minY = Math.min(minY, bounds.y);
              maxX = Math.max(maxX, bounds.right);
              maxY = Math.max(maxY, bounds.bottom);
          });

          if (surface._Board.annotationContainer && surface._Board.annotationContainer.children.length > 0) {
            const annotationBounds = surface._Board.annotationContainer.getBounds();
            minX = Math.min(minX, annotationBounds.x);
            minY = Math.min(minY, annotationBounds.y);
            maxX = Math.max(maxX, annotationBounds.right);
            maxY = Math.max(maxY, annotationBounds.bottom);
          }

          exportBounds = new (await import('pixi.js')).Rectangle(minX, minY, maxX - minX, maxY - minY);
      } else {
          // Fallback to the board itself if no valid items or annotations
          exportBounds = surface._Board.getBounds();
      }

      // Add padding
      const padding = 100;
      const exportRegion = {
        x: exportBounds.x - padding,
        y: exportBounds.y - padding,
        width: exportBounds.width + padding * 2,
        height: exportBounds.height + padding * 2
      };
      
      //////////////////////////////////////////////////////////////////////////////////////

/*
      // Get board bounds including all patterns and annotations
      const boardBounds = surface._Board.getBounds();
      
      // Add padding
      const padding = 100;
      const exportRegion = {
        x: boardBounds.x - padding,
        y: boardBounds.y - padding,
        width: boardBounds.width + padding * 2,
        height: boardBounds.height + padding * 2
      };
      
      // Store original values
      const originalBg = renderer.background.color;
      const originalAlpha = renderer.background.alpha;
      const originalScale = app.stage.scale.x;
      const originalPos = { x: app.stage.x, y: app.stage.y };
      
      // Set white opaque background
      renderer.background.color = 0xFFFFFF;
      renderer.background.alpha = 1;
      
      // Reset transform to capture at 1:1 scale
      app.stage.scale.set(1, 1);
      app.stage.position.set(0, 0);
      


      */
      // Create render texture with specific region
      const renderTexture = renderer.generateTexture({
        target: app.stage,
        resolution: 2, // Higher quality
        region: exportRegion
      });
      
      // Extract as image
      const image = await renderer.extract.image(renderTexture);
      
      // Create canvas with white background
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        ppInfo("Export", "Failed to create canvas context.");
        renderTexture.destroy();
        return;
      }
      
      // Fill white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw the image
      ctx.drawImage(image, 0, 0);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `board_${new Date().toISOString().slice(0, 10)}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          ppInfo("Export", "Board exported successfully!");
        } else {
          ppInfo("Export", "Failed to create image blob.");
        }
      }, 'image/png', 0.95);
      
      // Restore original values
      app.stage.scale.set(originalScale, originalScale);
      app.stage.position.set(originalPos.x, originalPos.y);
      renderer.background.color = originalBg;
      renderer.background.alpha = originalAlpha;
      
      // Clean up
      renderTexture.destroy();
    } catch (error) {
      console.error("Export error:", error);
      ppInfo("Export", "Failed to export board. Please try again.");
    }
  }

  
  startAdding() {
    if (!this.newText.trim()) {
      ppInfo('Annotation', 'Please enter text for the annotation');
      return;
    }
    this.isPlacing = true;
    this.update();
  }
}

const _default: TRenderHandler = ($this: AnnotationPopup) => {
  if (!$this.isVisible) return <></>;
  
  const handleMouseDown = (e: MouseEvent) => {
    const popupEl = (e.target as HTMLElement).closest('.annotation-popup');
    const titleBar = (e.target as HTMLElement).closest('.annotation-title-bar');
    
    if (titleBar && popupEl) {
      $this.isDragging = true;
      const rect = popupEl.getBoundingClientRect();
      $this.dragOffsetX = e.clientX - rect.left;
      $this.dragOffsetY = e.clientY - rect.top;
      
      const handleMouseMove = (e: MouseEvent) => {
        if ($this.isDragging) {
          $this.popupX = e.clientX - $this.dragOffsetX;
          $this.popupY = e.clientY - $this.dragOffsetY;
          $this.update();
        }
      };
      
      const handleMouseUp = () => {
        $this.isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };
  
  return (
    <div 
      class="annotation-popup"
      style={{
        position: "fixed",
        left: `${$this.popupX}px`,
        top: `${$this.popupY}px`,
        width: "350px",
        backgroundColor: "white",
        borderRadius: "10px",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.3)",
        zIndex: "1002",
        userSelect: "none"
      }}
    >
      {/* Title Bar */}
      <div 
        class="annotation-title-bar"
        style={{
          backgroundColor: "black",
          color: "white",
          padding: "10px 15px",
          borderRadius: "10px 10px 0 0",
          cursor: "move",
          fontSize: "16px",
          fontWeight: "bold"
        }}
        onMouseDown={handleMouseDown}
      >
        Board Annotations
      </div>
      
      {/* Content */}
      <div style={{ padding: "20px", maxHeight: "500px", overflowY: "auto" }}>
        {/* New/Edit Annotation */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>
            {$this.selectedAnnotation ? "Edit Annotation" : "New Annotation"}
          </h3>
          
          <div style={{ marginBottom: "10px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Text:</label>
            <textarea
              value={$this.newText}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#ffffffff",
                borderRadius: "5px",
                border: "1px solid #25A9E0",
                fontSize: "14px",
                boxSizing: "border-box",
                resize: "vertical",
                minHeight: "60px"
              }}
              onChange={(e) => {
                $this.newText = e.target.value;
                $this.update();
              }}
            />
          </div>
          
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Color:</label>
              <input
                type="color"
                value={$this.newColor}
                style={{
                  width: "100%",
                  height: "35px",
                  padding: "3px",
                  backgroundColor: "#fffefeff",
                  borderRadius: "5px",
                  border: "1px solid #25A9E0",
                  cursor: "pointer"
                }}
                onChange={(e) => {
                  $this.newColor = e.target.value;
                  $this.update();
                }}
              />
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Font Size:</label>
              <input
                type="number"
                value={$this.newFontSize}
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#fffdfdff",
                  borderRadius: "5px",
                  border: "1px solid #25A9E0",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
                min="8"
                max="72"
                onChange={(e) => {
                  $this.newFontSize = parseInt(e.target.value) || 16;
                  $this.update();
                }}
              />
            </div>
          </div>
          
          {/* Width and Height controls - only show when editing */}
          {$this.selectedAnnotation && (
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Width:</label>
                <input
                  type="number"
                  value={$this.newWidth}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#fffdfdff",
                    borderRadius: "5px",
                    border: "1px solid #25A9E0",
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                  min="50"
                  max="500"
                  onChange={(e) => {
                    $this.newWidth = parseInt(e.target.value) || 150;
                    $this.update();
                  }}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Height:</label>
                <input
                  type="number"
                  value={$this.newHeight}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#fffdfdff",
                    borderRadius: "5px",
                    border: "1px solid #25A9E0",
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                  min="30"
                  max="300"
                  onChange={(e) => {
                    $this.newHeight = parseInt(e.target.value) || 50;
                    $this.update();
                  }}
                />
              </div>
            </div>
          )}
          
          <div style={{ display: "flex", gap: "10px" }}>
            {$this.selectedAnnotation ? (
              <>
                <button
                  style={{
                    flex: 1,
                    padding: "8px",
                    backgroundColor: "#25A9E0",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                  onClick={() => $this.updateSelectedAnnotation()}
                >
                  Update
                </button>
                <button
                  style={{
                    padding: "8px 15px",
                    backgroundColor: "#25A9E0",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                  onClick={() => {
                    $this.selectedAnnotation = null;
                    $this.newText = "New Annotation";
                    $this.newColor = "#25A9E0";
                    $this.newFontSize = 25;
                    $this.newWidth = 250;
                    $this.newHeight = 150;
                    $this.update();
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                style={{
                  flex: 1,
                  padding: "8px",
                  backgroundColor: "#25A9E0",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
                onClick={() => $this.startAdding()}
              >
                Add Annotation
              </button>
            )}
          </div>
        </div>
        
        {/* Placement Message */}
        {$this.isPlacing && (
          <div style={{
            marginBottom: "15px",
            padding: "10px",
            backgroundColor: "#25A9E0",
            borderRadius: "5px",
            border: "1px solid #25A9E0",
            textAlign: "center",
            fontSize: "14px",
            color: "#000000ff",
            fontWeight: "bold"
          }}>
            Click on the board to place the annotation
          </div>
        )}
        
        {/* Annotations List */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px" }}>Annotations ({$this.annotations.length})</h3>
          {$this.annotations.length === 0 ? (
            <div style={{ color: "#25A9E0", fontSize: "14px" }}>No annotations yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {$this.annotations.map(annotation => (
                <div
                  style={{
                    padding: "8px",
                    backgroundColor: $this.selectedAnnotation?.id === annotation.id ? "#ffffffff" : "#ffffffff",
                    borderRadius: "5px",
                    border: "1px solid #25A9E0",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px"
                  }}
                  onClick={() => $this.selectAnnotation(annotation)}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      backgroundColor: annotation.color,
                      borderRadius: "3px",
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {annotation.text}
                  </div>
                  <button
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#25A9E0",
                      color: "white",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      $this.deleteAnnotation(annotation);
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "#25A9E0",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold"
            }}
            onClick={() => $this.exportBoard()}
          >
            Export Board
          </button>
          <button
            style={{
              flex: 1,
              padding: "10px",
              backgroundColor: "#25A9E0",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold"
            }}
            onClick={() => $this.hide()}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const annotationPopup = new AnnotationPopup();