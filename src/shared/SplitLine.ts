import { ppConfirm } from "../ui/controls/popup/Popup";
import { DisplayObject } from "../Graphics/DisplayObject";
import { surfaceManager } from "../Graphics/SurfaceManager";
import { IPoint } from "../VectorPath/Utils/IPoint";

export class SplitLine extends DisplayObject {
    splitPoint1: IPoint;  // Stored in screen coordinates
    splitPoint2: IPoint;  // Stored in screen coordinates
    evtMouse: { x: number, y: number } | null = null;
    _canBeUsed: boolean = false;
    private lastZoomFactor: number = 1;  // Track zoom changes

    set canBeUsed(value: boolean) {
        this._canBeUsed = value;
        if (!value) {
          this.clear();
        }
        this.update();
    }

    get canBeUsed() {
        return this._canBeUsed;
    }

    // Add zoom factor setter to update split points when zoom changes
    set zoomFactor(value: number) {
        if (this._zoomFactor === value) return;
        
        const zoomRatio = value / this._zoomFactor;
        
        // Scale existing split points to maintain their relative position
        if (this.splitPoint1) {
            this.splitPoint1.x *= zoomRatio;
            this.splitPoint1.y *= zoomRatio;
        }
        if (this.splitPoint2) {
            this.splitPoint2.x *= zoomRatio;
            this.splitPoint2.y *= zoomRatio;
        }
        if (this.evtMouse) {
            this.evtMouse.x *= zoomRatio;
            this.evtMouse.y *= zoomRatio;
        }
        
        this._zoomFactor = value;
        this.lastZoomFactor = value;
        this.update();
    }

    get zoomFactor(): number {
        return this._zoomFactor;
    }

    public onSelectionComplete?: (rect: { x: number; y: number; width: number; height: number }) => void;

    constructor() {
        super();
        this.setInteractivity(true);  // Enable interaction using the inherited method
    }

    // Override raw mouse event handling methods from DisplayObject
    override onRawEventMouseDown(eventData: { x: number, y: number, button: number }): void {

    }

    override onRawEventMouseMove(eventData: { x: number, y: number }): void {
      if (!this.canBeUsed) return;
      this.evtMouse = { x: eventData.x - this.parent.x, y: eventData.y - this.parent.y };
      this.update();
    }

    override onRawEventMouseUp(eventData: { x: number, y: number , button: number }): void {
      if (!this.canBeUsed) return;
      this.evtMouse = { x: eventData.x - this.parent.x, y: eventData.y - this.parent.y };
      if (eventData.button !== 0) return;

      if (!this.splitPoint1) {
        this.splitPoint1 = { x: this.evtMouse.x, y: this.evtMouse.y };
        this.splitPoint2 = null as any as IPoint;
        this.update();
      } else if (!this.splitPoint2) {
        this.splitPoint2 = { x: this.evtMouse.x, y: this.evtMouse.y };
        this.update();

        //ppConfirm('Split Line', 'Do you want to split the line?').then((result) => {
          this.canBeUsed = false;
          //if (result) {
            const splitPoint1 = this.splitPoint1;
            const splitPoint2 = this.splitPoint2;
            this.splitPoint1 = null;
            this.splitPoint2 = null;

            //if (result === "ok") {
              surfaceManager.splitPattern(splitPoint1, splitPoint2);
              surfaceManager.saveSlectedSurface();
            //} else {
            //  this.canBeUsed = true;
            //  this.update();
           // }

          //}
       // });

      } else {
        this.splitPoint1 = { x: this.evtMouse.x, y: this.evtMouse.y };
        this.splitPoint2 = null;
        this.update();
      }
    }

    // Optional: Allow custom destruction if needed
    override dispose(): void {
        super.dispose();
    }

    override update(): void {
      this.clear();
      if (this.splitPoint1) {
        this.setFillStyle({color: 0x66ccff, alpha: 0.2});
        this.setStrokeStyle({width: 1, color: 0x66ccff, alpha: 0.8});
        this.circle(this.splitPoint1.x, this.splitPoint1.y, 5);
        this.stroke();
        this.fill();
      }

      if (this.splitPoint2) {
        this.setFillStyle({color: 0x66ccff, alpha: 0.2});
        this.setStrokeStyle({width: 1, color: 0x66ccff, alpha: 0.8});
        this.circle(this.splitPoint2.x, this.splitPoint2.y, 5);
        this.stroke();
        this.fill();
      }

      // if 2 points show a segment between them
      if (this.splitPoint1 && this.splitPoint2) {
        this.setStrokeStyle({width: 1, color: 0x66ccff, alpha: 0.8});
        this.moveTo(this.splitPoint1.x, this.splitPoint1.y);
        this.lineTo(this.splitPoint2.x, this.splitPoint2.y);
        this.stroke();
      }

      if (this.splitPoint1 && !this.splitPoint2) {
        this.setStrokeStyle({width: 1, color: 0x66ccff, alpha: 0.8});
        this.moveTo(this.splitPoint1.x, this.splitPoint1.y);
        this.lineTo(this.evtMouse?.x, this.evtMouse?.y);
        this.stroke();
      }
    }
}
