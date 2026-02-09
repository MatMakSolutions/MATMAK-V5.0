/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { TIcon } from "../icons/TIcon";
import { curProjectId, currentPatternSelection, searchResults, sFetch } from "../../../uof/Globals";
import { getUow } from "../../..//uof/UnitOfWork";
import { blackButtonThin } from "../CutBoardPreview/CutBoardPreview";
import { Table } from "../Table/Table";
import { ppConfirm, ppInfo, ppProjectStatus, ppPrompt } from "../popup/Popup";
import { _evtBus, _evts } from "../../../core/EventBus";
import { ButtonBar } from "../buttons/ButtonBar";
import { SearchResult } from "../SearchResult/SearchResult";
import { FilterPane } from "../search/FilterPane";
import { Dropdown } from "../search/cmp/Dropdown";
import { TSearchResult } from "src/uof/SearchType";
import '../../../utils/css/project.css'




export class Projects extends BaseComponent {
  children: BaseComponent[] = [];
  title: string = "Projects";
  items: any[] = [];

  async refresh() {
    const $this = this;
    const tableProjects = getUow<Table>("tableProjects");
    tableProjects.rows = [];
    tableProjects.update();
    const projectStatusList = ((await sFetch("userproject/projectstatus", "GET", null)) as any).payload;

    sFetch("UserProject", "get", null, true).then((res: any) => {
      this.items = res.payload;

      tableProjects.rows = res.payload.filter((_: any) => _.name.toLowerCase().indexOf(searchFilter) !== -1 || !searchFilter).map((_: any, i: number) => {
        const btn1p = (
          <button class="load-project-button" onClick={async () => {
            curProjectId.id = _.projectId;
            curProjectId.name = _.name;
            const btnSearch = getUow<ButtonBar>("btnSearch");
            const searchresult = getUow<SearchResult>("searchresult");
            searchresult.reset();
            const vehicleSearch = getUow<FilterPane>("vehicleSearch");
            vehicleSearch.reset();
            const ddMake = getUow<Dropdown>("ddMake");
            const ddModel = getUow<Dropdown>("ddModel");
            const ddSubModel = getUow<Dropdown>("ddSubModel");
            const ddVersion = getUow<Dropdown>("ddVersion");
            const ddYear = getUow<Dropdown>("ddYear");
            const ddRegion = getUow<Dropdown>("ddRegion");
            let searches = [];
            searchResults.clear();
            currentPatternSelection.images = [];
            currentPatternSelection.selections = [];
            currentPatternSelection.selectionsDisp = [];
            currentPatternSelection.shouldBeProcessed = false;
            try {
              searches = ((await sFetch("userproject/projectcarsearch/" + _.projectId, "GET", null, true)) as any).payload ?? [];
            } catch (e) {
              searchResults.clear();
            }
            for (let i = 0; i < searches.length; i++) {
              const element = searches[i];
              const lookupMake = await sFetch("lookup/carmakes/0", "GET", null) as any;
              const lookupModel = await sFetch(`lookup/carmodels/${element.makeId}/${0}`, "GET", null) as any;
              const lookupSubModel = await sFetch(`lookup/carseries/${element.modelId}/${0}`, "GET", null) as any;
              const lookupVersion = await sFetch(`lookup/carversion/${element.seriesId}/${0}`, "GET", null) as any;
              const lookupYear = await sFetch("lookup/years", "GET", null) as any;
              const lookupRegion = await sFetch("lookup/patternregions", "POST", {
                "page": 0,
                "page_size": 1000,
                "sort_column": "name",
                "sort_order": "asc",
                "search_text": "",
                "filters": JSON.stringify([
                  { "key": "make_id", "value": element.makeId },
                  { "key": "model_id", "value": element.modelId },
                  { "key": "series_id", "value": element.seriesId },
                  { "key": "version_id", "value": element.versionId },
                  { "key": "year_id", "value": element.yearId }
                ])
              }) as any;
              const ddMakeValue = lookupMake.filter((__: any) => __.id === element.makeId)[0];
              const ddModelValue = lookupModel.filter((__: any) => __.id === element.modelId)[0];
              const ddSubModelValue = lookupSubModel.filter((__: any) => __.id === element.seriesId)[0];
              const ddVersionValue = lookupVersion.filter((__: any) => __.id === element.versionId)[0];
              const ddYearValue = lookupYear.filter((__: any) => __.id === element.yearId)[0];
              let ddRegionValue = lookupRegion.filter((__: any) => __.id === element.regionId)[0] ?? -1;
              const searchKey = `${ddMakeValue.name} - ${ddModelValue.name} - ${ddSubModelValue.name} - ${ddVersionValue.name} - ${ddYearValue.name} - ${ddRegionValue.name}`;
              searchResults.set(searchKey, {
                needReload: true,
                searchId: element.searchId,
                payload: {
                  productSearchRequest: {
                    category_id: 1,
                    make_id: element.makeId,
                    series_id: element.modelId,
                    model_id: element.seriesId,
                    year_id: element.yearId,
                    version_id: element.versionId,
                    region_id: element.regionId,
                  }
                }
              } as TSearchResult);
            }
            _evtBus.emit(_evts.ButtonBar.Click, { id: btnSearch.guid, name: btnSearch.name });
          }}>
            <svg viewBox="0 0 24 24" class="load-project-icon" aria-hidden="true">
              <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
            Load
          </button>
        );
        const btn2p = (
          <button class="status-project-button" onClick={async () => {
            const status = await ppProjectStatus();
            if (!status) return;
            await sFetch("userproject", "put", {
              "projectId": _.projectId,
              "projectINewName": _.name,
              "statusId": Number(status),
            }, true);
            $this.refresh();
          }}>
            <svg viewBox="0 0 24 24" class="status-project-icon" aria-hidden="true">
              <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
            </svg>
            {projectStatusList.filter((__: any) => __.id.toString() === _.statusId.toString())[0].statusName}
          </button>
        );
        const btn3 = (
          <button class="delete-project-button" onClick={async () => {
            const res = await ppConfirm("Deletion", "Are you sure you want to delete this project?", "Yes", "No");
            if (res !== "ok") return;
            await sFetch("userproject?projectid=" + _.projectId, "delete", {}, true);
            $this.refresh();
            await ppInfo("Deleted", "The project has been deleted", "Ok", 500, 210);
          }}>
            <svg viewBox="0 0 24 24" class="delete-project-icon" aria-hidden="true">
              <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            Delete
          </button>
        );
        return [i + 1, _.name, new Date(_.dateCreated).toLocaleDateString(), new Date(_.dateCreated).toLocaleTimeString(), btn2p, [btn1p, btn3]];
      });
      this.update();
      tableProjects.update();
    });
  }

  constructor() {
    super("Projects");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["items"]);
    const $this = this;

    this.addEventListener("mount", async function mount() {
      await $this.refresh();
      $this.update();
    });
  }
}

const _default: TRenderHandler = ($this: Projects) => {
  return <>
    <div class="my-boards-header">{$this.title}</div>
    <div class="my-boards-search">
      {textbox("lens", "Search", $this)}
      {/*dropDown("filter", "Filters")*/}
      {/*dropDown("silver-request", "Sort")*/}
      <button class="create-project-button" onClick={async () => {
        const name = await ppPrompt("New Project", `My Project ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}`, "Create", "Cancel");
        if (!name) return;
        await sFetch("userproject", "post", { projectIName: name }, true);
        $this.refresh();
      }}>
        <svg viewBox="0 0 24 24" class="create-project-icon" aria-hidden="true">
          <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
        Create Project
      </button>
    </div>
    { $this.children.map((child) => child.vdom) }
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

let searchFilter = "";
const textbox = (icon: TIcon, text: string, $this: Projects) => {
  return <>
    <div class="my-boards-search-box">
      <input
        type="text"
        defaultValue={!!searchFilter ? searchFilter : text}
        onClick={(e) => { e.currentTarget.value = searchFilter }}
        onKeyUp={(e) => {
          searchFilter = e.currentTarget.value.toLowerCase();
          const tableProjects = getUow<Table>("tableProjects");
          const projectStatusList = ((sFetch("userproject/projectstatus", "GET", null)) as any).payload;

          tableProjects.rows = $this.items?.filter(_ => (_.name as string).toLowerCase().indexOf(searchFilter) !== -1 || !searchFilter).map?.((_: any, i: number) => {
            const btn1p = (
              <button class="load-project-button" onClick={async () => {
                curProjectId.id = _.projectId;
                curProjectId.name = _.name;
                const btnSearch = getUow<ButtonBar>("btnSearch");
                const searchresult = getUow<SearchResult>("searchresult");
                searchresult.reset();
                const vehicleSearch = getUow<FilterPane>("vehicleSearch");
                vehicleSearch.reset();
                const ddMake = getUow<Dropdown>("ddMake");
                const ddModel = getUow<Dropdown>("ddModel");
                const ddSubModel = getUow<Dropdown>("ddSubModel");
                const ddVersion = getUow<Dropdown>("ddVersion");
                const ddYear = getUow<Dropdown>("ddYear");
                const ddRegion = getUow<Dropdown>("ddRegion");
                let searches = [];
                searchResults.clear();
                currentPatternSelection.images = [];
                currentPatternSelection.selections = [];
                currentPatternSelection.selectionsDisp = [];
                currentPatternSelection.shouldBeProcessed = false;
                try {
                  searches = ((await sFetch("userproject/projectcarsearch/" + _.projectId, "GET", null, true)) as any).payload ?? [];
                } catch (e) {
                  searchResults.clear();
                }
                for (let i = 0; i < searches.length; i++) {
                  const element = searches[i];
                  const lookupMake = await sFetch("lookup/carmakes/0", "GET", null) as any;
                  const lookupModel = await sFetch(`lookup/carmodels/${element.makeId}/${0}`, "GET", null) as any;
                  const lookupSubModel = await sFetch(`lookup/carseries/${element.modelId}/${0}`, "GET", null) as any;
                  const lookupVersion = await sFetch(`lookup/carversion/${element.seriesId}/${0}`, "GET", null) as any;
                  const lookupYear = await sFetch("lookup/years", "GET", null) as any;
                  const lookupRegion = await sFetch("lookup/patternregions", "POST", {
                    "page": 0,
                    "page_size": 1000,
                    "sort_column": "name",
                    "sort_order": "asc",
                    "search_text": "",
                    "filters": JSON.stringify([
                      { "key": "make_id", "value": element.makeId },
                      { "key": "model_id", "value": element.modelId },
                      { "key": "series_id", "value": element.seriesId },
                      { "key": "version_id", "value": element.versionId },
                      { "key": "year_id", "value": element.yearId }
                    ])
                  }) as any;
                  const ddMakeValue = lookupMake.filter((__: any) => __.id === element.makeId)[0];
                  const ddModelValue = lookupModel.filter((__: any) => __.id === element.modelId)[0];
                  const ddSubModelValue = lookupSubModel.filter((__: any) => __.id === element.seriesId)[0];
                  const ddVersionValue = lookupVersion.filter((__: any) => __.id === element.versionId)[0];
                  const ddYearValue = lookupYear.filter((__: any) => __.id === element.yearId)[0];
                  let ddRegionValue = lookupRegion.filter((__: any) => __.id === element.regionId)[0] ?? -1;
                  const searchKey = `${ddMakeValue.name} - ${ddModelValue.name} - ${ddSubModelValue.name} - ${ddVersionValue.name} - ${ddYearValue.name} - ${ddRegionValue.name}`;
                  searchResults.set(searchKey, {
                    needReload: true,
                    searchId: element.searchId,
                    payload: {
                      productSearchRequest: {
                        category_id: 1,
                        make_id: element.makeId,
                        series_id: element.modelId,
                        model_id: element.seriesId,
                        year_id: element.yearId,
                        version_id: element.versionId,
                        region_id: element.regionId,
                      }
                    }
                  } as TSearchResult);
                }
                _evtBus.emit(_evts.ButtonBar.Click, { id: btnSearch.guid, name: btnSearch.name });
              }}>
                <svg viewBox="0 0 24 24" class="load-project-icon" aria-hidden="true">
                  <path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
                Open Project
              </button>
            );
            const btn2p = (
              <button class="status-project-button" onClick={async () => {
                const status = await ppProjectStatus();
                if (!status) return;
                await sFetch("userproject", "put", {
                  "projectId": _.projectId,
                  "projectINewName": _.name,
                  "statusId": Number(status),
                }, true);
                $this.refresh();
              }}>
                <svg viewBox="0 0 24 24" class="status-project-icon" aria-hidden="true">
                  <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
                </svg>
                {projectStatusList.filter((__: any) => __.id.toString() === _.statusId.toString())[0].statusName}
              </button>
            );
            const btn3 = (
              <button class="delete-project-button" onClick={async () => {
                const res = await ppConfirm("Deletion", "Are you sure you want to delete this project?", "Yes", "No");
                if (res !== "ok") return;
                await sFetch("userproject?projectid=" + _.projectId, "delete", {}, true);
                $this.refresh();
                await ppInfo("Deleted", "The project has been deleted", "Ok", 500, 210);
              }}>
                <svg viewBox="0 0 24 24" class="delete-project-icon" aria-hidden="true">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
                Delete
              </button>
            );
            return [i + 1, _.name, new Date(_.dateCreated).toLocaleDateString(), new Date(_.dateCreated).toLocaleTimeString(), btn2p, [btn1p, btn3]];
          });
          tableProjects.update();
        }
      }/>
      <div class="search-box-icon" />
    </div>
  </>;
}