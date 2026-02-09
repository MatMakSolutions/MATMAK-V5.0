/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { getCurrencySymbol } from "../../../utils/UserSettings";
import { ppInfo } from "../popup/Popup";
import { _evtBus } from "../../../core/EventBus";
import { config } from "../../../core/Constant";
import { liveConfig } from "../../../core/LiveConfig";
import { surfaceManager } from "../../../Graphics/SurfaceManager";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";

export class RollSelectionPopup extends BaseComponent {
  isVisible: boolean = false;
  selectedRollIndex: number = -1; // -1 means "Default" is selected
  
  // Popup position
  popupX: number = 100;
  popupY: number = 100;
  isDragging: boolean = false;
  dragOffsetX: number = 0;
  dragOffsetY: number = 0;
  
  constructor() {
    super("RollSelectionPopup");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isVisible", "selectedRollIndex"]);
  }
  
  show() {
    this.isVisible = true;
    this.selectedRollIndex = (window as any).selectedRollIndex ?? -1;
    this.update();
  }
  
  hide() {
    this.isVisible = false;
    this.update();
  }
  
  /**
   * Select a roll and update the board width accordingly
   * @param index -1 for default, 0+ for user rolls
   */
  selectRoll(index: number) {
    this.selectedRollIndex = index;
    (window as any).selectedRollIndex = index;
    
    let widthMm: number;
    let source: string;
    
    if (index === -1) {
      // Default width from settings
      widthMm = config.boardWidth;
      source = "default";
    } else {
      // Roll width
      const userRollData = (window as any).userRollData || [];
      if (userRollData[index]) {
        const roll = userRollData[index];
        // Roll width from API is in meters, convert to mm
        widthMm = roll.width * 1000;
        source = roll.name || `Roll ${index + 1}`;
      } else {
        widthMm = config.boardWidth;
        source = "default";
      }
    }
    
    // Update the board width
    this.updateBoardWidth(widthMm, source);
    
    _evtBus.emit("rollSelected", index);
    this.update();
  }
  
  /**
   * Update the board width across the application
   */
  updateBoardWidth(widthMm: number, source: string) {
    if (!surfaceManager.currentSurface) return;
    
    // Update the current surface board width
    surfaceManager.currentSurface._Board._boardWidth = widthMm;
    
    // Update the surface data for persistence
    if (surfaceCollection.selectedSurfaceData) {
      surfaceCollection.selectedSurfaceData.boardWidth = widthMm;
    }
    
    // Refresh the display
    surfaceManager.currentSurface.display();
    
    // Emit event for any listeners (overlap, cut preview, nesting, etc.)
    _evtBus.emit("boardWidthChanged", { width: widthMm, source });
  }
  
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}

const _default: TRenderHandler = ($this: RollSelectionPopup) => {
  if (!$this.isVisible) return <></>;
  
  const userRollData = (window as any).userRollData || [];
  const userCurrency = (window as any).userCurrency || 1;
  const currencySymbol = getCurrencySymbol(userCurrency);
  const userUnitOfMeasure = liveConfig.unitOfMeasure || 2;
  const isImperial = userUnitOfMeasure === 3;
  const unitLabel = isImperial ? 'in' : 'mm';
  
  // Get default width from settings
  const defaultWidthMm = config.boardWidth;
  const defaultWidthDisplay = isImperial 
    ? (defaultWidthMm / 25.4).toFixed(1) 
    : defaultWidthMm.toFixed(0);
  
  const handleMouseDown = (e: MouseEvent) => {
    const popupEl = (e.target as HTMLElement).closest('.roll-selection-popup');
    const titleBar = (e.target as HTMLElement).closest('.roll-selection-title-bar');
    
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
  
  const isDefaultSelected = $this.selectedRollIndex === -1;
  
  return (
    <div 
      class="roll-selection-popup"
      style={{
        position: "fixed",
        left: `${$this.popupX}px`,
        top: `${$this.popupY}px`,
        width: "400px",
        backgroundColor: "white",
        borderRadius: "10px",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.3)",
        zIndex: "1002",
        userSelect: "none"
      }}
    >
      {/* Title Bar */}
      <div 
        class="roll-selection-title-bar"
        style={{
          backgroundColor: "black",
          color: "white",
          padding: "10px 15px",
          borderRadius: "10px 10px 0 0",
          cursor: "move",
          fontSize: "16px",
          fontWeight: "bold",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
        onMouseDown={handleMouseDown}
      >
        <span>Material Roll Selection</span>
        <button
          style={{
            backgroundColor: "transparent",
            color: "white",
            border: "none",
            fontSize: "20px",
            cursor: "pointer",
            padding: "0 5px"
          }}
          onClick={() => $this.hide()}
        >
          ×
        </button>
      </div>
      
      {/* Content */}
      <div style={{ 
        padding: "20px",
        maxHeight: "400px",
        overflowY: "auto"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Default Width Option */}
          <div
            style={{
              border: isDefaultSelected ? "2px solid #25A9E0" : "1px solid #ccc",
              borderRadius: "8px",
              padding: "15px",
              backgroundColor: isDefaultSelected ? "#ffffffff" : "white",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onClick={() => $this.selectRoll(-1)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "5px" }}>
                  Default (Settings)
                </div>
                <div style={{ color: "#666", fontSize: "14px" }}>
                  Width: {defaultWidthDisplay}{unitLabel}
                </div>
                <div style={{ color: "#666", fontSize: "14px" }}>
                  Uses width from Settings configuration
                </div>
              </div>
              <div style={{
                textAlign: "right",
                fontSize: "14px",
                fontWeight: "bold",
                color: "#888"
              }}>
                Default
              </div>
            </div>
            {isDefaultSelected && (
              <div style={{
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#25A9E0",
                color: "white",
                borderRadius: "5px",
                fontSize: "12px",
                textAlign: "center"
              }}>
                Currently Selected
              </div>
            )}
          </div>
          
          {/* User Rolls */}
          {userRollData.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "20px",
              color: "#666",
              borderTop: "1px solid #eee",
              marginTop: "10px"
            }}>
              No additional material rolls configured
            </div>
          ) : (
            userRollData.map((roll: any, index: number) => {
              const pricePerSqm = roll.purchase_price;
              const isSelected = index === $this.selectedRollIndex;
              const widthInMm = roll.width * 1000; // Convert meters to mm
              
              const widthDisplay = isImperial 
                ? `${(widthInMm / 25.4).toFixed(1)}${unitLabel} (${widthInMm.toFixed(0)}mm)`
                : `${widthInMm.toFixed(0)}${unitLabel} (${(widthInMm / 25.4).toFixed(1)}in)`;
              
              return (
                <div
                  key={index}
                  style={{
                    border: isSelected ? "2px solid #25A9E0" : "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "15px",
                    backgroundColor: isSelected ? "#ffffffff" : "white",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onClick={() => $this.selectRoll(index)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "5px" }}>
                        {roll.name || `Roll ${index + 1}`}
                      </div>
                      <div style={{ color: "#666", fontSize: "14px" }}>
                        Width: {widthDisplay}
                      </div>
                      <div style={{ color: "#666", fontSize: "14px" }}>
                        Cost Price: {currencySymbol}{roll.purchase_price.toFixed(2)}/m
                      </div>
                    </div>
                    <div style={{
                      textAlign: "right",
                      fontSize: "18px",
                      fontWeight: "bold",
                      color: "#25A9E0"
                    }}>
                      {currencySymbol}{pricePerSqm.toFixed(2)}/m²
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{
                      marginTop: "10px",
                      padding: "5px 10px",
                      backgroundColor: "#25A9E0",
                      color: "white",
                      borderRadius: "5px",
                      fontSize: "12px",
                      textAlign: "center"
                    }}>
                      Currently Selected
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};