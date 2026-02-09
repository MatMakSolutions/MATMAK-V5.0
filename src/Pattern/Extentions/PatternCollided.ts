import { Graphics, GraphicsPath, Matrix } from "pixi.js";
import { _Pattern } from "../Pattern";
import { extendClass } from "./_BasePlugin";

export type TCollidedPattern = {
  display_collided: () => void;
  cleanUp_collided: () => void;
  collidedGraphics: Graphics | null;
}

export const CollidePattern = (input: any) => extendClass(input, {
  fields:["collideGraphics"],
  methods: [
    {name: 'init_collided', body: function(this: _Pattern & TCollidedPattern) {
      this.applyTransformTimeoutId = 0;
      this.collidedGraphics = new Graphics();
      this.container.addChild(this.collidedGraphics);
    }},

    {name: 'dispose_collided', body: function(this: _Pattern & TCollidedPattern) {
      this.collidedGraphics && this.container.removeChild(this.collidedGraphics);
      this.collidedGraphics && this.collidedGraphics.destroy();
      this.collidedGraphics && (this.collidedGraphics = null);
    }},

    {name: 'display_collided', body: function(this: _Pattern & TCollidedPattern) {
      // prerequisites
      if (!this.collidedGraphics) {
        this.collidedGraphics = new Graphics();
        this.container.addChild(this.collidedGraphics);
      }

      const g = this.collidedGraphics;
      g.clear();
      g.transform(new Matrix().scale(this.zoomFactor, this.zoomFactor));
      g.setStrokeStyle({ width: 1, color: 0x000000, alpha: 0.5 });
      g.setFillStyle({ color: 0xFF0000, alpha: 0.5 });
      this.container.addChild(g);
      g.path(new GraphicsPath(this._vector.generatePathString()));
      g.stroke();
      g.fill();

      this.subPatterns.forEach((pattern) => {
        pattern.display();
      });

      // recalculate the hit area only when a modification of shape has been done.
      if (this._isDirty) {
        clearTimeout(this.applyTransformTimeoutId);
        this.applyTransformTimeoutId = (setTimeout(() => {
          this._polyHit.setPath(this._vector.generatePathString());
          this._isDirty = false;
        }, 200) as unknown as number);
      }
    }},

    {name: 'cleanUp_collided', body: function(this: _Pattern & TCollidedPattern) {
      this.collidedGraphics?.clear();
      this.subPatterns.forEach((pattern) => { pattern["cleanUp"](); });
    }}
  ]
});