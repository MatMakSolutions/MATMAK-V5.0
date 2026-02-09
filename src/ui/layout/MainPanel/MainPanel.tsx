/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { _evtBus, _evts } from "../../../core/EventBus";

export class MainPanel extends BaseComponent {
  topPanel   : BaseComponent;
  leftPanel  : BaseComponent;
  rightPanel : BaseComponent;
  maxPanel   : BaseComponent;
  topBarVisible: boolean = false;


  constructor() {
    super("MainPanel");
    this.registerTemplate("default",_default);
    this.registerTemplate("3Panes",_3Panes);
    this.setState("3Panes");
    this.registerDependencyProperties(["topBarVisible"]);

    _evtBus.on(_evts.ButtonBar.Click, (payload: { name: string }) => {
      this.topBarVisible = payload.name === "cut-board";
      this.update();
    });
  }
}


const _default: TRenderHandler = ($this: MainPanel) => {
  return <>
    <div class={`main-panel ${!$this.topBarVisible ? 'no-top-bar' : ''}`}>
      <div class="max-pane">
        <div style={{ height: "30px"}}/>
        {$this.maxPanel?.vdom}
      </div>
    </div>
  </>;
}

const _3Panes: TRenderHandler = ($this: MainPanel) => {
  return <>
    <div class={`main-panel ${!$this.topBarVisible ? 'no-top-bar' : ''}`}>
      <div class="top-pane" style={{marginTop: "0px"}}>
        {$this.topPanel?.vdom}
      </div>
      <div class="sub-panel">
        <div class="left-pane">
          {$this.leftPanel?.vdom}
        </div>
        <div class="right-pane">
          {$this.rightPanel?.vdom}
        </div>
      </div>
    </div>
  </>;
}