/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f,
  JSXInternal
} from "@ekkojs/web-controls";

export class Dropdown extends BaseComponent {
  title: string = "";
  text: string = "";
  isOpened: boolean = false;
  items: any[] = [];
  itemLabel: string = "";
  selectedItem: any;

  isDisabled: boolean = false;
  forceWidth: string = "160px";
  searchQuery: string = "";

  onSelect: (item: any) => void;

  autoCloseTimeout: number | null = null;

  constructor() {
    super("Dropdown");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["title", "text", "isOpened", "isDisabled"]);
    const $this = this;
    const handler = function (event: any) {
      const dropdown = document.body.querySelector(`#dd${$this.guid}`); // Sélectionnez votre menu déroulant
      const isClickInside = dropdown.contains(event.target);

      if (!isClickInside) {
        $this.isOpened = false;
        $this.update();
      }
    }

    this.addEventListener("mount", () => {
      document.addEventListener('click', handler);
    });
    this.addEventListener("unmount", () => {
      document.removeEventListener('click', handler);
    });
  }

  openList() {
    if (this.isOpened || this.isDisabled) return;

    this.isOpened = true;
    this.searchQuery = ""; // Reset search query
    this.triggerRender(); // Force UI update
  }

  closeList() {
    this.isOpened = false;
    this.triggerRender(); // Force UI update
  }

  reset() {
    this.text = "";
    this.isOpened = false;
    this.items.length = 0;
    this.selectedItem = -1;
    this.triggerRender(); // Force UI update
  }

  filterItems() {
    if (!this.searchQuery.trim()) {
      return this.items;
    }
    const query = this.searchQuery.toLowerCase();
    return this.items.filter((item) =>
      item[this.itemLabel]?.toLowerCase().includes(query)
    );
  }

  triggerRender() {
    // Simple method to explicitly trigger a re-render
    this.isOpened = this.isOpened; // Mark as changed for the framework
  }
}

const _default: TRenderHandler = ($this: Dropdown) => {
  let dropdownList = null as JSXInternal.Element;

  if ($this.isOpened) {
    dropdownList = (
      <div
        class="filter-drop-down-list"
        style={{
          position: "absolute",
          top: "100%",
          left: "0",
          zIndex: "1000",
          minWidth: `${$this.forceWidth}`,
          backgroundColor: "#fff",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      >
       <button
  class="filter-drop-down-close-button"
  onClick={() => $this.closeList()}
>
  ×
</button>
        <input
          type="text"
          class="filter-drop-down-search"
          placeholder="Search..."
          value={$this.searchQuery}
          onInput={(e: any) => {
            $this.searchQuery = e.target.value;
            $this.triggerRender(); // Trigger a UI update
          }}
          style={{
            width: "calc(100% - 10px)",
            margin: "5px",
            padding: "5px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        {$this.filterItems().map((item) => (
          <div
            class="filter-drop-down-item"
            onClick={() => {
              $this.text = item[$this.itemLabel];
              $this.isOpened = false;
              $this.selectedItem = item;
              $this.onSelect?.(item);
              $this.triggerRender(); // Trigger a UI update
            }}
            style={{
              padding: "5px 10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {item[$this.itemLabel]}
          </div>
        ))}
      </div>
    );
  }

  return <>
      <div class="filter-drop-down" id={"dd" + $this.guid}
        style={{
          position: "relative",
          opacity: $this.isDisabled ? "0.3" : "1",
          minWidth: `${$this.forceWidth}!important`,
        }}
      >
        <div
          class=""
          style={{
            minWidth: `${$this.forceWidth}`,
            cursor: $this.isDisabled ? "not-allowed" : "pointer",
          }}
          onClick={() => {
            !$this.isDisabled && $this.openList();
          }}
        >
          <span style={{ fontWeight: "500" }}>
            {$this.text !== "" ? $this.text : $this.title}
          </span>
          <div
            style={{
              backgroundImage: "url(assets/svg/black-triangle.svg)",
              minWidth: "8px",
              minHeight: "8px",
              maxWidth: "8px",
              maxHeight: "8px",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              position: "absolute",
              top: "50%",
              right: "15px",
            }}
          />
        </div>
        {dropdownList}
      </div>
    </>
};