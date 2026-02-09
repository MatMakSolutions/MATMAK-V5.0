import * as PIXI from 'pixi.js';
import * as svgPath from 'svgpath';
import * as Paper from 'paper';
import { guid } from "../core/Guid";
import { GraphicDrawer } from "./WebGL/GraphicDrawer";
import concaveman from "concaveman";
import { Point } from "./RawVector/RawVector";
import { i } from "vite/dist/node/types.d-aGj9QkWt";
import { BoardSurface } from "../cutboard/BoardSurface/BoardSurface";
import { _boardEvts, _evtBus } from "../core/EventBus";
import {
  ITEM_COLOR_WHEN_OVERLAPED,
  ITEM_COLOR_WHEN_SELECTED,
  ITEM_FILL_ALPHA_WHEN_OVERLAPED,
  ITEM_FILL_ALPHA_WHEN_SELECTED,
  ITEM_LINE_ALPHA_WHEN_OVERLAPED,
  ITEM_LINE_ALPHA_WHEN_SELECTED
} from "../core/Constant";
import { ppConfirm, ppCutStatus, ppInfo } from "../ui/controls/popup/Popup";
import { liveConfig } from "../core/LiveConfig";
import { PatternFile } from "../../src/uof/SearchType";
let paper = (Paper as any).default as typeof Paper;

paper.setup(new paper.Size(100, 100));

type CurveDefinition = {
  start    : { x: number, y: number };
  end      : { x: number, y: number };
  control1 : { x: number, y: number };
  control2 : { x: number, y: number };
}


export class MultiViewItem {
  _type = "ITEM" as "ITEM" | "CIRCLE";
  //##
  selectedShape: PIXI.Graphics;
  overLapShape: PIXI.Graphics;
  isZoomLocked: boolean = false;
  _startDragPosition: { x: number, y: number } = { x: 0, y: 0 };
  _rawPattern: PatternFile | null = null;
  _editSaveState: ReturnType<typeof MultiViewItem.prototype.saveState> | null = null;

  // UI
  _isHighlighted: boolean = false;
  _mainCtn !: PIXI.Container;
  _mainGraphics !: PIXI.Graphics;
  _editPoints: MultiViewItem[] = [];
  _boardSurface: BoardSurface;
  _editPathItem: MultiViewItem | null = null;
  _psStart : MultiViewItem | null = null;
  _psEnd : MultiViewItem | null = null;
  _psLine : PIXI.Graphics | null = null;
  _hasZoomChanged: boolean = false;
  disposed: boolean = true;
  _wrapPt1: Point = { x: 0, y: 0 };
  _wrapPt2: Point = { x: 0, y: 0 };
  _hasBeenWrapped: boolean = false;

  _zoomLevel: number = 1;

  _isWrapMode: boolean = false;
  _isSplitMode: boolean = false;
  _isSubPatternMode: boolean = false;

  get zoomLevel() {
    return this._zoomLevel;
  }

  set zoomLevel(value: number) {
    if (this.isZoomLocked) return;
    if (value !== this._zoomLevel) {
      this._hasZoomChanged = true;
      this._zoomLevel = value;
    }
  }


  set isWrapMode(value: boolean) {
    this.checkMvItems();
    this._isWrapMode = value;
    if (!value) {
      this._psEnd._mainCtn.visible = false;
      this._psStart._mainCtn.visible = false;
      this._psLine && (this._psLine.visible = false);
    }
  }

  highlightSegment(idx: number) {
    this._editPoints.forEach(_ => {
      if (_._editPointIndex === idx) {
        let red = _._mainCtn.getChildByName("RED");
        if (!red) {
          const g = new PIXI.Graphics();
          g.name = "RED";
          g.lineStyle(1, 0xff0000, 1);
          if (_._editPointIndexPosition === 1) {
            // we fill it in red too
            g.beginFill(0xff0000, 1);
          }
          g.drawCircle(0, 0, 5);
          _._mainCtn.addChild(g);
          red = g;
        }
        red.visible = true;
        // ensure it is at the highest level
        _._mainCtn.removeChild(red);
        _._mainCtn.addChild(red);
      } else {
        const red = _._mainCtn.getChildByName("RED");
        red && (red.visible = false);
      }
    })
  }

  drawPsLine(x1?: number, y1?: number, x2?: number, y2?: number, forceCircle?: boolean, zoomLevel?: number) {
    if (!this._psLine) {
      this._psLine = new PIXI.Graphics();
      this._mainCtn.parent.addChild(this._psLine);
    }
    this._psLine.visible = true;
    this._psLine.clear();

    let needsToDrawCircle = forceCircle;

    x1 = x1 || this._psStart._mainCtn.x;
    y1 = y1 || this._psStart._mainCtn.y;
    x2 = x2 || this._psEnd._mainCtn.x;
    y2 = y2 || this._psEnd._mainCtn.y;

    // Yellow
    this._psLine.lineStyle(2, 0xff00ff, 1);
    this._psLine.moveTo(x1, y1);
    if (needsToDrawCircle) {
      this._psLine.drawCircle(x1, y1, 5);
      // Draw a text in teh middle of the line representing the distance between the two points in mm (1mm = 1vu)
      const distance = Math.sqrt(Math.pow(x2- x1, 2) + Math.pow(y2 - y1, 2));
      let text = this._psLine.getChildByName("text") as PIXI.Text;
      let distinMm = Number((distance / zoomLevel).toFixed(0));
      // check if imperial
      if (liveConfig.unitOfMeasure === 3) {
        distinMm = Number((distance / zoomLevel / 25.4).toFixed(2));
      }

      if (!text) {
        text = new PIXI.Text( `${distinMm}${liveConfig.unitOfMeasure === 3 ? "in" : "mm"}`, { fill: 0x000000, fontSize: 12 });
        text.name = "text";
        this._psLine.addChild(text);
      }
      text.x = (x1 + x2) / 2;
      text.y = (y1 + y2) / 2;
      text.text = `${distinMm}${liveConfig.unitOfMeasure === 3 ? "in" : "mm"}`;
    }
    this._psLine.lineTo(x2, y2);
  }

  hidePsLine() {
    this._psLine && (this._psLine.visible = false);
  }

  get isWrapMode() {
    return this._isWrapMode;
  }

  set isSplitMode(value: boolean) {
    this.checkMvItems();
    this._isSplitMode = value;
    if (!value) {
      this._psEnd._mainCtn.visible = false;
      this._psStart._mainCtn.visible = false;
    }
  }

  get isSplitMode() {
    return this._isSplitMode;
  }

  set isSubPatternMode(value: boolean) {
    this.checkMvItems();
    this._isSubPatternMode = value;
  }

  get isSubPatternMode() {
    return this._isSplitMode;
  }

  guid: string = "";  // Unique identifier for the item
  /*
    Imported from the MVD
  */
  widthInMm     : number  = 0;     // width in mm
  heightInMm    : number  = 0;     // height in mm
  widthInVu     : number  = 0;     // width in vector units
  heightInVu    : number  = 0;     // height in vector units
  withReduction : boolean = true;  // with reduction
  withSimlify   : boolean = true;  // with simplify
  backupAngle   : number  = 0;     // backup angle
  hasBeenOutwarded: boolean = false; // Has been outwarded


//#region Serialization related data
  originalPaths    : string[] = [];                        // Original paths
  normalizedPaths  : string[] = [];                        // Normalized paths
  workingPaths     : string[] = [];                        // Normilized path after UI transformation
  originalPosition : paper.Point = new paper.Point(0, 0);  // Original positions of the paths
  originalShift    : paper.Point = new paper.Point(0, 0);  // Original shift of the paths
  center           : paper.Point = new paper.Point(0, 0);  // Center of the norma path
  wasDragEnded     : boolean = false;                       // Was drag ended
  outwardedPath   : string;                        // Outwarded paths
  outwardedPaper   : paper.Path;                        // Outwarded paper
  outwardDoubleCut : boolean = false;                       // Outward double cut

  // UI Transformation
  _x     : number = 0;  // x position
  _y     : number = 0;  // y position
  _angle : number = 0;  // angle
  polygon: Point[] = []; // Polygon definition

  allowSelection    : boolean = true;                            // Allow selection
  allowDragNDrop    : boolean = true;                            // Allow drag
  _isDragged        : boolean = false;                           // Is dragged
  _isSelected       : boolean = false;                           // Is selected
  isDragStarted     : boolean = false;                           // Is drag started
  isDragEnded       : boolean = false;                           // Is drag ended
  isHovered         : boolean = false;                           // Is hovered
  _mainPathPaper!  : paper.Path;                                 // Main path paper
  _mainNormalizedPaper!  : paper.Path;                                 // Main path paper
  dragStartPosition: { x: number, y: number } = { x: 0, y: 0 };  // Drag start position
  _isEditMode      : boolean = false;                            // Is in edit mode
  _editPointIndex  : number = -1;
  _editPointIndexPosition: number = -1;                                // Edit point index
  _isCollided     : boolean = false;                            // Is colliding
  _colliderGfx    : PIXI.Graphics | null = null;                 // Collider graphics
  _collideList : Set<string> = new Set();                       // Collide list
  _shapeHasChanged: boolean = false;                             // Shape has changed
  _carColor       : number = -1;                           // Car color

  //##
  workingPapers: paper.Path[] = [];
  originalPaper!: paper.Path;
  originalPaperRot0!: paper.Path;
  originalRotation = 0;
  //#endregion


  getCutModeDataPaths() {
    const res = [] as string[];
    if (this.hasBeenOutwarded) {
      if (this.outwardDoubleCut) {
        const outwardedPaper = this.outwardedPaper.clone();
        outwardedPaper.translate({ x: this.rawX, y: this.rawY });
        res.push(outwardedPaper.pathData);

        this.getMainPapers().forEach(_paper => {
          const paper = _paper.clone();
          paper.translate({ x: this.rawX, y: this.rawY });
          res.push(paper.pathData);
        });
      } else {
        this.getMainPapers().forEach((_paper, idx) => {
          if (idx === 0) {
            const outwardedPaper = this.outwardedPaper.clone();
            outwardedPaper.translate({ x: this.rawX, y: this.rawY });
            res.push(outwardedPaper.pathData);
          } else {
            const paper = _paper.clone();
            paper.translate({ x: this.rawX, y: this.rawY });
            res.push(paper.pathData);
          }
        });
      }
    } else {
      this.getMainPapers().forEach(_paper => {
        const paper = _paper.clone();
        paper.translate({ x: this.rawX, y: this.rawY });
        res.push(paper.pathData);
      });
    }
    return res;
  }

  saveState() {
    return {
      _x                      : this._x,
      _y                      : this._y,
      _angle                  : this._angle,
      _zoomLevel              : this._zoomLevel,
      _isWrapMode             : this._isWrapMode,
      _isSplitMode            : this._isSplitMode,
      _isSubPatternMode       : this._isSubPatternMode,
      _isEditMode             : this._isEditMode,
      _isSelected             : this._isSelected,
      _isDragged              : this._isDragged,
      _shapeHasChanged        : this._shapeHasChanged,
      _carColor               : this._carColor,
      _hasBeenWrapped         : this._hasBeenWrapped,
      _hasZoomChanged         : this._hasZoomChanged,
      _collideList            : Array.from(this._collideList ?? []),
      _isCollided             : this._isCollided,
      originalPaths           : this.originalPaths?.map(_ => _) ?? [],
      normalizedPaths         : this.normalizedPaths?.map(_ => _) ?? [],
      workingPaths            : this.workingPaths?.map(_ => _) ?? [],
      originalPosition        : this.originalPosition?.clone(),
      originalShift           : this.originalShift?.clone(),
      center                  : this.center?.clone(),
      outwardedPath           : this.outwardedPath,
      outwardedPaper          : this.outwardedPaper?.clone(),
      _mainPathPaper          : this._mainPathPaper?.clone(),
      _mainNormalizedPaper    : this._mainNormalizedPaper?.clone(),
      dragStartPosition       : JSON.parse(JSON.stringify(this.dragStartPosition ?? { x: 0, y: 0 })),
      _editPointIndex         : this._editPointIndex,
      _editPointIndexPosition : this._editPointIndexPosition,
    }
  }

  restoreState(state: ReturnType<typeof MultiViewItem.prototype.saveState>) {
    this.rawX  = state._x;
    this.rawY  = state._y;
    this.angle = state._angle;
    this.reloadUI(this._boardSurface._spMainCtn);
  }

  fullRestoreState(state: ReturnType<typeof MultiViewItem.prototype.saveState>) {
    this.originalPaths        = state.originalPaths;
    this.normalizedPaths      = state.normalizedPaths;
    this.workingPaths         = state.workingPaths;
    this._mainPathPaper       = state._mainPathPaper;
    this._mainNormalizedPaper = state._mainNormalizedPaper;
    this.mainPath = this.normalizedPaths[0];
    this.workingPapers = this.workingPaths.map(_ => new paper.Path(_));
  }

  get isCollided() {
    return this._isCollided;
  }

  sealOriginalPath() {
    let first = !this.originalPaper;
    if (first) {
      this.originalPaper = this.workingPapers[0].clone();
      this.originalPaperRot0 = this.workingPapers[0].clone();
      this.originalPaperRot0.rotate(-this.angle, this.originalPaperRot0.bounds.center);
    }
  }

  addCollideItem(item: MultiViewItem) {
    this._collideList.add(item.guid);
    this.isCollided = true;
  }

  removeCollideItem(item: MultiViewItem) {
    this._collideList.delete(item.guid);
    if (this._collideList.size > 0) {
      this.isCollided = true;
    } else {
      this.isCollided = false;
    }
  }

  set isCollided(value: boolean) {
    this._isCollided = value;
    this.overLapShape.visible = value;
  }

  //###
  getMainPaths() {
    return this.workingPaths;
  }

  getMainPapers() {
    return this.workingPapers;
  }

  get isSelected() {
    return this._isSelected;
  }

  set isSelected(value: boolean) {
    this._isSelected = value;
    this.selectedShape.visible = value;
  }

  get mainPathPaper() {
    return this.workingPapers[0];
  }

  set mainPathPaper(value: paper.Path) {
    this._mainPathPaper = value;
  }

  get isDragged() {
    return this._isDragged;
  }

  set isDragged(value: boolean) {
    this._isDragged = value;
    this._startDragPosition = { x: this.x, y: this.y };
    document.body.style.cursor = value ? "grabbing" : "default";
    this._mainCtn.alpha = value ? 0.5 : 1;
    //this._editPointIndexPosition === -1 &&  _evtBus.emit(_boardEvts.Item.onCheckCollisions, this);
  }

  get x() {
    return this._x * this.zoomLevel;
  }

  set x(value: number) {
    this._x = value / this.zoomLevel;
    this._mainCtn && (this._mainCtn.x = value);
  }

  get y() {
    return this._y * this.zoomLevel;
  }

  set y(value: number) {
    this._y = value / this.zoomLevel;
    this._mainCtn && (this._mainCtn.y = value);
  }

  get mainPath() {
    return this.workingPaths[0];
  }

  set mainPath(value: string) {
    this.workingPaths[0] = value;
  }

  get angle() {
    return this._angle;
  }

  get rawX() {
    return this._x;
  }

  set rawX(value: number) {
    this._x = value;

    this._mainCtn && (this._mainCtn.x = value * this.zoomLevel);
  }

  get rawY() {
    return this._y;
  }

  set rawY(value: number) {
    this._y = value;
    this._mainCtn && (this._mainCtn.y = value * this.zoomLevel);
  }

  set angle(value: number) {
    if (this.hasBeenOutwarded) {
      ppInfo("Cannot Rotate", "Outwarded shape cannot be rotated");
      return;
    }
    this._angle = value;
    this.applyChanges();
    this._boardSurface?._spMainCtn && this.reloadUI(this._boardSurface._spMainCtn);
  }

  dragEnd() {
    /*
    if (boardManager.selectedBoard.newBoard.undoIdx !== boardManager.selectedBoard.newBoard.undoStack.length - 1) {
              boardManager.selectedBoard.newBoard.undoStack = boardManager.selectedBoard.newBoard.undoStack.slice(0, boardManager.selectedBoard.newBoard.undoIdx + 1);
            }
            boardManager.selectedBoard.newBoard.undoStack.push([item, item.saveState()]);
            boardManager.selectedBoard.newBoard.undoIdx = boardManager.selectedBoard.newBoard.undoStack.length - 1;
            console.log("undo addition", boardManager.selectedBoard.newBoard.undoStack);
    */
    this.wasDragEnded = true;
   const rotationPoint = this._editPointIndex > -1 ? this._editPathItem.mainPathPaper.bounds.center : this.mainPathPaper.bounds.center;
   if (this._editPointIndex > -1) {
     const idx = this._editPointIndex;
     const idxPos = this._editPointIndexPosition;
     let pPath = this._editPathItem.mainPathPaper;//new paper.Path(this._editPathItem.normalizedPaths[0]);

      let point:paper.Point;
      if (idxPos === 1) {
        pPath.curves[idx].point1.x = (this._editPathItem.rawVal(this.x) - this._editPathItem.rawX);
        pPath.curves[idx].point1.y = (this._editPathItem.rawVal(this.y) - this._editPathItem.rawY);
      } else if (idxPos === 2) {
         pPath.curves[idx].handle1.x = (this._editPathItem.rawVal(this.x) - this._editPathItem.rawX) - pPath.curves[idx].values[0];
         pPath.curves[idx].handle1.y = (this._editPathItem.rawVal(this.y) - this._editPathItem.rawY) - pPath.curves[idx].values[1];
      } else {
         pPath.curves[idx].handle2.x = (this._editPathItem.rawVal(this.x) - this._editPathItem.rawX) - pPath.curves[idx].values[6];
         pPath.curves[idx].handle2.y = (this._editPathItem.rawVal(this.y) - this._editPathItem.rawY) - pPath.curves[idx].values[7];
      }

      pPath.rotate(-this._editPathItem.angle, rotationPoint);
      this._editPathItem.normalizedPaths[0] = pPath.pathData;
      this._editPathItem.updateChanges();
      this._editPathItem.reloadUI(this._boardSurface._spMainCtn);
      this.reloadUI(this._boardSurface._spMainCtn);
    } else {
      this._shapeHasChanged = true;
    }
  }

  updateEditMode() {
    // TODO : Remove
  }

 _addPositionPoint(curves: CurveDefinition[], index: number, circle: string) {
    const point = this.mainPathPaper.curves[index].point1;
    const mv = new MultiViewItem({paths: [circle]});
    mv._type                   = "CIRCLE";
    mv.normalize();

    mv.zoomLevel               = 3;
    mv.isZoomLocked            = true;
    mv._editPointIndex         = index
    mv._editPointIndexPosition = 1;

    this._boardSurface.addItem(mv);
    mv._editPathItem = this;
    mv.reloadUI(this._boardSurface._spMainCtn);

    this._editPoints.push(mv);
    mv.x = this.zVal(point.x + this.rawX);
    mv.y = this.zVal(point.y + this.rawY);

  }

  _addControlPoint(curves: CurveDefinition[], index: number, circle: string, type: 2 | 3) {
    const point = curves[index][type === 2 ? "control1" : "control2"];
    const mv = new MultiViewItem({paths: [circle]});
    mv._type                   = "CIRCLE";
    mv.normalize();

    mv.zoomLevel               = 3;
    mv.isZoomLocked            = true;
    mv._editPointIndex         = index;
    mv._editPointIndexPosition = type;

    this._boardSurface.addItem(mv);
    mv._editPathItem = this;
    mv.reloadUI(this._boardSurface._spMainCtn);

    this._editPoints.push(mv);
    mv.x = this.zVal(point.x + this.rawX);
    mv.y = this.zVal(point.y + this.rawY);
  }

  checkMvItems() {
    const circlePath2 = new paper.Path.Circle(new paper.Point(0,0), 3).pathData;
    if (!this._psStart?._mainCtn.visible) {
      this._psStart = null;
    }

    if (!this._psStart) {
      const mvStart = new MultiViewItem({paths: [circlePath2]});
      mvStart._type                   = "CIRCLE";

      mvStart.zoomLevel               = 5;
      mvStart.isZoomLocked            = true;
      mvStart._editPointIndex         = -1;
      mvStart._editPointIndexPosition = -1;
      mvStart._editPathItem           = this;
      mvStart.allowDragNDrop          = false;
      mvStart.allowSelection          = false;
      this._psStart                   = mvStart;

      this._boardSurface.addItem(mvStart);
      this._psStart.reloadUI(this._boardSurface._spMainCtn);
    }

    if (!this._psEnd) {
      const mvEnd = new MultiViewItem({paths: [circlePath2]});
      mvEnd._type                   = "CIRCLE";
      mvEnd.zoomLevel               = this.zoomLevel;
      mvEnd._editPointIndex         = -1;
      mvEnd._editPointIndexPosition = -1;
      mvEnd._editPathItem           = this;
      mvEnd.allowDragNDrop          = false;
      mvEnd.allowSelection          = false;
      this._psEnd                   = mvEnd;
      this._boardSurface.addItem(mvEnd);
      this._psEnd.reloadUI(this._boardSurface._spMainCtn);
    }
  }

  async setEditMode(value: boolean, withConfirm = false) {
    if (value !== this._isEditMode && value === true) this.backupAngle = this.angle;
    this._isEditMode = value;
    if (value) {
      this._editSaveState === null && (this._editSaveState = this.saveState());
      this.sealOriginalPath();
      this._shapeHasChanged = true;
      this.angle = 0;
      this._editPoints.forEach(_ => _.disposeUI());
      this._editPoints = [];
      const points = this.getCurveDefinition(this.workingPaths[0]); // check the index of the point
      const circlePath = new paper.Path.Circle(new paper.Point(0,0), 1.5).pathData;
      const circlePath2 = new paper.Path.Circle(new paper.Point(0,0), 1.5).pathData;

      points.forEach((point, idx) => {
        this._addPositionPoint(points, idx, circlePath2);
      });

      points.forEach((point, idx) => {
        this._addControlPoint(points, idx, circlePath, 2);
        this._addControlPoint(points, idx, circlePath, 3);
      });

      this.checkMvItems();
      this.reloadUI(this._boardSurface._spMainCtn);

      return;
    } else {
      if (withConfirm) {
        const answer = await ppConfirm("Save Changes", "Do you want to save the changes?");
        if (answer !== "ok") {
          this.fullRestoreState(this._editSaveState);
          this._editSaveState = null;
          this.applyChanges();
        }
      }
      if (this.backupAngle !== this._angle) {
        this.angle = this.backupAngle;
      }
      this._editPoints.forEach(_ => _.disposeUI());
      this._editPoints = [];
      this._psStart._mainCtn.visible = false;
      this._psEnd._mainCtn.visible = false;
      this.reNormalize();
      this.updateChanges();
      this.reloadUI(this._boardSurface._spMainCtn);
    }
  }

  applyChanges(noRotate = false, nonested = false) {
    this.updateChanges(noRotate, nonested);
  }

  constructor({ paths, withReduction = true, withSimplify = true, widthInMm = 1, heightInMm = 1, widthInVu = 1, heightInVu = 1 }:
    {
      paths          : string[];  // Paths
      withReduction ?: boolean;   // Apply reduction to the paths
      withSimplify  ?: boolean;   // Apply simplify to the paths
      widthInMm     ?: number;    // width in mm
      heightInMm    ?: number;    // height in mm
      widthInVu     ?: number;    // width in vector units
      heightInVu    ?: number;
    }) {
    this.guid = guid();
    this.originalPaths = paths;          // Original paths
    this.withReduction = withReduction;  // Save reduction parameter
    this.withSimlify   = withSimplify;   // Save simplify parameter
    this.widthInMm     = widthInMm;      // Save width in mm
    this.heightInMm    = heightInMm;     // Save height in mm
    this.widthInVu     = widthInVu;      // Save width in vu
    this.heightInVu    = heightInVu;     // Save height

    // simplify the paths
    if (withSimplify) {
      for (let i = 0; i < this.originalPaths.length; i++) {
        this.originalPaths[i] = svgPath.from(this.originalPaths[i])/*.unarc().unshort()*/.abs().round(3).toString();
      }
    }



    this.normalize();
  }

  getCurvedPath(path: string) {
    const pPath = new paper.Path(svgPath.from(path).round(3).toString());
    pPath.clockwise = true;
    return `M${pPath.curves[0].values[0]} ${pPath.curves[0].values[1]}` + pPath.curves.map(_ => _.values).map(_ => `C${_[2]} ${_[3]} ${_[4]} ${_[5]} ${_[6]} ${_[7]}`).join("")
  }

  getPolygonDefinition(path: string, precision = true) {
    const pPath = new paper.Path(path);
    const points = [] as { x: number, y: number }[];

    pPath.curves.forEach(curve => {
      points.push(curve.getPointAtTime(0));
      precision && points.push(curve.getPointAtTime(0.5));
      points.push(curve.getPointAtTime(1));
    });

    points.push(pPath.lastSegment.point);
    return points;
  }

  getConvexHull() {
    return concaveman(this.getPolygonDefinition(this.normalizedPaths[0]).map(_ => [_.x, _.y]), Infinity).map(_ => ({ x: _[0], y: _[1] }));
  }

  getWorkingConvexHull() {
    return concaveman(this.getPolygonDefinition(this.workingPaths[0]).map(_ => [_.x, _.y]), Infinity).map(_ => ({ x: _[0], y: _[1] }));
  }

  getCurveDefinition(path: string) {
    const pPath = new paper.Path(svgPath.from(path).round(3).toString());
    pPath.clockwise = true;
    return pPath.curves.map(_ => _.values).map(_ => ({
      start    : { x: _[0], y: _[1] },
      end      : { x: _[6], y: _[7] },
      control1 : { x: _[2], y: _[3] },
      control2 : { x: _[4], y: _[5] }
    })) as CurveDefinition[];
  }

  getCurveFromPaper(path: paper.Path) {
    const pPath = path;
    pPath.clockwise = true;
    return pPath.curves.map(_ => _.values).map(_ => ({
      start    : { x: _[0], y: _[1] },
      end      : { x: _[6], y: _[7] },
      control1 : { x: _[2], y: _[3] },
      control2 : { x: _[4], y: _[5] }
    })) as CurveDefinition[];
  }

  reNormalize() {
    if (this._isEditMode) {
      this.normalizedPaths = this.normalizedPaths.map((_path, idx) => {
        const path = new paper.Path(_path);
        path.clockwise = true;

        if (idx === 0) {
          const bounds = path.bounds;
          const center = bounds.center;

          this.originalShift    = new paper.Point(-center.x, -center.y);
          this.originalPosition = new paper.Point(center.x, center.y);
          path.translate(this.originalShift);
        }

        return path.pathData;
      });
    }
  }

  /**
   * Normalize the paths
   */
  normalize() {
    // Normalize will scale the united path with the ratio from the width and height in vu to the width and height in mm
    const normalizeRatioX = this.widthInMm / this.widthInVu;
    const normalizeRatioY = this.heightInMm / this.heightInVu;
    const needScale       = normalizeRatioX !== 1 || normalizeRatioY !== 1;

    if (needScale) {
      this.widthInVu  = this.widthInMm;
      this.heightInVu = this.heightInMm;
    }

    this.normalizedPaths = this.originalPaths.map((_path, idx) => {
      const path = new paper.Path(_path);
      path.clockwise = true;
      needScale && path.scale(normalizeRatioX, normalizeRatioY);

      if (idx === 0) {
        const bounds = path.bounds;
        const center = bounds.center;
        this.originalShift    = new paper.Point(-center.x, -center.y);
        this.originalPosition = new paper.Point(center.x, center.y);
      }

      path.translate(this.originalShift);
      return path.pathData;
    });
    this.updateChanges();
  }

  updateChanges(noRotate = false, noNested = false) {
    let mainPaper = null as paper.Path;
    this.workingPapers = this.normalizedPaths.map((_, idx) => {
      idx === 0 && (mainPaper = new paper.Path(_));
      const pp = new paper.Path(_);
      pp.clockwise = true;
      if (this.angle !== 0) {
        !noRotate && pp.rotate(this.angle, mainPaper.bounds.center);

        if (idx === 0) {
          if (this.originalPaper) {
            this.originalPaper = this.originalPaperRot0.clone();
            this.originalPaper?.rotate(this.angle, mainPaper.bounds.center);
          }
        }
      }
      return pp;
    });
    this.workingPaths = this.workingPapers.map(_ => _.pathData);
    this.mainPathPaper = this.workingPapers[0];
  }


  disposeUI() {
    this._boardSurface?._spMainCtn?.removeChild(this._mainCtn);
    this._boardSurface?.removeItem(this);
    this._boardSurface?._spMainCtn?.removeChild(this._psLine);
    this.overLapShape && this._boardSurface?._spMainCtn?.removeChild(this.overLapShape);
    this.overLapShape.destroy();
    this.overLapShape = null;
  }

  reloadUI(stage: PIXI.Container) {
    if (this.disposed) {
      this._mainCtn = new PIXI.Container();
      stage.addChild(this._mainCtn);
      this._mainGraphics = new PIXI.Graphics();
      this._mainCtn.addChild(this._mainGraphics);
      this.disposed = false;
      this.selectedShape = new PIXI.Graphics();
      this._mainCtn.addChild(this.selectedShape);
    } else {
      this._mainGraphics.clear();
    }

    this._drawItem();
    this._drawSelected();
    this._drawOverLap();

    if (this._hasZoomChanged) {
      this._hasZoomChanged = false;
      this._isEditMode && this.setEditMode(this._isEditMode);
    }
  }

  _drawItem() {
    this._mainGraphics.clear();
    // Based on the working paths only
    let fillColor = this._carColor > -1 ? this._carColor : 0x000000;
    let lineColor = 0x000000;
    let fillAlpha = 0.2;
    let lineAlpha = 0.5;

    if (this._editPointIndexPosition === 1) {
      fillColor = 0x000000;
      lineColor = 0x000000;
      fillAlpha = 0.8;
      lineAlpha = 1;
    } else if (this._editPointIndexPosition === 2) {
      fillColor = 0x094e6a;
      lineColor = 0x094e6a;
    } else if (this._editPointIndexPosition === 3) {
      fillColor = 0x094e6a;
      lineColor = 0x094e6a;
    }

    this.getMainPapers().forEach((path, idx) => {
      const curves = this.getCurveFromPaper((idx === 0 && this.outwardedPath && !this.outwardDoubleCut) ? this.outwardedPaper : path);
      this._mainGraphics.moveTo(this.zVal(curves[0].start.x), this.zVal(curves[0].start.y));
      this._mainGraphics.beginFill(fillColor, fillAlpha);
      this._mainGraphics.lineStyle(1, lineColor, lineAlpha);

      curves.forEach((curve, idx) => {
        this.cubicBezierCurveTo(this._mainGraphics, curve);
      });
      this._mainGraphics.closePath();
      this._mainGraphics.endFill();
    });

    // OUtwarded path
    if (this.outwardedPath) {
      if (this.outwardDoubleCut) {
        const curves = this.getCurveFromPaper(this.outwardedPaper);
        this._mainGraphics.moveTo(this.zVal(curves[0].start.x), this.zVal(curves[0].start.y));
        this._mainGraphics.beginFill(fillColor, fillAlpha);
        this._mainGraphics.lineStyle(1, lineColor, lineAlpha);

        curves.forEach((curve, idx) => {
          this.cubicBezierCurveTo(this._mainGraphics, curve);
        });
        this._mainGraphics.closePath();
        this._mainGraphics.endFill();
      } else {

      }
    }



    if (this._editPointIndexPosition === 1 && this.wasDragEnded) {
      const pt2 = this._editPathItem._editPoints.filter(_ => _._editPointIndex === this._editPointIndex && _._editPointIndexPosition === 2)[0];
      if (!pt2) return;
      pt2.dragEnd();

      let pt3 = this._editPathItem._editPoints.filter(_ => _._editPointIndex === this._editPointIndex - 1 && _._editPointIndexPosition === 3)[0];
      if (!pt3) {
        pt3 = this._editPathItem._editPoints.filter(_ => _._editPointIndex === this._editPathItem._editPoints.length - 1 && _._editPointIndexPosition === 3)[0];
      }
      pt3.dragEnd();
    }

    if (this._editPointIndexPosition === 2) {
      // gets the point of same index and position 1
      const pt = this._editPathItem._editPoints.filter(_ => _._editPointIndex === this._editPointIndex && _._editPointIndexPosition === 1)[0];
      if (!pt) return;

      this._mainGraphics.beginFill(0x094e6a, lineAlpha);
      this._mainGraphics.lineStyle(1, 0x094e6a, lineAlpha);
      this._mainGraphics.moveTo(0,0);
      this._mainGraphics.lineTo(pt.x - this.x, pt.y - this. y);
      if (!this.wasDragEnded) {
        this.wasDragEnded = true;
        setTimeout(() => {
          this.reloadUI(this._boardSurface._spMainCtn);
        }, 100);
      }
    }

    if (this._editPointIndexPosition === 3) {
      // gets the point of same index and position 1
      let pt = this._editPathItem._editPoints.filter(_ => _._editPointIndex === this._editPointIndex + 1 && _._editPointIndexPosition === 1)[0];
      if (!pt) {
        pt = this._editPathItem._editPoints.filter(_ => _._editPointIndex === 0 && _._editPointIndexPosition === 1)[0];
      }

      this._mainGraphics.beginFill(0x094e6a, lineAlpha);
      this._mainGraphics.lineStyle(1, 0x094e6a, lineAlpha);
      this._mainGraphics.moveTo(0,0);
      this._mainGraphics.lineTo(pt.x - this.x, pt.y - this. y);

      if (!this.wasDragEnded) {
        this.wasDragEnded = true;
        setTimeout(() => {
          this.reloadUI(this._boardSurface._spMainCtn);
        }, 100);
      }
    }
  }

  _drawSelected() {
    console.log("Draw Selected", this._isSelected);
    if (!this.selectedShape) {
      this.selectedShape = new PIXI.Graphics();
      this._mainCtn.addChild(this.selectedShape);
    }
    let fillColor = ITEM_COLOR_WHEN_SELECTED;
    let lineColor = ITEM_COLOR_WHEN_SELECTED;
    let fillAlpha = ITEM_FILL_ALPHA_WHEN_SELECTED;
    let lineAlpha = ITEM_LINE_ALPHA_WHEN_SELECTED;

    this.selectedShape.clear();
    const curves = this.getCurveFromPaper(this.workingPapers[0]);
    this.selectedShape.moveTo(this.zVal(curves[0].start.x), this.zVal(curves[0].start.y));
    this.selectedShape.beginFill(fillColor, fillAlpha);
    this.selectedShape.lineStyle(1, lineColor, lineAlpha);

    curves.forEach(curve => {
      this.cubicBezierCurveTo(this.selectedShape, curve);
    });
    this.selectedShape.closePath();
    this.selectedShape.endFill();
    this.selectedShape.visible = this._isSelected;
  }

  _drawOverLap() {
    if (!this.overLapShape) {
      this.overLapShape = new PIXI.Graphics();
      this._mainCtn.addChild(this.overLapShape);
    }
    let fillColor = ITEM_COLOR_WHEN_OVERLAPED;
    let lineColor = ITEM_COLOR_WHEN_OVERLAPED;
    let fillAlpha = ITEM_FILL_ALPHA_WHEN_OVERLAPED;
    let lineAlpha = ITEM_LINE_ALPHA_WHEN_OVERLAPED;

    this.overLapShape.clear();
    const curves = this.getCurveFromPaper(this.workingPapers[0]);
    this.overLapShape.moveTo(this.zVal(curves[0].start.x), this.zVal(curves[0].start.y));
    this.overLapShape.beginFill(fillColor, fillAlpha);
    this.overLapShape.lineStyle(1, lineColor, lineAlpha);

    curves.forEach(curve => {
      this.cubicBezierCurveTo(this.overLapShape, curve);
    });
    this.overLapShape.closePath();
    this.overLapShape.endFill();
    this.overLapShape.visible = this.isCollided;
  }

  _reloadUI(stage: PIXI.Container) {
    if (this.disposed) {
      this._mainCtn = new PIXI.Container();
      stage.addChild(this._mainCtn);
      this._mainGraphics = new PIXI.Graphics();
      this._mainCtn.addChild(this._mainGraphics);
      this.disposed = false;
    } else {
      this._mainGraphics.clear();
    }

    let fillColor = this._isSelected ? 0x094e6a : 0x000000;
    let lineColor = this._isSelected ? 0x094e6a : 0x000000;
    let fillAlpha = 0.2;
    let lineAlpha = 0.5;

    if (this._editPointIndexPosition === 1) {
      fillColor = 0x000000;
      lineColor = 0x000000;
      fillAlpha = 0.8;
      lineAlpha = 1;
    }

    if (this._editPointIndexPosition === 2) {
      fillColor = 0x094e6a;
      lineColor = 0x094e6a;
    }

    if (this._editPointIndexPosition === 3) {
      fillColor = 0x094e6a;
      lineColor = 0x094e6a;
    }

    this._mainGraphics.beginFill(fillColor, fillAlpha);
    this._mainGraphics.lineStyle(1, lineColor, lineAlpha);

    const curves = this.getCurveDefinition(this.mainPath);
    this.mainPathPaper = new paper.Path(this.mainPath);
    if (this._editPointIndex > -1) {
      this._mainGraphics.moveTo((curves[0].start.x), (curves[0].start.y));
    } else {
      this._mainGraphics.moveTo(this.zVal(curves[0].start.x), this.zVal(curves[0].start.y));
    }

    curves.forEach(curve => {
      this.cubicBezierCurveTo(this._mainGraphics, curve);
    });

    // Draw the other ones
    for(let i=1; i<this.workingPaths.length; i++) {
      const path = new paper.Path(this.workingPaths[i]);
      path.rotate(this.angle, path.bounds.center);
      path.clockwise = true;
      const curves = this.getCurveDefinition(path.pathData);
      if (this._editPointIndex > -1) {
        this._mainGraphics.moveTo((curves[0].start.x), (curves[0].start.y));
      } else {
        this._mainGraphics.moveTo(this.zVal(curves[0].start.x), this.zVal(curves[0].start.y));
      }

      curves.forEach(curve => {
        this.cubicBezierCurveTo(this._mainGraphics, curve);
      })
    }

    if (this._editPointIndexPosition === 2) {
      const _curves = this._editPathItem.getCurveDefinition(this._editPathItem.mainPath);
      this._mainGraphics.beginFill(0x094e6a, lineAlpha);
      this._mainGraphics.lineStyle(1, 0x094e6a, lineAlpha);
      this._mainGraphics.moveTo(0,0);
      this._mainGraphics.lineTo(
        this.zVal(_curves[this._editPointIndex].start.x) - this.x + this._editPathItem.x,
        this.zVal(_curves[this._editPointIndex].start.y) - this.y + this._editPathItem.y
      );
      this._mainGraphics.endFill();
    } else if (this._editPointIndexPosition === 3) {
      try {
       const _curves = this._editPathItem.getCurveDefinition(this._editPathItem.mainPath);
        this._mainGraphics.beginFill(0x094e6a, lineAlpha);
        this._mainGraphics.lineStyle(1, [0x094e6a, 0x094e6a][Math.random()], 1);
        this._mainGraphics.moveTo(0,0);
        this._mainGraphics.lineTo(
          this.zVal(_curves[this._editPointIndex].end.x) - this.x + this._editPathItem.x,
          this.zVal(_curves[this._editPointIndex].end.y) - this.y + this._editPathItem.y
        );
        this._mainGraphics.endFill();
        this._mainGraphics.beginFill(0x094e6a, lineAlpha);
      }catch (ex){ console.log("Error", ex); }
    } else {
      this._mainGraphics.endFill();
    }

    function getPerpendicularDistance(point: Point, start: Point, end: Point): number {
      const area = Math.abs((end.x - start.x) * (start.y - point.y) - (start.x - point.x) * (end.y - start.y));
      const bottom = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      return area / bottom;
    }

    function simplifyPolygon(points: Point[], tolerance: number): Point[] {
      if (points.length < 3) {
        return points;
      }

      const start = points[0];
      const end = points[points.length - 1];

      let maxDistance = 0;
      let index = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const distance = getPerpendicularDistance(points[i], start, end);
        if (distance > maxDistance) {
          index = i;
          maxDistance = distance;
        }
      }

      if (maxDistance > tolerance) {
        const leftPoints = simplifyPolygon(points.slice(0, index + 1), tolerance);
        const rightPoints = simplifyPolygon(points.slice(index), tolerance);

        return [...leftPoints.slice(0, -1), ...rightPoints];
      } else {
        return [start, end];
      }
    }

    // draw the polygon
    const polygon = new PIXI.Graphics();
    polygon.name = "polygon";

    // draw the bounding box
    const minX = Math.min(...this.polygon.map(_ => _.x));
    const maxX = Math.max(...this.polygon.map(_ => _.x));
    const minY = Math.min(...this.polygon.map(_ => _.y));
    const maxY = Math.max(...this.polygon.map(_ => _.y));

    const bounds = new PIXI.Graphics();
    bounds.beginFill(0xff0000, 0.2);
    bounds.lineStyle(1, 0xff0000, 0.5);
    bounds.drawRect(this.zVal(minX), this.zVal(minY), this.zVal(maxX - minX), this.zVal(maxY - minY));
    bounds.endFill();

    // draw tgeh center of the bb
    const center = new PIXI.Graphics();
    center.beginFill(0x0000ff, 0.2);
    center.lineStyle(1, 0x0000ff, 0.5);
    center.drawCircle(this.zVal((minX + maxX) / 2), this.zVal((minY + maxY) / 2), 5);
    center.endFill();

    this._mainCtn.x = this.x;
    this._mainCtn.y = this.y;
    this.applyChanges();
  }

  /* Added By Bilel to fix the split */
splitPath(
  originalPath: paper.Path,
  point1: paper.PointLike,
  point2: paper.PointLike
): [paper.Path | null, paper.Path | null] {

  const p1 = new paper.Point(point1);
  const p2 = new paper.Point(point2);


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

  firstHalf.closePath();
  secondHalf.closePath();

  // Clean up temporary polygons
  polygon1.remove();
  polygon2.remove();

  // Return the resulting paths
  return [firstHalf as paper.Path, secondHalf as paper.Path];
}


  ////////////////////////////////////////////////////////////////////
  splitAllPaths(point1: paper.Point, point2: paper.Point): void {
    const newWorkingPapers: paper.Path[] = [];
    const secondHalvesPaths: string[] = [];
    this.workingPapers.forEach((path, index) => {
      if (!path) return;


      const [firstHalf, secondHalf] = this.splitPath(path, point1, point2);


      if (firstHalf.pathData ) {

        newWorkingPapers.push(firstHalf);
      }


      if (secondHalf.pathData) {

        secondHalvesPaths.push(secondHalf.pathData);
      }
    });


      /////////////////////////////////////////////////////////////////////////
      if (secondHalvesPaths.length > 0) {
        const newItem = new MultiViewItem({
          paths: secondHalvesPaths,
          widthInMm: this.widthInMm,
          heightInMm: this.heightInMm,
          widthInVu: this.widthInVu,
          heightInVu: this.heightInVu,
        });


        this._boardSurface.addItem(newItem);
        newItem.reloadUI(this._boardSurface._spMainCtn);

       /* this part is causing the freezing of the board
       // newItem.x = this.x;
          //newItem.y = this.y;
          */
          //boardManager.selectedBoard.newBoard.mvs.push(newItem);
         newItem._carColor = this._carColor;
         newItem.isSplitMode = false;
         newItem.isSelected = false ;
          newItem.applyChanges();
          newItem.reloadUI(this._boardSurface._spMainCtn);

          }




      /////////////////////////////////////////////////////////////////////////



    // Update the working paths
    this.workingPapers = newWorkingPapers;
    this.workingPaths = newWorkingPapers.map(path => path.pathData);
    this.normalizedPaths = newWorkingPapers.map((path) => path.pathData);
    this.isSplitMode = false;
    this.isSelected = false;
    // Reload the UI to reflect changes
    this.reloadUI(this._boardSurface._spMainCtn);
  }

  removeSubPatterns() {
    this.workingPapers = this.workingPapers.slice(0, 1)
    this.workingPaths = this.workingPaths.slice(0, 1)
    this.normalizedPaths = this.normalizedPaths.slice(0, 1)
    this.originalPaths = this.originalPaths.slice(0, 1)

    this.reloadUI(this._boardSurface._spMainCtn)
  }

  private zVal(val: number) {
    return val * this.zoomLevel;
  }

  rawVal(val: number) {
    return val / this.zoomLevel;
  }

  private cubicBezierCurveTo(graphic: PIXI.Graphics, curve: CurveDefinition) {
    graphic.bezierCurveTo(
      this.zVal(curve.control1.x), // Control point 1
      this.zVal(curve.control1.y),

      this.zVal(curve.control2.x), // Control point 2
      this.zVal(curve.control2.y),

      this.zVal(curve.end.x), // End point
      this.zVal(curve.end.y));
  }


}



/* TODO:
  - render : Should render with Pixi the united path
  - getContainer : Should return the container with the united path
  - ShowEditPoints : Should show the edit points of the united path, one color for teh point, one for the control points
  - segments should be selectable by mouse
  - Floating points should follow the path according to teh nearest point on the path from the mouse position
  - In edit mode we sitch the path to an absolute path
  - Can move a point with the mouse and reflect the change on the path
  - Can update a control point with the mouse and reflect the change on the path
  - Can split a path from 2 points
  - can divide one segment in 2 segments at mouse position to nearest point
*/