/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import * as PIXI from 'pixi.js';


import { _evtBus, _evts ,CancelEvent} from "../../../core/EventBus";
import { currentPatternSelection  } from "../../../uof/Globals";
import { boardManager } from "../../..//cutboard/BoardManager";
import { ppConfirm ,ppInfo } from "../popup/Popup";
import { BoardSurface } from "../../../cutboard/BoardSurface/BoardSurface";
import { MultiViewItem } from "../../../mvd/MultiViewItem";
import { INITIAL_ZOOM , config } from "../../../core/Constant";
import { Dropdown } from "../search/cmp/Dropdown";
import { waitForElt } from "../../../core/Dom";
import { liveConfig,convertMm } from "../../../core/LiveConfig";
import { Surface } from "../../../Graphics/Surface";
import { surfaceManager } from "../../../Graphics/SurfaceManager";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";
import '../../../utils/css/cutboard.css';
import { TIcon } from "../../../ui/controls/icons/TIcon";
import { segmentManager } from "../../../Pattern/SegmentManager";



export const localConfig: TLocalConfig = {
  boardIndex : 0,
  boardName  : "",
  carLegend  : new Map<number, string>(),
  zoomLevel  : INITIAL_ZOOM,
  mvs        : [],
  undoStack  : [],
  undoIdx    : 0,
  hasbeenCentered: false,
}

export type TLocalConfig = {
  boardIndex : number;
  boardName  : string;
  carLegend  : Map<number, string>;
  zoomLevel  : number;
  mvs        : MultiViewItem[];
  undoStack  : [MultiViewItem, ReturnType<typeof MultiViewItem.prototype.saveState>][];
  undoIdx    : number;
  hasbeenCentered: boolean;
}



export class CutBoard extends BaseComponent {
  mainCtn     : PIXI.Container | null = null;
  boardSprite : PIXI.Graphics  | null = null;
  x           : number = 0;
  y           : number = 0;
  wrapDistance: Dropdown = new Dropdown();
  boardSurface: BoardSurface | null = null;
  currentSurface: Surface | null = null;
  isHeaderClosed: boolean = false;
   zoomChangedEvent: CancelEvent | null = null;
    isPanMode: boolean = false;
  
  // Material usage properties
  materialArea: number = 0;
  materialCost: number = 0;
  materialEfficiency: number = 0;
  selectedRollName: string = "N/A";
  materialUpdateEvents: CancelEvent[] = [];
  




 

  constructor() {
    super("CutBoard");
    this.registerTemplate("default",_default);
this.registerDependencyProperties(["isHeaderClosed", "isPanMode", "materialArea", "materialCost", "materialEfficiency", "selectedRollName"]);

    this.addEventListener("mount",async  () => {
      
this.zoomChangedEvent = _evtBus.on("zoomChanged", () => {
        this.update();
      });
      
      if (liveConfig.unitOfMeasure === 3) {
        this.wrapDistance.items.forEach((item) => {
          item.label = item.label.replace("mm", "in");
          item.value = item.value * 0.0393701;
        });
      }

   

      this.wrapDistance.itemLabel = "label";
      this.wrapDistance.selectedItem = this.wrapDistance.items[0];
      this.wrapDistance.text = `Wrap Distance (${liveConfig.unitOfMeasure === 3 ? "in" : "mm"})`;
      this.wrapDistance.forceWidth = "230px";

      liveConfig.wrapDistance = liveConfig.wrapDistance;

      // Set up event listeners for material usage updates
      this.materialUpdateEvents.push(
        _evtBus.on("patternMoved", () => {
          setTimeout(() => this.calculateMaterialUsage(), 50);
        })
      );
      
      this.materialUpdateEvents.push(
        _evtBus.on("nestingComplete", () => {
          setTimeout(() => this.calculateMaterialUsage(), 100);
        })
      );
      
      this.materialUpdateEvents.push(
        _evtBus.on("rollSelected", () => {
          this.calculateMaterialUsage();
          this.update();
        })
      );
      
      // Listen for board width changes from roll selection popup
      this.materialUpdateEvents.push(
        _evtBus.on("boardWidthChanged", () => {
          this.calculateMaterialUsage();
          this.update();
        })
      );
      
      // Sync when board data changes
      this.materialUpdateEvents.push(
        _evtBus.on("surfaceLoaded", () => {
          this.update();
        })
      );
      
      this.materialUpdateEvents.push(
        _evtBus.on("patternAdded", () => {
          setTimeout(() => this.calculateMaterialUsage(), 50);
        })
      );
      
      this.materialUpdateEvents.push(
        _evtBus.on("patternDeleted", () => {
          setTimeout(() => this.calculateMaterialUsage(), 50);
        })
      );
       
      this.update();
     
      surfaceManager.connectToScreen();
      
      // Initial material usage calculation
      setTimeout(() => this.calculateMaterialUsage(), 500);
 

  

      console.log("CutBoard mounted !");

     
      return;
    });

    this.addEventListener("unmount", async () => {
       if (this.zoomChangedEvent) {
        this.zoomChangedEvent.off();
      }
     
     // Clean up material usage event listeners
     this.materialUpdateEvents.forEach(event => event.off());
     this.materialUpdateEvents = [];
     if (segmentManager.isActive()) {
      segmentManager.deactivate();
          return;
     }
     surfaceManager.updateSelectedSurfaceData();
   
    
     
      console.log("CutBoard unmounted !");
      
      const parent = (await waitForElt<HTMLCanvasElement>("#cut-board-canvas")).parentElement;
      this.boardSurface?.unload(parent!)
    });
  }
  
  /**
   * Get the current board width for display
   */
  getCurrentBoardWidth(): number {
    if (surfaceManager.currentSurface) {
      return surfaceManager.currentSurface._Board._boardWidth || config.boardWidth;
    }
    return config.boardWidth;
  }

  calculateMaterialUsage() {
    try {
      const surface = surfaceManager.currentSurface;
      if (!surface || !surface._Patterns || surface._Patterns.length === 0) {
        this.materialArea = 0;
        this.materialCost = 0;
        this.materialEfficiency = 0;
        this.selectedRollName = "N/A";
        return;
      }

      // Get dynamic board dimensions from current surface
      const currentBoardWidth = surface._Board._boardWidth || config.boardWidth;
      const currentBoardLength = surface._Board._boardLength || config.boardLenght;

      // Calculate the bounding box of all patterns (matching CutBoard.ts logic)
      const allBbox: Array<{x: number, y: number, width: number, height: number}> = [];
      
      surface._Patterns.forEach(item => {
        // Get the bounding box from polygon hit points
        const hull = item._polyHit["points"];
        if (!hull || hull.length === 0) return;
        
        const minX = Math.min(...hull.map(p => p.x));
        const minY = Math.min(...hull.map(p => p.y));
        const maxX = Math.max(...hull.map(p => p.x));
        const maxY = Math.max(...hull.map(p => p.y));

        const bBox = {
          x: minX + item.zCtx,
          y: minY + item.zCty,
          width: maxX - minX,
          height: maxY - minY
        };

        // Check if the item's bounding box intersects with the board
        const intersects = 
          bBox.x < currentBoardLength &&
          bBox.x + bBox.width > 0 &&
          bBox.y < currentBoardWidth &&
          bBox.y + bBox.height > 0;

        if (intersects) {
          allBbox.push(bBox);
        }
      });

      if (allBbox.length === 0) {
        this.materialArea = 0;
        this.materialCost = 0;
        this.materialEfficiency = 0;
        this.selectedRollName = "N/A";
        return;
      }

      // Determine if board is horizontal (width < length) or vertical (width >= length)
      const isBoardHorizontal = currentBoardWidth < currentBoardLength;
      
      let area = 0;
      let boardArea = (currentBoardLength * currentBoardWidth) / 1000000; // Total board area in m²

      if (isBoardHorizontal) {
        // For horizontal board, find maxX (furthest right extent)
        const maxX = Math.max(...allBbox.map(_ => _.x + _.width));
        area = (maxX * currentBoardWidth) / 1000000; // Area in m²
        
        // Convert to square feet if imperial units
        if (liveConfig.unitOfMeasure === 3) {
          const lengthInches = maxX / 25.4;
          const widthInches = currentBoardWidth / 25.4;
          area = (widthInches * lengthInches) / 144; // Convert to sqft
        }
      } else {
        // For vertical board, find maxY (furthest down extent)
        const maxY = Math.max(...allBbox.map(_ => _.y + _.height));
        area = (currentBoardLength * maxY) / 1000000; // Area in m²
        
        // Convert to square feet if imperial units
        if (liveConfig.unitOfMeasure === 3) {
          const lengthInches = currentBoardLength / 25.4;
          const widthInches = maxY / 25.4;
          area = (widthInches * lengthInches) / 144; // Convert to sqft
        }
      }

      // Convert board area to sqft if imperial
      if (liveConfig.unitOfMeasure === 3) {
        const boardLengthInches = currentBoardLength / 25.4;
        const boardWidthInches = currentBoardWidth / 25.4;
        boardArea = (boardLengthInches * boardWidthInches) / 144;
      }

      this.materialArea = area;
      
      // Calculate usage percentage (efficiency)
      this.materialEfficiency = boardArea > 0 ? (area / boardArea) * 100 : 0;

      // Get roll data and calculate cost
      const userRollData = (window as any).userRollData;
      const userCurrency = (window as any).userCurrency;
      const selectedRollIndex = (window as any).selectedRollIndex ?? -1;
      
      // Check if default settings is selected (-1) or a specific roll is selected
      if (selectedRollIndex === -1) {
        // Default settings selected - show N/A for roll
        this.selectedRollName = "N/A";
        this.materialCost = 0;
      } else if (userRollData && userRollData.length > 0 && userRollData[selectedRollIndex]) {
        const roll = userRollData[selectedRollIndex];
        this.selectedRollName = roll.name || `Roll ${selectedRollIndex + 1}`;
        
        // Price is per m² - area calculation handles unit conversion
        const pricePerAreaUnit = roll.purchase_price;
        this.materialCost = area * pricePerAreaUnit;
      } else {
        this.selectedRollName = "No Roll Selected";
        this.materialCost = 0;
      }
      
      this.update();
    } catch (e) {
      console.error("Error calculating material usage:", e);
    }
  }

  async reloadBoard() {return;
    const boardCanvas = (await waitForElt<HTMLCanvasElement>("#cut-board-canvas"));
    boardCanvas.className = "cut-board-canvas";
    this.currentSurface = new Surface({
      canvas: boardCanvas,
      resizeTo: boardCanvas.parentElement!,
    });
    this.currentSurface!.zoomFactor = 1;
    this.currentSurface!.addPath("M -2.47 35.08 C -2.47 35.08 -98.58 34.67 -119.35 35.89 C -137.66 36.96 -157 47.31 -161.32 441.75 C");
    this.currentSurface!._Board._boardWidth = 1600;
    this.currentSurface!._Board._boardLength = 5000;
    this.currentSurface!.display();

    const localConfig = boardManager.selectedBoard?.newBoard ?? {
      boardIndex : 0,
      boardName  : "",
      carLegend  : new Map<number, string>(),
      zoomLevel  : INITIAL_ZOOM,
      mvs        : [] as MultiViewItem[]
    }

    if (boardManager.boards.length === 0 && localConfig.mvs.length === 0 && currentPatternSelection.selections.length === 0) return;

    if (localConfig.mvs.length === 0){
      console.log("currentPatternSelection", localConfig.mvs.length);
      currentPatternSelection.selections.forEach((item, idx) => {
        console.log("XXX add item", item);
        const paths = item.rawVectors.map((rv) => rv.asString());
        const mm = new MultiViewItem({paths});
        mm._rawPattern = item.rawPattern;
        localConfig.mvs.push(mm);
        mm._carColor = item.carColor;
        this.currentSurface?.addPath(mm.mainPath);
        mm.zoomLevel = INITIAL_ZOOM;
      });

      currentPatternSelection.selections.forEach((item, idx) => {
        item.carColor = item.carColor ?? 0x40E0D0;
        if (!localConfig.carLegend.has(item.carColor)) {
          localConfig.carLegend.set(item.carColor, item.carLegend);
        }
      });

      currentPatternSelection.images.length         = 0;
      currentPatternSelection.selections.length     = 0;
      currentPatternSelection.selectionsDisp.length = 0;
      currentPatternSelection.shouldBeProcessed     = false;
      this.currentSurface!.display();
    } else {
      this.currentSurface!.zoomFactor = localConfig.zoomLevel;
      localConfig.mvs = localConfig.mvs.filter((mm) => mm._type === "ITEM");
      localConfig.mvs.forEach((mm: MultiViewItem, idx) => {
        console.log("XXX add item 2", mm);
        this.currentSurface?.addPath(mm.workingPaths[0]);
      });
      this.currentSurface!.display();
    }
  }

  async OLD_reloadBoard() {
    try {
      const parent = (await waitForElt<HTMLCanvasElement>("#cut-board-canvas")).parentElement;
      this.boardSurface?.unload(parent!);
    } catch (ex) {/* Silent fail */ console.log("Unload failed")}

    const localConfig = boardManager.selectedBoard?.newBoard ?? {
      boardIndex : 0,
      boardName  : "",
      carLegend  : new Map<number, string>(),
      zoomLevel  : INITIAL_ZOOM,
      mvs        : [] as MultiViewItem[]
    }

    if (boardManager.boards.length === 0 && localConfig.mvs.length === 0 && currentPatternSelection.selections.length === 0) return;

    let board = new BoardSurface();
    console.log("Board surface should unload", this.boardSurface?._unloaded);
    this.boardSurface = board;

    (window as any).board = (window as any).board || [];
    (window as any).board.push(board)
    await board.createBoard();
    board._spMainCtn.visible = false;
    board.reload();
    board.debugUI(true);

    if (localConfig.mvs.length === 0){
      console.log("currentPatternSelection", localConfig.mvs.length);
      currentPatternSelection.selections.forEach((item, idx) => {
        console.log("item", item);
        const paths = item.rawVectors.map((rv) => rv.asString());
        const mm = new MultiViewItem({paths});
        mm._rawPattern = item.rawPattern;
        localConfig.mvs.push(mm);
        mm._carColor = item.carColor;
        board.addItem(mm);
        mm.zoomLevel = INITIAL_ZOOM;
        mm.reloadUI(mm._boardSurface._spMainCtn);
        mm.x = 0;
        mm.y = 0;
      });

      currentPatternSelection.selections.forEach((item, idx) => {
        item.carColor = item.carColor ?? 0x40E0D0;
        if (!localConfig.carLegend.has(item.carColor)) {
          localConfig.carLegend.set(item.carColor, item.carLegend);
        }
      });

      currentPatternSelection.images.length         = 0;
      currentPatternSelection.selections.length     = 0;
      currentPatternSelection.selectionsDisp.length = 0;
      currentPatternSelection.shouldBeProcessed     = false;
    } else {
      board.zoomLevel = localConfig.zoomLevel;
      localConfig.mvs = localConfig.mvs.filter((mm) => mm._type === "ITEM");
      localConfig.mvs.forEach((mm, idx) => {
        mm.disposed = true;
        mm.zoomLevel = localConfig.zoomLevel;
        board.addItem(mm);
        mm.reloadUI(mm._boardSurface._spMainCtn);
        mm.x = mm.x;
        mm.y = mm.y
      });
      board.reload();
      board.drawBoard();
      board.debugUI(true);
    }

    board.legends = localConfig.carLegend;
    board.drawLegends();
    setTimeout(() => {
      this.boardSurface!._spMainCtn.visible = true;
      if (boardManager.selectedBoard?.newBoard.hasbeenCentered) {
        this.boardSurface!._spMainCtn.x = boardManager.selectedBoard.mainCtnPos.x;
        this.boardSurface!._spMainCtn.y = boardManager.selectedBoard.mainCtnPos.y;
        return;
      }
      boardManager.selectedBoard.mainCtnPos = this.boardSurface?.centerBoard()!;
      boardManager.selectedBoard.newBoard.hasbeenCentered = true;
    }, 16);
  }



  
}

const _default: TRenderHandler = ($this:CutBoard) => {
  setTimeout(() => {
    const header = document.querySelector<HTMLDivElement>(".cut-board-header");
    if (header) {
      if ($this.isHeaderClosed) {
        header.classList.add("collapsed");
      } else {
        header.classList.remove("collapsed");
      }
      window.dispatchEvent(new Event('resize'));
    }
  }, 1);

  return <>
    <div className="cut-board">
    
 
       <div className="feed-info-container">
  <div className="feed-icon" />
  </div>
  <div className="material-info-container">
    <div className="material-usage-display">
      <div className="material-usage-item">
        <span className="material-label">Width:</span>
        <span className="material-value">
          {liveConfig.unitOfMeasure === 3 
            ? ($this.getCurrentBoardWidth() / 25.4).toFixed(2) 
            : $this.getCurrentBoardWidth()}
        </span>
      </div>
      <div className="material-usage-item">
        <span className="material-label">Length:</span>
        <span className="material-value">{liveConfig.unitOfMeasure === 3 ? (config.boardLenght / 25.4).toFixed(2) : config.boardLenght}</span>
      </div>
      <div className="material-usage-item">
        <span className="material-label">Unit:</span>
        <span className="material-value">{liveConfig.unitOfMeasure === 3 ? 'in' : 'mm'}</span>
      </div>
      <div className="material-usage-item">
        <span className="material-label">Roll:</span>
        <span className="material-value">{$this.selectedRollName || "N/A"}</span>
      </div>
      <div className="material-usage-item">
        <span className="material-label">Usage:</span>
        <span className="material-value">
          {($this.materialArea || 0).toFixed(2)} {liveConfig.unitOfMeasure === 3 ? 'sqft' : 'm²'}
        </span>
      </div>
      <div className="material-usage-item">
        <span className="material-label">Cost:</span>
        <span className="material-value">
          {(() => {
            const userCurrency = (window as any).userCurrency || 1;
            const currencySymbol = userCurrency === 1 ? "$" : userCurrency === 2 ? "€" : "£";
            return `${currencySymbol}${($this.materialCost || 0).toFixed(2)}`;
          })()}
        </span>
      </div>
      <div className="material-usage-item">
        <span className="material-label">Efficiency:</span>
        <span className="material-value">{($this.materialEfficiency || 0).toFixed(1)}%</span>
      </div>
    </div>
  </div>
    

 <div className="tb-pan-container">
    <div className="tb-select">
    {tbItem("tb-select", "", () => {
        $this.isPanMode = false;
        surfaceManager.setPanMode(false);
    }, !$this.isPanMode)}
</div>
  <div className="tb-pan">
    {tbItem("tb-pan", "", () => {
        $this.isPanMode = true;
        surfaceManager.setPanMode(true);
    }, $this.isPanMode)}

    </div>
  </div>

      <div className="center-board-container">
<div className="center-board-button"
        onClick={() => surfaceManager.centerBoard()}
    >
        <div className="center-board-icon"></div>
        <span>Center Board</span>
    </div>
    </div>


    <div className="zoom-container">
    <div className="zoom-display" >
    <span>Zoom: {surfaceManager.currentSurface ? `${(surfaceManager.currentSurface.zoomFactor * 100).toFixed(0)}%` : '100%'}</span>
</div>
</div>



      <div className="cut-board-workspace">
        <canvas id="cut-board-canvas"></canvas>
      </div>






      <div className="board-tabs">
        {boardManager.boards.map((_,idx) => <div className={`board-tab ${boardManager.currentBoardIndex === idx ? 'active' : 'inactive'}`}>
          <span onClick={async () => {
         // --- START OF CHANGES ---

  // If a board is already switching, do nothing.
  if (surfaceManager.isSwitchingBoards) {

    return;
  }

  if (segmentManager.isActive()) {
    ppInfo("Saving your changes","saving your changes ...");
    segmentManager.deactivate();
        return;
   }
  // Set the lock
  surfaceManager.isSwitchingBoards = true;

  // --- END OF CHANGES ---

         surfaceManager.updateSelectedSurfaceData();
   
 
          surfaceCollection.selectedSurfaceDataIndex = idx;
          boardManager.currentBoardIndex = idx;

          $this.update();
          surfaceManager.currentSurface!._app.canvas.remove();
        
          // Await the async connectToScreen to ensure it completes
          await surfaceManager.connectToScreen();
     
          $this.update();
          }}>{_.newBoard.boardName ?? _.boardName}</span>
          <div

          //////////////////////////////////////
          onClick={async () => {
  if (surfaceManager.isSwitchingBoards) return;
  
  if (segmentManager.isActive()) {
    ppInfo("Saving your changes","saving your changes ...");
    segmentManager.deactivate();
        return;
   }
  const confirmDeletion = await ppConfirm("Delete Board", "Are you sure you want to delete this board?");
  if (confirmDeletion !== "ok") return;

  surfaceManager.isSwitchingBoards = true;

  try {
    // Save data of the current surface before doing anything
  surfaceManager.updateSelectedSurfaceData();
  


    const removedBoardIndex = idx;
    const currentActiveIndex = boardManager.currentBoardIndex;

    // Dispose the current canvas view
    if (surfaceManager.currentSurface) {
      surfaceManager.currentSurface.dispose();
      surfaceManager.currentSurface = null;
    }

    // Remove the board data from the data models
    boardManager.boards.splice(removedBoardIndex, 1);
    surfaceCollection.removeSurfaceData(removedBoardIndex);

    let newActiveIndex;

    if (boardManager.boards.length === 0) {
      // If no boards are left, set index to -1
      newActiveIndex = -1;
    } else if (removedBoardIndex < currentActiveIndex) {
      // If a tab before the active one is removed, the active index shifts left
      newActiveIndex = currentActiveIndex - 1;
    } else if (removedBoardIndex > currentActiveIndex) {
      // If a tab after the active one is removed, the active index is unchanged
      newActiveIndex = currentActiveIndex;
    } else {
      // If the active tab itself is removed, the new active tab should be the one
      // that takes its place, or the one before it if it was the last one.
      newActiveIndex = Math.min(removedBoardIndex, boardManager.boards.length - 1);
    }

    boardManager.currentBoardIndex = newActiveIndex;
    surfaceCollection.selectedSurfaceDataIndex = newActiveIndex;

    // Re-render the UI to reflect the tab removal
    $this.update();

    // If there are boards left, connect the new active one to the screen
    if (newActiveIndex !== -1) {
      await surfaceManager.connectToScreen();
    } else {
      // If no boards are left, just release the lock
      surfaceManager.isSwitchingBoards = false;
    }
  } catch (e) {
    console.error("Failed to delete board:", e);
    surfaceManager.isSwitchingBoards = false; // Ensure lock is released on error
  }
}}
           
            className="board-tab-close" />
            
        </div>)}
         <div
          className="board-tab board-tab-add"
          role="button"
          aria-label="Create new board"
       onClick={async () => {
    if (boardManager.boards.length >= 5) {
        ppInfo("Board Limit Reached", "You can only have a maximum of 5 boards open.");
        return;
    }

    if (surfaceManager.isSwitchingBoards) return;
    
    if (segmentManager.isActive()) {
      ppInfo("Saving your changes","saving your changes ...");
      segmentManager.deactivate();
          return;
     }
    surfaceManager.isSwitchingBoards = true;

    // FIX: Only try to update and dispose a surface if one actually exists
    if (boardManager.boards.length > 0) {
        // Save the state of the current board before switching
  surfaceManager.updateSelectedSurfaceData();
   
          

        // Dispose of the current PIXI application and canvas
        if (surfaceManager.currentSurface) {
            surfaceManager.currentSurface.dispose();
            surfaceManager.currentSurface = null;
        }
    }

    // Create the board's logical shell
    boardManager.createBoard();

    // Create a new, empty SurfaceData object and add it to the collection
    const newSurfaceData = surfaceCollection.createSurfaceData(config.boardWidth, config.boardLenght);

    // Set the name for the new board
    const newIndex = surfaceCollection.collection.length - 1;
    const newBoardName = `Untitled Board ${surfaceCollection.collection.length}`;
    newSurfaceData.surfaceName = newBoardName;
    boardManager.boards[newIndex].newBoard.boardName = newBoardName;

    // Set the new board as the active one
    boardManager.currentBoardIndex = newIndex;
    surfaceCollection.selectedSurfaceDataIndex = newIndex;

    // Re-render the UI to show the new tab
    $this.update();

    // Connect the new empty surface to the canvas - await to ensure completion
    await surfaceManager.connectToScreen();
}}
        >
          <span>+</span>
        </div>
      </div>
    </div>
  </>;
}

const tbItem = (icon: TIcon, text: string, handler?: () => void, isActive?: boolean) => {
    const buttonClass = `top-bar-button ${isActive ? 'active' : ''}`;
  return <div class={buttonClass} onClick={handler}>
    <div class="top-bar-icon" style={{ backgroundImage: `url(assets/svg/${icon}.svg)` }} />
  
  </div>
}