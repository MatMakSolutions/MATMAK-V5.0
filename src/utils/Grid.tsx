import * as React from "react";

export function Grid({children, style, debug, is12}: {is12?: boolean; children?: any, style?: React.CSSProperties, debug?: boolean}) {
  return (
    <div className={`grid-container${is12 ? "-12" : ""}${debug ? "-debug" : ""}`} style={style}>
      {children}
    </div>
  );
}
type TColType = "-" | "+" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15" | "16";
export function Cell(props: {
  children ?: any;
  style    ?: React.CSSProperties;
  class    ?: string;
  colXs    ?: TColType;
  colSm    ?: TColType;
  colMd    ?: TColType;
  colLg    ?: TColType;
  colXl    ?: TColType;
  colXxl   ?: TColType;
  centered ?: boolean;
}) {
  const classes = [];
  if (props.colXs)    classes.push(["-","+"].includes(props.colXs)  ? `x${props.colXs}col-xs`   : `col-xs-${props.colXs}`);
  if (props.colSm)    classes.push(["-","+"].includes(props.colSm)  ? `x${props.colSm}col-sm`   : `col-sm-${props.colSm}`);
  if (props.colMd)    classes.push(["-","+"].includes(props.colMd)  ? `x${props.colMd}col-md`   : `col-md-${props.colMd}`);
  if (props.colLg)    classes.push(["-","+"].includes(props.colLg)  ? `x${props.colLg}col-lg`   : `col-lg-${props.colLg}`);
  if (props.colXl)    classes.push(["-","+"].includes(props.colXl)  ? `x${props.colXl}col-xl`   : `col-xl-${props.colXl}`);
  if (props.colXxl)   classes.push(["-","+"].includes(props.colXxl) ? `x${props.colXxl}col-xxl` : `col-xxl-${props.colXxl}`);
  if (props.class)    classes.push(props.class);
  if (props.centered) classes.push("i-stack");

  return (
    <div className={classes.join(" ")} style={props.style}>
      {props.children}
    </div>
  );
}