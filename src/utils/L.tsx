/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f, JSXInternal
} from "@ekkojs/web-controls";

type TColType = "-" | "+" ;


export type TLProps = {
  gap      ?: number;
  padding  ?: number;
  root     ?: boolean;
  absolute ?: boolean;
  fixed    ?: boolean;
  row      ?: boolean;
  col      ?: boolean;
  debug    ?: boolean;
  children ?: any;
  size     ?: number | string;
  fixWidth ?: number;
  fixHeight?: number;
  fullSize ?: boolean;

  class    ?: string;
  colXs    ?: TColType;
  colSm    ?: TColType;
  colMd    ?: TColType;
  colLg    ?: TColType;
  colXl    ?: TColType;
  colXxl   ?: TColType;

  overflowX ?: "auto" | "hidden" | "scroll" | "visible";
  overflowY ?: "auto" | "hidden" | "scroll" | "visible";

  style    ?: JSXInternal.CSSProperties;
}

export function L(props: TLProps) {
  const style = {
    gap           : props.gap || 0,
    display       : "flex",
    flexDirection : props.col ? "column" : "row",
    padding       : props.padding || 0
  } as JSXInternal.CSSProperties;

  // Root means this container is the first one in the hierarchy
  if (props.root) {
    style.width  = "100%";
    style.height = "100%";
  }

  // Absolute means this container is the root
  if (props.absolute) {
    style.position = "absolute";
    style.top      = 0;
    style.left     = 0;
    style.right    = 0;
    style.bottom   = 0;
  }

  // Fixed means this container is the root
  if (props.fixed) {
    style.position = "fixed";
    style.top      = 0;
    style.left     = 0;
    style.right    = 0;
    style.bottom   = 0;
  }

  // Debug means we want to see the layout
  // And give a min size to the container
  if (props.debug) {
    style.border          = "1px solid red";
    style.backgroundColor = "rgba(255, 0, 0, 0.1)";
    style.boxSizing       = "border-box";
  }

  // Size means we want to give a fixed size to the container if it is a string or flex def if it is a number
  if (props.size) {
    if (typeof props.size === "number") {
      style.flex = props.size;
    } else {
      // depends on the direction
      if (style.flexDirection === "row") {
        style.width = props.size;
      } else {
        style.height = props.size;
      }
    }
  }

  if (!props.col && !props.row) {
    style.justifyContent = "stretch";
    style.alignItems     = "stretch";
  }

  // If dir = row, children should be stretched vertically
  if (style.flexDirection === "row") {
    style.alignItems = "stretch";
  }
  // If dir = col, children should be stretched horizontally
  if (style.flexDirection === "column") {
    style.justifyContent = "stretch";
  }

  //Fix size (min and max width and height)
  if (props.fixWidth) {
    style.minWidth = props.fixWidth;
    style.maxWidth = props.fixWidth;
  }
  if (props.fixHeight) {
    style.minHeight = props.fixHeight;
    style.maxHeight = props.fixHeight;
  }



  // Overflow
  if (props.overflowX) style.overflowX = props.overflowX;
  if (props.overflowY) style.overflowY = props.overflowY;

  // Merge with style
  if (props.style) {
    Object.assign(style, props.style);
  }

  const classes = [];
  if (props.colXs)    classes.push(["-","+"].includes(props.colXs)  ? `x${props.colXs}col-xs`   : `col-xs-${props.colXs}`);
  if (props.colSm)    classes.push(["-","+"].includes(props.colSm)  ? `x${props.colSm}col-sm`   : `col-sm-${props.colSm}`);
  if (props.colMd)    classes.push(["-","+"].includes(props.colMd)  ? `x${props.colMd}col-md`   : `col-md-${props.colMd}`);
  if (props.colLg)    classes.push(["-","+"].includes(props.colLg)  ? `x${props.colLg}col-lg`   : `col-lg-${props.colLg}`);
  if (props.colXl)    classes.push(["-","+"].includes(props.colXl)  ? `x${props.colXl}col-xl`   : `col-xl-${props.colXl}`);
  if (props.colXxl)   classes.push(["-","+"].includes(props.colXxl) ? `x${props.colXxl}col-xxl` : `col-xxl-${props.colXxl}`);
  if (props.class)    classes.push(props.class);
  if (props.fullSize) classes.push("i-stack");

  return <div className={classes.join(" ")} style={style}>
    {props.children}
  </div>;
}