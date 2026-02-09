import { ppInfo } from "../../../../../src/ui/controls/popup/Popup";
import { BoardSurface } from "../../BoardSurface";

/**
 * Enter split edit mode
 */
export function EnterSplitEditAction(this: BoardSurface) {
  // Prevent entering split edit mode when the board is unloaded
  if (this._unloaded) return;

  let found = false;
  this.items.forEach(item => {
    if (item.isSelected) {
      found = true;
      if (item.hasBeenOutwarded) {
        ppInfo("Outwarded", "This item has been outwarded and cannot be splited");
        return;
      }
      item.isSplitMode = !item._isSplitMode;
    }
  });

  // Exit split mode
  if (!found) {
    this.items.forEach(item => {
        item.isSplitMode = false;
    });
  }
}