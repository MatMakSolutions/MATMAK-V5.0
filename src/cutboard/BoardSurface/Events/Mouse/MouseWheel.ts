import { _boardEvts, _evtBus } from "../../../../../src/core/EventBus";
import { BoardSurface } from "../../BoardSurface";

export function MouseWheelAction(this: BoardSurface, e: WheelEvent) {
  if (this._unloaded) return;
  // If ctrk is pressed, then rotate the board
  if (e.ctrlKey) {
    if (e.deltaY < 0) {
      _evtBus.emit(_boardEvts.BoardSurface.onRotate);
    } else {
      _evtBus.emit(_boardEvts.BoardSurface.onRotate, true);
    }
    return;
  }

  // check teh direction and start the right zoom event
  if (e.deltaY < 0) {
    _evtBus.emit(_boardEvts.BoardSurface.zoomIn);
  } else {
    _evtBus.emit(_boardEvts.BoardSurface.zoomOut);
  }
}