import { Graphics, GraphicsPath, Matrix } from "pixi.js";
import { _Pattern, Pattern } from "../Pattern";
import { extendClass } from "./_BasePlugin";
import { surfaceManager } from "../../Graphics/SurfaceManager";
import { VectorPath } from "../../VectorPath/VectorPath";
import { surfaceCollection } from "../../data/repository/SurfaceCollection";

export type TSelectionPattern = {
  display_selected: () => void;
  cleanUp_selected: () => void;
  selectedGraphics: Graphics;
}

export const SelectedPattern = (input: any) => extendClass(input, {
  fields:["selectedGraphics"],
  methods: [
    {name: 'init_selected', body: function(this: _Pattern & TSelectionPattern) {
      this.applyTransformTimeoutId = 0;
      this.selectedGraphics = new Graphics();
      this.container.addChild(this.selectedGraphics);
    }},

    {name: 'dispose_selected', body: function(this: _Pattern & TSelectionPattern) {
      this.container.removeChild(this.selectedGraphics);
      this.selectedGraphics.destroy();
      this.selectedGraphics = null;
    }},

    {name: 'display_selected', body: function(this: _Pattern & TSelectionPattern) {
      // prerequisites
      if (!this.selectedGraphics) {
        this.selectedGraphics = new Graphics();
        this.container.addChild(this.selectedGraphics);
      }
      
      // Ensure vector is normalized for proper bounding box calculation
      if (!this._vector["_cloned"]) {
        const pattern = this._vector.generatePathString();
        const oldPaths = this._vector.paths;
        const oldOriginalPosition = this._vector.originalPosition;
        this._vector = new VectorPath();
        this._vector.parse(pattern);
        this._vector["_originalPosition"] = oldOriginalPosition;
        this._vector["_cloned"] = true;
        this._vector.normalize();
        this._vector.paths = oldPaths;
      }

      const g = this.selectedGraphics;
      g.clear();

      // Check if this is a nested path (has a parent pattern)
      const isNestedPath = this._parentPattern !== null;
      
      // Use different colors for nested paths vs main patterns
      const strokeColor = isNestedPath ? 0xFF6600 : 0x094E6A; // Orange for nested, Blue for main
      const fillColor = isNestedPath ? 0xFF6600 : 0x094E6A;
      const strokeAlpha = isNestedPath ? 0.8 : 0.5; // More visible for nested
      const fillAlpha = isNestedPath ? 0.3 : 0.5;
      const strokeWidth = isNestedPath ? 2 : 1; // Thicker stroke for nested

      g.transform(new Matrix().scale(this.zoomFactor, this.zoomFactor));
      g.setStrokeStyle({ width: strokeWidth, color: strokeColor, alpha: strokeAlpha });
      g.setFillStyle({ color: fillColor, alpha: fillAlpha });
      this.container.addChild(g);
      g.path(new GraphicsPath(this._vector.generatePathString()));
      g.stroke();
      g.fill();

      // For nested paths, don't change subpattern colors (they maintain their own selection state)
      // For main patterns, update subpattern colors only if they're not individually selected
      if (!isNestedPath) {
        this.subPatterns.forEach((pattern) => {
          // Only change color if the subpattern is not independently selected
          if (pattern._state !== 'selected') {
            pattern._color = 0x094E6A;
            pattern._isDirty = true;
            pattern.display();
          }
        });
      }

      // recalculate the hit area only when a modification of shape has been done.
      if (this._isDirty) {
        clearTimeout(this.applyTransformTimeoutId);
        this.applyTransformTimeoutId = (setTimeout(() => {
          this._polyHit.setPath(this._vector.generatePathString());
          this._isDirty = false;
          const pattern = this._vector.generatePathString();
          const oldPaths = this._vector.paths;
          //this._vector.parse(pattern);
          //this._vector = new VectorPath();
          //this._vector.parse(pattern);
          //this._vector.paths = oldPaths;
          //this._vector.normalize();

          //surfaceCollection.updatePattern(this as any);
          surfaceManager.saveSlectedSurface();
        }, 200) as unknown as number);
      }
    }},

    {name: 'cleanUp_selected', body: function(this: _Pattern & TSelectionPattern) {
      this.selectedGraphics?.clear();
      this.subPatterns.forEach((pattern) => {
        pattern._color = this._color;
        pattern._isDirty = true;
        pattern["cleanUp"]();
      });
    }}
  ]
});