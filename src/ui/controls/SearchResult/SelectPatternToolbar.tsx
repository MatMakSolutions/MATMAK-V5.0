/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { IconCmp } from "../icons/Icon";
import { _evtBus, _evts } from "../../../core/EventBus";
import { getUow } from "../../../uof/UnitOfWork";
import { ButtonBar } from "../buttons/ButtonBar";
import '../../../utils/css/selectpatterntoolbar.css';



export class SelectPatternToolbar extends BaseComponent {
  goToSearch: IconCmp = new IconCmp();
  addAllToBoard: IconCmp = new IconCmp();
  addSelectedToBoard: IconCmp = new IconCmp();
  zoomIn: IconCmp = new IconCmp();
  zoomOut: IconCmp = new IconCmp();
  leftClick: IconCmp = new IconCmp();
  rightPress: IconCmp = new IconCmp();
  scrolling: IconCmp = new IconCmp();

  constructor() {
    super("SelectPatternToolbar");
    this.registerTemplate("default", _default);
    this.goToSearch.name = "tb-undo";
    this.addAllToBoard.name = "add-all-to-board";
    this.addSelectedToBoard.name = "add-to-board";
    this.zoomIn.name = "zoom-in";
    this.zoomOut.name = "zoom-out";
    this.leftClick.name = "left-click";
    this.rightPress.name = "right-press";
    this.scrolling.name = "scrolling";

    this.goToSearch.width = 32;
    this.goToSearch.height = 32;
    this.addAllToBoard.width = 32;
    this.addAllToBoard.height = 32;
    this.addSelectedToBoard.width = 32;
    this.addSelectedToBoard.height = 32;
    this.zoomIn.width = 32;
    this.zoomIn.height = 32;
    this.zoomOut.width = 32;
    this.zoomOut.height = 32;
    this.leftClick.width = 32;
    this.leftClick.height = 32;
    this.rightPress.width = 32;
    this.rightPress.height = 32;
    this.scrolling.width = 32;
    this.scrolling.height = 32;

    this.leftClick.type = "png";
    this.rightPress.type = "png";
    this.scrolling.type = "png";
  }
}

const _default: TRenderHandler = ($this: SelectPatternToolbar) => {
  return (
    <div className="toolbar-container">
      <div className="toolbar-grid">
        <div
          className="toolbar-item"
          onClick={() => {
            const btnSearch = getUow<ButtonBar>("btnSearch");
            _evtBus.emit(_evts.ButtonBar.Click, { id: btnSearch.guid, name: btnSearch.name });
          }}
          role="button"
          tabIndex={0}
          title="Go to Search"
          onKeyPress={(e: any) => e.key === 'Enter' && e.target.click()}
        >
          {$this.goToSearch.vdom}
          <span>Go To Search</span>
        </div>
        <div
          className="toolbar-item"
          onClick={() => _evtBus.emit(_evts.PatternSelection.addAll)}
          role="button"
          tabIndex={0}
          title="Add All to Board"
          onKeyPress={(e: any) => e.key === 'Enter' && e.target.click()}
        >
          {$this.addAllToBoard.vdom}
          <span>Add All</span>
        </div>
        <div
          className="toolbar-item"
          onClick={() => _evtBus.emit(_evts.PatternSelection.addSelected)}
          role="button"
          tabIndex={0}
          title="Add Selected to Board"
          onKeyPress={(e: any) => e.key === 'Enter' && e.target.click()}
        >
          {$this.addSelectedToBoard.vdom}
          <span>Add Selected</span>
        </div>
        <div
          className="toolbar-item"
          onClick={() => _evtBus.emit(_evts.PatternSelection.zoomIn)}
          role="button"
          tabIndex={0}
          title="Zoom In"
          onKeyPress={(e: any) => e.key === 'Enter' && e.target.click()}
        >
          {$this.zoomIn.vdom}
          <span>Zoom In</span>
        </div>
        <div
          className="toolbar-item"
          onClick={() => _evtBus.emit(_evts.PatternSelection.zoomOut)}
          role="button"
          tabIndex={0}
          title="Zoom Out"
          onKeyPress={(e: any) => e.key === 'Enter' && e.target.click()}
        >
          {$this.zoomOut.vdom}
          <span>Zoom Out</span>
        </div>
        <div className="toolbar-divider"></div>
        <div className="info-item" title="Select or Deselect Patterns">
          {$this.leftClick.vdom}
          <span>Select/Deselect</span>
        </div>
        <div className="info-item" title="Pan with Right Mouse Drag">
          {$this.rightPress.vdom}
          <span>Pan To move </span>
        </div>
        <div className="info-item" title="Zoom with Mouse Scroll">
          {$this.scrolling.vdom}
          <span>Zoom</span>
        </div>
      </div>
    </div>
  );
};