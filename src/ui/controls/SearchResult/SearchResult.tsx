/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { FilterField } from "./FilterField";
import { currentPatternSelection, mapToArray, searchCut, searchParams, searchResults, sFetch } from "../../../uof/Globals";
import { PatternFile, TSearchResult } from "../../../uof/SearchType";
import { blackButton } from "../CutBoardPreview/CutBoardPreview";
import { _evtBus, _evts } from "../../../core/EventBus";
import { VectorItemDocument } from "../../../mvd/VectorItemDocument";
import { PatternRepo, PatternSelect } from "../../../uof/Data";
import { ppInfo } from "../popup/Popup";
import { getUow } from "../../../uof/UnitOfWork";
import { CutBoardPreview } from "../CutBoardPreview/CutBoardPreview";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";
import { guid } from "../../../core/Guid";
import { TSurfaceDataPattern } from "../../../data/repository/SurfaceData";
import { VectorPath } from "../../../VectorPath/VectorPath";
import '../../../utils/css/searchresult.css';

const quickAddColors = [0x40E0D0, 0x00FF00, 0xFF0000, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0x000000, 0xFFFFFF];
let quickAddColorIdx = 0;
const QUICK_ADD_PADDING = 10;

const extractRegionLabel = (patternItem: PatternFile): string => {
  if (patternItem?.car_pattern_region) {
    const regionStr = String(patternItem.car_pattern_region);
    if (regionStr.includes(',')) {
      const afterFirstComma = regionStr.substring(regionStr.indexOf(',') + 1).trim();
      return afterFirstComma;
    }
    return regionStr.trim();
  }
  if (patternItem?.regions && Array.isArray(patternItem.regions)) {
    return patternItem.regions
      .map((r: any) => r.region || r.name || String(r))
      .filter((r: string) => r)
      .join(', ');
  }
  return "";
};

const ensurePatternLoaded = async (patternId: number) => {
  if (!PatternRepo.has(patternId)) {
    const vectorItemDocument = new VectorItemDocument();
    await vectorItemDocument.loadPatternDetail(patternId);
    PatternRepo.set(patternId, vectorItemDocument);
  }
};

const addPatternDirectlyToCutboard = async (patternItem: PatternFile) => {
  await ensurePatternLoaded(patternItem.pattern_id);
  const patternDoc = PatternRepo.get(patternItem.pattern_id);
  if (!patternDoc) {
    throw new Error("Pattern data is unavailable.");
  }

  PatternSelect.patternId = patternItem.pattern_id;
  PatternSelect.pattern = patternDoc;
  PatternSelect.item = patternItem;

  const vecDoc = patternDoc.clone();
  const regionLabel = extractRegionLabel(patternItem) || searchParams.currentName;
  const colorPack = quickAddColors[quickAddColorIdx];

  let groupMinX = Infinity;
  let groupMinY = Infinity;
  const selectedVectors: typeof vecDoc._items = [];

  vecDoc._items.forEach((vectorItem) => {
    vectorItem.mergeItems();
    vectorItem.carColor = colorPack;
    vectorItem.carLegend = regionLabel;
    vectorItem.rawPattern = patternItem;

    const vectorPath = new VectorPath();
    const pathString = vectorItem.rawVectors.map((v) => v.asString()).join(" ");
    vectorPath.parse(pathString);
    vectorPath.normalize();

    const bounds = vectorPath.getBoundingBox();
    const patternMinX = vectorPath.originalPosition.x + bounds.x;
    const patternMinY = vectorPath.originalPosition.y + bounds.y;

    if (patternMinX < groupMinX) groupMinX = patternMinX;
    if (patternMinY < groupMinY) groupMinY = patternMinY;

    selectedVectors.push(vectorItem);
  });

  if (!selectedVectors.length) {
    throw new Error("Pattern does not contain any cut items.");
  }

  const shiftX = QUICK_ADD_PADDING - groupMinX;
  const shiftY = QUICK_ADD_PADDING - groupMinY;

  selectedVectors.forEach((vectorItem) => {
    const surfacePattern = {
      boardAngle: 0,
      boardPosition: { x: shiftX, y: shiftY },
      patternColor: colorPack,
      patternName: searchParams.currentName,
      patternId: patternItem.pattern_id,
      paths: vectorItem.rawVectors.map((v) => v.asString()),
      guid: guid(),
      firstLoad: true
    } as TSurfaceDataPattern;
    surfaceCollection.addPatternToDraftedSurface(surfacePattern);
  });

  currentPatternSelection.selections.push(...selectedVectors);
  currentPatternSelection.images.push(patternItem.bitmap_image || "");
  currentPatternSelection.colorPacks.push(colorPack);
  currentPatternSelection.shouldBeProcessed = true;

  const patternName = patternItem.name || '';
  const displayName = patternName && searchParams.currentName 
    ? `${patternName} - ${searchParams.currentName}` 
    : patternName || searchParams.currentName;
  const cutItem = { ...patternItem, guid: guid(), name: displayName } as PatternFile;
  searchCut.push(cutItem);

  getUow<CutBoardPreview>("cutPreview").update();

  quickAddColorIdx = (quickAddColorIdx + 1) % quickAddColors.length;
};

export class SearchResult extends BaseComponent {
  filterField: FilterField = new FilterField();
  currentKey: string = "";
  filter1: string = "all"
  filter2: string = "all"
  
  // Loading states for pattern selection
  loadingPatterns: Set<string> = new Set();
  errorPatterns: Set<string> = new Set();
  successPatterns: Set<string> = new Set();
  quickAddLoading: Set<string | number> = new Set();
  quickAddError: Set<string | number> = new Set();
  quickAddSuccess: Set<string | number> = new Set();
  
  // Vehicle image collapse state
  isVehicleImageExpanded: boolean = false;
  
  // Pattern request state
  isRequestingPattern: boolean = false;

  reset() {
    this.currentKey = "";
    this.filter1 = "all";
    this.filter2 = "all";
    this.isVehicleImageExpanded = false;
    this.isRequestingPattern = false;
    this.update();
  }

  constructor() {
    super("SearchResult");
    this.registerTemplate("default",_default);
    this.registerDependencyProperties([
      "currentKey",
      "filter1",
      "filter2",
      "loadingPatterns",
      "errorPatterns",
      "successPatterns",
      "quickAddLoading",
      "quickAddError",
      "quickAddSuccess",
      "isVehicleImageExpanded",
      "isRequestingPattern"
    ]);
  }
}

const _default: TRenderHandler = ($this: SearchResult) => {
  const items = mapToArray(searchResults);
  const currentSearch = searchResults.get($this.currentKey);
  const carImage = currentSearch?.payload?.carImage;
  
  return (
    <div class="search-result-container">
      <div class="filter-pane">
        <div class="search-keys">
          {items.map((item, itmIdx) => (
            <div
              class={`search-key ${$this.currentKey === item.key ? 'active' : ''}`}
              key={item.key}
              onClick={async () => {
                $this.currentKey = item.key;
                const splitKey = item.key.split("-").map(_ => _.trim());
                searchParams.currentSearchIdx = itmIdx;
                searchParams.currentName = `${splitKey[0]} ${splitKey[1]} ${splitKey[2]} ${splitKey[4]}`;
                if (item.value.needReload) {
                  const searchId = item.value.searchId;
                  item.value = await sFetch("product/precuttool/productpages", "POST", {
                    "category_id": item.value.payload.productSearchRequest.category_id,
                    "make_id": item.value.payload.productSearchRequest.make_id,
                    "series_id": item.value.payload.productSearchRequest.model_id,
                    "model_id": item.value.payload.productSearchRequest.series_id,
                    "year_id": item.value.payload.productSearchRequest.year_id,
                    "version_id": item.value.payload.productSearchRequest.version_id,
                    "region_id": item.value.payload.productSearchRequest.region_id,
                    "filters": {
                      "search_text": "",
                      "page": 1,
                      "page_size": 32,
                      "sort_column": "name",
                      "sort_order": "asc",
                      "filters": JSON.stringify([
                        {"key": "category_id", "value": item.value.payload.productSearchRequest.category_id},
                        {"key": "make_id", "value": item.value.payload.productSearchRequest.make_id},
                        {"key": "series_id", "value": item.value.payload.productSearchRequest.model_id},
                        {"key": "model_id", "value": item.value.payload.productSearchRequest.series_id},
                        {"key": "year_id", "value": item.value.payload.productSearchRequest.year_id},
                        {"key": "version_id", "value": item.value.payload.productSearchRequest.version_id},
                        {"key": "region_id", "value": item.value.payload.productSearchRequest.region_id},
                      ]),
                      "user_id": localStorage.getItem("userId")
                    }
                  }) as TSearchResult;
                  item.value.searchId = searchId;
                }
                searchResults.set(item.key, item.value);
                $this.update();
              }}
              role="button"
              tabIndex={0}
              aria-label={`Select search: ${item.key}`}
              onKeyPress={(e: any) => e.key === 'Enter' && e.target.click()}
            >
              <span>{item.key}</span>
              <button
                class="close-btn"
                onClick={async (e: Event) => {
                  e.stopPropagation();
                  searchResults.delete(item.key);
                  await sFetch(`userproject/projectcarsearch/${item.value.searchId}`, "DELETE", {}, true);
                  $this.update();
                }}
                aria-label={`Remove search: ${item.key}`}
              ></button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Main Content Area - Side by Side Layout */}
      <div class="main-content-area">
        {/* Vehicle Image Display - On the Side with Filters */}
        {currentSearch && (
          <div class="vehicle-image-container">
            <div class="vehicle-image-header" onClick={() => {
              $this.isVehicleImageExpanded = !$this.isVehicleImageExpanded;
              $this.update();
            }}>
              <span class="vehicle-name">{currentSearch?.payload?.carName || 'Vehicle Image'}</span>
              <span class="expand-icon">{$this.isVehicleImageExpanded ? '▼' : '▶'}</span>
            </div>
            {$this.isVehicleImageExpanded && (
              <div class="vehicle-image-wrapper">
                {carImage ? (
                  <img src={carImage} alt="Vehicle" class="vehicle-image" />
                ) : (
                  <div class="no-car-image">No photo available</div>
                )}
              </div>
            )}
            <div class="filter-buttons-vertical">
              <div class="filter-group-container-vertical">
                <div class="filter-group">
                  <button
                    class={`filter-btn ${$this.filter1 === "all" ? 'active' : ''}`}
                    onClick={() => { $this.filter1 = "all"; $this.update(); }}
                    role="button"
                    aria-pressed={$this.filter1 === "all"}
                  >All</button>
                  <button
                    class={`filter-btn ${$this.filter1 === "Interior" ? 'active' : ''}`}
                    onClick={() => { $this.filter1 = "Interior"; $this.update(); }}
                    role="button"
                    aria-pressed={$this.filter1 === "Interior"}
                  >Interior</button>
                  <button
                    class={`filter-btn ${$this.filter1 === "Exterior" ? 'active' : ''}`}
                    onClick={() => { $this.filter1 = "Exterior"; $this.update(); }}
                    role="button"
                    aria-pressed={$this.filter1 === "Exterior"}
                  >Exterior</button>
                  <button
                    class={`filter-btn ${$this.filter1 === "Tint" ? 'active' : ''}`}
                    onClick={() => { $this.filter1 = "Tint"; $this.update(); }}
                    role="button"
                    aria-pressed={$this.filter1 === "Tint"}
                  >Tint</button>
                </div>
                <div class="filter-group">
                  <button
                    class={`filter-btn ${$this.filter2 === "all" ? 'active' : ''}`}
                    onClick={() => { $this.filter2 = "all"; $this.update(); }}
                    role="button"
                    aria-pressed={$this.filter2 === "all"}
                  >All</button>
                  <button
                    class={`filter-btn ${$this.filter2 === "wrapped" ? 'active' : ''}`}
                    onClick={() => { $this.filter2 = "wrapped"; $this.update(); }}
                    role="button"
                    aria-pressed={$this.filter2 === "wrapped"}
                  >Wrapped</button>
                  <button
                    class={`filter-btn ${$this.filter2 === "unwrapped" ? 'active' : ''}`}
                    onClick={() => { $this.filter2 = "unwrapped"; $this.update(); }}
                    role="button"
                    aria-pressed={$this.filter2 === "unwrapped"}
                  >Unwrapped</button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div class="pattern-grid">
        {searchResults.get($this.currentKey)?.payload?.precutpatternListResponse?.data
          .filter(_ => _.TypeName === $this.filter1 || $this.filter1 === "all")
          .filter(_ => (_.Iswrapped === true ? "wrapped" : "unwrapped") === $this.filter2 || $this.filter2 === "all")
          .length === 0 ? (
          <div class="no-results">
            <div class="no-results-content">
              <p class="no-results-text">Patterns coming soon</p>
              <button
                class={`request-pattern-btn ${$this.isRequestingPattern ? 'loading' : ''}`}
                onClick={async () => {
                  if ($this.isRequestingPattern) return;
                  
                  try {
                    $this.isRequestingPattern = true;
                    $this.update();
                    
                    const currentSearch = searchResults.get($this.currentKey);
                    const carId = currentSearch?.payload?.car_id;
                    const regionId = currentSearch?.payload?.productSearchRequest?.region_id;
                    
                    // Map pattern type to ID: Interior=1, Exterior=2, Tint=3
                    let patternTypeId: number;
                    if ($this.filter1 === "Interior") {
                      patternTypeId = 1;
                    } else if ($this.filter1 === "Exterior") {
                      patternTypeId = 2;
                    } else if ($this.filter1 === "Tint") {
                      patternTypeId = 3;
                    } else {
                      // If "all" is selected, default to Exterior
                      patternTypeId = 2;
                    }
                    
                    // Prepare payload
                    const payload: any = {
                      carId: carId,
                      patterTypeId: patternTypeId
                    };
                    
                    // Only include region if it's valid (not -1 or undefined)
                    if (regionId && regionId !== -1) {
                      payload.region = regionId;
                    }
                    
                    const response = await sFetch("product/precutcarrequest", "POST", payload) as any;
                    
                    if (response.statusCode === 200) {
                      await ppInfo(
                        "Request Submitted Successfully",
                        response.message || "Your pattern request has been submitted successfully. We will notify you when it's available.",
                        "Ok",
                        undefined,
                        260
                      );
                    } else {
                      throw new Error(response.message || "Request failed");
                    }
                  } catch (error: any) {
                    console.error("Pattern request error:", error);
                    await ppInfo(
                      "Request Failed",
                      error.message || "Failed to submit pattern request. Please try again later.",
                      "Ok",
                      undefined,
                      260
                    );
                  } finally {
                    $this.isRequestingPattern = false;
                    $this.update();
                  }
                }}
                disabled={$this.isRequestingPattern}
                role="button"
                aria-label="Request Pattern"
              >
                {$this.isRequestingPattern ? (
                  <>
                    <span class="spinner"></span>
                    Requesting...
                  </>
                ) : (
                  'Request Pattern'
                )}
              </button>
            </div>
          </div>
        ) : (
          searchResults.get($this.currentKey)?.payload?.precutpatternListResponse?.data
            .filter(_ => _.TypeName === $this.filter1 || $this.filter1 === "all")
            .filter(_ => (_.Iswrapped === true ? "wrapped" : "unwrapped") === $this.filter2 || $this.filter2 === "all")
            .map((item) => (
              <div
                class={`pattern-card ${$this.loadingPatterns.has(item.pattern_id) ? 'loading' : ''}`}
                key={item.pattern_id}
              >
                {$this.loadingPatterns.has(item.pattern_id) && (
                  <div class="pattern-loading-overlay">
                    <div class="loading-content">
                      <div class="loading-spinner"></div>
                      <div class="loading-text">Loading Pattern...</div>
                      <div class="progress-bar-container">
                        <div class="progress-bar"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div class="pattern-header">
                  <div class="pattern-name">{item.name}</div>
                  <div class={`pattern-wrap-badge ${item.Iswrapped ? 'wrapped' : 'not-wrapped'}`} title={item.Iswrapped ? 'Wrapped' : 'Unwrapped'}>
                    {item.Iswrapped ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 167.45 149.76" width="24" height="24">
                        <g>
                          <path fill="#27aae1" d="M166.99,101.59c-.44-5.43-1.49-16.12-5.38-20.05-1.15-1.16-6.99-4.34-7.13-4.75-.35-1.07.9-1.9,1.27-2.82,1.08-2.68.41-5.57-2.02-7.2-2.75-1.84-6.6-.34-9.73-1.07-4.4-9.6-9.57-17.94-19.76-22.05-19.07-7.69-61.63-7.66-80.76-.09-10.48,4.15-15.45,12.36-20.02,22.14-3.9.49-10.99-1.18-12.12,4.26-.7,3.39,2.02,5.62,1.63,6.83-.13.41-5.97,3.59-7.12,4.75C1.48,85.93.35,100.62.08,106.8c-.35,8.18.31,26.55,3.89,33.77,1.41,2.85,4.03,2.9,4.44,3.4.15.18.01,1.17.21,1.7.59,1.62,2.08,3.01,3.66,3.66l22.46.14c2.21-.34,4.73-3.23,4.38-5.55,3.93.29,7.62-1.33,11.42-1.99,17.68-3.08,43.33-2.83,61.22-.8,5.69.65,10.93,2.49,16.55,2.79-.36,2.32,2.17,5.21,4.38,5.55,6.79-.56,14.97.83,21.59.03,1.95-.23,3.87-2.04,4.53-3.83.19-.53.06-1.53.21-1.7.12-.14,2.49-.72,3.32-1.56,1.48-1.48,2.25-5.47,2.73-7.54,2.5-10.77,2.81-22.26,1.91-33.27ZM38.75,103.31c-.37.37-3.75.69-4.62.78-3.39.35-7.75.66-11.13.71-3.3.06-9.63.08-11.06-3.6-.9-2.31-1.39-6.93,1.73-7.48,5.25-.94,16.28,2.41,21.13,4.84,1.43.71,5.87,2.84,3.96,4.75ZM121.92,128.46c-2.82,4.41-8.54,3.61-12.89,3.83-15.29.77-32.38.89-47.74.38-2.57-.09-6.47-.15-8.89-.52-3.97-.61-10.27-4.44-6.27-8.74,4.8-5.16,26.84-7.11,34.09-7.37,9.7-.35,21.18.73,30.67,2.92,3.91.9,14.81,3.57,11.02,9.5ZM108.01,79.68c-24.22-.6-47.43.57-71.46,1.07-6.19.13-1.72-7.27-.22-10,3.76-6.84,6.8-9.83,14.35-12.13,8.78-2.68,19.66-3.62,28.85-3.91,10.57-.33,36.74.85,45.03,7.38,2.92,2.3,5.44,6.31,7.14,9.58,1.33,2.56,5.13,8.85-.35,9.01-7.65.22-15.67-.81-23.34-1ZM155.74,100.96c-.61,1.91-2.27,2.72-4.08,3.23-3.55,1-10.5.5-14.38.24-2.2-.15-5.59-.32-7.66-.7-1.28-.24-1.63-1.62-.9-2.63,1.33-1.83,8.55-4.39,10.9-5.12,2.7-.83,14.03-3.81,15.87-1.92,1.1,1.13.73,5.42.26,6.89Z"/>
                          <path fill="#000000" d="M61.49,90.17c-1.37,0-2.69-.48-3.94-1.43-2.35-1.79-2.7-4.5-2.84-6.9-.03-.54,0-1.3.03-2.18.04-.95.1-2.67-.02-3.22-.44-.33-2.04-.67-2.82-.84-.72-.15-1.35-.29-1.81-.46-3.48-1.28-5.32-4.03-4.91-7.37.46-3.76,3.23-5.02,5.67-6.13.66-.3,1.29-.59,1.88-.92,4.13-2.32,7.59-4.74,10.49-7.37-2.79.24-5.66.36-8.58.36-1.39,0-2.8-.03-4.18-.08-7.24-.3-16.32-1.58-18.44-5.99l-.07-.15-.03-.17c-1-5.6-1.64-11.37-2.27-16.95-.53-4.73-1.07-9.62-1.83-14.34l-.02-.15v-.15c.05-.43.03-.93,0-1.46-.03-.66-.06-1.34.02-2C28.75,4.45,34.58.14,44.22.14c7.23,0,14.72,2.5,18.94,4.98,5.34,3.14,9.67,7.94,12.89,14.28.17-.11.35-.22.56-.31,1.5-.67,5.47-.74,7.11-.74,1.28,0,5.6.05,7.15.74.21.09.4.2.57.32,2.45-4.79,5.27-8.47,8.58-11.25,5.93-4.95,15.44-8.15,24.23-8.15.67,0,1.32.02,1.96.06,7.84.47,13.75,7.01,13.46,14.88-.19,5.2-1.04,10.66-1.87,15.95-.76,4.91-1.55,9.99-1.8,14.8v.09s-.02.09-.02.09c-1.38,7.08-13.86,7.57-19.19,7.78-1.3.05-2.62.08-3.93.08-2.85,0-5.72-.12-8.57-.36,2.76,2.49,5.81,4.71,8.97,6.53.59.34,1.33.69,2.12,1.05,2.44,1.14,5.21,2.44,6.26,4.65.88,1.86.97,3.75.26,5.47-.76,1.85-2.36,3.3-4.52,4.08-.46.17-1.07.3-1.79.45-.8.17-2.42.51-2.85.85-.12.54-.06,2.32-.03,3.3.03.94.06,1.75.02,2.31-.16,2.46-.53,5.01-3.01,6.78-1.22.87-2.51,1.31-3.82,1.31-3.69,0-6.69-3.5-8.87-6.05l-.47-.55c-5.78-6.69-10.19-14.35-12.86-22.33-.03.08-.05.17-.08.25-.28.93-.57,1.88-.92,2.76-2.76,6.9-6.84,13.57-11.8,19.31l-.41.48c-2.23,2.6-5.28,6.15-9,6.15ZM51.28,68.38c-.1.18-.12.29-.12.32.14.4,1.41.84,3.76,1.3.68.14,1.22.24,1.61.38,4.54,1.63,4.43,5.83,4.34,9.2-.04,1.45-.07,2.83.19,3.97.03.15.32.38.55.45.28-.19,1.18-.87,3.36-3.21,9.29-10,14.91-22.48,15.53-34.43-.18,0-.36,0-.54,0-.32,0-.64-.01-.96-.05-.62-.07-1.16-.27-1.63-.44-.09-.03-.18-.07-.27-.1-3.89,7.08-10.1,13.4-18.03,18.34-.51.31-1.76.98-3.22,1.74-1.51.79-3.97,2.09-4.59,2.51ZM86.95,46.37c.62,11.95,6.23,24.43,15.53,34.43,2.17,2.34,3.07,3.02,3.36,3.21.24-.06.52-.3.56-.45.27-1.15.23-2.52.19-3.98-.09-3.38-.2-7.58,4.34-9.2.6-.21,1.33-.35,2.1-.49,1.05-.19,2.82-.51,3.1-1.04.05-.09.04-.25,0-.46-1.16-.69-2.37-1.33-3.55-1.96-1.6-.86-3.27-1.74-4.85-2.75-7.63-4.87-13.61-11.04-17.37-17.9-.09.03-.18.06-.27.1-.48.17-1.02.37-1.63.44-.32.04-.63.05-.96.05-.18,0-.36,0-.54,0ZM56.75,38.65c-8.71,0-15.08,1.62-17.95,4.55-1.2,1.23-1.15,1.69-1.15,1.69,0,.02.13.45,2.19,1.11,3.23,1.03,8.72,1.62,15.06,1.62,4.41,0,8.72-.28,11.82-.78l.55-.08c.49-.07,1.75-.25,2.19-.41.63-.65,2.53-3.79,2.92-4.72-.07-.31-.23-.89-.35-1.28-1.08-.30-4.07-.83-5.28-1.01-3.04-.44-6.68-.69-10-.69ZM97.99,46.34c.42.16,1.65.34,2.19.42l.55.08c3.04.48,7.47.77,11.85.77,6.57,0,12.16-.62,15.35-1.7,1.76-.6,1.88-1.02,1.88-1.02,0,0,.07-.45-1.14-1.69-2.86-2.93-9.27-4.55-18.04-4.55-3.32,0-6.93.25-9.90.68-.91.13-4.11.72-5.29,1.03-.13.40-.29.98-.35,1.28.33.85,2.27,4.06,2.91,4.70ZM83.69,24.43c-1.98,0-3.7.07-4.27.17-.73.13-1.58,1.04-1.69,1.8-.33,2.32-.25,8.84-.02,11.46.09,1.02.68,2.18,2.05,2.37.71.10,2.14.16,3.83.16s3.17-.06,3.97-.14c1.21-.13,2.07-1,2.20-2.20.29-2.66.25-8.72,0-11.30-.09-.96-.75-2.01-1.84-2.16-.64-.09-2.34-.15-4.23-.15ZM43.03,6.25c-1.76,0-3.21.19-4.19.56-3,1.13-5.16,4.64-4.9,7.98l2.73,22.31c3.61-2.34,8.14-3.79,13.52-4.34,2.11-.21,4.29-.32,6.49-.32,4.74,0,9.66.49,14.63,1.46-1.18-4.26-5.62-6.77-9.89-7.40-.27-.04-.78-.06-1.32-.09-2.14-.11-3.22-.22-3.86-.75-.85-.72-1.24-1.87-1-3.02.23-1.12,1.02-2.02,2.06-2.34.39-.12.88-.18,1.51-.18,1.11,0,2.45.18,3.17.28,3.40.46,6.43,1.61,9.05,3.42-1.92-6.83-8.10-12.31-13.71-14.78-3.06-1.35-9.40-2.80-14.29-2.80ZM110.8,32.45c2.19,0,4.38.11,6.49.31,5.35.53,9.89,1.98,13.51,4.33l2.73-23.28c-.69-5.23-3.57-7.56-9.34-7.56-2.47,0-5.12.43-7.38.85-6.8,1.26-12.28,4.36-16.31,9.23-1.98,2.39-3.38,4.98-4.09,7.52,2.21-1.55,4.68-2.6,7.35-3.14,1-.20,3.31-.58,4.93-.58.50,0,.89.04,1.22.11,1.02.23,1.85.96,2.20,1.96.37,1.04.17,2.19-.52,3.06-.83,1.04-2.60,1.11-4.31,1.18-.49.02-.95.04-1.24.08-4.27.63-8.71,3.14-9.89,7.40,4.96-.97,9.88-1.46,14.64-1.46Z"/>
                          <path fill="#000000" d="M29.06,12.42C30.92-3.12,53.14.68,62.52,6.19c5.95,3.5,10.1,8.81,13.01,14.99.6-.21,1.01-.7,1.59-.96,1.91-.85,11.35-.84,13.24,0,.58.26.99.75,1.59.96,2.19-4.57,4.96-8.8,8.88-12.07,6.44-5.38,16.98-8.31,25.32-7.8,7.24.44,12.55,6.36,12.28,13.59-.37,9.94-3.14,20.69-3.67,30.73-1.18,6.05-13.11,6.57-18.01,6.77-5.3.21-10.67-.01-15.92-.65,3.44,3.56,7.51,6.75,11.82,9.22,2.38,1.36,6.7,2.69,7.87,5.16,1.63,3.44-.15,6.61-3.55,7.85-1.26.46-4.86.77-5.34,1.92-.4.96-.02,4.7-.11,6.08-.16,2.35-.47,4.4-2.49,5.84-4.7,3.34-8.69-1.83-11.5-5.09-6.22-7.2-11.03-15.8-13.56-25-.55-.09-.33.05-.45.3-.76,1.67-1.23,3.94-1.95,5.74-2.74,6.85-6.77,13.38-11.59,18.96-2.8,3.24-6.99,8.58-11.65,5.02-1.92-1.46-2.22-3.7-2.35-5.98-.08-1.34.29-4.93-.1-5.88-.47-1.13-4.07-1.45-5.34-1.92-2.68-.98-4.47-3.04-4.1-6.04.48-3.94,4.06-4.5,6.92-6.11,4.87-2.73,9.49-5.99,13.31-10.08-5.26.67-10.82.86-16.13.65-4.23-.17-15.3-.99-17.36-5.28-1.84-10.3-2.44-20.95-4.09-31.27.09-1.09-.13-2.36,0-3.42ZM72.84,26.95c-.58-8.35-7.65-15.82-15.02-19.05-4.47-1.96-14.9-3.97-19.42-2.26-3.61,1.36-6,5.42-5.71,9.24l2.99,24.47c4.12-3.3,9.42-4.81,14.63-5.34,7.5-.76,15.21-.1,22.53,1.49-.4-5.88-5.83-9.43-11.24-10.23-1.02-.15-3.99-.09-4.56-.57-1.05-.89-.72-2.8.62-3.21.93-.29,3.1,0,4.15.15,4.25.57,7.99,2.29,11.02,5.31ZM131.79,39.35l3-25.54c-1.25-10.24-10.35-9.39-18.2-7.94-6.73,1.25-12.66,4.36-17.04,9.66-2.64,3.2-4.7,7.22-4.92,11.42,2.62-2.57,5.77-4.3,9.39-5.03,1.3-.26,4.43-.75,5.62-.48,1.34.3,1.84,1.94.98,3.02-.66.83-3.53.62-4.75.8-5.41.8-10.84,4.35-11.24,10.23,7.34-1.6,15.03-2.24,22.53-1.49,5.22.52,10.5,2.04,14.63,5.34ZM79.19,23.37c-1.29.23-2.52,1.58-2.7,2.85-.35,2.46-.26,9.16-.03,11.74.16,1.78,1.29,3.25,3.12,3.5,1.69.23,6.36.21,8.1.02,1.79-.19,3.12-1.53,3.31-3.31.29-2.7.26-8.82,0-11.55-.15-1.59-1.26-3.05-2.91-3.28-1.51-.21-7.46-.23-8.9.03ZM73.01,39.4c-.3-.36-5.23-1.17-6.07-1.3-7.58-1.09-23.27-1.67-29.02,4.23-2.66,2.73-1.57,3.86,1.56,4.86,6.7,2.13,20.45,2,27.46.88.8-.13,2.57-.33,3.19-.65.65-.34,3.41-4.92,3.53-5.67.04-.26-.53-2.21-.65-2.35ZM94.46,39.4c-.12.14-.7,2.09-.65,2.35.13.79,2.85,5.32,3.53,5.67.62.32,2.4.53,3.19.65,6.96,1.11,21.19,1.26,27.8-.98,3.06-1.04,3.65-2.29,1.23-4.77-5.72-5.86-21.49-5.33-29.02-4.23-.8.12-5.83,1-6.07,1.3ZM81.81,45.11c-.87-.04-1.78.08-2.65-.02-.95-.11-1.78-.65-2.7-.74-4.03,7.8-10.64,14.11-18.04,18.72-1.21.75-7.81,4.05-8.11,4.49-2.06,3.12,4.3,3.47,5.8,4,5.35,1.91,2.76,8.08,3.74,12.29.19.8,1.16,1.48,1.97,1.43.74-.05,3.4-2.9,4.07-3.62,9.16-9.85,15.61-22.91,15.91-36.54ZM85.65,45.11c.3,13.65,6.75,26.69,15.91,36.54.67.72,3.33,3.57,4.07,3.62.81.06,1.79-.63,1.97-1.43.98-4.2-1.61-10.37,3.74-12.29,2.09-.75,7.31-.51,5.8-4-2.87-1.74-5.92-3.11-8.75-4.92-7.16-4.57-13.47-10.69-17.4-18.29-.92.09-1.74.63-2.7.74-.87.1-1.78-.02-2.65.02Z"/>
                        </g>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 297.17 198.53" width="24" height="24">
                        <path fill="#27aae1" d="M296.36,113.05c-.78-9.63-2.65-28.61-9.55-35.59-2.05-2.07-12.41-7.7-12.65-8.42-.62-1.9,1.6-3.38,2.26-5.01,1.92-4.76.73-9.89-3.59-12.78-4.88-3.26-11.72-.6-17.28-1.89-7.81-17.03-16.99-31.83-35.08-39.12-33.85-13.65-109.38-13.6-143.32-.16-18.6,7.36-27.41,21.93-35.53,39.29-6.93.87-19.5-2.09-21.51,7.55-1.25,6.02,3.58,9.97,2.89,12.12-.23.72-10.6,6.36-12.64,8.42C2.63,85.26.62,111.33.15,122.3c-.63,14.52.56,47.12,6.9,59.93,2.51,5.06,7.15,5.15,7.88,6.03.26.32.03,2.08.37,3.02,1.06,2.87,3.69,5.34,6.5,6.5l39.86.25c3.93-.61,8.4-5.74,7.77-9.85,6.97.51,13.53-2.36,20.28-3.53,31.38-5.46,76.91-5.02,108.64-1.41,10.09,1.15,19.4,4.41,29.37,4.94-.63,4.12,3.84,9.25,7.77,9.85,12.05-.99,26.57,1.46,38.31.05,3.47-.42,6.88-3.62,8.05-6.8.34-.94.11-2.71.37-3.02.21-.25,4.41-1.28,5.89-2.76,2.62-2.62,4-9.7,4.85-13.39,4.43-19.12,4.98-39.51,3.39-59.05ZM68.77,116.1c-.65.65-6.66,1.22-8.2,1.38-6.02.62-13.75,1.16-19.76,1.27-5.86.1-17.1.14-19.64-6.39-1.6-4.1-2.47-12.3,3.06-13.28,9.32-1.66,28.89,4.28,37.5,8.58,2.54,1.27,10.42,5.04,7.03,8.43ZM216.37,160.74c-5.01,7.83-15.15,6.41-22.88,6.81-27.14,1.37-57.47,1.57-84.72.67-4.57-.15-11.49-.27-15.77-.93-7.04-1.08-18.22-7.89-11.13-15.52,8.52-9.16,47.63-12.62,60.5-13.08,17.21-.61,37.59,1.3,54.43,5.19,6.94,1.6,26.29,6.34,19.56,16.86ZM191.69,74.17c-42.99-1.06-84.18,1.01-126.81,1.9-10.98.23-3.05-12.91-.39-17.75,6.68-12.14,12.06-17.44,25.46-21.53,15.58-4.76,34.89-6.42,51.19-6.93,18.77-.58,65.2,1.5,79.91,13.1,5.18,4.08,9.65,11.2,12.67,17.01,2.37,4.55,9.11,15.7-.61,15.99-13.57.4-27.81-1.44-41.42-1.78ZM276.39,111.93c-1.08,3.39-4.03,4.83-7.25,5.74-6.31,1.78-18.63.89-25.53.43-3.91-.26-9.92-.56-13.59-1.25-2.28-.42-2.9-2.88-1.6-4.67,2.37-3.25,15.17-7.8,19.35-9.09,4.79-1.47,24.9-6.75,28.16-3.4,1.95,2,1.29,9.62.46,12.24Z"/>
                      </svg>
                    )}
                  </div>
                </div>
                {(() => {
                  // Handle regions - can be an array, object, or comma-separated string
                  let regionsToShow: string[] = [];
                  
                  if (item.car_pattern_region) {
                    // If it's a string, check if it has multiple values
                    const regionStr = String(item.car_pattern_region);
                    if (regionStr.includes(',')) {
                      // Remove everything before the first comma, then split regions
                      const afterFirstComma = regionStr.substring(regionStr.indexOf(',') + 1).trim();
                      regionsToShow = afterFirstComma.split(',').map(r => r.trim()).filter(r => r);
                    } else {
                      // Single region
                      regionsToShow = [regionStr.trim()];
                    }
                  } else if (item.regions && Array.isArray(item.regions)) {
                    // If regions is an array, extract the region names
                    regionsToShow = item.regions.map((r: any) => r.region || r.name || String(r)).filter((r: string) => r);
                  }
                  
                  if (regionsToShow.length === 0) return null;
                  
                  return (
                    <div class="pattern-regions">
                      {regionsToShow.map((region, idx) => (
                        <div key={idx} class="pattern-region">{region}</div>
                      ))}
                    </div>
                  );
                })()}
                <div class="pattern-image">
                  <img src={item.bitmap_image} alt={item.name} />
                </div>
                <div class="pattern-action">
                  <button
                    class={`select-btn ${$this.loadingPatterns.has(item.pattern_id) ? 'loading' : ''} ${$this.errorPatterns.has(item.pattern_id) ? 'error' : ''} ${$this.successPatterns.has(item.pattern_id) ? 'success' : ''}`}
                    onClick={async () => {
                      if ($this.loadingPatterns.has(item.pattern_id)) return; // Prevent multiple clicks
                      
                      // Clear error state when retrying
                      if ($this.errorPatterns.has(item.pattern_id)) {
                        $this.errorPatterns.delete(item.pattern_id);
                      }
                      
                      $this.loadingPatterns.add(item.pattern_id);
                      $this.update();
                      
                      try {
                        if (!PatternRepo.has(item.pattern_id)) {
                          const vectorItemDocument = new VectorItemDocument();
                          await vectorItemDocument.loadPatternDetail(item.pattern_id);
                          PatternRepo.set(item.pattern_id, vectorItemDocument);
                        }
                        PatternSelect.patternId = item.pattern_id;
                        PatternSelect.pattern = PatternRepo.get(item.pattern_id);
                        PatternSelect.item = item;
                        
                        // Show success feedback briefly
                        $this.successPatterns.add(item.pattern_id);
                        $this.update();
                        setTimeout(() => {
                          $this.successPatterns.delete(item.pattern_id);
                          $this.update();
                        }, 1500);
                        
                        _evtBus.emit(_evts.ButtonBar.Click, { id: "selectItem", name: "selectItem" });
                      } catch (e) {
                        console.error(e);
                        $this.errorPatterns.add(item.pattern_id);
                        $this.update();
                        await ppInfo(
                          "Error loading the pattern",
                          `The pattern loading has failed. Please try again or contact MATMAK Team: ${item.pattern_id}`,
                          "Ok",
                          undefined,
                          260
                        );
                      } finally {
                        $this.loadingPatterns.delete(item.pattern_id);
                        $this.update();
                      }
                    }}
                    disabled={$this.loadingPatterns.has(item.pattern_id)}
                    role="button"
                    aria-label={`Select pattern: ${item.name}`}
                  >
                    {$this.loadingPatterns.has(item.pattern_id) ? (
                      <>
                        <span class="spinner"></span>
                        Loading...
                      </>
                    ) : $this.errorPatterns.has(item.pattern_id) ? (
                      <>
                        <span class="error-icon">⚠️</span>
                        Retry
                      </>
                    ) : $this.successPatterns.has(item.pattern_id) ? (
                      <>
                        <span class="success-icon">✓</span>
                        Selected!
                      </>
                    ) : (
                      'Select'
                    )}
                  </button>
                  <button
                    class={`quick-add-btn ${$this.quickAddLoading.has(item.pattern_id) ? 'loading' : ''} ${$this.quickAddError.has(item.pattern_id) ? 'error' : ''} ${$this.quickAddSuccess.has(item.pattern_id) ? 'success' : ''}`}
                    onClick={async () => {
                      if ($this.quickAddLoading.has(item.pattern_id)) return;

                      if ($this.quickAddError.has(item.pattern_id)) {
                        $this.quickAddError.delete(item.pattern_id);
                      }

                      $this.quickAddLoading.add(item.pattern_id);
                      $this.update();

                      try {
                        await addPatternDirectlyToCutboard(item as PatternFile);
                        $this.quickAddSuccess.add(item.pattern_id);
                        $this.update();
                        setTimeout(() => {
                          $this.quickAddSuccess.delete(item.pattern_id);
                          $this.update();
                        }, 1500);
                      } catch (error) {
                        console.error(error);
                        $this.quickAddError.add(item.pattern_id);
                        $this.update();
                        await ppInfo(
                          "Error adding the pattern",
                          `Failed to add pattern ${item.pattern_id} to the cutboard. Please try again.`,
                          "Ok",
                          undefined,
                          260
                        );
                      } finally {
                        $this.quickAddLoading.delete(item.pattern_id);
                        $this.update();
                      }
                    }}
                    disabled={$this.quickAddLoading.has(item.pattern_id)}
                    role="button"
                    aria-label={`Add pattern ${item.name} directly to cutboard`}
                  >
                    {$this.quickAddLoading.has(item.pattern_id) ? (
                      'Adding...'
                    ) : $this.quickAddError.has(item.pattern_id) ? (
                      'Retry Add'
                    ) : $this.quickAddSuccess.has(item.pattern_id) ? (
                      'Added!'
                    ) : (
                      'Quick Add'
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}