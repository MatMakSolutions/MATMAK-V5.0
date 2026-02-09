/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";

export class Table extends BaseComponent {
  extendedIndex: number = -1;
  columns: {size: string | number, title: string}[] = [];
  rows: (string | number | any)[][] = [];
  fontSize: string = "18px";
  constructor() {
    super("Table");
    this.registerTemplate("default",_default);
  }
}

const _default: TRenderHandler = ($this:Table) => {
  const columns = $this.columns.map((column, index) => {
    return <div key={index} style={{
      flex            : column.size,
      display         : "flex",
      justifyContent  : "flex-start",
      alignItems      : "center",
      padding         : "10px",
      fontSize        : "20px",
      fontWeight      : "bold",
    }}>
      {column.title}
    </div>;
  });

  const rows = $this.rows?.map?.((row, index) => {
    const isExtendable = row.length > $this.columns.length;
    const isExtended = $this.extendedIndex === index;
    return <>
    <div class="table-hover" key={index} style={{
      flex            : columns[index]?.props?.size || 1,
      display         : "flex",
      flexDirection   : "row",
      borderBottom    : isExtended ? "1px solid transparent" : "1px solid #25A9E055",
      justifyContent  : "flex-start",
      alignItems      : "center",
      maxHeight       : isExtended ? "50px" : "50px",
      minHeight       : isExtended ? "50px" : "50px",
      cursor          : isExtendable ? "pointer" : "default",
      backgroundColor : isExtendable ? "transparent" : "transparent",
    }}
    onClick={() => {
      if (!isExtendable) return;
        $this.extendedIndex = isExtended ? -1 : index;
        $this.update();
        setTimeout(() => {
          (index === $this.rows.length - 1) && document.querySelector(".max-pane")?.scrollBy(0, 50);
        }, 200);
    }}
    >
      {row.map((cell, index, cells) => {
        if (isExtendable && index === cells.length - 1) return <></>;
        return <><div key={index} style={{
          flex           : $this.columns[index].size,
          display        : "flex",
          justifyContent : "flex-start",
          alignItems     : "center",
          padding        : "10px",
          fontSize       : $this.fontSize,
        }}>
          {cell}
        </div>
        </>;
      })}
    </div>
    {(isExtendable && isExtended) && <div key={index} style={{
      flex           : 1,
      display        : "flex",
      flexDirection  : "row",
      justifyContent : "flex-start",
      alignItems     : "center",
      maxHeight      : "50px",
      borderBottom    : "1px solid #25A9E055",
    }}>
      <div key={index} style={{
        flex           : 1,
        display        : "flex",
        justifyContent : "flex-start",
        alignItems     : "center",
        padding        : "10px",
        fontSize       : $this.fontSize,
      }}>
        <b>List of patterns : [<em>{row[row.length - 1]}</em>]</b>
      </div>
    </div>}
    </>
  });


  return <>
    <div style={{
      flex          : "1",
      display       : "flex",
      flexDirection : "row",
      maxHeight     : "50px",
    }}>
      {columns}
    </div>
      {rows}
  </>;
}