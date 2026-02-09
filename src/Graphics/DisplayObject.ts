import { Application, Graphics } from "pixi.js";
import { Surface } from "./Surface";
import { surfaceManager } from "./SurfaceManager";

declare var curSF: Surface;

export class DisplayObject extends Graphics {
  //app!: Application;
  _sf: Surface = surfaceManager.currentSurface!;

  // Event variables
  _isOver       : boolean = false;
  _isOut        : boolean = false;
  _isDragging   : boolean = false;
  _readyForDrag : boolean = false;
  _offEvents   ?: { off: () => void }
  _isInteractive: boolean = false;

  protected _initialized : boolean = false;
  private _startDrag    : boolean = false;
  private _id:number = 0;
  _zoomFactor: number = 1;

  z(value: number) {
    return this._zoomFactor * value;
  }

  uz(value: number) {
    return value / this._zoomFactor;
  }

 mouseMoveHandler : any | null  = null;
 mouseDownHandler : any | null = null;
 mouseUpHandler   : any | null = null;
 clickHandler     : any | null = null;
 dblclickHandler  : any | null = null;
 wheelHandler     : any | null = null;

  get id() {
    return this._id;
  }

  constructor() {
    super();
    (window as any).idCounter = (window as any).idCounter || 0;
    this._id = (window as any).idCounter++;
     }


  onEventClick(eventData: { x: number, y: number }): void {}
  onEventClickOut(): void {}
  onEventDblClick(eventData: { x: number, y: number }): void {}
  onEventDblClickOut(): void {}
  onVoidClickOut(): void {}
  onVoidDblClickOut(): void {}
  onEventWheel(eventData: { delta: number }): void {}
  onEventOut(): void {}
  onEventOver(): void {}
  onEventDrag(eventData: { x: number, y: number }): void {}
  onEventDrop(eventData: { x: number, y: number }): void {}
  onRawEventMouseDown(eventData: { x: number, y: number, button: number, ctrlKey?: boolean, shiftKey?: boolean }): void {}
  onRawEventMouseUp(eventData: { x: number, y: number, button: number }): void {}
  onRawEventMouseMove(eventData: { x: number, y: number , button: number}): void {}

  setInteractivity(value: boolean) {
    this._isInteractive = value;
    if (value === true) {
      this._offEvents = this._sf.registerForEvents(this);
    } else {
     this._offEvents?.off();
      this._offEvents = undefined;
    }
  }

  update(): void {}
/*
  dispose() {
    this._offEvents?.off();
    this._offEvents = undefined;
    this.destroy();
  }
}*/
  /**
   * ✨ FIX: Override the PixiJS destroy method.
   * This is now the single point of entry for all destruction,
   * ensuring our custom cleanup logic always runs.
   */
  override destroy(options?: any) {
    if (this.destroyed) return; // Prevent double-destruction

    // Our custom cleanup logic to unregister from the event system
    this._offEvents?.off();
    this._offEvents = undefined;
    
    // Call the original destroy method from the parent class (PIXI.Graphics)
    super.destroy(options);
  }

  /**
   * Keep dispose() for API consistency, but now it simply calls the
   * new, more robust destroy() method.
   */
  dispose() {
    this.destroy();
  }
}
