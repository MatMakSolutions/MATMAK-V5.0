/** @jsx h */
/** @jsxFrag f */
import { BaseComponent, TRenderHandler, h, f } from "@ekkojs/web-controls";
import { Surface } from '../../../Graphics/Surface';
import { Pattern } from '../../../Pattern/Pattern';
import { surfaceManager } from '../../../Graphics/SurfaceManager';
import { surfaceCollection } from '../../../data/repository/SurfaceCollection';
import { L } from '../../../utils/L';
import { guid } from '../../../core/Guid'; // <-- ADD THIS IMPORT
import paper from 'paper'; // <-- ADD THIS IMPORT
import { undoRedoManager } from '../../../core/UndoRedoManager';


if (!(window as any)._paperSetup) {
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    canvas.style.display = 'none'; // Hide it
    document.body.appendChild(canvas);
    paper.setup(canvas);
    (window as any)._paperSetup = true;
}


export class MirroringPopup extends BaseComponent {
  surface: Surface | null = null;
  isVisible: boolean = false;
  
  // Popup position
  popupX: number = 100;
  popupY: number = 100;
  isDragging: boolean = false;
  dragOffsetX: number = 0;
  dragOffsetY: number = 0;

constructor() {
    super("MirroringPopup");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isVisible"]);
  }

  show() {
    this.isVisible = true;
    this.surface = surfaceManager.currentSurface;
    this.update();
  }

  hide() {
    this.isVisible = false;
    this.update();
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
private async flipPattern(scaleX: number, scaleY: number) {
    if (!this.surface) return;
    const selectedPattern = this.surface._Patterns.find(p => p._state === 'selected');
    if (!selectedPattern) return;

    const surface = this.surface;
    
    // 1. Capture original pattern data BEFORE mirroring
    const originalPatternData = undoRedoManager.capturePatternState(selectedPattern._guid);

    // 2. Get original data and base position
    const patternData = JSON.parse(JSON.stringify(surfaceCollection.selectedSurfaceData.getPattern(selectedPattern._guid)));
    const oldUnzoomedX = selectedPattern.unZoomed(selectedPattern.x);
    const oldUnzoomedY = selectedPattern.unZoomed(selectedPattern.y);
    const oldOriginalPos = selectedPattern._vector.originalPosition;
    const baseX = oldUnzoomedX - oldOriginalPos.x;
    const baseY = oldUnzoomedY - oldOriginalPos.y;

    // 3. Get path strings
    const mainPathStr = patternData.paths[0];
    const subPathsStrs = patternData.paths.slice(1);

    // --- START OF FIX ---

    // 4. Create paper.js paths for ALL parts
    const paperMainPath = new paper.Path(mainPathStr);
    const paperSubPaths = subPathsStrs.map((subStr: string) => new paper.Path(subStr) as paper.Path);
    
    // 5. Group them to get the total bounds
    const group = new paper.Group([paperMainPath, ...paperSubPaths]);
    
    // 6. Get the center of the ENTIRE group
    const bbox = group.bounds;
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    
    // 7. Apply transformation to the group
    //    This flips all children (main + sub) correctly around the shared center
    group.translate(new paper.Point(-centerX, -centerY));
    group.scale(scaleX, scaleY);
    group.translate(new paper.Point(centerX, centerY));

    // 8. Extract the new, flipped path data
    const flippedMainPath = paperMainPath.pathData;
    const flippedSubPaths = paperSubPaths.map((p: paper.Path) => p.pathData);
    
    // --- END OF FIX ---
    
    // 9. Create the new pattern
    const newGuid = guid();
    const newPattern = surface.addPath(flippedMainPath, {
      guid: newGuid,
      nestedPaths: flippedSubPaths,
      noNormilize: false, // Ensure it normalizes
    });
    
    // 10. Calculate and set the new pattern's visual position
    const newOriginalPos = newPattern._vector.originalPosition;
    const newUnzoomedX = baseX + newOriginalPos.x;
    const newUnzoomedY = baseY + newOriginalPos.y;
    
    newPattern.x = newPattern.zoomed(newUnzoomedX);
    newPattern.y = newPattern.zoomed(newUnzoomedY);
    newPattern._rotation = selectedPattern._rotation;
    newPattern.display();

    // 11. Add new pattern to data layer
    const newPatternData = {
      ...patternData, // Copy all original properties
      guid: newGuid,
      paths: [flippedMainPath, ...flippedSubPaths],
      boardPosition: { x: newPattern.x, y: newPattern.y }, 
      boardAngle: newPattern._rotation,
    };
    
    surfaceCollection.selectedSurfaceData.addPattern(newPatternData);

    // 12. Delete the original pattern
    surface.removePattern(selectedPattern);
    surfaceCollection.selectedSurfaceData.removePattern(selectedPattern._guid);

    // 13. Record undo/redo action
    undoRedoManager.recordPatternAction({
      type: 'mirror',
      patternGuid: newGuid,
      beforeState: undefined,
      afterState: newPatternData,
      metadata: {
        originalPattern: originalPatternData
      }
    });

    // 14. Call saveSlectedSurface
    surfaceManager.saveSlectedSurface();
  }

  flipHorizontal() {
    this.flipPattern(-1, 1);
  }

  flipVertical() {
    this.flipPattern(1, -1);
  }

} 

 


const _default: TRenderHandler = ($this: MirroringPopup) => {
  if (!$this.isVisible) return <></>;
  
  const handleMouseDown = (e: MouseEvent) => {
    const popupEl = (e.target as HTMLElement).closest('.mirroring-popup');
    const titleBar = (e.target as HTMLElement).closest('.mirroring-title-bar');
    
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
      class="mirroring-popup"
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
        class="mirroring-title-bar"
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
        Mirror Pattern
      </div>
      
      {/* Content */}
      <div style={{ padding: "20px" }}>
        <div style={{ marginBottom: "15px", fontWeight: "bold", fontSize: "14px", color: "#333" }}>
          Select mirror direction:
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => $this.flipHorizontal()}
            style={{
              padding: "12px",
              backgroundColor: "#25A9E0",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#25A9E0"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#25A9E0"}
          >
            <span style={{ fontSize: "18px" }}>↔</span>
            Flip Horizontal
          </button>
          
          <button
            onClick={() => $this.flipVertical()}
            style={{
              padding: "12px",
              backgroundColor: "#25A9E0",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "background-color 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#25A9E0"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#25A9E0"}
          >
            <span style={{ fontSize: "18px" }}>↕</span>
            Flip Vertical
          </button>
        </div>
        
        {/* Close button */}
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            onClick={() => $this.hide()}
            style={{
              padding: "10px 30px",
              backgroundColor: "#25A9E0",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold"
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};