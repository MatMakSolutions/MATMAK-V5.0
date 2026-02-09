import { ppInfo } from "../../../../ui/controls/popup/Popup";
import { toastInfo } from "../../../../ui/controls/Toast/Toast";
import { BoardSurface } from "../../BoardSurface";

/**
 * Enter edit mode
 */
export function EnterEditAction(this: BoardSurface, e: MouseEvent) {
  // Prevent entering edit mode when the board is unloaded
  if (this._unloaded) return;

  // Find the selected item
  let found = false;
  this.items.forEach(item => {
    if (item.isSelected) {
      found = true;
      if (item.hasBeenOutwarded) {
        ppInfo("Outwarded", "This item has been outwarded and cannot be edited");
        return;
      }
      // Toggle the edit mode of the item
      const wasInEditMode = item._isEditMode;
      item.setEditMode(!item._isEditMode, true);
      // Show toast only when entering edit mode (not exiting)
      if (!wasInEditMode) {
        toastInfo("Hold Ctrl + Click & Drag to select multiple nodes", 4000);
      }
    }
  });

  if (!found) {
    this.items.forEach(item => {
      if (item._isEditMode) { // Exit edit mode
        found = true;
        item.setEditMode(!item._isEditMode, true);
      }
    });
  }
}