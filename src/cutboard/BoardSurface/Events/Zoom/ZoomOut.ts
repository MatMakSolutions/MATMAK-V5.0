import { boardManager } from "../../../BoardManager";
import { BoardSurface } from "../../BoardSurface";
import { MIN_ZOOM, ZOOM_STEP } from "../../../../core/Constant";

/**
 * Zoom out the board
 */
export function ZoomOutAction(this: BoardSurface) {
  // Prevent zooming when the board is unloaded
  if (this._unloaded) return;
  // Zoom out
  this.zoomLevel -= ZOOM_STEP;
  // Prevent zooming out too much
  if (this.zoomLevel < MIN_ZOOM) this.zoomLevel = MIN_ZOOM;
  // Update the zoom level of the board
  boardManager.selectedBoard.newBoard.zoomLevel = this.zoomLevel;
  // Update the zoom level of the items
  this.items.forEach(item => {
    item.zoomLevel = this.zoomLevel;
    item.rawX      = item.rawX;
    item.rawY      = item.rawY;
    item.reloadUI(this._spMainCtn);
  });
  // Redraw the board
  this.drawBoard();
}