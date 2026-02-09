import { PatternDetailResponse } from "src/ui/controls/SearchResult/PatternDetail";
import { sFetch } from "../uof/Globals";
import { decodeMVD } from "./Encoders";
import { mvdToVectorItem, syncCreatePolygonFromSVGPaths, vectorItem } from "./VectorItem";
import { Point } from "./RawVector/RawVector";
import { groupPolygons } from "./Polygon/GroupPolygon";
import * as svgPath from 'svgpath';
import * as Paper from 'paper';
import { ppInfo } from "../../src/ui/controls/popup/Popup";
import { PatternFile } from "src/uof/SearchType";
const paper = (Paper as any).default as typeof Paper;

paper.setup(new paper.Size(10000, 10000));

export class VectorItemDocument {
  _patternId: string;
  _items = []  as vectorItem[];

  clone() {
    const doc = new VectorItemDocument();
    doc._items = this._items.map(_ => _.clone());
    return doc;
  }

  serialize() {
    return this._items.map(_ => _.serialize());
  }

  desiialize(data: any) {
    this._items = data.map((_: any) => {
      const item = new vectorItem();
      item.deSerialize(_);
      return item;
    });
  }

  async loadPatternDetail(patternId: string) {
    // Retreive teh Pattern
    const detail = await sFetch<PatternDetailResponse>(`pattern/precuttool/${patternId}`, "GET", null, true);
    this._patternId = patternId;

    // Decode de raw mvd
    const encodedMvd64 = detail.payload.vector_image;
    const decodedMvd64 = atob(encodedMvd64);
    const decodedMvdUint8 = new Uint8Array(decodedMvd64.length);
    for (let i = 0; i < decodedMvd64.length; i++) {
      decodedMvdUint8[i] = decodedMvd64.charCodeAt(i);
    }

    const decodedMvd = decodeMVD(decodedMvdUint8);
    let items = mvdToVectorItem(decodedMvd);
    let points = 0;
    let optPoints = 0;

    items.forEach((item) => {
      const path = new paper.Path(svgPath.from(item.rawVectors[0].asString())/*.unarc().unshort().abs().rel().round(0)*/.toString());
      points += path.segments.length;
      //path.simplify(10);
      path.clockwise = true;
      //path.reduce({});
      optPoints += path.segments.length;
      item.rawVectors[0].rebuild(path.pathData);
    });

    // Deduce polygon to classify sub elements
    const polygons = (syncCreatePolygonFromSVGPaths(items.map(_ => _.rawVectors[0]), 5)).map((polygon) => {
      return polygon.map((point) => { return new Point(point[0], point[1]); });
    });

    const polyGroups = groupPolygons(polygons);
    const groups: number[][] = [];

    polyGroups.forEach((group) => {
      if (group.children.length > 0) {
        groups.push([group.index, ...group.children.map((child) => { return child.index; })]);
      }
    });



      // Create groups
      groups.forEach((group) => {
        const main = items[group.shift()];

        group.forEach((index) => {
          main.rawVectors.push(items[index].rawVectors[0]);
          delete items[index];
        });

        main.mergeItems();
      });

    // cleat items
    items = items.filter(_ => _);

    // Normalize all items
    items.forEach((item) => { item.normalizeDocument(); });
    this._items = items;
  }
}