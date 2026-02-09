/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { TIcon } from "../icons/TIcon";
import { IconCmp } from "../icons/Icon";
import { guid } from "src/core/Guid";
import { _evtBus, _evts } from "../../../core/EventBus";
import { ppInfo } from "../popup/Popup";

export class ButtonBar extends BaseComponent {
  name: TIcon   = "add-all-to-board";
  icon: IconCmp = new IconCmp();
  text: string  = "";
  selected: boolean = false;
  isRoot: boolean = false;
  notImplemented: boolean = false;

  constructor() {
    super("ButtonBar");
    this.registerTemplate("default",_default);
    this.registerDependencyProperties(["name", "text", "selected"]);
    this.icon.width  = 27;
    this.icon.height = 27;
  }
}

const _default: TRenderHandler = ($this: ButtonBar) => {
  $this.icon.name = $this.name;
  let style = {};
  if ($this.isRoot) {
    style = { height: "130px"};
  }
  return <>
  <div>
    <div class="button-bar" style={{...style}} onClick={() => {
        if (!$this.isRoot) {
          $this.selected = true;
          _evtBus.emit(_evts.ButtonBar.Click, {id: $this.guid, name: $this.name});
          if ($this.notImplemented) {
            ppInfo("Not Implemented", "This feature is not implemented yet", "Ok", 500, 210);
            _evtBus.emit(_evts.ButtonBar.Click, {id: "", name: ""});

          }
        }
      }}>
      <div class={`button-bar ${$this.selected ? "selected" : ""}`} style={{position: "absolute"}}/>
      <div class="icon" style={{zIndex: 200}}>
        {$this.icon.vdom}
      </div>
      <div class="text" style={{zIndex: 200}}>
        {$this.text}
      </div>
    </div>
  </div>
  </>;
}