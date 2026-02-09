import { boardManager } from "../../../../../src/cutboard/BoardManager";
import { BoardSurface, globalLiveData } from "../../BoardSurface";
import { _boardEvts, _evtBus } from "../../../../../src/core/EventBus";
import * as Paper from 'paper';

export function MouseMoveAction(this: BoardSurface, e: MouseEvent, paper: typeof Paper) {
  if (this._unloaded) return;
  const bbox = this.canvas.getBoundingClientRect();
  // On Screen Position
  globalLiveData.screenMousePos.x = e.clientX - bbox.x;
  globalLiveData.screenMousePos.y = e.clientY - bbox.y;

  // On Board Position
  globalLiveData.boardMousePos.x = e.clientX - bbox.x - this._spMainCtn.x;
  globalLiveData.boardMousePos.y = e.clientY - bbox.y - this._spMainCtn.y;

  this.items.forEach(item => {

    if (item.isSplitMode || item.isWrapMode) {
      const ptx = (globalLiveData.boardMousePos.x - item.x) / item.zoomLevel;
      const pty = (globalLiveData.boardMousePos.y - item.y) / item.zoomLevel;
      const pt = item.mainPathPaper.getNearestPoint(new paper.Point(ptx, pty));
      this._lastNearestPoint = pt;

      if (this.divide1 === undefined) {
        item._psStart._mainCtn.visible = true;
        if (!item._psStart.isZoomLocked) {
          item._psStart.zoomLevel = 5;
          item._psStart.isZoomLocked = true;
          item._psStart.reloadUI(item._psStart._boardSurface._spMainCtn);
        }

        item._psStart.x = (pt.x + item.rawX) * item.zoomLevel;
        item._psStart.y = (pt.y + item.rawY) * item.zoomLevel;
      } else if (this.divide2 === undefined) {
        item._psEnd._mainCtn.visible = true;
        if (!item._psEnd.isZoomLocked) {
          item._psEnd.zoomLevel = 5;
          item._psEnd.isZoomLocked = true;
          item._psEnd.reloadUI(item._psEnd._boardSurface._spMainCtn);
        }

        item._psEnd.x = (pt.x + item.rawX) * item.zoomLevel;
        item._psEnd.y = (pt.y + item.rawY) * item.zoomLevel;

        if (item.isSplitMode) {
          item.drawPsLine();
        } else {
          item.hidePsLine();
        }
      }
    }

    if (item._isEditMode) {
      if (!item.allowDragNDrop) return;

        if (item) {
          const x = item._psStart.rawX;
          const y = item._psStart.rawY;
          const offset = item.mainPathPaper.getOffsetOf(this._lastNearestPoint);
          const point = item.mainPathPaper.getPointAt(offset);
          // check if offset or point belongs to the segment
          item.mainPathPaper.segments.forEach((segment, idx) => {
            const _offset = segment.curve.getOffsetOf(this._lastNearestPoint);
            if (_offset === offset) {
              if (item.mainPathPaper.segments.length > 3) {
                item.highlightSegment(idx);
                //item.mainPathPaper.removeSegment(idx);
              }
            }
          });
        }

      const ptx = (globalLiveData.boardMousePos.x - item.x) / item.zoomLevel;
      const pty = (globalLiveData.boardMousePos.y - item.y) / item.zoomLevel;
      const pt = item.mainPathPaper.getNearestPoint(new paper.Point(ptx, pty));
      this._lastNearestPoint = pt;

      item._psStart._mainCtn.visible = true;
      if (!item._psStart.isZoomLocked) {
        item._psStart.zoomLevel = 5;
        item._psStart.isZoomLocked = true;
        item._psStart.reloadUI(item._psStart._boardSurface._spMainCtn);
      }

      item._psStart.x = (pt.x + item.rawX) * item.zoomLevel;
      item._psStart.y = (pt.y + item.rawY) * item.zoomLevel;
    }

    if (item.isDragged) {
      item.x = globalLiveData.boardMousePos.x - item.dragStartPosition.x;
      item.y = globalLiveData.boardMousePos.y - item.dragStartPosition.y;

      if (item._editPointIndex > -1 && e.button === 0) {
        item.dragEnd();
        item._editPointIndexPosition === 1 && item.drawPsLine(item._startDragPosition.x, item._startDragPosition.y, item._mainCtn.x, item._mainCtn.y, true, this.zoomLevel);
      }

      return;
    }

    if (item.mainPathPaper.contains({
      x: item.rawVal(globalLiveData.boardMousePos.x) - item.rawX,
      y: item.rawVal(globalLiveData.boardMousePos.y) - item.rawY
    })) {
      if (item.isDragStarted) {
        item.isDragged = true;
      } else {
        item.isHovered = true;
      }
    } else {
      item.isHovered = false;
    }
  });

  if (this._isDragStarted) {
    this._isDragged = true;
  }
  if (this._isDragged) {
    this._spMainCtn.x = (globalLiveData.screenMousePos.x - this._dragStartPosition.x) + this._dragBoardStartPosition.x;
    this._spMainCtn.y = (globalLiveData.screenMousePos.y - this._dragStartPosition.y) + this._dragBoardStartPosition.y;
    boardManager.selectedBoard.mainCtnPos = { x: this._spMainCtn.x, y: this._spMainCtn.y };
  }

  // Emit the event
  _evtBus.emit(_boardEvts.BoardSurface.onMove, e);
}