import { _boardEvts, _evtBus } from "../../../../../src/core/EventBus";
import { BoardSurface, globalLiveData } from "../../BoardSurface";
import * as Paper from 'paper';
/*
  * This function is called when the mouse is pressed down on the board
  * It is responsible for:
  * 1. Setting the drag start position
  * 2. Setting the board drag start position
  * 3. Setting the cursor to grabbing
  * 4. Emitting the mouse down event
  */
export function MouseDownAction(this: BoardSurface, e: MouseEvent, paper: typeof Paper) {
  if (this._unloaded) return;
  if (e.button === 2) {
    this.items.forEach(item => {
      if (item.isZoomLocked) return;

      item.isDragged = false;
      item.isDragStarted = false;
    });
    this._isDragStarted = true;
    this._dragStartPosition = {
      x: globalLiveData.screenMousePos.x,
      y: globalLiveData.screenMousePos.y
    };
    this._dragBoardStartPosition = {
      x: this._spMainCtn.x,
      y: this._spMainCtn.y
    };
    document.body.style.cursor = "grabbing";
    return;
  }

  if (e.button === 0) {
    this._isDragStarted = false;
    let isProcessed = false;

    this.items.forEach(item => {
      if (!item.allowDragNDrop) return;
      if (item._isEditMode || isProcessed) return;

      if (new paper.Path(item.mainPath).contains({
        x: item.rawVal(globalLiveData.boardMousePos.x) - item.rawX,
        y: item.rawVal(globalLiveData.boardMousePos.y) - item.rawY
      })) {
        isProcessed = true;
        item.isDragStarted = true;
        item.dragStartPosition = {
          x: globalLiveData.boardMousePos.x - item.x,
          y: globalLiveData.boardMousePos.y - item.y
        }

      } else {
        item.isDragStarted = false
      }
    });
  }

  _evtBus.emit(_boardEvts.BoardSurface.onMouseDown, e);
}