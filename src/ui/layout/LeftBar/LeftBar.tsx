/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { systemDesign } from "../../SystemDesign";
import { CancelEvent, _evtBus, _evts } from "../../../core/EventBus";
import { ButtonBar } from "../../../ui/controls/buttons/ButtonBar";
import { Profile } from "../../../ui/controls/buttons/Profile";
import { IconCmp } from "../../../ui/controls/icons/Icon";

export class LeftBar extends BaseComponent {
  children: BaseComponent[] = [];
  profile: Profile = new Profile();
  brand: IconCmp = new IconCmp();

  constructor() {
    super("LeftBar");
    this.registerTemplate("default",_default);
    this.registerDependencyProperties(["children"]);
    let evtBtnClick: CancelEvent = null;

    this.addEventListener("mount", () => {
      evtBtnClick = _evtBus.on(_evts.ButtonBar.Click, (payload: {id: string}) => {
        this.children.forEach((child: ButtonBar) => {
          if (child.guid !== payload.id) {
            child.selected = false;
          }
        });
      });
    });

    this.addEventListener("unmount", () => {
      evtBtnClick.off();
    });

   this.brand.name = "brand";
    this.brand.width = 87;
    this.brand.height = 69;
    
  }
  toggleDarkMode = async () => {
    await (window as any).darkMode.toggle();
  }
}

const _default: TRenderHandler = ($this: LeftBar) => {
  return <>
    <div class="left-bar">
      <div style={{
       
      }}>
       
        {/* Render children (buttons) with separators */}
        {$this.children.map((child, idx) => [
          idx > 0 && <hr style={{
           
          }} />,
          child.vdom,
          idx === $this.children.length - 1 && <hr style={{
           
          }} />
        ])}
     
        {$this.profile.vdom}

         {/* Place brand logo at the top */}
        <div style={{

          paddingLeft: '17px',
          paddingBottom: '5px',
}}>
  {$this.brand.vdom}
  <span style={{
  
  
  }}>

  </span>
</div>

      </div>
    </div>
  </>;
}

LeftBar.registerSystemDesign(systemDesign);