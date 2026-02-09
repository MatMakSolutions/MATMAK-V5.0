/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f,
  JSXInternal
} from "@ekkojs/web-controls";

export class Label extends BaseComponent {
  title     : string  = "";
  text      : string  = "";
  isOpened  : boolean = false;
  items     : any[]   = [];
  itemLabel : string  = "";
  selectedItem : any;

  isDisabled: boolean = false;

  onSelect : (item: any) => void;

  constructor() {
    super("Label");
    this.registerTemplate("default",_default);
    this.registerDependencyProperties(["title", "text", "isOpened", "isDisabled"]);
  }

  openList() {
    if (this.isOpened) return;

    this.isOpened = true;
  }

  reset() {
    this.text         = "";
    this.isOpened     = false;
    this.items.length = 0;
  }
}

const _default: TRenderHandler = ($this:Label) => {
  let lst = null as JSXInternal.Element;

  if ($this.isOpened) {
   lst =  <div class="">
      {$this.items.map((item) => {
        return <div class=""
          onClick={() => {
            $this.text = item[$this.itemLabel];
            $this.isOpened = false;
            $this.selectedItem = item;
            $this.onSelect?.(item);
          }}
          >{item[$this.itemLabel]}</div>;
      })}
    </div>;
  } else {
    lst = null;
  }

  return <>
      <div class=""
        style={{
          opacity        : $this.isDisabled ? "0.3" : "1",
          minWidth       : "400px",
          maxWidth       : "400px",
          display        : "flex",
          position       : "relative",
          flexDirection  : "row",
          justifyContent : "center",
          marginTop      : "40px",
        }}

      >
    <div style={{
      position   : "absolute",
      left       : "10px",
      top        : "-40px",
      fontWeight : "500",
      fontStyle  : "italic",
    }}>
      {$this.title}
    </div>
      <div class=""
        onClick={() => {
          !$this.isDisabled && $this.openList();
        }}
        >
        <span style={{
          fontWeight: "500",
        }}>{$this.text !== "" ? $this.text : $this.title}</span>

      </div>

        </div>

  </>;
};

async function waitFor<T>(handler: () => T, timeout: number = 10000): Promise<T> {
  return new Promise((resolve: (value?: any) => void, reject: () => void) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (!!handler()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject();
      }
    }, 10);
  });
}