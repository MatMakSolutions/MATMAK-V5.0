import { boardManager } from "../../../../../src/cutboard/BoardManager";
import { BoardSurface } from "../../BoardSurface";
import { _boardEvts, _evtBus } from "../../../../../src/core/EventBus";

export function MouseUpAction(this: BoardSurface, e: MouseEvent) {
  if (this._unloaded) return;
      if (e.button === 2) {
        this.items.forEach(item => {
          item.isDragStarted = false;
          item.isDragged = false;
        });
        this._isDragStarted = false;
        this._isDragged = false;
        document.body.style.cursor = "default";
      }

      if (e.button === 0) {
        const anyDragged = this.items.some(it => it.isDragged);
        this.items.forEach(item => {
          if (item.isDragged) {
            item.isDragged = false;
            item.isDragStarted = false;
            item.dragEnd();
            const save = item.saveState();
            // Before adding, we need to check if there is stack items after the current index
            // if there is, we need to remove them
            // Check if teh item is a pattern not a circle
            if (item._type === "ITEM" && !item._isEditMode) {
              if (boardManager.selectedBoard.newBoard.undoIdx < boardManager.selectedBoard.newBoard.undoStack.length - 1) {
                boardManager.selectedBoard.newBoard.undoStack = boardManager.selectedBoard.newBoard.undoStack.slice(0, boardManager.selectedBoard.newBoard.undoIdx + 1);
              }
              boardManager.selectedBoard.newBoard.undoStack.push([item, save]);
              boardManager.selectedBoard.newBoard.undoIdx = boardManager.selectedBoard.newBoard.undoStack.length - 1;
            }
          } else if (!anyDragged) {
            if (item._type === "ITEM" && item.isDragStarted && (!item.isDragged || !item.allowDragNDrop)) {
              if (!(item._isEditMode || item._isSplitMode || item._isWrapMode)) {
                item.isSelected = !item.isSelected;
              }

              if (item._editPathItem?._isEditMode) {
                return;
              }
            } else {
              if (!(item._isEditMode || item._isSplitMode || item._isWrapMode)) {
                item.isSelected = false;
              }
            }
          }

          item.isDragStarted = false;
          item.isDragged = false;
          if (item._psLine?.visible) {
            item._psLine.visible = false;
          }
        });
      }
      _evtBus.emit(_boardEvts.BoardSurface.onMouseUp, e);
      if (this.hasItemSelected) {
        // get the selected item
        const selectedItem = this.items.filter(_ => _.isSelected)[0];
        // if not in edit mode, then we need to display the rotation input
        if (selectedItem._isEditMode) return;
        // if in wrap mod eexit
        if (selectedItem.isWrapMode) return;
        // if split mode exit
        if (selectedItem.isSplitMode) return;



        const rotationElt = document.createElement("input");
        // insert it in the body
        //test if exists, delete it
        if (document.getElementById("rotation-elt")) {
          document.getElementById("rotation-elt").remove();
          document.getElementById("rotation-eltl").remove();
        }
        //document.body.appendChild(rotationElt);
        rotationElt.type = "range";
        // range value is from 0 to 360
        rotationElt.min = "0";
        rotationElt.max = "360";
        // steps are 25 degrees
        rotationElt.step = "25";
        // Input size is 300px, displayed as fixed on the bottom right
        rotationElt.style.position = "fixed";
        rotationElt.style.top = "115px";
        rotationElt.style.right = "20px";
        rotationElt.value = selectedItem.angle.toString();
        // Add a label saying rotation
        const label = document.createElement("label");
        // uniue id
        label.id = "rotation-eltl";
        label.innerText = "Rotation";
        label.style.position = "fixed";
        // bold
        label.style.fontWeight = "bold";
        label.style.top = "112px";
        label.style.right = "161px";
        //document.body.appendChild(label);

        // Needs to have a unique id
        rotationElt.id = "rotation-elt";
        // when we change teh value, we need to rotate the selected items
        rotationElt.addEventListener("input", (e) => {
          this.items.filter(_ => _.isSelected).forEach(item => {
            item.angle = parseInt((e.target as HTMLInputElement).value);
            item.reloadUI(this._spMainCtn);
          });
        });
      } else {
        // if no item is selected, remove the rotation input
        const rotationElt = document.getElementById("rotation-elt");
        const label = document.getElementById("rotation-eltl");
        if (rotationElt) {
          rotationElt.remove();
          label.remove();
        }
      }
}