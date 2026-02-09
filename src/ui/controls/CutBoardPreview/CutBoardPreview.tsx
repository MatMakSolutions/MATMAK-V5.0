/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { TIcon } from "../icons/TIcon";
import { currentPatternSelection, mapToArray, searchCut } from "../../../uof/Globals";
import { _evtBus, _evts } from "../../../core/EventBus";
import { boardManager } from "../../../cutboard/BoardManager";
import { ppInfo } from "../popup/Popup";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";
import { surfaceManager } from "../../../Graphics/SurfaceManager";
import '../../../utils/css/cutboardpreview.css';

export class CutBoardPreview extends BaseComponent {
  isClosed = false;
  constructor() {
    super("CutBoardPreview");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isClosed"]);
  }
}
 


const _default: TRenderHandler = ($this: CutBoardPreview) => {
  setTimeout(() => {
    const rp = document.querySelector<HTMLDivElement>(".right-pane");
    if (rp) {
      if ($this.isClosed) {
        rp.classList.add("collapsed");
      } else {
        rp.classList.remove("collapsed");
      }
      (window as any).searchApp.resize();
      setTimeout(() => {
        (window as any).searchApp.resize();
      }, 1);
    }
  }, 1);

  const handleRemove = (idx: number) => {
    try {
      if (idx < 0 || idx >= searchCut.length) {
        ppInfo('Error', 'Invalid item selected for removal.');
        return;
      }

      const minLength = Math.min(
        searchCut.length,
        currentPatternSelection.images.length,
        currentPatternSelection.colorPacks.length
      );
      if (minLength !== searchCut.length || minLength !== currentPatternSelection.images.length || minLength !== currentPatternSelection.colorPacks.length) {
        searchCut.length = minLength;
        currentPatternSelection.images.length = minLength;
        currentPatternSelection.colorPacks.length = minLength;
      }

      if (idx >= minLength) {
        ppInfo('Error', 'Item no longer exists after data correction.');
        return;
      }

      const patternFile = searchCut[idx];
      const image = currentPatternSelection.images[idx];
      const colorPack = currentPatternSelection.colorPacks[idx];

      if (!patternFile || image === undefined || colorPack === undefined) {
        ppInfo('Error', 'Cannot remove item due to incomplete data.');
        return;
      }

      searchCut.splice(idx, 1);
      currentPatternSelection.images.splice(idx, 1);
      currentPatternSelection.colorPacks.splice(idx, 1);

      currentPatternSelection.selections = currentPatternSelection.selections.filter(
        (item) => item.carColor !== colorPack
      );

      const selItemsToRemove = surfaceCollection.draftSelection?.patterns.filter(
        (item) => item.patternColor === colorPack
      ) ?? [];
      const removedPatternGuids: string[] = [];
      selItemsToRemove.forEach((item) => {
        try {
          surfaceCollection.draftSelection?.removePattern(item.guid);
          removedPatternGuids.push(item.guid);
        } catch (e) {}
      });

      const remainingPatterns = surfaceCollection.draftSelection?.patterns.filter(
        (item) => item.patternColor === colorPack
      ) ?? [];
      if (remainingPatterns.length > 0 && surfaceCollection.draftSelection) {
        surfaceCollection.draftSelection.patterns = surfaceCollection.draftSelection.patterns.filter(
          (item) => item.patternColor !== colorPack
        );
      }

      _evtBus.emit('CutItemRemoved', { index: idx, guid: patternFile.guid, colorPack });

      $this.update();
    } catch (e) {
      ppInfo('Error', 'Failed to remove item. Please try again.');
    }
  };

  const isSearchCutEmpty = !searchCut || searchCut.length === 0;

  return (
    <div class="cut-board-preview-container">
      <div class="cut-pane-header">
        <div class="header-title" style={{ display: $this.isClosed ? "none" : "block" }}>
          Cut Board Preview
        </div>
        <div class="toggle-button" onClick={() => {
          $this.isClosed = !$this.isClosed;
          $this.update();
        }} aria-label={$this.isClosed ? "Expand Cut Board Preview" : "Collapse Cut Board Preview"} role="button" tabIndex={0}
        onKeyPress={(e: any) => e.key === 'Enter' && ($this.isClosed = !$this.isClosed)}>
          <div class="toggle-icon" style={{
            transform: $this.isClosed ? "scaleX(-1)" : "scaleX(1)",
          }}></div>
        </div>
      </div>
      {!$this.isClosed && (
        <div class="cut-board-content">
          {isSearchCutEmpty ? (
            <div class="empty-message">No items in Cut Board Preview. Add items to proceed.</div>
          ) : (
            searchCut.map((item, idx) => (
              <div key={`${item.guid}`} class="cut-board-card">
                <div class="card-title">{item.name}</div>
                <button
                  class="remove-button"
                  onClick={() => handleRemove(idx)}
                  onKeyPress={(e: any) => e.key === 'Enter' && handleRemove(idx)}
                  aria-label={`Remove ${item.name}`}
                  role="button"
                >
                  <span>X</span>
                </button>
                <div class="card-image" style={{
                  backgroundImage: `url(${currentPatternSelection.images[idx]})`,
                }} />
              </div>
            ))
          )}
          <div class="action-button-container">
            {blackButton("add-to-cut", "Open Cut Board", isSearchCutEmpty ? () => {
              ppInfo("Empty Preview", "Cannot open Cut Board with no items. Add items to proceed.");
            } : () => {
              if (boardManager.boards.length === 5) {
                ppInfo("Board limit", "You can only have 5 boards open at a time.");
                return;
              }
              
              _evtBus.emit(_evts.ButtonBar.Click, { name: "cut-board" });
              boardManager.createBoard();
              
              if (surfaceCollection.draftSelection) {
                surfaceCollection.createFromDraft();
              }
              
              // Clear items
              searchCut.length = 0;
              currentPatternSelection.images.length = 0;
              currentPatternSelection.colorPacks.length = 0;
              currentPatternSelection.selections.length = 0;
              if (surfaceCollection.draftSelection) {
                surfaceCollection.draftSelection.patterns = [];
              }
              
              $this.update();
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const blackButton = (icon: TIcon, text: string, action?: () => void) => {
  return (
    <button class="black-button" onClick={() => action?.()} aria-label={text} role="button">
      <div class="button-icon" style={{
        backgroundImage: `url(assets/svg/${icon}.svg)`,
      }} />
      <span>{text}</span>
    </button>
  );
}

export const blackButtonThin = (icon: TIcon, text: string, size: number = 150, revert = false, onClick?: () => void) => {
  const style = {} as any;
  const textStyle = {} as any;

  if (revert) {
    style["right"] = "10px";
    textStyle["paddingRight"] = "15px";
  } else {
    style["left"] = "10px";
    textStyle["paddingLeft"] = "15px";
  }

  return (
    <button class="black-button thin" style={{ minWidth: `${size}px`, maxWidth: `${size}px` }} onClick={() => onClick?.()} aria-label={text} role="button">
      <span style={textStyle}>{text}</span>
      <div class="button-icon" style={{
        backgroundImage: `url(assets/svg/${icon}.svg)`,
        minWidth: revert ? "12px" : "20px",
        minHeight: revert ? "12px" : "20px",
        maxWidth: revert ? "12px" : "20px",
        maxHeight: revert ? "12px" : "20px",
        top: revert ? "12px" : "8px",
        ...style,
      }} />
    </button>
  );
}