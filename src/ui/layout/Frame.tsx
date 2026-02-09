/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { systemDesign } from "../SystemDesign";

export class MainFrame extends BaseComponent {
  theme : string = "";
  children: BaseComponent[] = [];

  constructor() {
    super("MainFrame");
    this.registerTemplate("default",_default);
  }
}

const _default: TRenderHandler = ($this:MainFrame) => {
  return <>
    <div class={`${$this.theme} mm main-frame`}>
      {$this.children.map((child) => child.vdom)}
    </div>
  </>;
}

MainFrame.registerSystemDesign(systemDesign)