/** @jsx h */
/** @jsxFrag f */
import { BaseComponent, TRenderHandler, h, f } from "@ekkojs/web-controls";
import { systemDesign } from "../../SystemDesign";
import { surfaceManager } from "../../../Graphics/SurfaceManager";
import { liveConfig } from "../../../core/LiveConfig";

export class RulerPopup extends BaseComponent {
  isVisible: boolean = false;
  isDragging: boolean = false;
  popupX: number = 400;
  popupY: number = 200;
  dragOffsetX: number = 0;
  dragOffsetY: number = 0;
  
  // Ruler settings - default based on user's current unit system
  measurementUnit: 'metric' | 'imperial' = liveConfig.unitOfMeasure === 3 ? 'imperial' : 'metric';
  graduation: number = liveConfig.unitOfMeasure === 3 ? 1 : 100; // 1 inch for imperial, 100mm for metric
  keepRulerOnRelease: boolean = false;
  placementMessage: string = "";
  
  constructor() {
    super("RulerPopup");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isVisible", "measurementUnit", "graduation", "keepRulerOnRelease", "placementMessage"]);
  }
  
  show() {
    // Update measurement unit based on current liveConfig
    this.measurementUnit = liveConfig.unitOfMeasure === 3 ? 'imperial' : 'metric';
    this.graduation = liveConfig.unitOfMeasure === 3 ? 1 : 100;
    
    this.isVisible = true;
    // Enable ruler mode on surface
    const surface = surfaceManager.currentSurface;
    if (surface) {
      surface.rulerMode = true;
      surface.rulerUnit = this.measurementUnit;
      surface.rulerGraduation = this.graduation;
      surface.rulerKeepOnRelease = this.keepRulerOnRelease;
      // Initialize the ruler tool immediately
      surface.initializeRuler();
    }
    this.placementMessage = "Click and drag on the board to measure";
    this.update();
  }
  
  hide() {
    this.isVisible = false;
    this.placementMessage = "";
    // Disable ruler mode on surface
    const surface = surfaceManager.currentSurface;
    if (surface) {
      surface.rulerMode = false;
      // Clear any existing ruler
      surface.cleanupRuler();
    }
    this.update();
  }
  
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  updateSettings() {
    const surface = surfaceManager.currentSurface;
    if (surface) {
      surface.updateRulerSettings(this.measurementUnit, this.graduation, this.keepRulerOnRelease);
    }
    this.update();
  }
  
  setMetric() {
    this.measurementUnit = 'metric';
    this.graduation = 100; // Default to 100mm
    this.updateSettings();
  }
  
  setImperial() {
    this.measurementUnit = 'imperial';
    this.graduation = 1; // Default to 1 inch
    this.updateSettings();
  }
  
  updateGraduation(value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      this.graduation = num;
      this.updateSettings();
    }
  }
  
  toggleKeepOnRelease() {
    this.keepRulerOnRelease = !this.keepRulerOnRelease;
    this.updateSettings();
  }
}

const _default: TRenderHandler = ($this: RulerPopup) => {
  if (!$this.isVisible) return <></>;
  
  const handleMouseDown = (e: MouseEvent) => {
    const popupEl = (e.target as HTMLElement).closest('.ruler-popup');
    const titleBar = (e.target as HTMLElement).closest('.ruler-title-bar');
    
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
      class="ruler-popup"
      style={{
        position: "fixed",
        left: `${$this.popupX}px`,
        top: `${$this.popupY}px`,
        width: "300px",
        backgroundColor: "white",
        borderRadius: "10px",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.3)",
        zIndex: "1002",
        userSelect: "none"
      }}
    >
      {/* Title Bar */}
      <div 
        class="ruler-title-bar"
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
        Ruler Tool
      </div>
      
      {/* Content */}
      <div style={{ padding: "20px" }}>
        {/* Measurement Unit */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ marginBottom: "10px", fontWeight: "bold", fontSize: "14px" }}>
            Measurement Unit:
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: $this.measurementUnit === 'metric' ? "#25A9E0" : "#25A9E0",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px"
              }}
              onClick={() => $this.setMetric()}
            >
              Metric
            </button>
            <button
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: $this.measurementUnit === 'imperial' ? "#25A9E0" : "#25A9E0",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px"
              }}
              onClick={() => $this.setImperial()}
            >
              Imperial
            </button>
          </div>
        </div>
        
        {/* Graduation */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "bold" }}>
            Graduation:
          </label>
          {$this.measurementUnit === 'metric' ? (
            <select
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ccc",
                borderRadius: "5px",
                fontSize: "14px",
                cursor: "pointer"
              }}
              value={$this.graduation.toString()}
              onChange={(e: Event) => $this.updateGraduation((e.target as HTMLSelectElement).value)}
            >
              <option value="1">1 mm</option>
              <option value="5">5 mm</option>
              <option value="10">10 mm</option>
              <option value="25">25 mm</option>
              <option value="50">50 mm</option>
              <option value="100">100 mm</option>
            </select>
          ) : (
            <select
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ccc",
                borderRadius: "5px",
                fontSize: "14px",
                cursor: "pointer"
              }}
              value={$this.graduation.toString()}
              onChange={(e: Event) => $this.updateGraduation((e.target as HTMLSelectElement).value)}
            >
              <option value="0.0625">1/16"</option>
              <option value="0.125">1/8"</option>
              <option value="0.25">1/4"</option>
              <option value="0.5">1/2"</option>
              <option value="1">1"</option>
            </select>
          )}
        </div>
        
        {/* Keep ruler on release option */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ 
            display: "flex", 
            alignItems: "center", 
            cursor: "pointer",
            fontSize: "14px"
          }}>
            <input
              type="checkbox"
              checked={$this.keepRulerOnRelease}
              style={{ 
                marginRight: "8px",
                cursor: "pointer"
              }}
              onChange={() => $this.toggleKeepOnRelease()}
            />
            Keep ruler after mouse release
          </label>
        </div>
        
        {/* Placement Message */}
        {$this.placementMessage && (
          <div style={{
            marginBottom: "15px",
            padding: "10px",
            backgroundColor: "#FFF8DC",
            borderRadius: "5px",
            border: "1px solid #25A9E0",
            textAlign: "center",
            fontSize: "14px",
            color: "#333",
            fontWeight: "bold"
          }}>
            {$this.placementMessage}
          </div>
        )}
        
        {/* Close Button */}
        <button
          style={{
            width: "100%",
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
  );
};

RulerPopup.registerSystemDesign(systemDesign);