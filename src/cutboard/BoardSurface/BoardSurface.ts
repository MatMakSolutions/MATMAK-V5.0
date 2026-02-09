import * as PIXI from 'pixi.js';
import { _evtBus, _boardEvts, nestingEvents, CancelEvent } from "../../core/EventBus";
import { MultiViewItem } from "../../mvd/MultiViewItem";
import { guid } from "../../core/Guid";
import { waitForElt } from "../../core/Dom";
import { isPointInPolygonWithScaling } from "../../mvd/WebGL/CrossingPolygon";
import * as Paper from 'paper';
import { f } from "@ekkojs/web-controls";
import { config, INITIAL_ZOOM, MAX_ZOOM, MIN_ZOOM, ROTATION_ANGLE_STEP, TConfig, ZOOM_STEP } from "../../core/Constant";
import { createPolygonFromSVGPaths } from "../PrepareCut";
import { boardManager } from "../BoardManager";
import { createExternalOutwardPolygon } from "../../outward/_Outward";
import { ppInfo, ppWait } from "../../ui/controls/popup/Popup";
import { convertMm, liveConfig } from "../../core/LiveConfig";
import { currentPatternSelection, sFetch } from "../../uof/Globals";
import { calculateProjection, PathManipulator } from "../../mvd/LowLevel/PathManipulator";
import { Path } from "paper/dist/paper-core";
import { LineCommand } from "../../mvd/LowLevel/LineCommand";
import { CurveCommand } from "../../mvd/LowLevel/CurveCommand";
import { VectorDocument } from "../../mvd/VectorDocument";
import { ZoomOutAction } from "./Events/Zoom/ZoomOut";
import { ZoomInAction } from "./Events/Zoom/ZoomIn";
import { RotateAction } from "./Events/Rotation";
import { EnterEditAction } from "./Events/EditMode/EnterEdit";
import { EnterSubPatternRemoveAction } from "./Events/NestedPattern/EnterSubPatternRemove";
import { EnterSplitEditAction } from "./Events/SplitMode/EnterSplitEdit";
import { EnterWrapEditAction } from "./Events/WrapMode/EnterWrapEdit";
import { MouseUpAction } from "./Events/Mouse/MouseUp";
import { MouseWheelAction } from "./Events/Mouse/MouseWheel";
import { MouseDownAction } from "./Events/Mouse/MouseDown";
import { MouseMoveAction } from "./Events/Mouse/MouseMove";
import { ResizeAction } from "./Events/Resize/Resize";
let paper = (Paper as any).default as typeof Paper;

const CANVAS = "#cut-board-canvas";
declare var sendCutToIp: (ip: string, port: string, hpgl: string) => Promise<{ success: boolean, message?: string, error?: string }>;
declare var sendCutToSuma: (hpgl: string) => void;
declare var getConfig: () => Promise<TConfig>;


type BoardLimit = {
  width: number;
  height: number;
};

type GlobalLiveData = {
  boardWidth: number;
  boardHeight: number;
  boardMousePos: {
    x: number;
    y: number;
  }
  screenMousePos: {
    x: number;
    y: number;
  }
}



export const globalLiveData = {
  boardWidth: 0,
  boardHeight: 0,
  boardMousePos: {
    x: 0,
    y: 0
  },
  screenMousePos: {
    x: 0,
    y: 0
  }
} as GlobalLiveData;

export class BoardSurface {
  displayMaterialUsage: boolean = false;

  get hasItemSelected() {
    return this.items.filter(_ => _.isSelected).length > 0;
  }

  hasBeenCentered: boolean = false;
  hasPendingCut: boolean = false;
  globalCollisionMap: Map<string, {done: boolean, collide: boolean}> = new Map();
  isGlobalCollisionRunning: boolean = false;
  legends: Map<number, string> = new Map();
  divide1: paper.PointLike;
  divide2: paper.PointLike;
  guid: string = "";
  canvas    !: HTMLCanvasElement;
  zoomLevel: number = 0.2;
  items: MultiViewItem[] = [];
  boardLimit: BoardLimit = { width: 5000, height: 1600 };
  _lastNearestPoint: { x: number, y: number } = { x: 0, y: 0 };
  
  // Dynamic board dimensions - use these instead of config.boardWidth/config.boardLenght
  _boardWidth: number = config.boardWidth;
  _boardLength: number = config.boardLenght;

  _app       !: PIXI.Application;
  _appDebug  !: PIXI.Container;
  _spMainCtn !: PIXI.Container;
  _spBoard   !: PIXI.Graphics;

  _isDragStarted: boolean = false;
  _isDragged: boolean = false;
  _dragStartPosition: { x: number, y: number } = { x: 0, y: 0 }; 
  _dragBoardStartPosition: { x: number, y: number } = { x: 0, y: 0 };
  _isCtrlPressed: boolean = false;
  _unloaded: boolean = false;

  constructor() {
    this.guid = guid();
    this.zoomLevel = INITIAL_ZOOM;
  }

  setDisplayMaterialUsage(state: boolean) {
    this.displayMaterialUsage = state;
    this.drawBoard();
  }

  debugEvents = [] as CancelEvent[];
  moveRotateTimerIdx = 0;

  debugUI(state: boolean = true) {
    this._appDebug?.destroy({ children: true, texture: true, textureSource: true });
    if (!state) return;

    this.debugEvents.forEach(e => e.off());
    this.debugEvents.length = 0;

    this._appDebug = new PIXI.Container();
    this._app.stage.addChild(this._appDebug);

    // Display the Screen Size
    let x = 10;
    let y = 10;
    let placement = [] as PackResult[];

    const windowBB = this.canvas.parentElement.getBoundingClientRect();
    //const screenSize = new PIXI.Text(`Screen Size: ${windowBB.width} x ${windowBB.height}`, { fontSize: 12, fill: 0x000000 });
    const boardMeasureLength = convertMm(this._boardLength, 'inches');
    const boardMeasureWidth = convertMm(this._boardWidth, 'inches');
    const screenSize = new PIXI.Text(`Board Size: ${boardMeasureLength[0]} ${boardMeasureLength[1] === "Metric" ? "mm" : "in"} x ${boardMeasureWidth[0]} ${boardMeasureLength[1] === "Metric" ? "mm" : "in"}`, { fontSize: 15, fill: 0x000000 });
    //const screenSize = new PIXI.Text(`Board Size: ${this._boardWidth}mm x ${this._boardLength}mm`, { fontSize: 15, fill: 0x000000 });
    screenSize.position.set(x, y);
    this._appDebug.addChild(screenSize);
    y += 20;

    const mousePos = new PIXI.Text(`Mouse Position: 0, 0`, { fontSize: 12, fill: 0x000000 });
    mousePos.position.set(x, y);
    //this._appDebug.addChild(mousePos);
    y += 20;

    const mouseSpMainPos = new PIXI.Text(`Mouse Position (Main): 0, 0`, { fontSize: 12, fill: 0x000000 });
    mouseSpMainPos.position.set(x, y);
    //this._appDebug.addChild(mouseSpMainPos);
    y += 20;

    let packItems = {} as { [key: number]: MultiViewItem }

    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onUndo, () => {
      if (this._unloaded) return;
      // check if any iten is in edit mode, if so just exit
      if (this.items.filter(_ => _._isEditMode).length > 0) return;
      boardManager.selectedBoard.newBoard.undoIdx = Math.max(0, boardManager.selectedBoard.newBoard.undoIdx - 1);
      const frame = boardManager.selectedBoard.newBoard.undoStack[boardManager.selectedBoard.newBoard.undoIdx];
      frame[0].restoreState(frame[1]);
    }));

    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onRedo, () => {

      if (this._unloaded) return;
            // check if any iten is in edit mode, if so just exit
            if (this.items.filter(_ => _._isEditMode).length > 0) return;
      boardManager.selectedBoard.newBoard.undoIdx = Math.min(boardManager.selectedBoard.newBoard.undoStack.length - 1, boardManager.selectedBoard.newBoard.undoIdx + 1);
      const frame = boardManager.selectedBoard.newBoard.undoStack[boardManager.selectedBoard.newBoard.undoIdx];
      frame[0].restoreState(frame[1]);
    }));

    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onReloadConfig, () => {
      this.drawBoard();
    }));

    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onToggleMaterialusage, () => {
      if (this._unloaded) return;
      this.setDisplayMaterialUsage(!this.displayMaterialUsage);
    }));

    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onResize, () => {
      if (this._unloaded) return;
      screenSize.text = `Screen Size: ${globalLiveData.boardWidth} x ${globalLiveData.boardHeight}`;
    }));

    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onRotate, (isNegative: boolean = false) => {
      clearTimeout(this.moveRotateTimerIdx);
      this.moveRotateTimerIdx = setTimeout(() => {
        this.debugUI(true);
      }, 16) as any;
    }));

    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onMove, (isNegative: boolean = false) => {
      clearTimeout(this.moveRotateTimerIdx);
      this.moveRotateTimerIdx = setTimeout(() => {
        if (this.displayMaterialUsage) {
          _evtBus.emit(_boardEvts.BoardSurface.onToggleMaterialusage, null);
          _evtBus.emit(_boardEvts.BoardSurface.onToggleMaterialusage, null);
        }
      }, 16) as any;
    }));


    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onNesting, (e: WheelEvent) => {
      if (this._unloaded) return;
      const evtHandler = [] as CancelEvent[];
      nestingEvents.sessionCreation.do();
      nestingEvents.setBin.do({ width: this._boardLength, height: this._boardWidth });
      packItems = {} as { [key: number]: MultiViewItem }
      this.items.filter(_ => _._type === "ITEM").forEach((item, idx) => {
        nestingEvents.addPart.do({ idx, item });
        packItems[idx] = item;
      });
      nestingEvents.start.do();
      evtHandler.push(nestingEvents.progress.waitFor((e) => {
        _evtBus.emit(_boardEvts.BoardSurface.onNestingProgress, [(e.progress * 100) >> 0, e.generation]);
      }));
      evtHandler.push(nestingEvents.packingResult.waitFor((e) => {
        placement.push(e);
        e.placements.forEach((item) => {
          packItems[item.part].rawX = item.position.x;
          packItems[item.part].rawY = item.position.y;
          packItems[item.part].angle = item.rotation * 180 / Math.PI;
        });
        e.unplaced.forEach((item) => {
          packItems[item.id].rawX = 0;
          packItems[item.id].rawY = 0;
          packItems[item.id].angle = 0;
        });
        if (e.isLast) {
          // Order the items with maximum placed items first
          placement.sort((a, b) => b.placed.length - a.placed.length);
          // keep all that have the same number of placed as the first one
          const maxPlaced = placement[0].placed.length;
          placement = placement.filter(_ => _.placed.length === maxPlaced);
          // Order the items with minimum width occupation first by taking teh max x of the placed items in their points array
          placement.sort((a, b) => {
            const aMax = Math.max(...a.placed.map(_ => Math.max(..._.points.map(_ => _.x))));
            const bMax = Math.max(...b.placed.map(_ => Math.max(..._.points.map(_ => _.x))));
            return aMax - bMax;
          });
          const e = placement[0];
          e.placements.forEach((item) => {
            packItems[item.part].rawX = item.position.x;
            packItems[item.part].rawY = item.position.y;
            packItems[item.part].angle = item.rotation * 180 / Math.PI;
          });
          e.unplaced.forEach((item) => {
            packItems[item.id].rawX = 0;
            packItems[item.id].rawY = 0;
            packItems[item.id].angle = 0;
          });


          evtHandler.forEach(e => e.off());
          _evtBus.emit(_boardEvts.BoardSurface.onNestingResult, e);
          _evtBus.emit(_boardEvts.BoardSurface.onNestingComplete);
        }
        /*this.items.forEach((itm: any) => {
          _evtBus.emit(_boardEvts.Item.onCheckCollisions, itm);
        });*/
      }));
    }));

    this.debugEvents.push(_evtBus.on(_boardEvts.Item.onCheckCollisions, (item: MultiViewItem) => {
      if (this._unloaded) return;

      // Trigger a global collision detection
      if (!item) {
        const validItems = this.items.filter(_ => _._type === "ITEM");
        if (validItems.length < 2) {
          _evtBus.emit(_boardEvts.BoardSurface.onGlobalCollisionComplete, false);
          return;
        }

        this.globalCollisionMap = new Map();
        this.isGlobalCollisionRunning = true;

        this.items.forEach((itm: MultiViewItem) => {
          if (itm._type === "ITEM") {
            this.globalCollisionMap.set(itm.guid, { done: false, collide: false });
          }
        });
        this.items.forEach((itm: any) => {
          if (itm._type === "ITEM") {
            _evtBus.emit(_boardEvts.Item.onCheckCollisions, itm);
          }
        });
        return;
      }

      let hasCollision = false;
      /*this.items.filter(_ => _._type === "ITEM").filter(_ => _._editPointIndexPosition === -1).forEach(target => {
        target._collideList.clear();
      });*/

      this.items.filter(_ => _._type === "ITEM").filter(_ => _._editPointIndexPosition === -1).forEach(target => {
        if (item.guid === target.guid) return;
        const c1 = item.mainPathPaper.clone();
        c1.translate({ x: item.rawX, y: item.rawY });
        const c2 = target.mainPathPaper.clone();
        c2.translate({ x: target.rawX, y: target.rawY });

        // check colision with the border
        const bbox = c1.bounds;
        // check if the item is outside the board
        if (bbox.x + bbox.width > this._boardLength || bbox.y + bbox.height > this._boardWidth) {
          item.addCollideItem(item);
          hasCollision = true;
          return;
        }

        // check if the item is outside the  on the left or top
        if (bbox.x < 0 || bbox.y < 0) {
          item.addCollideItem(item);
          hasCollision = true;
          return;
        }

        if (!hasCollision) {
          item.removeCollideItem(item);
        }


        if (c1.intersects(c2)) {
          item.addCollideItem(target);
          target.addCollideItem(item);
          hasCollision = true;
        } else {
          item.removeCollideItem(target);
          target.removeCollideItem(item);
        }
      });

      if (this.isGlobalCollisionRunning) {
        if (hasCollision) {
          this.globalCollisionMap.set(item.guid, { done: true, collide: true });
        } else {
          this.globalCollisionMap.set(item.guid, { done: true, collide: false });
        }

        // check if All items have been processed
        if (Array.from(this.globalCollisionMap.values()).filter(_ => _.done).length === this.globalCollisionMap.size) {
          this.isGlobalCollisionRunning = false;
          // check if at least on was in collision
          let hasGlobalCollision = Array.from(this.globalCollisionMap.values()).filter(_ => _.collide).length > 0;
          const entries = this.globalCollisionMap.entries();
          this.items.forEach(item => {
            const whoAmI = Array.from(entries).filter(_ => _[0] === item.guid)[0];
            if (whoAmI) {
              if (whoAmI[1].collide === true) {
                item._isCollided = true;
                item.reloadUI(this._spMainCtn);
              }
            }
          });
          _evtBus.emit(_boardEvts.BoardSurface.onGlobalCollisionComplete, hasGlobalCollision);
        }

        this.globalCollisionMap.forEach((v, k) => {
          if (v.collide) {
            this.items.filter(_ => _.guid === k)[0].reloadUI(this._spMainCtn);
          }
        });

      }
    }));

    let cpt = 0;
    this.debugEvents.push(_evtBus.on(_boardEvts.BoardSurface.onMove, (e: MouseEvent) => {
      if (this._unloaded) return;
      mousePos.text = `Mouse screen Position: ${globalLiveData.screenMousePos.x}, ${globalLiveData.screenMousePos.y}`;
      mouseSpMainPos.text = `Mouse board position: ${globalLiveData.boardMousePos.x}, ${globalLiveData.boardMousePos.y}`;
    }));



  }

  drawLegends() {
    let x = 0;
    let y = - 20;

    const childrenToRemove = [] as PIXI.DisplayObject[];
    this._spBoard.children.forEach((child) => {
      if (child.name?.includes("legend")) {
        childrenToRemove.push(child);
    }});
    childrenToRemove.forEach(child => {
      this._spBoard.removeChild(child);
    });

    this.legends.forEach((value, key) => {
      let legend = this._spBoard.getChildByName(`legend-${key}`);
      if (!legend) {
        legend = new PIXI.Text(`${value}`, { fontSize: 12, fill: key });
      };
      legend = new PIXI.Text(`${value}`, { fontSize: 12, fill: key });
      legend.alpha = 0.5;
      legend.position.set(x, y);
      this._spBoard.addChild(legend);
      legend.name = `legend-${key}`;
      y -= 20;
    });
  }

  getMaterialUsage() {
    const boardWidth = this._boardLength * this.zoomLevel;
    const boardHeight = this._boardWidth * this.zoomLevel;
    const isBoardHorizontal = boardWidth > boardHeight;
    const allBbox = [] as { x: number, y: number, width: number, height: number }[];
      this.items.forEach(item => {
        // get BBox
        const hull = item.getWorkingConvexHull().map(_ => new paper.Point(_.x, _.y));
        const minX = Math.min(...hull.map(_ => _.x));
        const minY = Math.min(...hull.map(_ => _.y));
        const maxX = Math.max(...hull.map(_ => _.x));
        const maxY = Math.max(...hull.map(_ => _.y));

        const bBox = {
          x: minX + item.rawX,
          y: minY + item.rawY,
          width: maxX - minX,
          height: maxY - minY
        }

        // check if the bBox fit the board
        let isInside = true;
        if (bBox.x + bBox.width > boardWidth) isInside = false;
        if (bBox.y + bBox.height > boardHeight) isInside = false;
        allBbox.push(bBox);
      });

      if (isBoardHorizontal) {
        // get maxX
        const maxX = Math.max(...allBbox.map(_ => _.x + _.width));
        // Add the Area calculation in m2
        const area = (maxX * this._boardWidth) / 1000000;
        const areaFixed = area.toFixed(2);
        const boardArea = (this._boardLength * this._boardWidth) / 1000000;
        const boardAreaFixed = Number(boardArea.toFixed(2));
        // calculate the % of usage by dividing the area of the items by the total area of the board

        const usage = (area / boardArea) * 100;
        return [Number(areaFixed), usage];
      } else {
        // get maxY
        const maxY = Math.max(...allBbox.map(_ => _.y + _.height));
        // Add the Area calculation in m2
        const area = (this._boardLength * maxY) / 1000000;
        const areaFixed = area.toFixed(2);
        const boardArea = (this._boardLength * this._boardWidth) / 1000000;
        const boardAreaFixed = Number(boardArea.toFixed(2));
        // calculate the % of usage by dividing the area of the items by the total area of the board
        const usage = (area / boardArea) * 100;

        return [Number(areaFixed), usage];
      }
  }

  centerBoard() {
    // get the spBoard size
    let boardWidth = this._boardLength * this.zoomLevel;
    let boardHeight = this._boardWidth * this.zoomLevel;

    // center the board into the screen
    const windowBB = this.canvas.parentElement.getBoundingClientRect();
    // Adjust the zoom level so we see always the board fully, without having the board being more than 90% of the canvas width

    let isBoardHorizontal = boardWidth > boardHeight;
    let isWindowHorizontal = windowBB.width > windowBB.height;

    // Adjust teh size according to teh pixel denity
    // pixelDensity = window.devicePixelRatio;
    //boardWidth /= pixelDensity;
    //boardHeight /= pixelDensity;

    // check if the board is horizontal or vertical
    if (isBoardHorizontal) {
      // check if the window is horizontal or vertical
      if (isWindowHorizontal) {
        // check if the board is larger than the window
        if (boardWidth > windowBB.width) {
          this.zoomLevel = (windowBB.width / boardWidth) * this.zoomLevel;
        }
      } else {
        // check if the board is larger than the window
        if (boardHeight > windowBB.height) {
          this.zoomLevel = (windowBB.height / boardHeight) * this.zoomLevel;
        }
      }
    } else {
      // check if the window is horizontal or vertical
      if (isWindowHorizontal) {
        // check if the board is larger than the window
        if (boardHeight > windowBB.height) {
          this.zoomLevel = (windowBB.height / boardHeight) * this.zoomLevel;
        }
      } else {
        // check if the board is larger than the window
        if (boardWidth > windowBB.width) {
          this.zoomLevel = (windowBB.width / boardWidth) * this.zoomLevel;
        }
      }
    }


    let x = (windowBB.width - boardWidth) / 2;
    let y = (windowBB.height - boardHeight) / 2;



    this._spMainCtn.position.set(x, y);
    return { x, y };
  }

  drawBoard() {
    if (!this._spBoard) {
      this._spBoard = new PIXI.Graphics();
      this._spMainCtn.addChild(this._spBoard);
    }

    const boardWidth = this._boardLength * this.zoomLevel;
    const boardHeight = this._boardWidth * this.zoomLevel;

    const isBoardHorizontal = boardWidth > boardHeight;
    this._spBoard.clear();
    this._spBoard.lineStyle(3, 0x000000, 1);
    this._spBoard.beginFill(0x000000, 0);
    this._spBoard.drawRect(0, 0, boardWidth, boardHeight);
    this._spBoard.endFill();


    if (this.displayMaterialUsage) {
      // calculate the max X for all items
      const allBbox = [] as { x: number, y: number, width: number, height: number }[];
      this.items.forEach(item => {
        // get BBox


        const hull = item.getWorkingConvexHull().map(_ => new paper.Point(_.x, _.y));
        const minX = Math.min(...hull.map(_ => _.x));
        const minY = Math.min(...hull.map(_ => _.y));
        const maxX = Math.max(...hull.map(_ => _.x));
        const maxY = Math.max(...hull.map(_ => _.y));

        const bBox = {
          x: minX + item.rawX,
          y: minY + item.rawY,
          width: maxX - minX,
          height: maxY - minY
        }

        // check if the bBox fit the board
        let isInside = true;
        if (bBox.x + bBox.width > boardWidth) isInside = false;
        if (bBox.y + bBox.height > boardHeight) isInside = false;
        allBbox.push(bBox);

        // Get maxX total


       // this._spBoard.lineStyle(2, 0x000000, 1);
       // this._spBoard.drawRect(bBox.x * this.zoomLevel, bBox.y * this.zoomLevel, bBox.width * this.zoomLevel, bBox.height * this.zoomLevel);

      });

      // Remove if already exists
      const textToRemove = [] as PIXI.DisplayObject[];
      this._spBoard.children.forEach((child) => {
        if (child.name?.includes("txt-board-size")) {
          textToRemove.push(child);
      }});
      textToRemove.forEach(child => {
        this._spBoard.removeChild(child);
      });

      if (isBoardHorizontal) {
        // get maxX
        const maxX = Math.max(...allBbox.map(_ => _.x + _.width));

        // Draw a line from 0 to maxx
        this._spBoard.lineStyle(2, 0x000000, 1);
        this._spBoard.moveTo(0, boardHeight + (100 * this.zoomLevel));
        this._spBoard.lineTo(maxX * this.zoomLevel, boardHeight + (100 * this.zoomLevel));

        this._spBoard.moveTo(-100 * this.zoomLevel, 0);
        this._spBoard.lineTo(-100 * this.zoomLevel, boardHeight);

        // Add teh size on each axis in meters
        const valText = (maxX/1000) * 1000;
        const valTextMeasure = convertMm(valText, 'inches');
        const text = new PIXI.Text(`${valTextMeasure[1] === "Metric" ? (valText / 1000).toFixed(2) : valTextMeasure[0]} ${valTextMeasure[1] === "Metric" ? "m" : "in"}`, { fontSize: 12, fill: 0x000000 });
        text.name = "txt-board-size";
        text.position.set(((maxX * this.zoomLevel) /2) >> 0, (boardHeight + (100 * this.zoomLevel)) >> 0);
        text.anchor.set(0.5, 0);
        this._spBoard.addChild(text);

        const valText2 = (this._boardWidth/1000) * 1000;
        const valTextMeasure2 = convertMm(valText2, 'inches');
        const text2 = new PIXI.Text(`${valTextMeasure2[1] === "Metric" ? (valText2 / 1000).toFixed(2) : valTextMeasure2[0]} ${valTextMeasure2[1] === "Metric" ? "m" : "in"}`, { fontSize: 12, fill: 0x000000 });
        //const text2 = new PIXI.Text(`${(this._boardWidth/1000).toFixed(2)}m`, { fontSize: 12, fill: 0x000000 });
        text2.name = "txt-board-size2";
        text2.position.set((-130 * this.zoomLevel>>0), (boardHeight / 2)>>0);
        text2.anchor.set(0.5, 0.5);
        this._spBoard.addChild(text2);
        // text2 is vertical and should rotate
        text2.rotation = Math.PI / 2;

        // Add the Area calculation in m2
        let area = (maxX * this._boardWidth) / 1000000;
        if (valTextMeasure2[1] === "Imperial") {
          // convert area from m2 to sqft
          area = area * 10.7639;
        }
        const text3 = new PIXI.Text(`Usage : ${area.toFixed(2)} ${valTextMeasure2[1] === "Metric" ? "m²" : "sqft"}`, { fontSize: 12, fill: 0x000000 });
        text3.name = "txt-board-size3";
        text3.position.set(0, (boardHeight + (100 * this.zoomLevel))>>0);
        this._spBoard.addChild(text3);
      } else {
        // get maxY
        const maxY = Math.max(...allBbox.map(_ => _.y + _.height));

        // Draw a line from 0 to maxX
        this._spBoard.lineStyle(2, 0x000000, 1);
        this._spBoard.moveTo(boardWidth + (100 * this.zoomLevel), 0);
        this._spBoard.lineTo(boardWidth + (100 * this.zoomLevel), maxY * this.zoomLevel);

        this._spBoard.moveTo(0, -100 * this.zoomLevel);
        this._spBoard.lineTo(boardWidth, -100 * this.zoomLevel);

        // Add the size on each axis in meters
        const valText = (config.boardLenght/1000) * 1000;
        const valTextMeasure = convertMm(valText, 'inches');
        const text = new PIXI.Text(`${valTextMeasure[1] === "Metric" ? (valText / 1000).toFixed(2) : valTextMeasure[0]} ${valTextMeasure[1] === "Metric" ? "m" : "in"}`, { fontSize: 12, fill: 0x000000 });
        //const text = new PIXI.Text(`${(config.boardLenght/1000).toFixed(2)}m`, { fontSize: 12, fill: 0x000000 });
        text.name = "txt-board-size";
        text.anchor.set(0.5, 0.5);
        text.position.set((boardWidth /2)>>0, (((-150 - text.getBounds().height) * this.zoomLevel))>>0);
        this._spBoard.addChild(text);

        const valText2 = (maxY/1000) * 1000;
        const valTextMeasure2 = convertMm(valText2, 'inches');
        const text2 = new PIXI.Text(`${valTextMeasure2[1] === "Metric" ? (valText2 / 1000).toFixed(2) : valTextMeasure2[0]} ${valTextMeasure2[1] === "Metric" ? "m" : "in"}`, { fontSize: 12, fill: 0x000000 });
        //const text2 = new PIXI.Text(`${(maxY/1000).toFixed(2)}m`, { fontSize: 12, fill: 0x000000 });
        text2.name = "txt-board-size2";
        text2.position.set((boardWidth + (150 * this.zoomLevel))>>0, ((maxY * this.zoomLevel) / 2)>>0);
        this._spBoard.addChild(text2);

        // Add the Area calculation in m2
        let area = (config.boardLenght * maxY) / 1000000;
        if (valTextMeasure2[1] === "Imperial") {
          // convert area from m2 to sqft
          area = area * 10.7639;
        }
        const text3 = new PIXI.Text(`Usage : ${area.toFixed(2)} ${valTextMeasure2[1] === "Metric" ? "m²" : "sqft"}`, { fontSize: 12, fill: 0x000000 });
        //const text3 = new PIXI.Text(`Usage : ${area.toFixed(2)}m²`, { fontSize: 12, fill: 0x000000 });
        text3.name = "txt-board-size3";
        text3.position.set((boardWidth + (150 * this.zoomLevel))>>0, 0);

        this._spBoard.addChild(text3);
      }

/**
 *
 * // get maxY
        const maxY = Math.max(...allBbox.map(_ => _.y + _.height));

        // Draw a line from 0 to maxx
        this._spBoard.lineStyle(2, 0x000000, 1);
        this._spBoard.moveTo(boardWidth + (100 * this.zoomLevel), 0);
        this._spBoard.lineTo(boardWidth + (100 * this.zoomLevel), maxY * this.zoomLevel);

        this._spBoard.moveTo(0, -100 * this.zoomLevel);
        this._spBoard.lineTo(boardWidth, -100 * this.zoomLevel);

        // Add teh size on each axis in meters
        const text = new PIXI.Text(`${boardWidth/1000}m`, { fontSize: 12, fill: 0x000000 });
        text.position.set(boardWidth + 10, maxY * this.zoomLevel);
        this._spBoard.addChild(text);

        const text2 = new PIXI.Text(`${maxY/10}m`, { fontSize: 12, fill: 0x000000 });
        text2.position.set(boardWidth, -50);
        this._spBoard.addChild(text2);
 */

      //return;
    } else {
      // Remove if already exists
      const textToRemove = [] as PIXI.DisplayObject[];
      this._spBoard.children.forEach((child) => {
        if (child.name?.includes("txt-board-size")) {
          textToRemove.push(child);
      }});
      textToRemove.forEach(child => {
        this._spBoard.removeChild(child);
      });
    }


    this.drawLegends();

    // Draw a grid every 50 pixels on the board
    const gridSize = 100 * this.zoomLevel;
    const gridColor = 0x000000;
    const gridAlpha = 0.2;
    const gridWidth = 1;
    let tickIndex = 0;
    const childrenToRemove = [] as PIXI.DisplayObject[];
    this._spBoard.children.forEach((child) => {
      if (child.name?.includes("grid-")) {
        childrenToRemove.push(child);
    }});
    childrenToRemove.forEach(child => {
      this._spBoard.removeChild(child);
    });
    for (let i = 0; i <= boardWidth; i += gridSize) {
      this._spBoard.lineStyle(gridWidth, gridColor, gridAlpha);
      this._spBoard.moveTo(i, 0);
      this._spBoard.lineTo(i, boardHeight);
      if (tickIndex % 20 === 0 && tickIndex > 0) {
        this._spBoard.lineStyle(2, gridColor, 1);
        this._spBoard.moveTo(i, 0);
        this._spBoard.lineTo(i, -100 * this.zoomLevel);
        const tickMeasure = convertMm((tickIndex/10)*1000, 'inches');
        // should display in m or in
        const text = new PIXI.Text(`${tickMeasure[1] === "Metric" ? (tickIndex/10).toFixed(2) : tickMeasure[0]} ${tickMeasure[1] === "Metric" ? "m" : "in"}`, { fontSize: 12, fill: 0x000000 });
        //const text = new PIXI.Text(`${tickIndex/10}m`, { fontSize: 12, fill: 0x000000 });
        text.name = "grid-" + i;
        text.position.set(i + 10, -100 * this.zoomLevel);
        this._spBoard.addChild(text)
      }
      tickIndex++;
    }
    tickIndex = 0;
    for (let i = 0; i <= boardHeight; i += gridSize) {
      // Implement here as well the tick vertically, drawn on teh left side of the board
      this._spBoard.lineStyle(gridWidth, gridColor, gridAlpha);
      this._spBoard.moveTo(0, i);
      this._spBoard.lineTo(boardWidth, i);
      if (tickIndex % 20 === 0 && tickIndex > 0) {
        this._spBoard.lineStyle(2, gridColor, 1);
        this._spBoard.moveTo(0, i);
        this._spBoard.lineTo(-100 * this.zoomLevel, i);
        const tickMeasure = convertMm((tickIndex/10)*1000, 'inches');
        // should display in m or in
        const text = new PIXI.Text(`${tickMeasure[1] === "Metric" ? (tickIndex/10).toFixed(2) : tickMeasure[0]} ${tickMeasure[1] === "Metric" ? "m" : "in"}`, { fontSize: 12, fill: 0x000000 });
        //const text = new PIXI.Text(`${tickIndex/10}m`, { fontSize: 12, fill: 0x000000 });
        text.name = "grid-" + i;
        text.position.set(-300 * this.zoomLevel, i + 10);
        this._spBoard.addChild(text)
      }
      tickIndex++;
    }
  }

  addItem(item: MultiViewItem) {
    item.zoomLevel = this.zoomLevel;
    this.items.push(item);
    item._boardSurface = this;
    if (item._type === "ITEM") {
      boardManager.selectedBoard.newBoard.undoStack.push([item, item.saveState()]);
      boardManager.selectedBoard.newBoard.undoIdx = boardManager.selectedBoard.newBoard.undoStack.length - 1;
    }
  }

  removeItem(item: MultiViewItem) {
    this.items = this.items.filter(i => i.guid !== item.guid);
    this._spMainCtn.removeChild(item._mainCtn);
  }

  cleanItems() {
    this.items = this.items.filter(i => !i._mainCtn.destroyed)
  }

  unload(parent: HTMLElement) {
    this._unloaded = true;
    parent?.removeChild(parent.children[0]);

    this.items.forEach(item => {
      item.disposeUI();
    });

    this._spMainCtn?.removeChildren();
    this._spMainCtn?.destroy({
      children: true,
      texture: true,
      textureSource: true
    });

    if (this._app) {
      this._app.destroy(true, { children: true, texture: true, textureSource: true });
      this._app = undefined;
    }
  }

  async createBoard(isNew: boolean = false) {
    const parent = !isNew
      ? (await waitForElt<HTMLCanvasElement>(".cut-board-workspace"))
      : null;

     // const parent = document.querySelector(".cut-board-canvas") as HTMLElement;

    if (this._app) {
      this._app.destroy(true, { children: true, texture: true, textureSource: true });
    }

    //parent.querySelectorAll("canvas").forEach((c) => c.remove());

    const boardCanvas = document.createElement("canvas");

    boardCanvas.style.position = "absolute";
    boardCanvas.style.top      = "0";
    boardCanvas.style.left     = "0";
    boardCanvas.style.width    = "100%";
    boardCanvas.style.height   = "100%";
    boardCanvas.id             = "cut-board-canvas";
    parent.appendChild(boardCanvas);
    this.canvas = boardCanvas;

    this._app = new PIXI.Application({
      background  : '#ffffff',
      antialias   : true,
      autoDensity : true,
      view        : boardCanvas,
      resizeTo    : parent
    });

    this._spMainCtn = new PIXI.Container();
    this._app.stage.addChild(this._spMainCtn);

    this.drawBoard();


    // add point on 0 0
    /*const point = new PIXI.Graphics();
    point.beginFill(0x000000, 1);
    point.drawCircle(0, 0, 5);
    point.endFill();
    this._spMainCtn.addChild(point);*/


    this.connectEventSystem();

    await waitForElt<HTMLCanvasElement>("#cut-board-canvas");
  }

  connectEventSystem() {
    _evtBus.on(_boardEvts.BoardSurface.onConfigChange, () => {
      if (this._unloaded) return;
      this.drawBoard();
    });


    _evtBus.on(_boardEvts.Item.onEnterEdit, (e: MouseEvent) => {
      EnterEditAction.call(this, e);
    });

    _evtBus.on(_boardEvts.Item.onEnterSubPatternRemove, () => {
      EnterSubPatternRemoveAction.call(this);
    });

    _evtBus.on(_boardEvts.Item.onEnterSplitEdit, (e: MouseEvent) => {
      EnterSplitEditAction.call(this, e);
    });

    _evtBus.on(_boardEvts.Item.onEnterWrapEdit, (e: MouseEvent) => {
      EnterWrapEditAction.call(this, e);
    });

    this.canvas.addEventListener("mouseup", (e: MouseEvent) => {
      MouseUpAction.call(this, e);
    });

    this.canvas.addEventListener("wheel", (e) => {
      MouseWheelAction.call(this, e);
    });

    this.canvas.addEventListener("mousedown", (e: MouseEvent) => {
      MouseDownAction.call(this, e, paper);
    });

    this.canvas.addEventListener("wheel", (e) => {
      if (this._unloaded) return;
      _evtBus.emit(_boardEvts.BoardSurface.onMouseScroll, e);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      MouseMoveAction.call(this, e, paper);
    });

    this.canvas.addEventListener("mouseleave", (e) => {
      if (this._unloaded) return;
      _evtBus.emit(_boardEvts.BoardSurface.onMouseLeave, e);
    });

    window.addEventListener('mouseout', (event) => {
      if (this._unloaded) return;
      _evtBus.emit(_boardEvts.BoardSurface.onMouseOut);
    });

    window.addEventListener('resize', (event) => {
      ResizeAction.call(this, event);
    });

    window.addEventListener('keydown', (event) => {
      if (this._unloaded) return;
      if (event.ctrlKey) {
        this._isCtrlPressed = true;
      }
    });

    window.addEventListener('keyup', (event) => {
      if (this._unloaded) return;
      if (event.key === "Delete") {
        // check first if we are in edit mode
        let cannotProceed = false;
        this.items.forEach(item => {
          item._isEditMode && (cannotProceed = true);
          item._isWrapMode && (cannotProceed = true);
          item._isSplitMode && (cannotProceed = true);
        });

        if (!cannotProceed) {
          this.items.forEach(item => {
            if (item.isSelected && !item._isEditMode) {
              item.disposeUI();
              this.removeItem(item);
              boardManager.selectedBoard.newBoard.mvs = this.items;
            }
          });
          return;
        }
      }


      if (event.key === "w") {
        const item = this.items.find(i => i._isWrapMode);
        if (!item) return;
        if (this.divide1 === undefined) {
          this.divide1 = this._lastNearestPoint;
        } else {
          this.divide2 = this._lastNearestPoint;
          if (item) {
            // If = 3 needs to convert from inches to mm
            const wrapValue = liveConfig.unitOfMeasure === 3
             ? liveConfig.wrapDistance * 25.4
             : liveConfig.wrapDistance;

            function wrapPathSegment(
              originalPath: paper.Path,
              point1: paper.PointLike,
              point2: paper.PointLike,
              offsetDistance: number = wrapValue
            ): string {
              // Convert PointLike to Point
              const p1 = new paper.Point(point1);
              const p2 = new paper.Point(point2);

              if (!originalPath.closed) {
                originalPath = originalPath.clone();
                originalPath.closePath();
              }

              // Ensure the original path is closed
              if (!originalPath.closed) {
                throw new Error('The path must be closed.');
              }

              // Step 1: Insert the two points into the path
              const location1 = originalPath.getNearestLocation(p1);
              const location2 = originalPath.getNearestLocation(p2);

              if (!location1 || !location2) {
                throw new Error('Points must lie on the path.');
              }

              // Divide the path at the two points
              const vd = new VectorDocument();
              vd.addPath(originalPath.pathData);

              const pathMap = new PathManipulator(vd.vdocs[0].asString());
              const [loc1, loc2, wc] = pathMap.getPointsInClockwiseOrder(location1.point, location2.point)
              const pm1 = pathMap.getNearestLocation(loc1);
              const pmSplit1 = pathMap.split(pm1.index, pm1.closestPoint);
              const pm2 = pathMap.getNearestLocation(loc2);
              const pmSplit2 = pathMap.split(pm2.index, pm2.closestPoint);

              const _p1 = new paper.Point(pm1.closestPoint);
              const _p2 = new paper.Point(pm2.closestPoint);
              const __dir = _p2.subtract(_p1).normalize();
              const __norm = new paper.Point(-__dir.y, __dir.x);

              const projection = calculateProjection(_p1, _p2, offsetDistance)

              const _direction = _p2.subtract(_p1).normalize();
              const _normal = new paper.Point(-_direction.y, _direction.x);
              const _p3 = (_p1.subtract(__norm.multiply(offsetDistance))).subtract(_p1);
              const _p4 = {
                x: (pathMap.data[pmSplit2.index1] as CurveCommand).x,
                y: (pathMap.data[pmSplit2.index1] as CurveCommand).y
              };

              pathMap.convertToRelative();
              const _l1 = new LineCommand(projection.x, projection.y, true);
              const _l2 = new LineCommand(-projection.x, -projection.y, true);
              pathMap.data.splice(pmSplit2.index2 , 0, _l2);
              pathMap.data.splice(pmSplit1.index2, 0, _l1);
              pathMap["_pathString"] = pathMap.buildPathString();

              let firstSplit = originalPath.splitAt(location1);
              let secondSplit = firstSplit ? firstSplit.splitAt(location2) : null;

              (window as any).PathManipulator = PathManipulator;

              if (!secondSplit) {
                throw new Error('Failed to split the path at the specified points.');
              }


              // Calculate the vector perpendicular of teh 2 points clockwise
              const direction = p2.subtract(p1).normalize();

              // create a lineto that will go to this direction for a distance of distance param
              const normal = new paper.Point(-direction.y, direction.x);
              const p3 = p2.subtract(normal.multiply(offsetDistance));
              const p4 = p1.subtract(normal.multiply(offsetDistance));

              const isFirstBigger = firstSplit.length > secondSplit.length;
              let inverted = false;

              if (isFirstBigger) {
                inverted = true;
                const tmp = firstSplit;
                firstSplit = secondSplit;
                secondSplit = tmp;
              }

              // Create a new path that will be the wrap path
              firstSplit.translate({ x: normal.multiply(offsetDistance).x * (inverted ? 1 : -1), y: normal.multiply(offsetDistance).y * (inverted ? 1 : -1) });
              firstSplit.lineTo(inverted ? p4 :p2);

              //firstSplit.lineTo(secondSplit.segments[0].point)
              secondSplit.lineTo(inverted ? p2 : p4);


              // Return the wrap path
              firstSplit.join(secondSplit);
              //firstSplit = new paper.Path(firstSplit.pathData);

              firstSplit.segments.forEach((seg) => {
              //seg.clearHandles();
              if (seg.point.x >> 0 === p2.x >> 0 && seg.point.y >> 0 === p2.y >> 0) {
                seg.clearHandles();
                seg.previous?.clearHandles();
                seg.next?.clearHandles();
             }
              if (seg.point.x >> 0 === p4.x >> 0 && seg.point.y >> 0 === p4.y >> 0) {
                seg.clearHandles();
                seg.previous?.clearHandles();
                seg.next?.clearHandles();
              }

              const pp1 = firstSplit.getNearestPoint(p1);
              const pp3 = firstSplit.getNearestPoint(p3);

              });


              firstSplit.closePath();
              //return firstSplit;

              pathMap.convertToAbsolute();
              pathMap.calculatePreviousPoints();
              //pathMap.translate(-projection.x, -projection.y);
              if (wc) {
                const total = pathMap.data.reduce((acc, curr) => {
                  if (curr instanceof CurveCommand || curr instanceof LineCommand) {
                    return acc + curr.getTotalLength();
                  }
                  return acc;
                }, 0);

                let segmentLength = 0;
                for(let i = pmSplit1.index2; i < pmSplit2.index2; i++) {
                  const cmd = pathMap.data[i];
                  if (cmd instanceof CurveCommand || cmd instanceof LineCommand) {
                    segmentLength += cmd.getTotalLength();
                  }
                }

                // If path was inverted and the segment is bigger than half of the total
                // We need to shift the path back to the original position
                const ratio = segmentLength / total;
                if (ratio > 0.5) {
                  pathMap.translate(-projection.x, -projection.y);                }

              }
              return pathMap.path;
            }

            item.sealOriginalPath();
            item._shapeHasChanged = true;
            const res = wrapPathSegment(item.mainPathPaper, this.divide1, this.divide2, wrapValue);
            item.normalizedPaths[0] = res;
            ///////////added by bilel to fix the shift subpattern after wrap //////////////////
             item.normalizedPaths = item.workingPapers.map((paperPath, index) => {

              return index === 0 ? item.normalizedPaths[0] : paperPath.pathData;
            });
            ///////////////////////////////////////////////////////////////////////////////////
            item.applyChanges(true, true);
            item.isWrapMode = false;
            item.isSelected = false;
            item.reloadUI(this._spMainCtn);

            this.divide1 = undefined;
            this.divide2 = undefined;
          }
        }


      }
      if (event.key === "s") {
        const item = this.items.find(i => i._isSplitMode);
        if (!item) return;

        if (this.divide1 === undefined) {
          this.divide1 = this._lastNearestPoint;
        } else {
          this.divide2 = this._lastNearestPoint;
          if (item) {
            /**
           * Splits a Paper.Path along a line defined by two points and returns the two resulting paths.
           *
           * @param originalPath - The original Paper.Path to be split.
           * @param point1 - The first point defining the splitting line (Point or PointLike).
           * @param point2 - The second point defining the splitting line (Point or PointLike).
           * @returns A tuple containing the two resulting Paper.Paths after the split.
           */
            function splitPathByLine(
              originalPath: paper.Path,
              point1: paper.PointLike,
              point2: paper.PointLike
            ): [paper.Path | null, paper.Path | null] {
              // Convert PointLike to Point if necessary
              const p1 = new paper.Point(point1);
              const p2 = new paper.Point(point2);

              // Large value to extend the line and polygons beyond the geometry
              const D = 10000;

              // Step 1: Calculate the direction and normal vectors
              const direction = p2.subtract(p1).normalize();
              const normal = new paper.Point(-direction.y, direction.x);

              // Step 2: Create extended points along the line
              const pStart = p1.subtract(direction.multiply(D));
              const pEnd = p1.add(direction.multiply(D));

              // Points along the normal to create the first half-plane polygon
              const nStart = pStart.add(normal.multiply(D));
              const nEnd = pEnd.add(normal.multiply(D));

              // Step 3: Construct the first half-plane polygon
              const polygon1 = new paper.Path({
                segments: [pStart, pEnd, nEnd, nStart],
                closed: true,
                insert: false, // Do not add to the project to keep it invisible
              });

              // Points along the normal in the opposite direction for the second half-plane
              const nStart2 = pStart.subtract(normal.multiply(D));
              const nEnd2 = pEnd.subtract(normal.multiply(D));

              // Construct the second half-plane polygon
              const polygon2 = new paper.Path({
                segments: [pStart, pEnd, nEnd2, nStart2],
                closed: true,
                insert: false, // Do not add to the project to keep it invisible
              });

              // Ensure the original path is closed for Boolean operations
              if (!originalPath.closed) {
                originalPath = originalPath.clone();
                originalPath.closePath();
              }

              // Step 4: Perform Boolean operations to get the two halves
              const firstHalf = originalPath.intersect(polygon1);
              const secondHalf = originalPath.intersect(polygon2);

              // Clean up temporary polygons
              polygon1.remove();
              polygon2.remove();

              // Return the resulting paths
              return [firstHalf as paper.Path, secondHalf as paper.Path];
            }

            function shiftPathSegmentOutward(
              originalPath: paper.Path,
              point1: paper.PointLike,
              point2: paper.PointLike
            ): void {
              // Convert PointLike to Point if necessary
              const p1 = new paper.Point(point1);
              const p2 = new paper.Point(point2);

              if (!originalPath.closed) {
                originalPath = originalPath.clone();
                originalPath.closePath();
              }

              // Ensure the original path is closed
              if (!originalPath.closed) {
                throw new Error('The path must be closed.');
              }

              // Step 1: Insert the two points into the path
              // Get the offsets along the path for the two points
              const offset1 = originalPath.getOffsetOf(p1);
              const offset2 = originalPath.getOffsetOf(p2);

              // Handle the case where the points are not exactly on the path
              if (offset1 === null || offset2 === null) {
                throw new Error('Points must lie on the path.');
              }

              // Sort the offsets to maintain order
              let lowerOffset = offset1;
              let higherOffset = offset2;
              let lowerPoint = p1;
              let higherPoint = p2;

              if (offset1 > offset2) {
                lowerOffset = offset2;
                higherOffset = offset1;
                lowerPoint = p2;
                higherPoint = p1;
              }

              // Insert segments at the two points
              const location1 = originalPath.getLocationAt(lowerOffset);
              const location2 = originalPath.getLocationAt(higherOffset);

              if (!location1 || !location2) {
                throw new Error('Unable to find locations on the path.');
              }

              // Divide the path at the higher offset first to avoid offset shifts
              const startSegment = originalPath.divideAt(higherOffset);
              const endSegment = originalPath.divideAt(lowerOffset);

              // Step 2: Identify the segments between the two points
              // Find the indices of the segments corresponding to the inserted points
              const segments = originalPath.segments;
              let startIndex = startSegment.index;//segments.findIndex(segment => segment.point.equals(lowerPoint));
              let endIndex = endSegment.index;//segments.findIndex(segment => segment.point.equals(higherPoint));

              if (startIndex === -1 || endIndex === -1) {
                throw new Error('Inserted points not found in the path segments.');
              }

              // Collect the indices of the segments between the two points
              const indicesToShift: number[] = [];
              for (let i = startIndex; i !== endIndex; i = (i + 1) % segments.length) {
                indicesToShift.push(i);
              }
              indicesToShift.push(endIndex); // Include the end index

              // Step 3: Calculate the outward perpendicular direction
              const direction = higherPoint.subtract(lowerPoint).normalize();

              // Since the path is clockwise and Y increases downward, the outward normal is:
              const outwardNormal = new paper.Point(direction.y, -direction.x);

              // Step 4: Shift the segments between the two points
              for (const index of indicesToShift) {
                segments[index].point = segments[index].point.add(outwardNormal.multiply(20));
                // If handles need to be adjusted, do so here (optional)
              }

              // Optionally, smooth the path to adjust for sharp corners
              // originalPath.smooth({ from: startIndex, to: endIndex });
            }

            function extrudePathSegment(
              originalPath: paper.Path,
              point1: paper.PointLike,
              point2: paper.PointLike
            ): void {
              // Convert PointLike to Point if necessary
              const p1 = new paper.Point(point1);
              const p2 = new paper.Point(point2);

              // Ensure the original path is closed
              if (!originalPath.closed) {
                throw new Error('The path must be closed.');
              }

              // Step 1: Insert the two points into the path
              // Get the offsets along the path for the two points
              const offset1 = originalPath.getOffsetOf(p1);
              const offset2 = originalPath.getOffsetOf(p2);

              // Handle the case where the points are not exactly on the path
              if (offset1 === null || offset2 === null) {
                throw new Error('Points must lie on the path.');
              }

              // Sort the offsets to maintain order
              let lowerOffset  = offset1;
              let higherOffset = offset2;
              let lowerPoint   = p1;
              let higherPoint  = p2;

              if (offset1 > offset2) {
                lowerOffset  = offset2;
                higherOffset = offset1;
                lowerPoint   = p2;
                higherPoint  = p1;
              }

              // Divide the path at the higher offset first to avoid offset shifts
              const location2 = originalPath.getLocationAt(higherOffset);
              const segment2  = location2 && originalPath.divideAt(location2);
              const location1 = originalPath.getLocationAt(lowerOffset);
              const segment1  = location1 && originalPath.divideAt(location1);

              if (!segment1 || !segment2) {
                throw new Error('Unable to divide the path at the specified points.');
              }

              // Step 2: Identify the segments between the two points
              // Find the indices of the segments corresponding to the inserted points
              const segments   = originalPath.segments;
              let   startIndex = segments.findIndex(segment => segment === segment1);
              let   endIndex   = segments.findIndex(segment => segment === segment2);

              if (startIndex === -1 || endIndex === -1) {
                throw new Error('Inserted segments not found in the path.');
              }

              // Collect the indices of the segments between the two points
              const indicesToShift: number[] = [];
              for (let i = startIndex; i !== endIndex; i = (i + 1) % segments.length) {
                indicesToShift.push(i);
              }
              indicesToShift.push(endIndex); // Include the end index

              // Step 3: Calculate the outward perpendicular direction
              const direction = higherPoint.subtract(lowerPoint).normalize();

              // Since the path is clockwise and Y increases downward, the outward normal is:
              const outwardNormal = new paper.Point(direction.y, -direction.x);

              // Step 4: Add lines along the normal direction at the two points
              // Create new points shifted by 20 units along the normal
              const shiftedStart = lowerPoint.add(outwardNormal.multiply(20));
              const shiftedEnd   = higherPoint.add(outwardNormal.multiply(20));

              // Insert new segments after startIndex and endIndex with the shifted points
              const shiftedStartSegment = new paper.Segment(shiftedStart);
              const shiftedEndSegment = new paper.Segment(shiftedEnd);

              // Insert the shifted segments into the path
              originalPath.insert((startIndex + 1) % segments.length, shiftedStartSegment);
              originalPath.insert((endIndex + 2) % segments.length, shiftedEndSegment);

              // Update indices after insertion
              if (endIndex < startIndex) {
                endIndex += 2;
              } else {
                endIndex += 1;
              }

              // Step 5: Shift the segments between the two points (excluding the shifted points)
              for (let i = (startIndex + 1) % originalPath.segments.length; i !== endIndex; i = (i + 1) % originalPath.segments.length) {
                const segment = originalPath.segments[i];
                segment.point = segment.point.add(outwardNormal.multiply(20));
              }

              // Step 6: Add lines representing the shift distance at the endpoints
              // No action needed as we've already inserted the shifted points

              // Optional: Remove any redundant segments or smooth the path
              // originalPath.smooth({ from: startIndex, to: (endIndex + 1) % originalPath.segments.length });
            }

            item.hidePsLine();
            item._shapeHasChanged = false;
            item.originalPaper = undefined;
            // const res = splitPathByLine(item.mainPathPaper, this.divide1, this.divide2);
            // item.normalizedPaths[0] = res[0].pathData
            ///////////added by Bilel to fix the split /////////////////////////////
            item.splitAllPaths(
              new paper.Point(this.divide1),
              new paper.Point(this.divide2)
            );

            ////////////////////////////////////////////////////////////////////////
            //item.applyChanges();
            //item.isSplitMode = false;
            //item.isSelected = false;
            //item.reloadUI(this._spMainCtn);

            this.divide1 = undefined;
            this.divide2 = undefined;

            // const newMv = new MultiViewItem({
             // paths: [res[1].pathData],
            //});
           // this.addItem(newMv);
            //newMv.x = item.x;
           // newMv.y = item.y;
            //newMv._carColor = item._carColor;
            boardManager.selectedBoard.newBoard.mvs = this.items.filter(i => i._type === "ITEM");
            //newMv.isSplitMode = false;
           //newMv.applyChanges();
           // newMv.reloadUI(this._spMainCtn);
          }


        }
      }
      if (event.key === "p") {
        const item = this.items.find(i => i._isEditMode);
        if (item) {
          const x = item._psStart.rawX;
          const y = item._psStart.rawY;
          const location = item.mainPathPaper.getLocationOf(this._lastNearestPoint);

          item.mainPathPaper.divideAt(location)

          item.mainPathPaper.rotate(-item._angle, item.mainPathPaper.bounds.center);
          item.normalizedPaths[0] = item.mainPathPaper.pathData
          item.mainPathPaper.rotate(item._angle, item.mainPathPaper.bounds.center);

          item.mainPath = item.mainPathPaper.pathData;

          item.applyChanges();
          item.setEditMode(true);
        }
      }

      if (event.key === "Delete") {
        const item = this.items.find(i => i._isEditMode);
        if (item) {
          const x = item._psStart.rawX;
          const y = item._psStart.rawY;
          const offset = item.mainPathPaper.getOffsetOf(this._lastNearestPoint);
          const point = item.mainPathPaper.getPointAt(offset);
          // check if offset or point belongs to the segment
          item.mainPathPaper.segments.forEach((segment, idx) => {
            const _offset = segment.curve.getOffsetOf(this._lastNearestPoint);
            if (_offset === offset) {
              if (item.mainPathPaper.segments.length > 3) {
                item.mainPathPaper.removeSegment(idx);
              }
            }
          });



          item.mainPathPaper.rotate(-item._angle, item.mainPathPaper.bounds.center);
          item.normalizedPaths[0] = item.mainPathPaper.pathData
          item.mainPathPaper.rotate(item._angle, item.mainPathPaper.bounds.center);

          item.mainPath = item.mainPathPaper.pathData;

          item.applyChanges();
          item.setEditMode(true);
        }
      }
    });

    _evtBus.on(_boardEvts.BoardSurface.onRotate, (reverse) => {
      RotateAction.call(this, reverse);
    });

    _evtBus.on(_boardEvts.BoardSurface.zoomIn, () => {
      ZoomInAction.call(this);
    });

    _evtBus.on(_boardEvts.BoardSurface.zoomOut, () => {
      ZoomOutAction.call(this);
    });


    _evtBus.on(_boardEvts.BoardSurface.onGlobalCollisionComplete, async (hasCollision: boolean) => {
      if (this._unloaded) return;

      const validItems = this.items.filter(item => item._type === "ITEM");
      if (validItems.length === 0) {
        ppInfo("Cut","No Items to Cut");
        return;
      }
      this.items = validItems;

      const config = await getConfig();
      if (this.hasPendingCut) {
        this.hasPendingCut = false;
        if (!hasCollision) {
          const _ppWait = ppWait("Cut","Cutting in Progress");
          _ppWait.show();

          const usages = this.getMaterialUsage();

          const strPatterns = [] as string[];
          this.items.forEach(item => {
            // if the patternId is not yet in the list we add it
            if (!strPatterns.includes(item._rawPattern?.pattern_id)) {
              strPatterns.push(item._rawPattern?.pattern_id ?? "");
            }
          });

          try {
            await sFetch("usercuttes", "POST", {
              "usagePercent"      : usages[1],
              "usageSize"         : usages[0],
              "patternCuttedList" : strPatterns
            });
          } catch{}

          const res = [] as string[];
          this.items.forEach(item => {
           const dataArray = item.getCutModeDataPaths();
            dataArray.forEach(data => {
              res.push(data);
            });
          });
          const ratio = 40;

          const polygons = await createPolygonFromSVGPaths(res, 80);

          if (config.cut.target === "SUMMA") {
            const summa = config.cut.summa.model;
            const plotter = summa.split("|");
    let bladeNumber = config.cut.summa.blade;

    if (plotter[0].includes("F")) {
      bladeNumber = "1"
    }

    let startSequence = `IN;SP${bladeNumber};`;

    if (plotter[0].includes("S3")) {
      startSequence = `;`;
    }

    if (plotter[0].includes("D")) {
      startSequence = `,;:HOA,ECN,`;
    }


    let hpgl =  startSequence + polygons.map(_ => `PU;PA${(_[0][1] * ratio) >> 0},${(/*maxY -*/ (_[0][0] * ratio)) >> 0};PD${_.map(__ => `${(__[1] * ratio) >> 0},${(/*maxY - */(__[0] * ratio)) >> 0}`).join(",")};`);
    hpgl = hpgl.replace(/;;,PU/g, ";PU");

    if (plotter[0].includes("D")) {
      hpgl = hpgl.replace(/PU/g, "U");
      hpgl = hpgl.replace(/PA/g, "U");
      hpgl = hpgl.replace(/PD/g, "D");

      hpgl += `

,e

"@"`;
    }

    if (plotter[0].includes("S3")) {
      hpgl = hpgl.replace(/PU/g, "PI");
      hpgl = hpgl.replace(/PA/g, "PU");
      hpgl = hpgl.replace(/PI/g, "PA");
    }

    if (plotter.join("|").includes("Network")) {
      sendCutToIp(config.cut.network.ip, config.cut.network.port.toString(), hpgl)
    } else {
      sendCutToSuma(hpgl)
    }
            _ppWait.hide();
            return;
          }

          if (config.cut.target === "PRINTER") {
            const hpgl ="PRINTER|" + config.cut.printer.name + "|IN;SP1;" + polygons.map(_ => `PU;PA${(_[0][1] * ratio) >> 0},${(/*maxY -*/ (_[0][0] * ratio)) >> 0};PD${_.map(__ => `${(__[1] * ratio) >> 0},${(/*maxY - */(__[0] * ratio)) >> 0}`).join(",")};`);
            sendCutToSuma(hpgl);
            _ppWait.hide();
            return;
          }


          const hpgl = "IN;SP1;" + polygons.map(_ => `PU;PA${(_[0][1] * ratio) >> 0},${(/*maxY -*/ (_[0][0] * ratio)) >> 0};PD${_.map(__ => `${(__[1] * ratio) >> 0},${(/*maxY - */(__[0] * ratio)) >> 0}`).join(",")};`);
          sendCutToIp(config.cut.network.ip, config.cut.network.port.toString(), hpgl.replace(/;,PU/g, ";PU"))
          _ppWait.hide();
        } else {
          console.log("Collision Detected, Aborting Cut");
        }
      }
    });


    _evtBus.on(_boardEvts.BoardSurface.onCutCommand, async () => {
      if (this._unloaded) return;
      this.hasPendingCut = true;
      _evtBus.emit(_boardEvts.Item.onCheckCollisions);
    });

    _evtBus.on(_boardEvts.BoardSurface.onOutward, async () => {
      if (this._unloaded) return;
      // get the selected item
      const item = this.items.find(i => i.isSelected);
      if (!item) return;

      if (item.hasBeenOutwarded) {
        ppInfo("Outward","Item has already been outwarded");
        return;
      }

      // get the main working path as a string
      const path = item.workingPapers[0].pathData;

      const wrapValue = liveConfig.unitOfMeasure === 3
             ? liveConfig.wrapDistance * 25.4
             : liveConfig.wrapDistance;

      // call teh outward function
      const res = createExternalOutwardPolygon(path, wrapValue);


      item.outwardedPath    = res;
      item.outwardedPaper   = new paper.Path(res);
      item.hasBeenOutwarded = !true;
      item.outwardDoubleCut = liveConfig.doubleCut;

      // Check if teh double cut is enabled
      if (liveConfig.doubleCut) {
        // The old path will become a nested one
        item.workingPapers.unshift(item.workingPapers[0]);
        item.normalizedPaths.unshift(item.normalizedPaths[0]);
        item.workingPaths.unshift(item.workingPaths[0]);
      }

      item.outwardedPaper.rotate(-item._angle, item.center)
      item.workingPapers[0]   = item.outwardedPaper;
      item.normalizedPaths[0] = item.outwardedPaper.pathData;
      item.workingPaths[0]    = item.outwardedPaper.pathData;

      item.outwardedPath    = null
      item.outwardedPaper   = null;

      item.applyChanges();


      item.reloadUI(this._spMainCtn);
    });
  }

  async reload() {
    if (this._unloaded) return;
    this.drawLegends();
    this.items.forEach(item => {
      item.reloadUI(this._spMainCtn);
    });

    // TODO: Reload Board Limits

  }
}