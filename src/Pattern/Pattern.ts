import { DisplayObject } from "../Graphics/DisplayObject";
import { TRectangle } from "../VectorPath/Utils/Rectangle";
import { VectorPath } from "../VectorPath/VectorPath";
import { Container, Graphics, GraphicsPath, Matrix, Rectangle } from "pixi.js"
import { extendClass } from "./Extentions/_BasePlugin";
import { SelectedPattern } from "./Extentions/PatternSelected";
import { SplitPattern, TSplitPattern } from "./Extentions/PatternSplit";
import { SplitBikiniPattern, TSplitBikiniPattern } from "./Extentions/PatternBikini";
import { EditionPattern, TEditionPattern } from "./Extentions/PatternEdition";
import { PolygonHit } from "./PolygonHit";
import { IPoint } from "../VectorPath/Utils/IPoint";
import { TWrapPattern, WrapPattern } from "./Extentions/PatternWrap";
import { CollidePattern, TCollidedPattern } from "./Extentions/PatternCollided";
import { surfaceCollection } from "../data/repository/SurfaceCollection";



interface IPattern {
  _groupParent?: typeof Pattern;
  subPatterns?: typeof Pattern[];
  setState(state: '' | 'selected' | 'groupSelected' | 'collided'): void;
}

export class _Pattern {
  _guid           : string = "";                                // GUID of the pattern.
  private _zoomFactor     : number = 1;                                 // Zoom factor for the pattern.
  _x                      : number = 0;                                 // X coordinate of the pattern.
  _y                      : number = 0;                                 // Y coordinate of the pattern.
  _rotation               : number = 0;                                 // Rotation of the pattern.
  _backupRotation         : number = 0;                                 // Backup of the rotation.
  _bbox                   : TRectangle;                                 // Bounding box of the pattern.
  _state                  : '' | 'selected' | 'groupSelected' | 'edition' | 'wrap' | 'split' | 'bikini' | 'collided' = "";
  _polyHit                : PolygonHit = new PolygonHit();
  _readyForDrag           : boolean = false;
  _dragging               : boolean = false;
  _dragStartPoint         : { x: number, y: number } = { x: 0, y: 0 };
  _isNested               : boolean = false;
  _isDirty                : boolean = false;
  _disposed               : boolean = false;
  _MainGraphics!          : Graphics;
  applyTransformTimeoutId : number = 0;
  _color                  : number = 0x000000; // Color of the pattern.
  _parentPattern          : _Pattern | null = null; // Reference to parent pattern for sub-patterns
 isGroup                 : boolean = false; 
  subPatterns: _Pattern[] = [];
/////////////////////////
 public getBounds(): Rectangle {
        
    return this.container.getBounds().rectangle;
    }
///////////////////////////

  public clearSubPatterns() {
    this.subPatterns.forEach(sub => {
        sub.dispose();
    });
    this.subPatterns = [];
    if (this._vector) {
        this._vector.paths = [];
    }
  }
  get isNested() {
    return this._isNested;
  }

  set isNested(value: boolean) {
    this._isNested = value;
  }

  setState(state: '' | 'selected' | 'groupSelected' | 'edition' | 'wrap' | 'split' | 'bikini' | 'collided') {
    // first we call the destroy method of the current state

    if (`cleanUp_${this._state}` in this) {
      (this as any)[`cleanUp_${this._state}`]();
    }

    // If state = '' we just call cleanUp and return.
    if (this._state === '') {
      this.cleanUp();
    }

    const previousState = this._state;
    this._state = state;

    // Propagate edition state to sub-patterns (but NOT segment mode - segment mode is main path only)
    if (state === 'edition' && previousState !== 'edition') {
      // Entering edition mode - bring all sub-patterns into edition mode
      this.subPatterns.forEach(subPattern => {
        if (subPattern._state !== 'edition') {
          subPattern.setState('edition');
        }
      });

    } else if (state !== 'edition' && previousState === 'edition') {
      // Exiting edition mode - exit all sub-patterns from edition mode
      this.subPatterns.forEach(subPattern => {
        if (subPattern._state === 'edition') {
          subPattern.setState('');
        }
      });
    }
    // NOTE: Segment mode is NOT propagated to sub-patterns - it only applies to the main path

    this.display();
  }

  // vectorXXX fields represents the current state of the vector.
  // that differes from the pattern state.
  // We do not apply modification in real time to the vector to avoid
  // loosing the original precision.
  _vectorPositionX : number = 0;  // X coordinate of the vector.
  _vectorPositionY : number = 0;  // Y coordinate of the vector.
  _vectorRotation  : number = 0;  // Latest rotation of the pattern.

  _vector     : VectorPath;  // Vector path of th9e pattern.
  _vectorBack : VectorPath;  // Vector path of th9e pattern.

  _Mapper     : any;  // Mapper to use for the pattern.
  _childrens : DisplayObject[] = [];  // Childrens of the pattern.
  _timeoutDragIdx : number = 0;  // Timeout index for the drag.
  _groupMembers?: _Pattern[];
  // Added flag to switch edit mode on/off.
  public editMode: boolean = false;
  // Global container at the root level.
  public container: Container;

  constructor(vector: VectorPath) {
    this._vector = vector;
    this._vectorBack = new VectorPath();
    this._vectorBack.parse(this._vector.generatePathString());
    this._bbox = this._vector.getBoundingBox();
    this.container = new Container();

    this._isDirty = true;
    // Look for all methods whose name starts with "onInit" and call them.
    for (const key in this) {
      if (key.startsWith('init_') && typeof this[key] === 'function') {
        this[key]();
      }
    }
  }

  darkenColorNum(color: number, percent: number): number {
    const amt = Math.max(0, Math.min(100, percent)) / 100;

    const r = Math.floor(((color >> 16) & 0xff) * (1 - amt));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - amt));
    const b = Math.floor((color & 0xff) * (1 - amt));

    return (r << 16) | (g << 8) | b;
  }

  initializeNestedPatterns() {
    this._vector.paths.forEach((path) => {
      const vp = new VectorPath();
      vp.parse(path);
      vp.normalize(true);
      // We apply the translate of teh parent only
      vp.translate(-this._vector["_originalPosition"].x, -this._vector["_originalPosition"].y);
     vp["_originalPosition"] = {
        x: this._vector["_originalPosition"].x,
        y: this._vector["_originalPosition"].y
      };
      const pt = new Pattern(vp);
      pt.zoomFactor = this._zoomFactor;
      pt._color = this._color;
      pt._parentPattern = this; // Set parent reference
      
      // CRITICAL: Initialize _polyHit immediately for hit testing to work
      pt._polyHit.setPath(vp.generatePathString());
      console.log('Initialized _polyHit for subpattern:', pt._guid);
      
      this.subPatterns.push(pt);
     
      pt.container.label = "subPattern"
      this.container.addChild(pt.container);
    });
  }



  reset() {
    this._vector.reset();
    this.display();
  }

  get ctx() {
    return this.container.x;
  }

  get cty() {
    return this.container.y;
  }

  get zCtx() {
    return this.unZoomed(this.container.x);
  }

  get zCty() {
    return this.unZoomed(this.container.y);
  }

  set zCtx(value: number) {
    this.x = this.zoomed(value);
  }

  set zCty(value: number) {
    this.y = this.zoomed(value);
  }

  get zoomFactor() {
    return this._zoomFactor;
  }

  set zoomFactor(value: number) {
    // adjust x / y to keep the same position
    this._x = this._x * value / this._zoomFactor;
    this._y = this._y * value / this._zoomFactor;
    this._zoomFactor = value;
    this.subPatterns.forEach((pattern) => { pattern.zoomFactor = value; });
    this.display();
  }

  protected cleanUp() {
    this._MainGraphics?.clear();
    this.subPatterns.forEach((pattern) => { pattern.cleanUp(); });
  }

  display() {


    
    if (this._color === 0) {
      // get from surfaceData
      const pattern = surfaceCollection.selectedSurfaceData.getPattern(this._guid);
      if (pattern) {
        this._color = this.darkenColorNum(Number(pattern.patternColor), 35);
        this.subPatterns.forEach((pattern) => {
          pattern._color = this._color;
        });
      }
    }
    // prerequisits
    if (!this._MainGraphics) {
      this._MainGraphics = new Graphics();
      this.container.addChild(this._MainGraphics);
    }

    this.container.position.set(this._x, this._y);

    // Call the main state display method.
    if (this._state !== "" && `display_${this._state}` in this) {
      (this as any)[`display_${this._state}`]();
      return;
    }

    // Fallback to the default display method.
    const g = this._MainGraphics;
    g.clear();

    
    g.transform(new Matrix().scale(this._zoomFactor, this._zoomFactor));
    g.setStrokeStyle({ width: 1, color: this._color, alpha: 0.5 });
    g.setFillStyle({ color: this._color, alpha: 0.2 });
    g.path(new GraphicsPath(this._vector.generatePathString()));
    g.stroke();
    g.fill();

    // Display the nested patterns.
    if (this._vector.paths.length > 0 && this.subPatterns.length === 0) {
      this.initializeNestedPatterns();
    }

    this.subPatterns.forEach((pattern) => {
      pattern.display();
    });

    // recalculate the hit area only when a modification of shape has been done.
   /* if (this._isDirty) {
      clearTimeout(this.applyTransformTimeoutId);
      this.applyTransformTimeoutId = (setTimeout(() => {
        this._polyHit.setPath(this._vector.generatePathString());
        this._isDirty = false;
      }, 200) as unknown as number);
    }*/

    if (this._isDirty) {
            clearTimeout(this.applyTransformTimeoutId);
            this.applyTransformTimeoutId = (setTimeout(() => {
              this._polyHit.setPath(this._vector.generatePathString());
              this._isDirty = false;
              const pattern = this._vector.generatePathString();
              const oldPaths = this._vector.paths;
              //this._vector = new VectorPath();
              //this._vector.parse(pattern);
              //this._vector.paths = oldPaths;
              //this._vector.normalize();

              //surfaceCollection.updatePattern(this as any);
              //surfaceManager.saveSlectedSurface();
            }, 200) as unknown as number);
          }
    
      

  }


  dispose() {
    this.cleanUp();
    try {
      this.container.parent?.removeChild(this.container);
      this.container.destroy();
    } catch{}
    this._disposed = true;

    // call all onDispose methods.
    if (`dispose_${this._state}` in this) {
      (this as any)[`dispose_${this._state}`]();
    }

    this.subPatterns.forEach((pattern) => { pattern.dispose() });
  }

  // Returns teh current zoomed value of the pattern.
  zoomed(value: number) {
    return value * this._zoomFactor;
  }

  hitTest(point: { x: number, y: number }) {
    // Use absolute position for nested patterns
    const absolutePos = this.getAbsolutePosition();
    const curX = absolutePos.x;
    const curY = absolutePos.y;
    const pX = point.x;
    const pY = point.y;
    this._polyHit.x = curX;
    this._polyHit.y = curY;
    this._polyHit.zoomfactor = this._zoomFactor;
    return this._polyHit.hit({ x: pX, y: pY });
  }

  // Get absolute position accounting for parent pattern
  getAbsolutePosition(): { x: number, y: number } {
    if (this._parentPattern) {
      const parentPos = this._parentPattern.getAbsolutePosition();
      return {
        x: parentPos.x + this._x,
        y: parentPos.y + this._y
      };
    }
    return { x: this._x, y: this._y };
  }

  unZoomed(value: number) {
    return value / this._zoomFactor;
  }

  // Returns the current width of the pattern.
  get width() {
    return this._bbox.width;
  }

  // Returns the current height of the
  get height() {
    return this._bbox.height;
  }

  // Returns the current rotation of the pattern.
  get x() {
    return this._x;
  }

  // Sets the current rotation of the pattern.
  set x(value: number) {
    this._x = value;
    this.container.x = value
  }

  // Returns the current rotation of the pattern.
  get y() {
    return this._y;
  }

  // Sets the current rotation of the pattern.
  set y(value: number) {
    this._y = value;
    this.container.y = value
  }

  /**
   * Apply the transformation to the vector path.
   * @param {number} rotate - Rotation to apply.
   * @param {number} translate - Translation to apply.
   */
  applyTransformations({rotate,translate, rotationPoint}: {rotate: boolean, translate: boolean, rotationPoint?: IPoint}) {

    if (rotate && this._rotation !== this._vectorRotation) {
      // Calculate the delta of rotation to apply so the vectorRotation is the same as the pattern rotation.
      const deltaRotation = this._rotation - this._vectorRotation;
      this._vectorRotation = this._rotation;
      this._vector.rotate(deltaRotation, rotationPoint);
      this._vector["_path"] = this._vector.generatePathString();

      if (this.subPatterns.length > 0) {
        this.subPatterns.forEach((pattern, index) => {
          
          pattern._rotation = this._rotation;
          pattern.applyTransformations({rotate, translate, rotationPoint});
      
        });
        this._vector.paths = this.subPatterns.map((pattern) => pattern._vector.generatePathString());
      }
      this._isDirty = true;
    }

    if (translate && (this._x !== this._vectorPositionX || this._y !== this._vectorPositionY)) {
      // Calculate the delta of translation to apply so the vector position is the same as the pattern position.
      const deltaX = this._x - this._vectorPositionX;
      const deltaY = this._y - this._vectorPositionY;

      this._vectorPositionX = this._x;
      this._vectorPositionY = this._y;

      this._vector.translate(deltaX, deltaY);
    }
   

  }

}

export const Pattern =  SplitBikiniPattern(
                          SelectedPattern(
                            EditionPattern(
                              SplitPattern(
                                WrapPattern(
                                  CollidePattern(
                                    _Pattern
                                  )
                                )
                              )
                            )
                          )
                        ) as _Pattern
                            & TSplitBikiniPattern
                            & TEditionPattern
                            & TSplitPattern
                            & TWrapPattern
                            & TCollidedPattern
                            & { new (vector: VectorPath): typeof Pattern; };