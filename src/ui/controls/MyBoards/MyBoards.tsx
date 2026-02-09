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
import { ppConfirm, ppInfo } from "../popup/Popup";
import { BoardType } from "../../../uof/BoardType";
import { CutBoard, localConfig } from "../CutBoard/CutBoard";
import { MultiViewItem } from "../../../mvd/MultiViewItem";
import { boardManager } from "../../../cutboard/BoardManager";
import { surfaceCollection, SurfaceCollection } from "../../../data/repository/SurfaceCollection";
import { guid } from "../../../core/Guid";
import { PatternFile } from "src/uof/SearchType";
import { TSurfaceDataPattern, SurfaceData } from "../../../data/repository/SurfaceData";
import '../../../utils/css/myboard.css';

export class MyBoards extends BaseComponent {
  children: BaseComponent[] = [];
  title: string = "Saved Boards";
  items: any[] = [];
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  totalItems: number = 0;
  searchText: string = "";

  async refresh() {
    const $this = this;
    const tableBoards = getUow<Table>("tableBoards");
    if (!tableBoards) {
      console.error("Table component not found");
      ppInfo("Error", "Table component not found.", "Ok", 500, 210);
      return;
    }
    tableBoards.rows = [];

    const params = new URLSearchParams({
      Page: $this.currentPage.toString(),
      PageSize: $this.pageSize.toString(),
      SortOrder: 'desc',
      ...(curProjectId.id && { projectId: curProjectId.id }),
      ...($this.searchText && { SearchText: $this.searchText })
    });

    const endpoint = `userboard/filter?${params.toString()}`;
    
    try {
      const res: any = await sFetch(endpoint, "get", null, true);

      if (res.statusCode !== 200) {
        console.error("API returned non-200 status:", res.statusCode);
        $this.items = [];
        $this.totalPages = 1;
        $this.totalItems = 0;
        ppInfo("Error", `Failed to load boards: ${res.message || "Unknown error"}`, "Ok", 500, 210);
        tableBoards.update();
        $this.update();
        return;
      }

      if (res.payload === null || (res.payload && Array.isArray(res.payload.data))) {
        $this.items = res.payload?.data || [];
        $this.totalItems = res.payload?.record_count || 0;
        $this.totalPages = res.payload?.number_of_pages || Math.max(1, Math.ceil($this.totalItems / $this.pageSize));
      } else {
        console.error("Invalid API response, expected payload.data as array:", res);
        $this.items = [];
        $this.totalPages = 1;
        $this.totalItems = 0;
        ppInfo("Error", "Failed to load boards. Invalid data format.", "Ok", 500, 210);
      }

    } catch (error: any) {
      console.error("API call failed:", error);
      $this.items = [];
      $this.totalPages = 1;
      $this.totalItems = 0;
      ppInfo("Error", `Failed to load boards: ${error.message || "Unknown error"}`, "Ok", 500, 210);
    }

    tableBoards.rows = [
      ...$this.items.map((item: any, i: number) => {
        const btn1 = (
          <button class="add-to-cut-board-button" onClick={async () => {
            if (boardManager.boards.length >= 5) {
              ppInfo("Board limit", "You can only have 5 boards open at a time.", "Ok", 500, 210);
              return;
            }
            try {
              const res: any = await sFetch(`userboard/${item.board_id}`, "get", null, true);
              if (!res.payload || !res.payload.vector_image) {
                ppInfo("Error", "Failed to load board data.", "Ok", 500, 210);
                return;
              }
              const boardData = atob(res.payload.vector_image);
              let parsedData: any;
              try {
                parsedData = JSON.parse(boardData);
              } catch (e) {
                console.error("Failed to parse board data:", e);
                ppInfo("Error", "Invalid board data format.", "Ok", 500, 210);
                return;
              }
              
              // Handle both old format (array) and new format (structured object with items and annotations)
              let boardDeserializedData: BoardType[];
              let annotations: any[] = [];
              
              if (Array.isArray(parsedData)) {
                // Old format: array of board items
                boardDeserializedData = parsedData;
              } else if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.items)) {
                // New format: structured object with items and annotations
                boardDeserializedData = parsedData.items;
                annotations = parsedData.annotations || [];
              } else {
                ppInfo("Error", "Invalid board data structure.", "Ok", 500, 210);
                return;
              }
              
              boardManager.createBoard();
              const cutBoard = getUow<CutBoard>("cutBoard");
              if (!cutBoard) {
                ppInfo("Error", "CutBoard component not found.", "Ok", 500, 210);
                return;
              }
              
              // Store annotations in the board manager
              if (boardManager.boards[boardManager.currentBoardIndex]) {
                boardManager.boards[boardManager.currentBoardIndex].annotations = annotations;
              }
              
              const legends = Array.isArray(boardDeserializedData[boardDeserializedData.length - 1])
                ? boardDeserializedData.pop() as any
                : [];
              const legendsMap = new Map<number, string>();
              legends.forEach((legend: any) => {
                if (legend.key != null && legend.value != null) {
                  legendsMap.set(legend.key, legend.value);
                }
              });
              boardManager.selectedBoard.newBoard.carLegend = legendsMap;
              // Create a new SurfaceData directly instead of using draftSelection
              // This preserves the cutboard preview patterns in draftSelection
              const newSurfaceData = new SurfaceData();
              // Store the saved board ID and name for future updates
              newSurfaceData.savedBoardId = item.board_id;
              newSurfaceData.savedBoardName = item.name;
              boardDeserializedData.forEach((data, j) => {
                if (!data || !data.normalizePaths) {
                  console.warn("Skipping invalid board item:", data);
                  return;
                }
                const isLegacyRaw = data.rawPattern ? ("pattern_id" in data.rawPattern) : false;
                const newSurface: TSurfaceDataPattern = {
                  guid: guid(),
                  boardAngle: data.angle ?? 0,
                  boardPosition: { x: data.x ?? 0, y: data.y ?? 0 },
                  paths: Array.isArray(data.normalizePaths) ? [...data.normalizePaths] : [],
                  patternName: (isLegacyRaw ? (data.rawPattern as PatternFile)?.name : (data.rawPattern as TSurfaceDataPattern)?.patternName) ?? "",
                  patternColor: data.carColor ?? "",
                  patternId: (isLegacyRaw ? (data.rawPattern as PatternFile)?.pattern_id : (data.rawPattern as TSurfaceDataPattern)?.patternId) ?? "",
                };
                if (newSurface.patternName === "") {
                  newSurface.patternName = legendsMap.get(Number(newSurface.patternColor)) ?? `Pattern ${j + 1}`;
                }
                newSurfaceData.addPattern(newSurface);
              });
              // Initialize undo/redo stack for the new surface data
              newSurfaceData.undoRedoStack = [];
              newSurfaceData.undoRedoIndex = -1;
              // Add the new surface data directly to collection without using draftSelection
              surfaceCollection.collection.push(newSurfaceData);
              surfaceCollection.selectedSurfaceDataIndex = surfaceCollection.collection.length - 1;
              if (boardManager.selectedBoard?.newBoard) {
                boardManager.selectedBoard.newBoard.boardName = item.name;
              }
              await ppInfo("Added", "The board has been added to the cut board", "Ok", 500, 210);
            } catch (error: any) {
              console.error("Failed to load board:", error);
              ppInfo("Error", `Failed to load board: ${error.message || "Unknown error"}`, "Ok", 500, 210);
            }
          }}>
            <svg viewBox="0 0 24 24" class="add-to-cut-board-icon" aria-hidden="true">
              <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6v-6h2v6h6v2z" />
            </svg>
            Load
          </button>
        );
        const btn3 = (
          <button class="delete-board-button" onClick={async () => {
            const res = await ppConfirm("Deletion", "Are you sure you want to delete this board?", "Yes", "No");
            if (res !== "ok") return;
            try {
              await sFetch(`userboard/${item.board_id}`, "delete", {}, true);
              await $this.refresh();
              await ppInfo("Deleted", "The board has been deleted", "Ok", 500, 210);
            } catch (error: any) {
              console.error("Failed to delete board:", error);
              ppInfo("Error", `Failed to delete board: ${error.message || "Unknown error"}`, "Ok", 500, 210);
            }
          }}>
            <svg viewBox="0 0 24 24" class="delete-board-icon" aria-hidden="true">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            Delete
          </button>
        );
        return [i + 1, item.name, new Date(item.date_created).toLocaleDateString(), new Date(item.date_created).toLocaleTimeString(), [btn1, btn3]];
      })
    ];

    tableBoards.update();
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
    this.currentPage = 1; // Reset to first page
    const input = document.querySelector('.my-boards-search-box input') as HTMLInputElement;
    if (input) input.value = "";
    await this.refresh();
    this.update();
  }

  constructor() {
    super("MyBoards");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["items", "currentPage", "totalPages", "totalItems", "searchText"]);
    const $this = this;
    this.addEventListener("mount", async function mount() {
      await $this.refresh();
      $this.update();
    });
  }
}

const _default: TRenderHandler = ($this: MyBoards) => {
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
          placeholder="Search by board name"
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
      <div class="no-boards-message">No boards found.</div>
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

const dropDown = (icon: TIcon, text: string) => {
  return <>
    <div class="my-boards-dropdown">
      <div class="dropdown-icon" />
      <span class="dropdown-text">{text}</span>
      <div class="dropdown-arrow" />
    </div>
  </>;
}