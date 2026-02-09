/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { Graphics, Container, Text, TextStyle } from "pixi.js";
import { surfaceManager } from "../../../Graphics/SurfaceManager";
import { VectorPath } from "../../../VectorPath/VectorPath";
import { Pattern } from "../../../Pattern/Pattern";
import { guid } from "../../../core/Guid";
import { ppInfo, ppPrompt } from "../popup/Popup";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";
import { liveConfig } from "../../../core/LiveConfig";

export class GeometryPopup extends BaseComponent {
  isVisible: boolean = false;
  selectedShape: 'rectangle' | 'circle' | null = null;
  width: number = liveConfig.unitOfMeasure === 3 ? 4 : 100;  // 4 inches or 100mm
  height: number = liveConfig.unitOfMeasure === 3 ? 4 : 100; // 4 inches or 100mm
  diameter: number = liveConfig.unitOfMeasure === 3 ? 4 : 100; // 4 inches or 100mm
  
  // Popup position
  popupX: number = 100;
  popupY: number = 100;
  isDragging: boolean = false;
  dragOffsetX: number = 0;
  dragOffsetY: number = 0;
  
  // Preview
  isPlacing: boolean = false;
  previewContainer: Container | null = null;
  previewGraphics: Graphics | null = null;
  placementMessage: string = "";
  
  constructor() {
    super("GeometryPopup");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isVisible", "selectedShape", "width", "height", "diameter", "isPlacing", "placementMessage"]);
  }
  
  show() {
    // Unselect all patterns
    const surface = surfaceManager.currentSurface;
    if (surface) {
      surface._Patterns.forEach(p => {
        if (p._state !== "") {
          p.setState("");
        }
      });
    }
    
    this.isVisible = true;
    this.setupPreview();
    this.update();
  }
  
  hide() {
    this.isVisible = false;
    this.isPlacing = false;
    this.placementMessage = "";
    this.cleanupPreview();
    this.update();
  }
  
  setupPreview() {
    const surface = surfaceManager.currentSurface;
    if (!surface || !surface._InfoLayer) return;
    
    this.previewContainer = new Container();
    this.previewGraphics = new Graphics();
    this.previewContainer.addChild(this.previewGraphics);
    surface._InfoLayer.addChild(this.previewContainer);
    
    // Add mouse event listeners
    surface._app.canvas.addEventListener("mousemove", this.handleMouseMove);
    surface._app.canvas.addEventListener("mousedown", this.handleMouseDown);
  }
  
  cleanupPreview() {
    const surface = surfaceManager.currentSurface;
    if (surface) {
      surface._app.canvas.removeEventListener("mousemove", this.handleMouseMove);
      surface._app.canvas.removeEventListener("mousedown", this.handleMouseDown);
      
      if (this.previewContainer && surface._InfoLayer) {
        surface._InfoLayer.removeChild(this.previewContainer);
        this.previewContainer.destroy();
        this.previewContainer = null;
        this.previewGraphics = null;
      }
    }
  }
  
  handleMouseMove = (event: MouseEvent) => {
    if (this.isPlacing && this.previewGraphics && this.selectedShape) {
      const surface = surfaceManager.currentSurface;
      if (!surface) return;
      
      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      const g = this.previewGraphics;
      g.clear();
      g.setStrokeStyle({ width: 2, color: 0x00FF00, alpha: 0.8 });
      g.setFillStyle({ color: 0x00FF00, alpha: 0.2 });
      
      // Convert to mm if in imperial mode for preview
      let widthMm = this.width;
      let heightMm = this.height;
      let diameterMm = this.diameter;
      
      if (liveConfig.unitOfMeasure === 3) {
        // Convert from inches to mm
        widthMm = this.width * 25.4;
        heightMm = this.height * 25.4;
        diameterMm = this.diameter * 25.4;
      }
      
      if (this.selectedShape === 'rectangle') {
        const halfWidth = surface.zoomed(widthMm / 2);
        const halfHeight = surface.zoomed(heightMm / 2);
        g.rect(mouseX - halfWidth, mouseY - halfHeight, surface.zoomed(widthMm), surface.zoomed(heightMm));
      } else if (this.selectedShape === 'circle') {
        g.circle(mouseX, mouseY, surface.zoomed(diameterMm / 2));
      }
      
      g.fill();
      g.stroke();
    }
  }
  
  handleMouseDown = (event: MouseEvent) => {
    if (this.isPlacing && this.selectedShape && event.button === 0) {
      const surface = surfaceManager.currentSurface;
      if (!surface) return;
      
      const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      // Pass screen coordinates directly
      this.createShape(mouseX, mouseY);
      this.isPlacing = false;
      this.placementMessage = "";
      this.update();
      
      // Clear preview
      if (this.previewGraphics) {
        this.previewGraphics.clear();
      }
    }
  }
  
  createShape(x: number, y: number) {
    let pathString = '';
    
    // Convert to mm if in imperial mode
    let widthMm = this.width;
    let heightMm = this.height;
    let diameterMm = this.diameter;
    
    if (liveConfig.unitOfMeasure === 3) {
      // Convert from inches to mm
      widthMm = this.width * 25.4;
      heightMm = this.height * 25.4;
      diameterMm = this.diameter * 25.4;
    }
    
    if (this.selectedShape === 'rectangle') {
      const halfWidth = widthMm / 2;
      const halfHeight = heightMm / 2;
      const left = -halfWidth;
      const right = halfWidth;
      const top = -halfHeight;
      const bottom = halfHeight;
      
      // Rectangle as 4 lines
      pathString = `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
    } else if (this.selectedShape === 'circle') {
      const radius = diameterMm / 2;
      // Circle as 4 curves
      const k = 0.552284749831; // Magic number for circular bezier curves
      const cp = radius * k; // Control point distance
      
      pathString = `M ${radius} 0 `;
      pathString += `C ${radius} ${cp} ${cp} ${radius} 0 ${radius} `;
      pathString += `C ${-cp} ${radius} ${-radius} ${cp} ${-radius} 0 `;
      pathString += `C ${-radius} ${-cp} ${-cp} ${-radius} 0 ${-radius} `;
      pathString += `C ${cp} ${-radius} ${radius} ${-cp} ${radius} 0 Z`;
    }
    
    // Create new pattern
    const surface = surfaceManager.currentSurface;
    if (surface && pathString) {
      const newPattern = surface.addPath(pathString, {
        guid: guid(),
        noNormilize: false
      });
      
      if (newPattern) {
        // Convert screen coordinates to pattern position
        // Account for stage position (pan) and zoom
        newPattern.x = x - surface._app.stage.x;
        newPattern.y = y - surface._app.stage.y;
        newPattern.display();
        
        // Register the pattern with the data layer
        surfaceCollection.selectedSurfaceData.addPattern({
          boardAngle: 0,
          boardPosition: { x: newPattern.x, y: newPattern.y },
          guid: newPattern._guid,
          paths: [newPattern._vector.generatePathString()],
          patternColor: "",
          patternName: `Geometry_${this.selectedShape}`,
          patternId: guid()
        });
        
        // Save to surface
        surfaceManager.saveSlectedSurface();
      }
    }
  }
  
  updateWidth(value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      this.width = num;
      this.update();
    }
  }
  
  updateHeight(value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      this.height = num;
      this.update();
    }
  }
  
  updateDiameter(value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      this.diameter = num;
      this.update();
    }
  }
  
  selectRectangle() {
    this.selectedShape = 'rectangle';
    this.update();
  }
  
  selectCircle() {
    this.selectedShape = 'circle';
    this.update();
  }
  
  startAdding() {
    if (!this.selectedShape) {
      ppInfo('Geometry', 'Please select a shape type first');
      return;
    }
    this.isPlacing = true;
    this.placementMessage = "Click on the board to place the shape";
    this.update();
  }
  
  finish() {
    this.hide();
  }
}

const _default: TRenderHandler = ($this: GeometryPopup) => {
  if (!$this.isVisible) return <></>;
  
  const isImperial = liveConfig.unitOfMeasure === 3;
  const unitLabel = isImperial ? "in" : "mm";
  
  const handleMouseDown = (e: MouseEvent) => {
    const popupEl = (e.target as HTMLElement).closest('.geometry-popup');
    const titleBar = (e.target as HTMLElement).closest('.geometry-title-bar');
    
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
      class="geometry-popup"
      style={{
        position: "fixed",
        left: `${$this.popupX}px`,
        top: `${$this.popupY}px`,
        width: "250px",
        backgroundColor: "white",
        borderRadius: "10px",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.3)",
        zIndex: "1002",
        userSelect: "none"
      }}
    >
      {/* Title Bar */}
      <div 
        class="geometry-title-bar"
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
        Add Geometry
      </div>
      
      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Shape Selection */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ marginBottom: "10px", fontWeight: "bold" }}>Select Shape:</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: $this.selectedShape === 'rectangle' ? "#25A9E0" : "#25A9E0",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px"
              }}
              onClick={() => $this.selectRectangle()}
            >
              Rectangle
            </button>
            <button
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: $this.selectedShape === 'circle' ? "#25A9E0" : "#25A9E0",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px"
              }}
              onClick={() => $this.selectCircle()}
            >
              Circle
            </button>
          </div>
        </div>
        
        {/* Dimensions */}
        <div style={{ marginBottom: "20px" }}>
          {$this.selectedShape === 'rectangle' && (
            <>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Width ({unitLabel}):</label>
                <input
                  type="number"
                  value={$this.width}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "5px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                  min="0.1"
                  step={isImperial ? "0.1" : "1"}
                  onChange={(e) => $this.updateWidth(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Height ({unitLabel}):</label>
                <input
                  type="number"
                  value={$this.height}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#f0f0f0",
                    borderRadius: "5px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                  min="0.1"
                  step={isImperial ? "0.1" : "1"}
                  onChange={(e) => $this.updateHeight(e.target.value)}
                />
              </div>
            </>
          )}
          
          {$this.selectedShape === 'circle' && (
            <div style={{ marginBottom: "10px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontSize: "14px" }}>Diameter ({unitLabel}):</label>
              <input
                type="number"
                value={$this.diameter}
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#f0f0f0",
                  borderRadius: "5px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
                min="0.1"
                step={isImperial ? "0.1" : "1"}
                onChange={(e) => $this.updateDiameter(e.target.value)}
              />
            </div>
          )}
        </div>
        
        {/* Placement Message */}
        {$this.placementMessage && (
          <div style={{
            marginBottom: "15px",
            padding: "10px",
            backgroundColor: "#25A9E0",
            borderRadius: "5px",
            border: "1px solid #ffffffff",
            textAlign: "center",
            fontSize: "14px",
            color: "#333",
            fontWeight: "bold"
          }}>
            {$this.placementMessage}
          </div>
        )}
        
        {/* Buttons */}
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
            onClick={() => $this.startAdding()}
          >
            Add
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
            onClick={() => $this.finish()}
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
};