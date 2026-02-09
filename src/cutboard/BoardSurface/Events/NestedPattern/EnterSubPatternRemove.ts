import { ppInfo } from "../../../../../src/ui/controls/popup/Popup";
import { BoardSurface } from "../../BoardSurface";

/**
 * Enter sub pattern remove mode
 */
export function EnterSubPatternRemoveAction(this: BoardSurface) {
  // Prevent entering sub pattern remove mode when the board is unloaded
  if (this._unloaded) return;

  // Find the selected item
  this.items.forEach(item => {
    // Check if the item is selected and has sub patterns
    const isSubPatterns = item.workingPapers.length > 1;

    if (item.isSelected && isSubPatterns) {
      if (item.hasBeenOutwarded) {
        ppInfo("Outwarded", "This item has been outwarded and cannot be edited");
        return;
      }
      // Toggle the sub pattern remove mode of the item
      item.isSubPatternMode = true;
      item.removeSubPatterns();
      item.isSubPatternMode = false;
    }
  });
}