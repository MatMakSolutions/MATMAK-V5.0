import { Graphics, GraphicsPath, Matrix, Text, TextStyle } from "pixi.js";
import { _Pattern } from "../Pattern";
import { extendClass } from "./_BasePlugin";
import { IPoint } from "../../VectorPath/Utils/IPoint";
import { surfaceManager } from "../../Graphics/SurfaceManager";
import { VectorPath } from "../../VectorPath/VectorPath";
import { liveConfig } from "../../core/LiveConfig";

export type TSplitBikiniPattern = {
  display_bikini: () => void;
  destroy_bikini: () => void;
  init_bikini: () => void;
  cleanUp_bikini: () => void;
  onMouseMove_bikini: (mouseX: number, mouseY: number) => void;
  onMouseClick_bikini: (mouseX: number, mouseY: number) => void;
  
  bikiniGraphics: Graphics | null;
  bikiniRulerGraphics: Graphics | null;
  bikiniLineGraphics: Graphics | null;
  bikiniRulerTexts: Text[];
  bikiniMeasurementText: Text | null;
  bikiniLeftMeasurementText: Text | null;
  bikiniCutY: number | null;
  mouseInBikiniZone: boolean;
  splitPoint1: IPoint | null;
  splitPoint2: IPoint | null;
  isCurvedSplit: boolean;
  curveDepth: number; // Depth of the curve in pixels (positive = downward)
}

export const SplitBikiniPattern = (input: any) => extendClass(input, {
  fields: ['bikiniCutY', 'mouseInBikiniZone', 'bikiniRulerTexts', 'bikiniRulerGraphics', 'bikiniMeasurementText', 'bikiniLeftMeasurementText', 'splitPoint1', 'splitPoint2', 'isCurvedSplit', 'curveDepth'],
  methods: [
    {
      name: 'init_bikini', 
      body: function(this: _Pattern & TSplitBikiniPattern) {
        this.bikiniGraphics = new Graphics();
        this.bikiniRulerGraphics = new Graphics();
        this.bikiniLineGraphics = new Graphics();
        this.bikiniRulerTexts = [];
        this.bikiniMeasurementText = null;
        this.bikiniLeftMeasurementText = null;
        this.container.addChild(this.bikiniGraphics);
        this.container.addChild(this.bikiniRulerGraphics);
        this.container.addChild(this.bikiniLineGraphics);
        this.bikiniCutY = null;
        this.mouseInBikiniZone = false;
        this.splitPoint1 = null;
        this.splitPoint2 = null;
        // Use liveConfig values for curved split
        this.isCurvedSplit = liveConfig.curvedSplitEnabled;
        this.curveDepth = liveConfig.curvedSplitDepth;
      }
    },
    {
      name: 'destroy_bikini', 
      body: function(this: _Pattern & TSplitBikiniPattern) {
        if (this.bikiniGraphics) {
          this.container.removeChild(this.bikiniGraphics);
          this.bikiniGraphics.destroy();
          this.bikiniGraphics = null;
        }
        if (this.bikiniRulerGraphics) {
          this.container.removeChild(this.bikiniRulerGraphics);
          this.bikiniRulerGraphics.destroy();
          this.bikiniRulerGraphics = null;
        }
        if (this.bikiniLineGraphics) {
          this.container.removeChild(this.bikiniLineGraphics);
          this.bikiniLineGraphics.destroy();
          this.bikiniLineGraphics = null;
        }
        // Clean up ruler texts
        if (this.bikiniRulerTexts) {
          this.bikiniRulerTexts.forEach(text => {
            this.container.removeChild(text);
            text.destroy();
          });
          this.bikiniRulerTexts = [];
        }
        // Clean up measurement text
        if (this.bikiniMeasurementText) {
          this.container.removeChild(this.bikiniMeasurementText);
          this.bikiniMeasurementText.destroy();
          this.bikiniMeasurementText = null;
        }
        if (this.bikiniLeftMeasurementText) {
          this.container.removeChild(this.bikiniLeftMeasurementText);
          this.bikiniLeftMeasurementText.destroy();
          this.bikiniLeftMeasurementText = null;
        }
      }
    },
    {
      name: 'display_bikini', 
      body: function(this: _Pattern & TSplitBikiniPattern) {
        if (!this.bikiniGraphics) {
          this.init_bikini();
        }
        
        // First draw the pattern itself (like selected state does)
        const mainG = this.bikiniGraphics!;
        mainG.clear();
        mainG.transform(new Matrix().scale(this.zoomFactor, this.zoomFactor));
        mainG.setStrokeStyle({ width: 1, color: 0x094E6A, alpha: 0.5 });
        mainG.setFillStyle({ color: 0x094E6A, alpha: 0.5 });
        mainG.path(new GraphicsPath(this._vector.generatePathString()));
        mainG.stroke();
        mainG.fill();
        
        // Display sub patterns
        this.subPatterns.forEach((pattern) => {
          pattern._color = 0x094E6A;
          pattern._isDirty = true;
          pattern.display();
        });
        
        // Create a separate graphics for rulers
        if (!this.bikiniRulerGraphics) {
          this.bikiniRulerGraphics = new Graphics();
          this.container.addChild(this.bikiniRulerGraphics);
        }
        
        const g = this.bikiniRulerGraphics;
        g.clear();
        
        // Clean up existing ruler texts
        this.bikiniRulerTexts.forEach(text => {
          this.container.removeChild(text);
          text.destroy();
        });
        this.bikiniRulerTexts = [];
        
        // Get the current bounding box (which accounts for rotation)
        const currentBBox = this._vector.getBoundingBox();
        
        // Draw ruler rectangles
        g.setStrokeStyle({
          width: 1,
          color: 0x333333,
          alpha: 0.8
        });
        g.setFillStyle({
          color: 0xF0F0F0,
          alpha: 0.9
        });
        
        const rulerWidth = 60;
        const gap = 5; // 5px gap between rulers and pattern bbox
        const rulerExtension = 15; // 15px extension on top and bottom
        // Use the current bbox which reflects the rotated state
        const leftX = this.zoomed(currentBBox.x) - rulerWidth - gap;
        const rightX = this.zoomed(currentBBox.x + currentBBox.width) + gap;
        const topY = this.zoomed(currentBBox.y) - rulerExtension;
        const height = this.zoomed(currentBBox.height) + (2 * rulerExtension);
        
        // Draw main ruler rectangles (extended by 15px on top and bottom)
        g.rect(leftX, topY, rulerWidth, height);
        g.rect(rightX, topY, rulerWidth, height);
        g.fill();
        g.stroke();
        
        // Draw measurement marks and labels
        const measurementStyle = new TextStyle({
          fontFamily: 'Arial',
          fontSize: 10,
          fill: 0x000000,
          align: 'right'
        });
        
        // Calculate measurement intervals based on unit of measure
        const isInches = liveConfig.unitOfMeasure === 3;
        const MM_TO_INCHES = 0.0393701;
        
        // Use appropriate intervals: 10mm for metric, 0.5 inch (12.7mm) for imperial
        const intervalMM = isInches ? 25.4 : 20; // 1 inch 
        const intervalPixels = this.zoomed(intervalMM);
        
        // Draw marks based on actual pattern height
        const numMarks = Math.floor(currentBBox.height / intervalMM);
        
        for (let i = 0; i <= numMarks; i++) {
          // Calculate positions based on pattern bbox, not extended ruler
          const patternTopY = this.zoomed(currentBBox.y);
          const patternHeight = this.zoomed(currentBBox.height);
          
          const y = patternTopY + this.zoomed(i * intervalMM);
          // Major mark every 50mm (5 intervals) for metric, every 1 inch (2 intervals of 0.5") for imperial
          const isMajor = isInches ? i % 2 === 0 : i % 5 === 0;
          
          // Draw tick marks
          g.setStrokeStyle({
            width: isMajor ? 2 : 1,
            color: 0x000000,
            alpha: isMajor ? 0.8 : 0.4
          });
          
          const tickLength = isMajor ? 15 : 8;
          
          // Left ruler ticks (counting from bottom)
          const leftY = patternTopY + patternHeight - this.zoomed(i * intervalMM);
          g.moveTo(leftX + rulerWidth - tickLength, leftY);
          g.lineTo(leftX + rulerWidth, leftY);
          g.stroke();
          
          // Right ruler ticks (counting from top)
          g.moveTo(rightX, y);
          g.lineTo(rightX + tickLength, y);
          g.stroke();
          
          // Add text labels for major marks
          if (isMajor) {
            let label: string;
            if (isInches) {
              const inches = (i * intervalMM * MM_TO_INCHES).toFixed(1);
              label = `${inches}"`;
            } else {
              label = `${i * intervalMM}mm`;
            }
            
            // Left ruler label (at bottom-based position)
            const leftText = new Text(label, measurementStyle);
            leftText.x = leftX + 5;
            leftText.y = leftY - 5;
            this.container.addChild(leftText);
            this.bikiniRulerTexts.push(leftText);
            
            // Right ruler label (at top-based position)
            const rightText = new Text(label, measurementStyle);
            rightText.x = rightX + tickLength + 3;
            rightText.y = y - 5;
            this.container.addChild(rightText);
            this.bikiniRulerTexts.push(rightText);
          }
        }
        
        // Draw center line on rulers (based on pattern center, not extended ruler)
        g.setStrokeStyle({
          width: 1,
          color: 0xFF0000,
          alpha: 0.3
        });
        const patternCenterY = this.zoomed(currentBBox.y) + this.zoomed(currentBBox.height) / 2;
        g.moveTo(leftX, patternCenterY);
        g.lineTo(leftX + rulerWidth, patternCenterY);
        g.moveTo(rightX, patternCenterY);
        g.lineTo(rightX + rulerWidth, patternCenterY);
        g.stroke();
      }
    },
    {
      name: 'cleanUp_bikini', 
      body: function(this: _Pattern & TSplitBikiniPattern) {
        this.bikiniGraphics?.clear();
        this.bikiniRulerGraphics?.clear();
        this.bikiniLineGraphics?.clear();
        // Clean up ruler texts
        if (this.bikiniRulerTexts) {
          this.bikiniRulerTexts.forEach(text => {
            this.container.removeChild(text);
            text.destroy();
          });
          this.bikiniRulerTexts = [];
        }
        // Clean up measurement text
        if (this.bikiniMeasurementText) {
          this.bikiniMeasurementText.visible = false;
        }
        if (this.bikiniLeftMeasurementText) {
          this.bikiniLeftMeasurementText.visible = false;
        }
        this.bikiniCutY = null;
        this.mouseInBikiniZone = false;
        this.splitPoint1 = null;
        this.splitPoint2 = null;
        
        // Restore sub pattern colors
        this.subPatterns.forEach((pattern) => {
          pattern._color = this._color;
          pattern._isDirty = true;
          pattern.display();
        });
      }
    },
    {
      name: 'onMouseMove_bikini',
      body: function(this: _Pattern & TSplitBikiniPattern, mouseX: number, mouseY: number) {
        if (!this.bikiniLineGraphics || this._state !== 'bikini') return;
        
        const g = this.bikiniLineGraphics;
        g.clear();
        
        // Convert mouse coordinates to pattern-relative coordinates
        const relativeX = mouseX - this.x;
        const relativeY = mouseY - this.y;
        
        // Get current bbox
        const currentBBox = this._vector.getBoundingBox();
        
        // Check if mouse is in the bikini zone (between rulers)
        const leftBound = this.zoomed(currentBBox.x);
        const rightBound = this.zoomed(currentBBox.x + currentBBox.width);
        const topBound = this.zoomed(currentBBox.y);
        const bottomBound = this.zoomed(currentBBox.y + currentBBox.height);
        
        this.mouseInBikiniZone = relativeX >= leftBound && relativeX <= rightBound && 
                                relativeY >= topBound && relativeY <= bottomBound;
        
        if (this.mouseInBikiniZone) {
          // Draw horizontal line or curve in pattern coordinates
          g.setStrokeStyle({
            width: 2,
            color: 0x00FF00,
            alpha: 1
          });
          
          // Use liveConfig for curved split settings
          const isCurved = liveConfig.curvedSplitEnabled;
          if (isCurved) {
            // Draw a smooth downward curve
            const midX = (leftBound + rightBound) / 2;
            // Scale curve depth by zoom factor to match ruler scaling
            // curvedSplitDepth is in pixels, so we need to scale it by zoom to match the ruler
            const curveY = relativeY + this.zoomed(liveConfig.curvedSplitDepth);
            
            // Use quadratic bezier curve for smooth downward curve
            g.moveTo(leftBound, relativeY);
            g.quadraticCurveTo(midX, curveY, rightBound, relativeY);
            g.stroke();
          } else {
            // Draw straight horizontal line
            g.moveTo(leftBound, relativeY);
            g.lineTo(rightBound, relativeY);
            g.stroke();
          }
          
          // Draw indicators inside the rulers
          const rulerWidth = 60;
          const gap = 5; // 5px gap between rulers and pattern bbox
          const leftRulerStart = leftBound - rulerWidth - gap;
          const leftRulerEnd = leftBound - gap;
          const rightRulerStart = rightBound + gap;
          const rightRulerEnd = rightBound + gap + rulerWidth;
          
          // Left ruler indicator (green line completely inside ruler)
          g.setStrokeStyle({
            width: 3,
            color: 0x00FF00,
            alpha: 1
          });
          // Draw from left edge of ruler + 5px to right edge - 5px
          g.moveTo(leftRulerStart + 5, relativeY);
          g.lineTo(leftRulerEnd - 5, relativeY);
          g.stroke();
          
          // Add arrow pointing right at the end of left indicator
          g.setFillStyle({
            color: 0x00FF00,
            alpha: 1
          });
          g.moveTo(leftRulerEnd - 5, relativeY);
          g.lineTo(leftRulerEnd - 10, relativeY - 4);
          g.lineTo(leftRulerEnd - 10, relativeY + 4);
          g.closePath();
          g.fill();
          
          // Right ruler indicator (green line completely inside ruler)
          g.setStrokeStyle({
            width: 3,
            color: 0x00FF00,
            alpha: 1
          });
          // Draw from left edge of ruler + 5px to right edge - 5px
          g.moveTo(rightRulerStart + 5, relativeY);
          g.lineTo(rightRulerEnd - 5, relativeY);
          g.stroke();
          
          // Add arrow pointing left at the start of right indicator
          g.setFillStyle({
            color: 0x00FF00,
            alpha: 1
          });
          g.moveTo(rightRulerStart + 5, relativeY);
          g.lineTo(rightRulerStart + 10, relativeY - 4);
          g.lineTo(rightRulerStart + 10, relativeY + 4);
          g.closePath();
          g.fill();
          
          // Draw small circles at the pattern edges for better visibility
          g.setFillStyle({
            color: 0x00FF00,
            alpha: 1
          });
          g.circle(leftBound, relativeY, 3);
          g.circle(rightBound, relativeY, 3);
          g.fill();
          
          // Show measurements - convert to pattern space
          const patternY = (relativeY - this.zoomed(currentBBox.y)) / this.zoomFactor;
          const patternYFromBottom = currentBBox.height - patternY;
          
          // Check if we need to display in inches
          const isInches = liveConfig.unitOfMeasure === 3;
          const MM_TO_INCHES = 0.0393701;
          
          // Draw measurement backgrounds
          g.setFillStyle({
            color: 0x000000,
            alpha: 0.7
          });
          // Right ruler measurement background - inside the ruler
          g.roundRect(rightRulerStart + 5, relativeY - 10, 50, 20, 5);
          g.fill();
          
          // Left ruler measurement background - inside the ruler
          g.roundRect(leftRulerStart + 5, relativeY - 10, 50, 20, 5);
          g.fill();
          
          // Create or update measurement text
          if (!this.bikiniMeasurementText) {
            const style = new TextStyle({
              fontFamily: 'Arial',
              fontSize: 12,
              fill: 0x00FF00,
              fontWeight: 'bold'
            });
            this.bikiniMeasurementText = new Text('', style);
            this.container.addChild(this.bikiniMeasurementText);
          }
          
          // Update right ruler text (from top) - inside the ruler
          if (isInches) {
            const inches = (patternY * MM_TO_INCHES).toFixed(2);
            this.bikiniMeasurementText.text = `${inches}"`;
          } else {
            this.bikiniMeasurementText.text = `${Math.round(patternY)}mm`;
          }
          this.bikiniMeasurementText.x = rightRulerStart + 8;
          this.bikiniMeasurementText.y = relativeY - 8;
          this.bikiniMeasurementText.visible = true;
          
          // Add left ruler text (from bottom) - inside the ruler
          if (!this.bikiniLeftMeasurementText) {
            const style = new TextStyle({
              fontFamily: 'Arial',
              fontSize: 12,
              fill: 0x00FF00,
              fontWeight: 'bold'
            });
            this.bikiniLeftMeasurementText = new Text('', style);
            this.container.addChild(this.bikiniLeftMeasurementText);
          }
          
          if (isInches) {
            const inches = (patternYFromBottom * MM_TO_INCHES).toFixed(2);
            this.bikiniLeftMeasurementText.text = `${inches}"`;
          } else {
            this.bikiniLeftMeasurementText.text = `${Math.round(patternYFromBottom)}mm`;
          }
          this.bikiniLeftMeasurementText.x = leftRulerStart + 8;
          this.bikiniLeftMeasurementText.y = relativeY - 8;
          this.bikiniLeftMeasurementText.visible = true;
        } else {
          // Hide measurement text when mouse is outside
          if (this.bikiniMeasurementText) {
            this.bikiniMeasurementText.visible = false;
          }
          if (this.bikiniLeftMeasurementText) {
            this.bikiniLeftMeasurementText.visible = false;
          }
        }
      }
    },
    {
      name: 'onMouseClick_bikini',
      body: function(this: _Pattern & TSplitBikiniPattern, mouseX: number, mouseY: number) {
        if (!this.mouseInBikiniZone || this._state !== 'bikini') return;
        
        // Convert mouse coordinates to pattern-relative coordinates
        const relativeX = mouseX - this.x;
        const relativeY = mouseY - this.y;
        
        // Get current bbox
        const currentBBox = this._vector.getBoundingBox();
        
        // Check if mouse Y is in bounds
        const topBound = this.zoomed(currentBBox.y);
        const bottomBound = this.zoomed(currentBBox.y + currentBBox.height);
        
        if (relativeY < topBound || relativeY > bottomBound) return;
        
        // Convert to unzoomed pattern Y (relative to bbox top)
        const patternY = (relativeY - this.zoomed(currentBBox.y)) / this.zoomFactor;
        
        // Create two points for horizontal cut (or curve)
        // Split starts exactly at the pattern edges (ruler size)
        const leftBound = this.zoomed(currentBBox.x);
        const rightBound = this.zoomed(currentBBox.x + currentBBox.width);
        
        const point1: IPoint = {
          x: this.x + leftBound, // Exactly at left pattern edge
          y: mouseY
        };
        
        const point2: IPoint = {
          x: this.x + rightBound, // Exactly at right pattern edge
          y: mouseY
        };
        
        // Store cut points for split operation
        // Note: For curved splits, we'll use additional points in the split function
        this.splitPoint1 = point1;
        this.splitPoint2 = point2;
        
        console.log('Bikini cut - Mouse position:', mouseX, mouseY);
        console.log('Bikini cut - Point 1:', point1);
        console.log('Bikini cut - Point 2:', point2);
        console.log('Bikini cut - Pattern state:', this._state);
        
        // Visual feedback - flash the line
        if (this.bikiniLineGraphics) {
          const g = this.bikiniLineGraphics;
          g.clear();
          g.setStrokeStyle({
            width: 3,
            color: 0xFFFF00, // Yellow flash
            alpha: 1
          });
          
          const leftBound = this.zoomed(currentBBox.x);
          const rightBound = this.zoomed(currentBBox.x + currentBBox.width);
          
          // Use liveConfig for curved split settings
          const isCurved = liveConfig.curvedSplitEnabled;
          if (isCurved) {
            // Draw a smooth downward curve
            const midX = (leftBound + rightBound) / 2;
            // Scale curve depth by zoom factor to match ruler scaling
            // curvedSplitDepth is in pixels, so we need to scale it by zoom to match the ruler
            const curveY = relativeY + this.zoomed(liveConfig.curvedSplitDepth);
            
            // Use quadratic bezier curve for smooth downward curve
            g.moveTo(leftBound, relativeY);
            g.quadraticCurveTo(midX, curveY, rightBound, relativeY);
            g.stroke();
          } else {
            // Draw straight horizontal line
            g.moveTo(leftBound, relativeY);
            g.lineTo(rightBound, relativeY);
            g.stroke();
          }
          
          // Clear the flash after a short delay
          setTimeout(() => {
            g.clear();
            
            // Just use the existing splitPattern method from surfaceManager
            surfaceManager.splitPattern(this.splitPoint1!, this.splitPoint2!);
            surfaceManager.saveSlectedSurface();
          }, 200);
        }
      }
    }
  ]
});