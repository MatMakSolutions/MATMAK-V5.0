/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";

export class Button extends BaseComponent {
  text: string;
  onClick: () => void;
  isDisabled: boolean = false;

  constructor() {
    super("Button");
    this.registerTemplate("default",_default);
    this.registerDependencyProperties(["text", "isDisabled"]);
  }
}

const _default: TRenderHandler = ($this:Button) => {
  return <>
   <div class="filter-drop-down"  style={{backgroundColor: "#25A8DF", opacity: $this.isDisabled ? 0.3 : 1}} onClick={() => !$this.isDisabled && $this.onClick?.()}>
    <span style={{
      fontWeight : "500",
      color      : "white",
      cursor     : "pointer",
    }}>{$this.text}</span>
  </div>
  </>;
};