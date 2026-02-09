/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { waitForElt } from "../../../core/Dom";
import * as PIXI from 'pixi.js';
import { PatternSelect } from "../../../uof/Data";
import { VectorDisplay } from "../../../mvd/WebGL/VectorDisplay";
import { GraphicDrawer } from "../../../mvd/WebGL/GraphicDrawer";
import { _evtBus, _evts, CancelEvent } from "../../../core/EventBus";
import { curProjectId, currentPatternSelection, searchCut, searchParams } from "../../../uof/Globals";
import { CutBoardPreview } from "../CutBoardPreview/CutBoardPreview";
import { getUow } from "../../../uof/UnitOfWork";
import { boardManager } from "../../../cutboard/BoardManager";
import { guid } from "../../../core/Guid";
import { SurfaceData, TSurfaceDataPattern } from "../../../data/repository/SurfaceData";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";
import { PatternFile } from "../../../uof/SearchType";
import { VectorPath } from "../../../VectorPath/VectorPath";
import { themeManager } from "../../../utils/ThemeManager";

function getScreenshot(app: PIXI.Application, container: PIXI.Container, renderer: PIXI.Renderer): string {
  const renderTexture = PIXI.RenderTexture.create({
    width: app.screen.width,
    height: app.screen.height
  });
  renderer.render(container, { renderTexture });
  const canvas = renderer.extract.canvas(renderTexture);
  const base64String = canvas.toDataURL('image/png');
  renderTexture.destroy(true);
  return base64String;
}

const colors = [0x40E0D0, 0x00FF00, 0xFF0000, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0x000000, 0xFFFFFF];
let colorIdx = 0;



export class SelectPattern extends BaseComponent {
  stage          : PIXI.Container | null = null;
  mainCtn        : PIXI.Container | null = null;
  zoomInEvt      : CancelEvent    | null = null;
  zoomOutEvt     : CancelEvent    | null = null;
  addAllEvt      : CancelEvent    | null = null;
  addSelectedEvt : CancelEvent    | null = null;
  onResize       : CancelEvent    | null = null;
    selectionRect: PIXI.Graphics | null = null;
  isSelecting: boolean = false;
  startX: number = 0;
  startY: number = 0;



  constructor() {
    super("SelectPattern");
    this.registerTemplate("default",_default);

    this.addEventListener("unmount", () => {
      this.zoomInEvt?.off();
      this.zoomOutEvt?.off();
      this.addAllEvt?.off();
      this.addSelectedEvt?.off();
      this.onResize?.off();
    });

    this.addEventListener("mount", async () => {
      // Gets the main canvas element
      const boardCanvas = await waitForElt<HTMLCanvasElement>("#select-pattern-canvas");

      this.zoomInEvt = _evtBus.on(_evts.PatternSelection.zoomIn, () => {
        handleZoom(GraphicDrawer.zoomFactor, 0.02);
      });

      this.zoomOutEvt = _evtBus.on(_evts.PatternSelection.zoomOut, () => {
        handleZoom(GraphicDrawer.zoomFactor, -0.02);
      });

      function handleZoom(previousZoom: number, newZoom: number) {
        const oldRatio = previousZoom;
        const zoomFactor = newZoom;
        GraphicDrawer.zoomFactor += zoomFactor;

        vecDisplay.forEach((vd) => {
          vd.rebuild();
          vd.render();
        });
        const worldPos = {
          x: (prevX - mainCtn.x) / oldRatio,
          y: (prevY - mainCtn.y) / oldRatio
        };

        mainCtn.x = prevX - worldPos.x * GraphicDrawer.zoomFactor;
        mainCtn.y = prevY - worldPos.y * GraphicDrawer.zoomFactor;
      }



      this.addAllEvt = _evtBus.on(_evts.PatternSelection.addAll, () => {
        vecDisplay.forEach((item) => {
          item.isSelected = true;

        });
        const str = getScreenshot(app, app.stage, app.renderer as any);
        currentPatternSelection.images.push(str);
        currentPatternSelection.colorPacks.push(colors[colorIdx]);
        const patternName = PatternSelect.item?.name || '';
        const displayName = patternName && searchParams.currentName 
          ? `${patternName} - ${searchParams.currentName}` 
          : patternName || searchParams.currentName;
        const itm = {...PatternSelect.item, guid: guid(), name: displayName} as PatternFile;
        searchCut.push(itm);

        // --- START NEW LOGIC ---
        const PADDING = 10; // 10mm padding from the cutboard edge
        let groupMinX = Infinity;
        let groupMinY = Infinity;
        
        // Get region from PatternSelect.item instead of make/model/year
        let regionLabel = "";
        if (PatternSelect.item?.car_pattern_region) {
          const regionStr = String(PatternSelect.item.car_pattern_region);
          if (regionStr.includes(',')) {
            // Remove everything before the first comma, then get regions
            const afterFirstComma = regionStr.substring(regionStr.indexOf(',') + 1).trim();
            regionLabel = afterFirstComma;
          } else {
            regionLabel = regionStr.trim();
          }
        } else if (PatternSelect.item?.regions && Array.isArray(PatternSelect.item.regions)) {
          regionLabel = PatternSelect.item.regions.map((r: any) => r.region || r.name || String(r)).filter((r: string) => r).join(', ');
        }
        
        const selectedPatterns: {idx: number, originalX: number, originalY: number}[] = [];

        // First pass: Find the top-left corner (minX, minY) of the entire group
        vecDisplay.forEach((vd,idx) => {
          if (vd.isSelected) {
            vecDoc._items[idx].carColor = colors[colorIdx];
            vecDoc._items[idx].carLegend = regionLabel || searchParams.currentName;
            vecDoc._items[idx].rawPattern = itm;
            currentPatternSelection.selections.push(vecDoc._items[idx]);
            
            // Create a VectorPath to get bounds AND originalPosition
            const vectorPath = new VectorPath();
            const pathString = vecDoc._items[idx].rawVectors.map((v) => v.asString()).join(' ');
            vectorPath.parse(pathString);
            vectorPath.normalize(); // This calculates both bounds and originalPosition
            
            const bounds = vectorPath.getBoundingBox(); // Bounds of the normalized (centered) pattern
            const originalX = vectorPath.originalPosition.x; // The large "world" coordinate
            const originalY = vectorPath.originalPosition.y;

            // Calculate the pattern's true top-left corner in "world" space
            const patternMinX = originalX + bounds.x;
            const patternMinY = originalY + bounds.y;

            // Update the group's overall top-left corner
            if (patternMinX < groupMinX) groupMinX = patternMinX;
            if (patternMinY < groupMinY) groupMinY = patternMinY;
            
            selectedPatterns.push({idx, originalX, originalY});
          }
        });
        
        // Calculate the single shift required for the whole group
        // We want the group's top-left corner (groupMinX) to be at PADDING
        const shiftX = PADDING - groupMinX;
        const shiftY = PADDING - groupMinY;
        
        // Second pass: add all patterns
        selectedPatterns.forEach(({idx, originalX, originalY}) => {
          
          // The boardPosition is the "base" offset.
          // Per connectToScreen logic: finalPos = boardPosition + originalPosition
          // We want: finalPos = originalPosition + shift
          // Therefore: boardPosition = shift
          const baseX = shiftX;
          const baseY = shiftY;

          const item = {
            boardAngle: 0,
            boardPosition: {x: baseX, y: baseY}, // Use the calculated base shift
            patternColor: colors[colorIdx],
            patternName: searchParams.currentName,
            patternId: PatternSelect.item?.pattern_id,
            paths: vecDoc._items[idx].rawVectors.map((v) => v.asString()),
            guid: guid(),
            firstLoad: true,
          } as TSurfaceDataPattern
          surfaceCollection.addPatternToDraftedSurface(item);
        });
        // --- END NEW LOGIC ---

        currentPatternSelection.shouldBeProcessed = true;
        getUow<CutBoardPreview>("cutPreview").update();

        colorIdx++;
        colorIdx = colorIdx % colors.length;
      });

      this.addSelectedEvt = _evtBus.on(_evts.PatternSelection.addSelected, () => {
        const str = getScreenshot(app, app.stage, app.renderer as any);
        currentPatternSelection.images.push(str);
        currentPatternSelection.colorPacks.push(colors[colorIdx]);
        let hasSelected = false;
        
        // --- START NEW LOGIC ---
        const PADDING = 10; // 10mm padding from the cutboard edge
        let groupMinX = Infinity;
        let groupMinY = Infinity;
        
        // Get region from PatternSelect.item instead of make/model/year
        let regionLabel = "";
        if (PatternSelect.item?.car_pattern_region) {
          const regionStr = String(PatternSelect.item.car_pattern_region);
          if (regionStr.includes(',')) {
            // Remove everything before the first comma, then get regions
            const afterFirstComma = regionStr.substring(regionStr.indexOf(',') + 1).trim();
            regionLabel = afterFirstComma;
          } else {
            regionLabel = regionStr.trim();
          }
        } else if (PatternSelect.item?.regions && Array.isArray(PatternSelect.item.regions)) {
          regionLabel = PatternSelect.item.regions.map((r: any) => r.region || r.name || String(r)).filter((r: string) => r).join(', ');
        }
        
        const selectedPatterns: {idx: number, originalX: number, originalY: number}[] = [];

        // First pass: Find the top-left corner (minX, minY) of the entire group
        vecDisplay.forEach(async (vd,idx) => {
          if (vd.isSelected) {
            hasSelected = true;

            vecDoc._items[idx].carColor = colors[colorIdx];
            vecDoc._items[idx].carLegend = regionLabel || searchParams.currentName;
            vecDoc._items[idx].rawPattern = PatternSelect.item;
            currentPatternSelection.selections.push(vecDoc._items[idx]);
            
            // Create a VectorPath to get bounds AND originalPosition
            const vectorPath = new VectorPath();
            const pathString = vecDoc._items[idx].rawVectors.map((v) => v.asString()).join(' ');
            vectorPath.parse(pathString);
            vectorPath.normalize(); // This calculates both bounds and originalPosition
            
            const bounds = vectorPath.getBoundingBox(); // Bounds of the normalized (centered) pattern
            const originalX = vectorPath.originalPosition.x; // The large "world" coordinate
            const originalY = vectorPath.originalPosition.y;

            // Calculate the pattern's true top-left corner in "world" space
            const patternMinX = originalX + bounds.x;
            const patternMinY = originalY + bounds.y;

            // Update the group's overall top-left corner
            if (patternMinX < groupMinX) groupMinX = patternMinX;
            if (patternMinY < groupMinY) groupMinY = patternMinY;
            
            selectedPatterns.push({idx, originalX, originalY});
          }
        });
        
        if (!hasSelected) {
          colorIdx++;
          colorIdx = colorIdx % colors.length;
          return;
        }

        // Calculate the single shift required for the whole group
        const shiftX = PADDING - groupMinX;
        const shiftY = PADDING - groupMinY;
        
        // Second pass: add all patterns
        selectedPatterns.forEach(({idx, originalX, originalY}) => {
          
          // The boardPosition is the "base" offset.
          // Per connectToScreen logic: finalPos = boardPosition + originalPosition
          // We want: finalPos = originalPosition + shift
          // Therefore: boardPosition = shift
          const baseX = shiftX;
          const baseY = shiftY;

          const item = {
            boardAngle: 0,
            boardPosition: {x: baseX, y: baseY}, // Use the calculated base shift
            patternColor: colors[colorIdx],
            patternName: searchParams.currentName,
            patternId: PatternSelect.item?.pattern_id,
            paths: vecDoc._items[idx].rawVectors.map((v) => v.asString()),
            guid: guid(),
            firstLoad: true,
          } as TSurfaceDataPattern
          surfaceCollection.addPatternToDraftedSurface(item);
        });
        // --- END NEW LOGIC ---

        currentPatternSelection.shouldBeProcessed = true;
        const patternName = PatternSelect.item?.name || '';
        const displayName = patternName && searchParams.currentName 
          ? `${patternName} - ${searchParams.currentName}` 
          : patternName || searchParams.currentName;
        const itm = {...PatternSelect.item, guid: guid(), name: displayName};
        searchCut.push(itm as PatternFile);
        PatternSelect.pattern._items.forEach((item) => {
          console.log(item.carColor, item.carLegend, item.rawVectors[0].asString());
        });
        getUow<CutBoardPreview>("cutPreview").update();

        colorIdx++;
        colorIdx = colorIdx % colors.length;
      });

      // Get theme to set appropriate background
      const isDark = themeManager.isDarkMode();
      const bgColor = isDark ? '#2a2a2a' : '#ffffff';
      
      // Creates a new PIXI application
      const app = new PIXI.Application();
      await app.init({
        background: bgColor,
        antialias: true,
        autoDensity: true,
        canvas: boardCanvas
      });
      
      // Subscribe to theme changes to update background dynamically
      const unsubscribeTheme = themeManager.subscribe((theme: string) => {
        const newBgColor = theme === 'dark' ? '#2a2a2a' : '#ffffff';
        if (app.renderer && app.renderer.background) {
          // Convert hex string to number for PIXI
          const hexNumber = parseInt(newBgColor.replace('#', ''), 16);
          app.renderer.background.color = hexNumber;
        }
      });
      
      // Store unsubscribe function for cleanup
      this.addEventListener("unmount", () => {
        unsubscribeTheme?.();
      });

      (window as any).searchApp = app;
    
      app.resizeTo = boardCanvas.parentElement!;

      const mainCtn = new PIXI.Container();
      app.stage.addChild(mainCtn);

      this.selectionRect = new PIXI.Graphics();
      this.selectionRect.zIndex = 1000;
      app.stage.addChild(this.selectionRect);

      const vecDoc = PatternSelect.pattern.clone();
      const vecDisplay = vecDoc._items.map((item) => {
        item.mergeItems();
        const res = new VectorDisplay(item.merged);
        res._rawPattern = PatternSelect.item;
        return res;
      });

      GraphicDrawer.zoomFactor = 0.2;

      vecDisplay.forEach((vd) => {
        mainCtn.addChild(vd.getContainer());
        vd.getContainer().interactive = true;
        vd.rebuild();
        vd.render();
        vd.getContainer().onclick = (e) => {
          if (!this.isSelecting) {
            vd.isSelected = !vd.isSelected;
          }
        };
      });

      // Center the content
      const bounds = new PIXI.Rectangle();
      vecDisplay.forEach((vd) => {
        const containerBounds = vd.getContainer().getBounds();
        if (bounds.width === 0 && bounds.height === 0) {
          bounds.x = containerBounds.x;
          bounds.y = containerBounds.y;
          bounds.width = containerBounds.width;
          bounds.height = containerBounds.height;
        } else {
          bounds.x = Math.min(bounds.x, containerBounds.x);
          bounds.y = Math.min(bounds.y, containerBounds.y);
          bounds.width = Math.max(bounds.x + bounds.width, containerBounds.x + containerBounds.width) - bounds.x;
          bounds.height = Math.max(bounds.y + bounds.height, containerBounds.y + containerBounds.height) - bounds.y;
        }
      });
      const canvasWidth = boardCanvas.width;
      const canvasHeight = boardCanvas.height;
      const scaledBoundsWidth = bounds.width * GraphicDrawer.zoomFactor;
      const scaledBoundsHeight = bounds.height * GraphicDrawer.zoomFactor;
      mainCtn.x = (canvasWidth - scaledBoundsWidth)/5 - bounds.x * GraphicDrawer.zoomFactor;
      mainCtn.y = (canvasHeight - scaledBoundsHeight) /7 - bounds.y * GraphicDrawer.zoomFactor;

      let panStart = false;
      let prevX = 0;
      let prevY = 0;

      app.render();
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      app.stage.onpointerdown = (e) => {
        if (e.button === 2) {
          panStart = true;
          prevX = e.data.global.x;
          prevY = e.data.global.y;
        } else if (e.button === 0) {
          this.isSelecting = true;
          this.startX = e.data.global.x;
          this.startY = e.data.global.y;
          this.selectionRect.clear();
          this.selectionRect.beginFill(0x0000FF, 0.2);
          this.selectionRect.lineStyle(1, 0x0000FF);
        }
      };

      app.stage.onpointermove = (e) => {
        if (panStart) {
          if (prevX === 0 && prevY === 0) {
            prevX = e.data.global.x;
            prevY = e.data.global.y;
            return;
          }
          const newX = e.data.global.x;
          const newY = e.data.global.y;
          const deltaX = newX - prevX;
          const deltaY = newY - prevY;
          mainCtn.x += deltaX;
          mainCtn.y += deltaY;
          prevX = newX;
          prevY = newY;
        } else if (this.isSelecting) {
          const currentX = e.data.global.x;
          const currentY = e.data.global.y;
          const x = Math.min(this.startX, currentX);
          const y = Math.min(this.startY, currentY);
          const width = Math.abs(currentX - this.startX);
          const height = Math.abs(currentY - this.startY);
          this.selectionRect.clear();
          this.selectionRect.beginFill(0x0000FF, 0.2);
          this.selectionRect.lineStyle(1, 0x0000FF);
          this.selectionRect.drawRect(x, y, width, height);
          this.selectionRect.endFill();
        }
      };

      const finalizeSelection = () => {
        if (this.isSelecting) {
          const bounds = this.selectionRect.getBounds();
          vecDisplay.forEach((vd) => {
            const containerBounds = vd.getContainer().getBounds();
            const intersects =
              containerBounds.x < bounds.x + bounds.width &&
              containerBounds.x + containerBounds.width > bounds.x &&
              containerBounds.y < bounds.y + bounds.height &&
              containerBounds.y + containerBounds.height > bounds.y;
            if (intersects) {
              vd.isSelected = !vd.isSelected; // Toggle selection
            }
          });
          this.selectionRect.clear();
          this.isSelecting = false;
        }
      };

      app.stage.onpointerup = (e) => {
        if (e.button === 2) {
          panStart = false;
        } else if (e.button === 0) {
          finalizeSelection();
        }
      };

      app.stage.onpointerupoutside = (e) => {
        panStart = false;
        if (e.button === 0) {
          finalizeSelection();
        }
      };

      window.addEventListener("mouseup", (e) => {
        if (e.button !== 2) {
          panStart = false;
        }
        if (e.button === 0) {
          finalizeSelection();
        }
      });

      app.stage.on("wheel", (evt) => {
        if ((window as any).noAction === true) return;
        const isZoomIn = evt.deltaY > 0;
        _evtBus.emit(isZoomIn ? _evts.PatternSelection.zoomOut : _evts.PatternSelection.zoomIn);
      });
    });
  }
}


const _default: TRenderHandler = ($this:SelectPattern) => {
  return <>
   <div style={{
    backgroundColor: "",
    flex: "1",
    display: "flex",
    overflow: "hidden",
   }}>
      <canvas id="select-pattern-canvas" width="600" height="600"></canvas>
   </div>
  </>;
};