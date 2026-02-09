import * as PIXI from 'pixi.js';

export class SelectedBox {
  private stage: PIXI.Container;
  private graphics: PIXI.Graphics;

  constructor(stage: PIXI.Container) {
      this.stage = stage;
      this.graphics = new PIXI.Graphics();
      this.stage.addChild(this.graphics);
  }

  /**
   * Draws a selection box with:
   * - A rectangular outline (transparent fill)
   * - 8 circular handles (corners + midpoints)
   * - 1 rotate handle above the top edge, connected by a line
   *
   * @param bbox - { x, y, width, height } bounding box for the selection
   */
  public drawSelectionForElement(bbox: { x: number; y: number; width: number; height: number }): void {
      // Clear previous drawing
      this.graphics.clear();

      // Basic style settings
      const lineColor = 0x66ccff;
      const handleFillColor = 0x66ccff;
      const lineThickness = 1;
      const handleRadius = 5;
      const rotateHandleOffset = 30; // distance above top edge

      // Draw ONLY the rectangle stroke (no fill)
      this.graphics.lineStyle(lineThickness, lineColor, 1);
      this.graphics.drawRect(bbox.x, bbox.y, bbox.width, bbox.height);
      this.graphics.closePath(); // end the rectangle path

      // Calculate handle positions
      const topLeft     = { x: bbox.x,               y: bbox.y };
      const topRight    = { x: bbox.x + bbox.width,  y: bbox.y };
      const bottomLeft  = { x: bbox.x,               y: bbox.y + bbox.height };
      const bottomRight = { x: bbox.x + bbox.width,  y: bbox.y + bbox.height };

      const topMid    = { x: bbox.x + bbox.width / 2, y: bbox.y };
      const bottomMid = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height };
      const leftMid   = { x: bbox.x,                  y: bbox.y + bbox.height / 2 };
      const rightMid  = { x: bbox.x + bbox.width,     y: bbox.y + bbox.height / 2 };

      // Rotate handle above top-mid
      const rotateHandle = {
          x: topMid.x,
          y: topMid.y - rotateHandleOffset
      };

      // Draw a line from topMid to rotateHandle (stroke only)
      this.graphics.moveTo(topMid.x, topMid.y);
      this.graphics.lineTo(rotateHandle.x, rotateHandle.y);
      this.graphics.closePath(); // end that path
      this.graphics.setFillStyle({alpha: 0})
      this.graphics.stroke();

      // Now draw filled circles for all handles
      //this.graphics.beginFill(handleFillColor, 1);
      [
          /*topLeft, topRight, bottomLeft, bottomRight,
          topMid, bottomMid, leftMid, rightMid,*/
          rotateHandle
      ].forEach(pos => {
          this.graphics.drawCircle(pos.x, pos.y, handleRadius);
      });
      this.graphics.fill({alpha: 1, color: handleFillColor});
      //this.graphics.endFill();
  }

  public destroy(): void {
      this.stage.removeChild(this.graphics);
      this.graphics.destroy();
  }
}