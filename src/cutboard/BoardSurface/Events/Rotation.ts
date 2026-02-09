import { BoardSurface } from "../BoardSurface";
import { boardManager } from "../../../../src/cutboard/BoardManager";
import { liveConfig } from "../../../../src/core/LiveConfig";

/**
 * Rotate the selected item
 * @param reverse - Rotate in the opposite direction
 */
export function RotateAction(this: BoardSurface, reverse: boolean) {
  // Prevent rotating when the board is unloaded
  if (this._unloaded) return;
  // Find the selected item
  const item = this.items.find(i => i._isSelected);

  if (item) {
    // Rotate the item in the correct direction if reverse is true, rotate in the opposite direction
    if   (reverse) item.angle += liveConfig.rotation;
    else item.angle           -= liveConfig.rotation;

    const save = item.saveState();
    // Before adding, we need to check if there is stack items after the current index
    // if there is, we need to remove them
    if (item._type === "ITEM" && !item._isEditMode) {
      if (boardManager.selectedBoard.newBoard.undoIdx < boardManager.selectedBoard.newBoard.undoStack.length - 1) {
        boardManager.selectedBoard.newBoard.undoStack = boardManager.selectedBoard.newBoard.undoStack.slice(0, boardManager.selectedBoard.newBoard.undoIdx + 1);
      }

      boardManager.selectedBoard.newBoard.undoStack.push([item, save]);
      boardManager.selectedBoard.newBoard.undoIdx = boardManager.selectedBoard.newBoard.undoStack.length - 1;
    }
  }
}