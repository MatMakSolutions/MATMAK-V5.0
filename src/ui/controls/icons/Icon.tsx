/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { TIcon } from "./TIcon";

export class IconCmp extends BaseComponent {
  width  : number = 24;
  height : number = 24;
  name   : TIcon = "add-all-to-board";
  type   : string = "svg";

  constructor() {
    super("IconCmp");
    this.registerTemplate("default",_default);
    this.registerDependencyProperties(["width","height","name"]);
  }
}

const _default: TRenderHandler = ($this:IconCmp) => {
  return <>
    <div style={{
      minWidth           : $this.width,
      minHeight          : $this.height,
      maxWidth           : $this.width,
      maxHeight          : $this.height,
      backgroundImage    : `url(assets/${$this.type}/${$this.name}.${$this.type})`,
      backgroundSize     : 'contain',
      backgroundRepeat   : 'no-repeat',
      backgroundPosition : 'center',
      color : "#000000",
      
    }} />
  </>;
}