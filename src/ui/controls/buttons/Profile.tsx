/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { IconCmp } from "../icons/Icon";
import { _evtBus, _evts } from "../../../core/EventBus";

export class Profile extends BaseComponent {
  icon: IconCmp = new IconCmp();
  constructor() {
    super("Profile");
    this.registerTemplate("default",_default);

 
    this.icon.name   = "logo";
  }
}

const _default: TRenderHandler = ($this:Profile) => {
  return <>
    <div class="profile" style={{display: "flex", flexDirection:"column", alignItems: "center", marginTop: "30px", marginBottom: "55px"}}
      onClick={() => {
        _evtBus.emit(_evts.ButtonBar.Click, {id: $this.guid, name: "profile"});
      }}
    >
      {$this.icon.vdom}
      <div style={{color: "var(--color-text-primary)",marginTop: "25px"}}>
        Profile
      </div>
    </div>
  </>;
}