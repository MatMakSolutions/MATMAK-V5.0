import { _boardEvts, _evtBus } from "../../../../../src/core/EventBus";
import { BoardSurface, globalLiveData } from "../../BoardSurface";

export function ResizeAction(this: BoardSurface, e: Event) {
  if (this._unloaded) return;
  this._app.resize();
  setTimeout(() => {
    const bbox = this.canvas.parentElement.getBoundingClientRect();
    globalLiveData.boardWidth = bbox.width;
    globalLiveData.boardHeight = bbox.height;
    _evtBus.emit(_boardEvts.BoardSurface.onResize);
  }, 100);
}