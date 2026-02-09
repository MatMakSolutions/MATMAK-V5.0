/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";

export class FilterField extends BaseComponent {
  constructor() {
    super("FilterField");
    this.registerTemplate("default",_default);
  }
}

const _default: TRenderHandler = ($this:FilterField) => {
  return <>
    <div class="filter-drop-down" style={{
      backgroundColor: "black",
      color : "white",
      minWidth: "130px",
      maxWidth: "130px",
      borderRadius: "10px",
      marginTop: "20px",
      marginLeft: "30px",

    }}>
    <div style={{
      backgroundImage    : "url(assets/svg/filter.svg)",
      minWidth           : "18px",
      minHeight          : "18px",
      maxWidth           : "18px",
      maxHeight          : "18px",
      backgroundSize     : "contain",
      backgroundRepeat   : "no-repeat",
      backgroundPosition : "center",
      position           : "absolute",
      top                : "15px",
      left               : "15px",
    }} />
  <span style={{
    fontWeight          : "400",
  }}>Filters</span>
      <div style={{
      backgroundImage    : "url(assets/svg/white-triangle.svg)",
      minWidth           : "18px",
      minHeight          : "18px",
      maxWidth           : "18px",
      maxHeight          : "18px",
      backgroundSize     : "contain",
      backgroundRepeat   : "no-repeat",
      backgroundPosition : "center",
      position           : "absolute",
      top                : "15px",
      right              : "10px",
    }} />
</div>
  </>;
}

const dropDown = (text: string) => {

  return 
}