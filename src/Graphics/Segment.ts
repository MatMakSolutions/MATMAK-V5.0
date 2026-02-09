import { Polygon } from "pixi.js";
import { TSVGCommand } from "../VectorPath/Commands/Abstract/SvgCommand";
import { DisplayObject } from "./DisplayObject";
import { CCommand } from "../VectorPath/Commands/CCommand";
import { LCommand } from "../VectorPath/Commands/LCommand";
import { IPoint } from "../VectorPath/Utils/IPoint";

export class Segment extends DisplayObject {
  private _strokeColor          !: number;
  private _strokeHoverColor     !: number;
  private _strokeSelectedColor  !: number;
  private _strokeWidth          !: number;
  private _fillColor            !: number;
  private _strokeAlpha          !: number;
  private _fillAlpha            !: number;
  private _previousSegment      ?: Segment;
  private _nextSegment          ?: Segment;
  private _isSelected           : boolean = false;
  private _isHovered            : boolean = false;
  private _strokeNormalColor    !: number;

  get previousSegment(): Segment | undefined {
    return this._previousSegment;
  }

  set previousSegment(value: Segment) {
    this._previousSegment = value;
  }

  get nextSegment(): Segment | undefined {
    return this._nextSegment;
  }

  set nextSegment(value: Segment) {
    this._nextSegment = value;
  }

  set strokeColor(value: number) {
    this._strokeColor = value;
    this.setStrokeStyle({color: this._strokeColor});
    this.update();
  }

  set strokeNormalColor(value: number) {
    this._strokeNormalColor = value;
  }

  get isHovered() {
    return this._isHovered;
  }

  set isHovered(value: boolean) {
    this._isHovered = value;
    this.strokeColor = value
      ? this._strokeHoverColor
      : this.isSelected
        ? this._strokeSelectedColor
        : this._strokeNormalColor;
  }


  get isSelected() {
    return this._isSelected;
  }

  set isSelected(value: boolean) {
    this._isSelected = value;
    this.strokeColor = value ? this._strokeSelectedColor : this._strokeNormalColor;
  }

  set strokeSelectedColor(value: number) {
    this._strokeSelectedColor = value;
  }

  set strokeHoverColor(value: number) {
    this._strokeHoverColor = value;
  }

  get zoomFactor() {
    return this._zoomFactor;
  }

  set zoomFactor(value: number) {
    this._zoomFactor = value;
    this.update();
  }

  set strokeWidth(value: number) {
    this._strokeWidth = value;
    this.setStrokeStyle({
      width: this._strokeWidth,
      color: this._strokeColor,
      alpha: this._strokeAlpha
    });
    this.update();
  }

  set fillColor(value: number) {
    this._fillColor = value;
    this.setFillStyle({
      color: this._fillColor,
      alpha: this._fillAlpha
    });
    this.update();
  }

  set fillAlpha(value: number) {
    this._fillAlpha = value;
    this.update();
  }

  set strokeAlpha(value: number) {
    this._strokeAlpha = value;
    this.update();
  }

  get strokeColor() {
    return this._strokeColor;
  }

  get strokeWidth() {
    return this._strokeWidth;
  }

  get fillColor() {
    return this._fillColor;
  }

  get fillAlpha() {
    return this._fillAlpha;
  }

  get strokeAlpha() {
    return this._strokeAlpha;
  }

  constructor(public command?: TSVGCommand) {
    super();
    this._initialized = false;
    this.fillAlpha    = 0.5;
    this.strokeAlpha  = 0.5;
    this.strokeColor  = 0x132266;
    this.strokeWidth  = 1;
    this.fillColor    = 0x58A4BF;
    this._initialized = true;
  }



  override onEventOver(): void {
  }

  override update() {
    if (!this._initialized) return;

    // Clear the segment
    this.clear();

    if (this.command) {
      this.moveTo(this.z(this.command.startingPoint.x) , this.z(this.command.startingPoint.y));
      switch (this.command.type) {
        case "L":
          this.lineTo(this.z(this.command.endingPoint.x), this.z(this.command.endingPoint.y));
          break;
        case "C":
          this.bezierCurveTo(
            this.z(this.command.x1),
            this.z(this.command.y1),
            this.z(this.command.x2),
            this.z(this.command.y2),
            this.z(this.command.endingPoint.x),
            this.z(this.command.endingPoint.y)
          );
      }
      this.stroke();
    }
  }

  updateStyle(style: { color?: number; width?: number; alpha?: number }): void {
    if (style.color !== undefined) {
      this.strokeColor = style.color;
      this._strokeNormalColor = style.color;
    }
    if (style.width !== undefined) {
      this.strokeWidth = style.width;
    }
    if (style.alpha !== undefined) {
      this.strokeAlpha = style.alpha;
    }
  }

  override dispose(): void {
    this.command = undefined;
    this._previousSegment = undefined;
    this._nextSegment = undefined;
    super.dispose();
  }
}