import * as PIXI from "pixi.js";
import { ClosePath, CurveTo, EllipticalArcTo, HorizontalLineTo, LineTo, MoveTo, QuadraticBezierCurveTo, RawVector, VerticalLineTo } from "../RawVector/RawVector";
import { GraphicDrawer } from "./GraphicDrawer";
import { PatternFile } from "src/uof/SearchType";

export const globalVecs = [] as VectorDisplay[];
export const globalSize = { width: 0, height: 0 };

export class VectorDisplay {
  private _mainContainer    : PIXI.Container;
  private _mainGraphics!    : PIXI.Graphics;
  private _selectedGraphics!    : PIXI.Graphics;
  private _segmentGraphics  : PIXI.Graphics[] = [];
  _x                : number = 0;
  _y                : number = 0;
  private _isDisposed       : boolean = false;
  public lineStyle          : number = 3;
  public lineColor          : number = 0x00FF00;
  _isSelected                : boolean = false;
  _isDraggable               : boolean = false;
  _isDragging                : boolean = false;
  _previousX                 : number = null;
  _previousY                 : number = null;
  _isHovered                 : boolean = false;
  _rawPattern:PatternFile;

  get isSelected(): boolean {
    return this._isSelected;
  }

  displayBbox() {
    const bbox = this.getContainer().getBounds();
    const graphics = new PIXI.Graphics();
    graphics.lineStyle(1, 0xFF0000, 1);
    graphics.drawRect(bbox.x, bbox.y, bbox.width, bbox.height);
    this._mainContainer.addChild(graphics);

    const g2 = new PIXI.Graphics();
    g2.lineStyle(1, 0x00FF00, 1);
    g2.drawRect(0, 0, this.getContainer().width, this.getContainer().height);
    this._mainContainer.addChild(g2);
  }

  set isSelected(value: boolean) {
    this._isSelected = value;
    if (value) {
      this._mainGraphics.tint = 0x0000FF;
    } else {
      this._mainGraphics.tint = 0xFFFFFF;
    }
  }

  constructor(public rawVector: RawVector) {
    this._mainContainer = new PIXI.Container();
    rawVector.onDispose = () => this.dispose();
    rawVector.onUpdate  = () => this.rebuild(true);

    this._x = rawVector.x;
    this._y = rawVector.y;

    this.getContainer().on('pointerover', (event) => {
      this._isHovered = true;
    });

    this.getContainer().on('pointerout', (event) => {
      this._isHovered = false;
    });

    this.getContainer().on('pointermove', (event) => {
      if (!this._isDraggable) return;

      const currentX = event.data.global.x;
      const currentY = event.data.global.y;

      if (this._previousX === null || this._previousY === null) {
        this._previousX = currentX;
        this._previousY = currentY;
        return;
      }


      if (this._isDragging) {
        const deltaX = currentX - this._previousX;
        const deltaY = currentY - this._previousY;

        this.getContainer().x += deltaX;
        this.getContainer().y += deltaY;

        this._previousX = currentX;
        this._previousY = currentY;

        this.rebuild(true);
      }
    });
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }


  getContainer() {
    return this._mainContainer;
  }


  rebuild(asUpdate: boolean = false, color: number = 0x000000, stroke: number = 1, fillAlpha: number = 0.5) {
    // Reset the graphics
    if (!this._mainGraphics) {
      this._mainGraphics = new PIXI.Graphics();
      this._mainContainer.addChild(this._mainGraphics);
      this._selectedGraphics = new PIXI.Graphics();
      this._mainContainer.addChild(this._selectedGraphics);
    }

    this._mainGraphics.clear();
    this._selectedGraphics.clear();
    this._mainGraphics.moveTo(0, 0);
    this._selectedGraphics.moveTo(0, 0);
    this._segmentGraphics.forEach(g => {
      g.destroy();
      g.removeFromParent();
    });

    this._mainGraphics.setStrokeStyle({width: stroke, color, alpha: 0.5});
    this._mainGraphics.setFillStyle({color: 0xa1a1a1, alpha: fillAlpha});

    // Draw the path
    this.rawVector.paths.forEach((path) => {
      if (path instanceof MoveTo)
        GraphicDrawer.moveTo(this._mainGraphics, this.rawVector, path);
      if (path instanceof LineTo)
        GraphicDrawer.lineTo(this._mainGraphics, this.rawVector, path);
      if (path instanceof HorizontalLineTo)
        GraphicDrawer.horizontalLineTo(this._mainGraphics, this.rawVector, path);
      if (path instanceof VerticalLineTo)
        GraphicDrawer.verticalLineTo(this._mainGraphics, this.rawVector, path);
      if (path instanceof CurveTo)
        GraphicDrawer.cubicBezierCurveTo(this._mainGraphics, this.rawVector, path);
      if (path instanceof QuadraticBezierCurveTo)
        GraphicDrawer.quadraticBezierCurveTo(this._mainGraphics, this.rawVector, path);
      if (path instanceof EllipticalArcTo)
        GraphicDrawer.arcTo(this._mainGraphics, this.rawVector, path);
      if (path instanceof ClosePath)
        GraphicDrawer.closePath(this._mainGraphics, this.rawVector, path);
    });
    this._mainGraphics.stroke();
    this._mainGraphics.fill();
  }

  render() {
  };

  /**
   * Dispose of all graphics and remove from parent
   */
  dispose() {
    if (!this._mainGraphics) return;

    this._segmentGraphics.forEach(g => { g.destroy(); g.removeFromParent(); } );
    this._mainGraphics.destroy();
    this._mainGraphics.removeFromParent();
    this._mainContainer.destroy();
    this._mainContainer.removeFromParent();
    this._isDisposed = true;
  }
}