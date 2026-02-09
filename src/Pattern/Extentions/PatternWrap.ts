import { Graphics, GraphicsPath, Matrix, Text, TextStyle } from "pixi.js";
import { _Pattern } from "../Pattern";
import { extendClass } from "./_BasePlugin";
import { IPoint } from "../../VectorPath/Utils/IPoint";
import { SvgCommand, TClosestPointResult } from "../../VectorPath/Commands/Abstract/SvgCommand";

export type TWrapPattern = {
  // --- ADD THE MISSING METHOD HERE ---
  init_wrap: () => void;
  // --- END OF FIX ---

  display_wrap: () => void;
  destroy_wrap: () => void;
  cleanUp_wrap: () => void;
  setWrapPoint: (point: IPoint) => void;
  calculateWrap: () => { length: number, p1: IPoint, p2: IPoint };

  wrapPoint1: IPoint | null;
  wrapPoint2: IPoint | null;
  wrapDistance1: number;
  wrapDistance2: number;
  wrapSeg1Idx: number; // Re-added for consistency
  wrapSeg2Idx: number; // Re-added for consistency
  wrapGraphics: Graphics | null;
  wrapPoint1Graphics: Graphics | null;
  wrapPoint2Graphics: Graphics | null;
  wrapDistanceText: Text | null;
}

export const WrapPattern = (input: any) => extendClass(input, {
  fields:[
    'wrapPoint1',
    'wrapPoint2',
    'wrapDistance1',
    'wrapDistance2',
    'wrapGraphics',
    'wrapPoint1Graphics',
    'wrapPoint2Graphics',
    'wrapDistanceText',
    'wrapSeg1Idx',      // Re-added for consistency
    'wrapSeg2Idx'       // Re-added for consistency
  ],
  methods: [
    {name: 'init_wrap', body: function(this: _Pattern & TWrapPattern) {
      this.wrapPoint1 = null;
      this.wrapPoint2 = null;
      this.wrapDistance1 = 0;
      this.wrapDistance2 = 0;
      this.wrapSeg1Idx = -1;
      this.wrapSeg2Idx = -1;
      this.wrapGraphics = new Graphics();
      this.container.addChild(this.wrapGraphics);
      this.wrapPoint1Graphics = new Graphics();
      this.container.addChild(this.wrapPoint1Graphics);
      this.wrapPoint2Graphics = new Graphics();
      this.container.addChild(this.wrapPoint2Graphics);
      
      const style = new TextStyle({ fontFamily: 'Arial', fontSize: 14, fill: '#25A9E0', stroke: '#000000'});
      this.wrapDistanceText = new Text('', style);
      this.wrapDistanceText.anchor.set(0.5);
      this.container.addChild(this.wrapDistanceText);
    }},
    {name: 'destroy_wrap', body: function(this: _Pattern & TWrapPattern) {
      if (this.wrapGraphics) {
        this.container.removeChild(this.wrapGraphics);
        this.wrapGraphics.destroy();
        this.wrapGraphics = null;
        this.container.removeChild(this.wrapPoint1Graphics);
        this.wrapPoint1Graphics.destroy();
        this.wrapPoint1Graphics = null;
        this.container.removeChild(this.wrapPoint2Graphics);
        this.wrapPoint2Graphics.destroy();
        this.wrapPoint2Graphics = null;
        if (this.wrapDistanceText) {
          this.container.removeChild(this.wrapDistanceText);
          this.wrapDistanceText.destroy();
          this.wrapDistanceText = null;
        }
      }
    }},
    
    {name: 'display_wrap', body: function(this: _Pattern & TWrapPattern) {
      // Prerequisites
      if (!this.wrapGraphics) this.init_wrap(); // This line will no longer cause an error

      const g = this.wrapGraphics;
      g.clear();
      g.transform(new Matrix().scale(this.zoomFactor, this.zoomFactor));
      g.setStrokeStyle({ width: 1, color: 0x000000, alpha: 0.5 });
      g.setFillStyle({ color: 0xFF00FF, alpha: 0.1 });
      g.path(new GraphicsPath(this._vector.generatePathString()));
      g.stroke();
      g.fill();

      // Draw Point 1
      if (this.wrapPoint1) {
        const g1 = this.wrapPoint1Graphics;
        g1.clear();
        g1.circle(this.zoomed(this.wrapPoint1.x), this.zoomed(this.wrapPoint1.y), 5);
        g1.fill({ color: 0x00FF00 }); // Green for start
        g1.stroke({width: 1, color: 0x000000});
      }

      // Draw Point 2
      if (this.wrapPoint2) {
        const g2 = this.wrapPoint2Graphics;
        g2.clear();
        g2.circle(this.zoomed(this.wrapPoint2.x), this.zoomed(this.wrapPoint2.y), 5);
        g2.fill({ color: 0xFF0000 }); // Red for end
        g2.stroke({width: 1, color: 0x000000});
      }

      // Calculate and display distance text
      if (this.wrapPoint1 && this.wrapPoint2 && this.wrapDistanceText) {
        const { length } = this.calculateWrap();
        this.wrapDistanceText.text = `${length.toFixed(2)}mm`;
        
        // Position text between the two points
        const midX = this.zoomed((this.wrapPoint1.x + this.wrapPoint2.x) / 2);
        const midY = this.zoomed((this.wrapPoint1.y + this.wrapPoint2.y) / 2);
        this.wrapDistanceText.position.set(midX, midY - 20);
        this.wrapDistanceText.visible = false;
      } else if (this.wrapDistanceText) {
        this.wrapDistanceText.visible = false;
      }
    }},
    {name: 'cleanUp_wrap', body: function(this: _Pattern & TWrapPattern) {
      this.wrapGraphics?.clear();
      this.wrapPoint1Graphics?.clear();
      this.wrapPoint2Graphics?.clear();
      if(this.wrapDistanceText) this.wrapDistanceText.visible = false;
      this.wrapPoint1 = null;
      this.wrapPoint2 = null;
    }},
    {
      name: 'setWrapPoint',
      body: function(this: _Pattern & TWrapPattern, point: IPoint) {
        // IMPORTANT: Simplify the path to ensure all commands are L or C
        // This makes calculations reliable without implementing geometry for every command type.
        this._vector.simplify({ forceLine: true, forceCurve: true });
        
        const commands = this._vector.getCommands();
        let bestMatch: TClosestPointResult & { distAlongPath: number } = {
          t: 0,
          point: {x:0, y:0},
          distance: Infinity,
          distanceOnSegment: 0,
          distAlongPath: 0
        };

        let accumulatedDistance = 0;

        // 1. Find the closest point on the entire path
        commands.forEach((cmd: SvgCommand) => {
            // Check if getLength and getClosestPoint exist to prevent errors
            if (typeof (cmd as any).getLength !== 'function' || typeof (cmd as any).getClosestPoint !== 'function') {
                return; 
            }
            const closest = (cmd as any).getClosestPoint(point) as TClosestPointResult;
            if (closest.distance < bestMatch.distance) {
                bestMatch = {
                    ...closest,
                    distAlongPath: accumulatedDistance + closest.distanceOnSegment
                };
            }
            accumulatedDistance += (cmd as any).getLength();
        });

        if (bestMatch.point && bestMatch.distance !== Infinity) {
            // 2. Store the point information
            if (!this.wrapPoint1 || (this.wrapPoint1 && this.wrapPoint2)) {
                // Start a new wrap selection
                this.wrapPoint1 = bestMatch.point;
                this.wrapDistance1 = bestMatch.distAlongPath;
                this.wrapPoint2 = null; // Clear the second point
                this.wrapDistance2 = 0;
            } else {
                // Set the second wrap point
                this.wrapPoint2 = bestMatch.point;
                this.wrapDistance2 = bestMatch.distAlongPath;
            }
            this.display(); // Redraw to show the new point(s) and distance
        }
      }
    },
    {
        name: 'calculateWrap',
        body: function(this: _Pattern & TWrapPattern) {
            if (!this.wrapPoint1 || !this.wrapPoint2) {
                return { length: 0, p1: null, p2: null };
            }

            const totalPathLength = (this._vector as any).getTotalLength();
            const dist1 = this.wrapDistance1;
            const dist2 = this.wrapDistance2;
            
            const distanceClockwise = dist2 > dist1
                ? dist2 - dist1
                : totalPathLength - dist1 + dist2;

            const distanceCounterClockwise = dist1 > dist2
                ? dist1 - dist2
                : totalPathLength - dist2 + dist1;

            return {
                length: Math.min(distanceClockwise, distanceCounterClockwise),
                p1: this.wrapPoint1,
                p2: this.wrapPoint2,
            };
        }
    }
  ]
});