import { MAX_ZOOM, ZOOM_STEP } from "../../../../core/Constant";
import { BoardSurface } from "../../BoardSurface";
import { boardManager } from "../../../BoardManager";

/**
 * Zoom in the board
 */
export function ZoomInAction(this: BoardSurface) {
  // Prevent zooming when the board is unloaded
  if (this._unloaded) return;
  // Zoom in
  this.zoomLevel += ZOOM_STEP;
  // Prevent zooming in too much
  if (this.zoomLevel > MAX_ZOOM) this.zoomLevel = MAX_ZOOM;
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