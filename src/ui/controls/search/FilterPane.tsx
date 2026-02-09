/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { Dropdown } from "./cmp/Dropdown";
import { registerUow } from "../../../uof/UnitOfWork";
import { Button } from "../buttons/cmp/Button";
import '../../../utils/css/filterpane.css'




export class FilterPane extends BaseComponent {
  ddCategory: Dropdown = new Dropdown();
  ddMake: Dropdown = new Dropdown();
  ddModel: Dropdown = new Dropdown();
  ddSubModel: Dropdown = new Dropdown();
  ddVersion: Dropdown = new Dropdown();
  ddYear: Dropdown = new Dropdown();
  ddRegion: Dropdown = new Dropdown();
  btnShowVehicle: Button = new Button();

  constructor() {
    super("FilterPane");
    this.registerTemplate("default", _default);
    this.init();
  }

  reset() {
    this.ddMake.isDisabled = true;
    this.ddModel.isDisabled = true;
    this.ddSubModel.isDisabled = true;
    this.ddVersion.isDisabled = true;
    this.ddYear.isDisabled = true;
    this.ddRegion.isDisabled = true;

    this.ddCategory.items = [
      {
        "id": 1,
        "name": "Automobile"
      }
    ];
    this.ddMake.reset();
    this.ddModel.reset();
    this.ddSubModel.reset();
    this.ddVersion.reset();
    this.ddYear.reset();
    this.ddRegion.reset();
  }

  init() {
    registerUow({ key: "ddCategory", data: this.ddCategory });
    registerUow({ key: "ddMake", data: this.ddMake });
    registerUow({ key: "ddModel", data: this.ddModel });
    registerUow({ key: "ddSubModel", data: this.ddSubModel });
    registerUow({ key: "ddVersion", data: this.ddVersion });
    registerUow({ key: "ddYear", data: this.ddYear });
    registerUow({ key: "ddRegion", data: this.ddRegion });
    registerUow({ key: "btnShowVehicle", data: this.btnShowVehicle });
  }
}

const _default: TRenderHandler = ($this: FilterPane) => {
  return (
    <div class="filter-pane-container">
      <div class="filter-bar">
        <div class="filter-item" data-label="Category">{$this.ddCategory.vdom}</div>
        <div class="filter-item" data-label="Make">{$this.ddMake.vdom}</div>
        <div class="filter-item" data-label="Model">{$this.ddModel.vdom}</div>
        <div class="filter-item" data-label="SubModel">{$this.ddSubModel.vdom}</div>
      </div>
      <div class="filter-bar">
        <div class="filter-item" data-label="Version">{$this.ddVersion.vdom}</div>
        <div class="filter-item" data-label="Year">{$this.ddYear.vdom}</div>
        <div class="filter-item" data-label="Region">{$this.ddRegion.vdom}</div>
    
        <div class="filter-button" data-label="Search">{$this.btnShowVehicle.vdom}</div>
          </div>
    </div>
  );
}