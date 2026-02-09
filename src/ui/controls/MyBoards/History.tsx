/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { TIcon } from "../icons/TIcon";
import { curProjectId, sFetch } from "../../../uof/Globals";
import { blackButtonThin } from "../CutBoardPreview/CutBoardPreview";
import { getUow } from "../../../uof/UnitOfWork";
import { Table } from "../Table/Table";
import { ppConfirm, ppInfo ,ppCutStatus} from "../popup/Popup";
import '../../../utils/css/myboard.css';



export class History extends BaseComponent {
  children: BaseComponent[] = [];
  title: string = "History";
  items: any[] = [];
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number ;
  totalItems: number = 0;
  searchText: string = "";

  async refresh() {
    const $this = this;
    const tableHistory = getUow<Table>("tableHistory");
    if (!tableHistory) {
      console.error("Table component not found");
      ppInfo("Error", "Table component not found.", "Ok", 500, 210);
      return;
    }
    tableHistory.rows = [];

    const params = new URLSearchParams({
      PageNumber: $this.currentPage.toString(),
      PageSize: $this.pageSize.toString(),
      OrderDirection: 'desc',
      ...(curProjectId.id && { projectId: curProjectId.id }),
      ...($this.searchText && { SearchText: $this.searchText })
    });

    const endpoint = `usercuttes${curProjectId.id ? `/${curProjectId.id}` : ""}?${params.toString()}`;
    
    try {
      const res: any = await sFetch(endpoint, "get", null, true);

      if (res.statusCode !== 200) {
        console.error(`API returned non-200 status: ${res.statusCode}`, { endpoint, response: res });
        $this.items = [];
        $this.totalPages = 1;
        $this.totalItems = 0;
        ppInfo("Error", `Failed to load history: ${res.message || "Unknown error"}`, "Ok", 500, 210);
        tableHistory.update();
        $this.update();
        return;
      }

     if (res.payload && Array.isArray(res.payload.list)) {
        $this.items = res.payload.list;
        $this.totalItems = res.payload.totalCount || 0; 
        $this.totalPages = res.payload.totalPages || Math.max(1, Math.ceil($this.totalItems / $this.pageSize));
      } else {
        console.error("Invalid API response, expected payload as array:", { endpoint, response: res });
        $this.items = [];
        $this.totalPages = 1;
        $this.totalItems = 0;
        ppInfo("Error", "Failed to load history. Invalid data format.", "Ok", 500, 210);
      }

    } catch (error: any) {
      console.error("API call failed:", { endpoint, error: error.message, stack: error.stack });
      $this.items = [];
      $this.totalPages = 1;
      $this.totalItems = 0;
      ppInfo("Error", `Failed to load history: ${error.message || "Unknown error"}`, "Ok", 500, 210);
    }

    const projectStatusList = (await sFetch<any>("usercuttes/feedback/statuses", "GET", null)).payload || [];

    tableHistory.rows = await Promise.all($this.items.map(async (item: any, i: number) => {
     const statusId = item.feedback?.feedbackId ?? -1;
      const statusText = projectStatusList.find((s: any) => s.id.toString() === statusId.toString())?.status || "Pending";

      const btn2p = (
        <button class="add-to-cut-board-button" onClick={async () => {
          const status = await ppCutStatus();
          if (!status) return;
          try {
            const payload = {
              cutId: item.cutId,
              feedbackId: Number(status),
              comment: ""
            };
            
              await sFetch("usercuttes/feedback", "put", payload, true);
            
            await ppInfo("Updated", "Feedback status updated successfully", "Ok", 500, 210);
            await $this.refresh();
          } catch (error: any) {
            console.error("Failed to update feedback:", { error: error.message, stack: error.stack });
            ppInfo("Error", `Failed to update feedback: ${error.message || "Unknown error"}`, "Ok", 500, 210);
          }
        }}>
          <svg viewBox="0 0 24 24" class="add-to-cut-board-icon" aria-hidden="true">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h4v2h-4v4h-2v-4H7v-2h4V7z"/>
          </svg>
          {statusText}
        </button>
      );

      const carDetails = item.patterns?.[0]?.cardetails ?? "";
      const patternNames = item.patterns?.map((p: any) => p.name).join(", ") ?? "";
      return [
        i + 1,
        carDetails,
        item.patterns?.length ?? 0,
        new Date(item.dateCreated).toLocaleDateString(),
        new Date(item.dateCreated).toLocaleTimeString(),
        item.usageSize ?? "",
        [btn2p],
        patternNames
      ];
    }));

    tableHistory.update();
    $this.update();
  }

  async goToPage(page: number) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    await this.refresh();
    this.update();
  }
  async search() {
   this.currentPage = 1; 
    await this.refresh();
    this.update();
  }

  async clearSearch() {
    this.searchText = "";
    this.currentPage = 1;
    const input = document.querySelector('.my-boards-search-box input') as HTMLInputElement;
    if (input) input.value = "";
    await this.refresh();
    this.update();
  }

  constructor() {
    super("History");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["items", "currentPage", "totalPages", "totalItems", "searchText"]);
    const $this = this;
    this.addEventListener("mount", async function mount() {
      await $this.refresh();
      $this.update();
    });
  }
}

const _default: TRenderHandler = ($this: History) => {
  const maxPagesToShow = 5;
  const startPage = Math.max(1, $this.currentPage - Math.floor(maxPagesToShow / 2));
  const endPage = Math.min($this.totalPages, startPage + maxPagesToShow - 1);
  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  return <>
    <div class="my-boards-header">{$this.title}</div>
    <div class="my-boards-search">
      <div class="my-boards-search-box">
        <input
          type="text"
          placeholder="Search by car details"
          onInput={(e: any) => { $this.searchText = e.currentTarget.value; }}
        />
        <button class="search-button" onClick={() => $this.search()} title="Search">
          <svg viewBox="0 0 24 24" class="search-icon" aria-hidden="true">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
        {$this.searchText && (
          <button class="clear-search-button" onClick={() => $this.clearSearch()} title="Clear Search">
            <svg viewBox="0 0 24 24" class="clear-icon" aria-hidden="true">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
    {$this.items.length === 0 ? (
      <div class="no-boards-message">No history found.</div>
    ) : (
      <div class="table-container">
        {$this.children.map((child) => child.vdom)}
      </div>
    )}
    <div class="pagination-container">
      <button 
        class="pagination-button" 
        disabled={$this.currentPage === 1}
        onClick={async () => await $this.goToPage(1)}
        title="First Page"
      >
        <svg viewBox="0 0 24 24" class="pagination-icon" aria-hidden="true">
          <path fill="currentColor" d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"/>
        </svg>
        First
      </button>
      <button 
        class="pagination-button" 
        disabled={$this.currentPage === 1}
        onClick={async () => await $this.goToPage($this.currentPage - 1)}
        title="Previous Page"
      >
        <svg viewBox="0 0 24 24" class="pagination-icon" aria-hidden="true">
          <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Previous
      </button>
      {pageNumbers.map(page => (
        <button
          class={`pagination-button ${page === $this.currentPage ? 'active' : ''}`}
          onClick={async () => await $this.goToPage(page)}
        >
          {page}
        </button>
      ))}
      <button 
        class="pagination-button" 
        disabled={$this.currentPage === $this.totalPages}
        onClick={async () => await $this.goToPage($this.currentPage + 1)}
        title="Next Page"
      >
        <svg viewBox="0 0 24 24" class="pagination-icon" aria-hidden="true">
          <path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
        </svg>
        Next
      </button>
      <button 
        class="pagination-button" 
        disabled={$this.currentPage === $this.totalPages}
        onClick={async () => await $this.goToPage($this.totalPages)}
        title="Last Page"
      >
        <svg viewBox="0 0 24 24" class="pagination-icon" aria-hidden="true">
          <path fill="currentColor" d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/>
        </svg>
        Last
      </button>
      <span class="pagination-info">
        Page {$this.currentPage} of {$this.totalPages} ({$this.totalItems} items)
      </span>
    </div>
  </>;
}