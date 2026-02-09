import { Rectangle, Text } from "pixi.js";
import { DisplayObject } from "./DisplayObject";


export class CircleMenuItem extends DisplayObject {
  txtItem!: Text;
  text: string = "";
  color: number = 0xfbfbfb;
  hoverColor: number = 0xececec;
  constructor(text: string, x: number, y: number) {
    super();
    this.x       = x;
    this.y       = y;
    this.text    = text;
    this.setInteractivity(true);
  }

  update(): void {

    this.clear();
    this.hitArea = new Rectangle(this.x, this.y, 250, 50);
    this.txtItem?.destroy();
    this.txtItem = new Text(this.text, { fill: 0x000000 });
    this.rect(this.x, this.y, 250, 50);
    this.fill({ color: this.color, alpha: 1 });
    this.stroke({ color: this.color, alpha: 1 });
    this.addChild(this.txtItem);
    this.txtItem.position.set(this.x + 10, this.y + 10);
  }

  dispose(): void {
    this.txtItem?.removeFromParent();
    this.txtItem?.destroy();
    this.txtItem = null as any;
    this.text    = "";
    this.removeFromParent();
    this.destroy();
    ////////////////////////////
 
 
    super.dispose(); 
    ////////////////////////////
  }

  onEventOver(): void {
  
    this.color = this.hoverColor;
    this.update();
    this._sf._app.canvas.style.cursor = 'pointer';
  }

  onEventOut(): void {
    if (this.destroyed) return;
    this.color = 0xfbfbfb;
    this.update();
    // Only reset the cursor if not in point selection mode.
    if (!this._sf.activatePointSelection) {
      this._sf._app.canvas.style.cursor = 'default';
    }
  }

}