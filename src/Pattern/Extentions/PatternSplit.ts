import { Graphics, GraphicsPath, Matrix } from "pixi.js";
import { _Pattern } from "../Pattern";
import { extendClass } from "./_BasePlugin";
import { IPoint } from "../../VectorPath/Utils/IPoint";

export type TSplitPattern = {
  display_split: () => void;
  destroy_split: () => void;
  splitPoint1: IPoint;
  splitPoint2: IPoint;
  splitGraphics: Graphics;
}

export const SplitPattern = (input: any) => extendClass(input, {
  fields:["splitGraphics"],
  methods: [
    {name: 'display_split', body: function(this: _Pattern & TSplitPattern) {
      // Prerequisites - create split overlay graphics if needed (like selected mode)
      if (!this.splitGraphics) {
        this.splitGraphics = new Graphics();
        this.container.addChild(this.splitGraphics);
      }
      
      // Draw the split overlay (like selected mode - only the overlay, let default display handle main)
      const g = this.splitGraphics;
      g.clear();
      g.transform(new Matrix().scale(this.zoomFactor, this.zoomFactor));
      g.setStrokeStyle({ width: 1, color: 0x000000, alpha: 0.5 });
      g.setFillStyle({ color: 0xFF00FF, alpha: 0.1 });
      g.path(new GraphicsPath(this._vector.generatePathString()));
      g.stroke();
      g.fill();
      
      // Display sub-patterns
      this.subPatterns.forEach((pattern) => {
        pattern.display();
      });
    }},
    {name: 'cleanUp_split', body: function(this: _Pattern & TSplitPattern) {
      // Clean up split overlay graphics (like selected mode)
      this.splitGraphics?.clear();
      this.subPatterns.forEach((pattern) => {
        pattern._color = this._color;
        pattern._isDirty = true;
        pattern["cleanUp"]();
      });
    }}
  ]
});