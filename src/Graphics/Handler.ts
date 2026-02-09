import { Circle, Graphics } from "pixi.js";
import { DisplayObject } from "./DisplayObject";
import { IPoint } from "../VectorPath/Utils/IPoint";

export class Handler extends DisplayObject {
  private anchorLine: Graphics;
  public _color: number;
  public disableAnchorLine: boolean = false;

  constructor(private radius = 4, color = 0xff0000, private tolerance = 3) {
    super();

    this._color = color;
    this.initCircle(this.radius, this._color);
    this.setInteractivity(true);
    this.anchorLine = new Graphics();
    this.addChild(this.anchorLine);
  }

  getAnchor: () => IPoint = () => ({x: 0, y: 0});


  private initCircle(radius: number, color: number) {
    this.clear();
    this.setFillStyle({
      color: color,
      alpha: 0.5
    });
    this.circle(0, 0, radius);
    this.fill();

    this.hitArea = new Circle(0, 0, radius + this.tolerance);
  }
  
  public setColor(color: number) {
    this._color = color;
    this.update();
  }

  override onEventOver(): void {
  }

  override onEventDrag(eventData: { x: number; y: number }) {
  }

  override update(): void {
    this.initCircle(this.radius, this._color);
    this.anchorLine.clear();
    
    // Skip anchor line if disabled or during multi-selection
    if (this.disableAnchorLine) {
      return;
    }
    
    const anchor = this.getAnchor();
    // Only draw anchor line if anchor is not at origin (0,0)
    if (anchor.x !== 0 || anchor.y !== 0) {
      this.anchorLine.setStrokeStyle({ width: 1, color: this._color, alpha: 0.5 });
      this.anchorLine.moveTo(this.z(anchor.x) - this.x, this.z(anchor.y) - this.y);
      this.anchorLine.lineTo(0, 0);
      this.anchorLine.stroke();
    }
  }
}
