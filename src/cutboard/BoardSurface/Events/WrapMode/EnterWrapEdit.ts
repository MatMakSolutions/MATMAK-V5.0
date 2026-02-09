import { ppInfo } from "../../../../../src/ui/controls/popup/Popup";
import { BoardSurface } from "../../BoardSurface";

export function EnterWrapEditAction(this: BoardSurface) {
  if (this._unloaded) return;
      let found = false;
      this.items.forEach(item => {
        if (item.isSelected) {
          found = true;
          if (item.hasBeenOutwarded) {
            ppInfo("Outwarded", "This item has been outwarded and cannot be wrapped");
            return;
          }
          item.isWrapMode = !item._isWrapMode;
        }
      });

      if (!found) {
        this.items.forEach(item => {
            item.isWrapMode = false;
        });
      }
}