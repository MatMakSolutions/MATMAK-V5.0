import { Dropdown } from "src/ui/controls/search/cmp/Dropdown";
import { getUow } from "./UnitOfWork";
import { apiPath, curProjectId, getCache, searchParams, searchResults, sFetch } from "./Globals";
import { Button } from "src/ui/controls/buttons/cmp/Button";
import { TSearchResult } from "./SearchType";
import { TUserresponse } from "./UserType";
import { SearchResult } from "../ui/controls/SearchResult/SearchResult";
import { _evtBus, _evts } from "../core/EventBus";

let token = "";

export async function InitializeSearch() {

  const ddCategory = getUow<Dropdown>("ddCategory");
  ddCategory.title = "Select a Category";
  ddCategory.itemLabel = "name";
  ddCategory.onSelect = (item) => {
  };

  const ddMake = getUow<Dropdown>("ddMake");
  ddMake.title = "Select a Make";
  ddMake.itemLabel = "name";
  ddMake.onSelect = (item) => {
  };

  const ddModel = getUow<Dropdown>("ddModel");
  ddModel.title = "Select a Model";
  ddModel.itemLabel = "name";
  ddModel.onSelect = (item) => {
  };

  const ddSubModel = getUow<Dropdown>("ddSubModel");
  ddSubModel.title = "Select a SubModel";
  ddSubModel.itemLabel = "name";
  ddSubModel.onSelect = (item) => {
  };

  const ddVersion = getUow<Dropdown>("ddVersion");
  ddVersion.title = "Select a Version";
  ddVersion.itemLabel = "name";
  ddVersion.onSelect = (item) => {
  };

  const ddYear = getUow<Dropdown>("ddYear");
  ddYear.title = "Select a Year";
  ddYear.itemLabel = "name";
  ddYear.onSelect = (item) => {
  };

  const ddRegion = getUow<Dropdown>("ddRegion");
  ddRegion.title = "Select a Region";
  ddRegion.itemLabel = "name";
  ddRegion.onSelect = (item) => {
  };

  const btnShowVehicle = getUow<Button>("btnShowVehicle");
  btnShowVehicle.text = "Show Vehicle";
  btnShowVehicle.isDisabled = true;

  ddCategory.reset();
  ddMake.reset();
  ddModel.reset();
  ddSubModel.reset();
  ddVersion.reset();
  ddYear.reset();
  ddRegion.reset();

  ddMake.isDisabled     = true;
  ddModel.isDisabled    = true;
  ddSubModel.isDisabled = true;
  ddVersion.isDisabled  = true;
  ddYear.isDisabled     = true;
  ddRegion.isDisabled   = true;

  ddCategory.items = [
    {
      "id": 1,
      "name": "Automobile"
    }
  ];

  ddCategory.onSelect = async (item) => {
    const res = await sFetch("lookup/carmakes/0", "GET", null) as any;
    ddMake.items = res;
    ddMake.isDisabled = false;
    ddModel.reset(); ddModel.isDisabled = true;
    ddSubModel.reset(); ddSubModel.isDisabled = true;
    ddVersion.reset(); ddVersion.isDisabled = true;
    ddYear.reset(); ddYear.isDisabled = true;
    ddRegion.reset(); ddRegion.isDisabled = true;

  }

  ddMake.onSelect = async (item) => {
    const res = await sFetch("lookup/carmodels/" + ddMake.selectedItem.id + "/0", "GET", null) as any;
    ddModel.reset();
    ddModel.items = res;
    ddModel.isDisabled = false;
    ddSubModel.reset(); ddSubModel.isDisabled = true;
    ddVersion.reset(); ddVersion.isDisabled = true;
    ddYear.reset(); ddYear.isDisabled = true;
    ddRegion.reset(); ddRegion.isDisabled = true;
  }

  ddModel.onSelect = async (item) => {
    const res = await sFetch("lookup/carseries/" + ddModel.selectedItem.id + "/0", "GET", null) as any;
    ddSubModel.reset();
    ddSubModel.items = res;
    ddSubModel.isDisabled = false;
    ddVersion.reset(); ddVersion.isDisabled = true;
    ddYear.reset(); ddYear.isDisabled = true;
    ddRegion.reset(); ddRegion.isDisabled = true;
  }

  ddSubModel.onSelect = async (item) => {
    const res = await sFetch("lookup/carversion/" + ddSubModel.selectedItem.id + "/0", "GET", null) as any;
    ddVersion.reset();
    ddVersion.items = res;
    ddVersion.isDisabled = false;
    ddYear.reset(); ddYear.isDisabled = true;
    ddRegion.reset(); ddRegion.isDisabled = true;

  }

  ddVersion.onSelect = async (item) => {
    const res = await sFetch("lookup/caryear/" + ddVersion.selectedItem.id, "GET", null) as any;
    ddYear.items = res//.filter((x: any) => x.model_id === ddModel.selectedItem.id);
    ddYear.isDisabled = false;
  }

  ddYear.onSelect = async (item) => {

    const res = await sFetch("lookup/patternregions", "POST", {
      "page": 0,
      "page_size": 1000,
      "sort_column": "name",
      "sort_order": "asc",
      "search_text": "",
      "filters": JSON.stringify([
        {"key":"make_id"    ,"value":ddMake.selectedItem.id},
        {"key":"model_id"   ,"value":ddModel.selectedItem.id},
        {"key":"series_id"  ,"value":ddSubModel.selectedItem.id},
        {"key":"version_id" ,"value": ddVersion.selectedItem.id},
        {"key":"year_id"    ,"value": ddYear.selectedItem.id}
      ])
  });
    ddRegion.reset();
    ddRegion.items = (res as {name:string, id:number}[]).map((x) => {
      if (x.id === 12) x.id = -1;
      return x;
    });
    ddRegion.isDisabled = false;
    btnShowVehicle.isDisabled = false;
  }

  ddRegion.onSelect = async (item) => {
    btnShowVehicle.isDisabled = false;
  }

  btnShowVehicle.onClick = async () => {
    const res = await sFetch("product/precuttool/productpages", "POST", {
      "category_id" : ddCategory.selectedItem.id,
      "make_id"     : ddMake.selectedItem.id,
      "series_id"   : ddSubModel.selectedItem.id,
      "model_id"    : ddModel.selectedItem.id,
      "year_id"     : ddYear.selectedItem.id,
      "version_id"  : ddVersion.selectedItem.id,
      "region_id"   : ddRegion.selectedItem?.id ?? -1,
      "filters"     : {
        "search_text" : "",
        "page"        : 1,
        "page_size"   : 32,
        "sort_column" : "name",
        "sort_order"  : "asc",
        "filters"     : (JSON.stringify([
          {"key":"category_id" , "value": ddCategory.selectedItem.id},
          {"key":"make_id"     , "value": ddMake.selectedItem.id},
          {"key":"series_id"   , "value": ddSubModel.selectedItem.id},
          {"key":"model_id"    , "value": ddModel.selectedItem.id},
          {"key":"year_id"     , "value": ddYear.selectedItem.id},
          {"key":"version_id"  , "value": ddVersion.selectedItem.id},
          {"key":"region_id"   , "value": ddRegion.selectedItem?.id ?? -1},
        ])),
        "user_id": localStorage.getItem("user")
      }
    }) as TSearchResult;

    const searchKey = `${ddMake.selectedItem.name} - ${ddModel.selectedItem.name} - ${ddSubModel.selectedItem.name} - ${ddVersion.selectedItem.name} - ${ddYear.selectedItem.name} - ${ddRegion.selectedItem?.name ?? ""}`;
    searchParams.currentSearchIdx = searchResults.size;
    searchParams.currentName = `${ddMake.selectedItem.name} ${ddModel.selectedItem.name} ${ddSubModel.selectedItem.name} ${ddVersion.selectedItem.name} ${ddYear.selectedItem.name} ${ddRegion.selectedItem?.name ?? ""}`

    searchResults.set(searchKey, res);

    getUow<SearchResult>("searchresult").currentKey = searchKey;
    getUow<SearchResult>("searchresult").update();

    if (curProjectId.id !== "") {
      const res = await sFetch("userproject/projectcarsearch", "POST", {
        "projectId"  : curProjectId.id,
        "categoryId" : ddCategory.selectedItem.id,
        "makeId"     : ddMake.selectedItem.id,
        "yearId"     : ddYear.selectedItem.id,
        "modelId"    : ddModel.selectedItem.id,
        "seriesId"   : ddSubModel.selectedItem.id,
        "versionId"  : ddVersion.selectedItem.id,
        "regionId"   : ddRegion.selectedItem?.id ?? -1
      });
    }

  }


}



