import { PatternFile } from "src/uof/SearchType";
import { DecomposedMatrix, decomposeMatrix, parseTransform } from "./matrix/MatrixHelper";
import { MvdRaw } from "./MvdRaw";
import { CurveTo, HorizontalLineTo, LineTo, MoveTo, QuadraticBezierCurveTo, RawVector, SmoothCurveTo, SmoothQuadraticBezierCurveTo, VerticalLineTo } from "./RawVector/RawVector";
import { TGlobalMatrixTransform } from "./VectorDocument";
import { VectorPath } from "../VectorPath/VectorPath";


export function syncCreatePolygonFromSVGPaths(rawVectors: RawVector[], precision: number = 15): Array<[number, number][]> {
  if (precision < 0 || precision > 100) {
      throw new Error('Precision should be between 0 and 100.');
  }

  const _rawVectors = rawVectors.map(_ => _.clone());

  function handlePoly(allPolygons: Array<[number, number][]>, standalonePathString: string, precision: number, maxidx: number, idx: number, withInfo = false) {
    let allPolygonPoints: [number, number][] = [];

    // If it's not the first path, remove the last point of the previous path to prevent overlap
    allPolygonPoints = [];

    // Create SVG path element for the current standalone path string
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><path d='${standalonePathString}' /></svg>`, 'image/svg+xml');
    const pathElement = svgDoc.querySelector('path');


    const pathLength = pathElement.getTotalLength();

    // Calculate the number of points required for the segment based on precision and path length
    const numberOfPoints = Math.max(2, Math.ceil((precision / 100) * pathLength));

    // Ensure the first point is added
    let point = pathElement.getPointAtLength(0);
    //allPolygonPoints.push([point.x, point.y]);

    // Calculate intermediate points for the segment based on the precision
    for (let i = 1; i < numberOfPoints - 1; i++) {
      point = pathElement.getPointAtLength((pathLength / (numberOfPoints - 1)) * i);
      allPolygonPoints.push([point.x, point.y]);
    }

    // Ensure the last point is added
    point = pathElement.getPointAtLength(pathLength);
    allPolygonPoints.push([point.x, point.y]);
    allPolygonPoints.push(allPolygonPoints[0]);

    //allPolygonPoints = simplifyPolygon(allPolygonPoints, 3);
    allPolygons.push(allPolygonPoints);
  }

  const allPolygons = [] as Array<[number, number][]>;
  // Get all standalone path strings from the vector document
  _rawVectors.forEach(_ => _.setRelative(false));
  const svgPathStrings = _rawVectors.map(_ => _.paths.map(__ => __.asString()).join(" "));

  for (const standalonePathString of svgPathStrings) {
      try {
        handlePoly(allPolygons, standalonePathString, precision,0, 0,  true);
      } catch (ex) {}
  }

  return allPolygons;
}

type TSerializedVectorItem = {
  widthInMm            : number;
  heightInMm           : number;
  widthInVu            : number;
  heightInVu           : number;
  isItemListNormalized : boolean;
  isDocumentNormalized : boolean;
  paths                : string[];
}

export function mvdToVectorItem(mvd: MvdRaw) {
  const items = [] as vectorItem[];
  const mvdItems: RawVector[] = mvd.paths.map(_ => {
    const strPath = _.path;
    const newPath = new VectorPath();
    newPath.parse(strPath);
    newPath.toAbsolute();
    newPath.simplify({
      forceCurve: true,
      forceLine: true,
    });
    const path = new RawVector(newPath.generatePathString());
    //path.normalize();
    path.paths.forEach((_path) => {
      if (_path instanceof SmoothCurveTo) {
        path.changeType(_path, CurveTo.key);
      }
      if (_path instanceof SmoothQuadraticBezierCurveTo) {
        path.changeType(_path, QuadraticBezierCurveTo.key);
      }
      if (_path instanceof VerticalLineTo) {
        path.changeType(_path, LineTo.key);
      }
      if (_path instanceof HorizontalLineTo) {
        path.changeType(_path, LineTo.key);
      }
      path.refreshAbsolutePositions();
    });
    applyMatrixToRawVector(path, _.transform);
    return path;
  });


  return mvdItems.map((mvdItem) => {
    const item = new vectorItem();

    item.addRawVector(mvdItem);
    item.widthInMm  = mvd.widthInMm;
    item.heightInMm = mvd.heightInMm;
    item.widthInVu  = mvd.widthInVu;
    item.heightInVu = mvd.heightInVu;

    return item;
  });
}

function applyMatrixToRawVector(rawVector: RawVector, matrixTransform?: TGlobalMatrixTransform) {
  if (!matrixTransform) return;

  let matrixTransforms: DecomposedMatrix[] = [];
  if (typeof matrixTransform === 'string') {
    matrixTransforms = parseTransform(matrixTransform);
  } else if (Array.isArray(matrixTransform)) {
    matrixTransforms = [decomposeMatrix(matrixTransform)];
  } else {
    matrixTransforms = [];
  }

  if (matrixTransforms.length > 0) {
    const tmpRawVector = rawVector;
    let x = 0;
    let y = 0;
    matrixTransforms.forEach((matrixTransform) => {
      if (matrixTransform.rotate) {
        tmpRawVector.rotate(x + matrixTransform.translateX!, y + matrixTransform.translateY!, matrixTransform.rotate);
      }

      if (matrixTransform.scaleX !== 1 || matrixTransform.scaleY !== 1) {
        tmpRawVector.scale(matrixTransform.scaleX!, matrixTransform.scaleY!);
      }

      if (matrixTransform.translateX || matrixTransform.translateY) {
        tmpRawVector.translate(matrixTransform.translateX!, matrixTransform.translateY!);
        x += matrixTransform.translateX!;
        y += matrixTransform.translateY!;
      }
    });
  }
}

/**
 * Represents one Cutting Item
 */
export class vectorItem {
  carColor             : number  = -1;     // car color
  carLegend            : string  = "";     // car legend
  widthInMm            : number  = 0;      // width in mm
  heightInMm           : number  = 0;      // height in mm
  widthInVu            : number  = 0;      // width in vector units
  serializedWidthInVu  : number  = 0;      // width in vector units
  heightInVu           : number  = 0;      // height in vector units
  serializedHeightInVu : number  = 0;      // height in vector units
  isDocumentNormalized : boolean = false;  // has been normalized
  isItemListNormalized : boolean = false;  // has been normalized
  isItemsMerged        : boolean = false;  // has been normalized
  rawPattern           : PatternFile    = null;   // Original pattern metadata

  // All the vectors in the document
  rawVectors: RawVector[] = [];
  serializedRawVectors: string[] = [];
  mergedRawVectors: RawVector;

  setDimensions({
    widthInMm,
    heightInMm,
    widthInVu,
    heightInVu,
  } : {
    widthInMm  : number,
    heightInMm : number,
    widthInVu  : number,
    heightInVu : number,
  }) {
    this.widthInMm  = widthInMm;
    this.heightInMm = heightInMm;
    this.widthInVu  = widthInVu;
    this.heightInVu = heightInVu;

    this.serializedWidthInVu = widthInVu;
    this.serializedHeightInVu = heightInVu;
  };

  serialize() {
    return {
      widthInMm  : this.widthInMm,
      heightInMm : this.heightInMm,
      widthInVu  : this.serializedWidthInVu,
      heightInVu : this.serializedHeightInVu,
      paths      : this.serializedRawVectors
    } as TSerializedVectorItem;
  }

  serializeState() {
    return {
      widthInMm            : this.widthInMm,
      heightInMm           : this.heightInMm,
      widthInVu            : this.widthInVu,
      heightInVu           : this.heightInVu,
      isItemListNormalized : this.isItemListNormalized,
      isDocumentNormalized : this.isDocumentNormalized,
      paths                : this.rawVectors.map(_ => _.asString())
    } as TSerializedVectorItem;
  }

  deSerialize(data?: TSerializedVectorItem) {
    if (!data) {
      this.widthInVu  = this.serializedWidthInVu;
      this.heightInVu = this.serializedHeightInVu;

      this.rawVectors = this.serializedRawVectors.map(_ => new RawVector(_));
      return;
    }
    this.widthInMm            = data.widthInMm;
    this.heightInMm           = data.heightInMm;
    this.widthInVu            = data.widthInVu;
    this.heightInVu           = data.heightInVu;
    this.isItemListNormalized = data.isItemListNormalized;
    this.isDocumentNormalized = data.isDocumentNormalized;

    this.serializedWidthInVu  = data.widthInVu;
    this.serializedHeightInVu = data.heightInVu;

    this.serializedRawVectors = data.paths;
    this.rawVectors = data.paths.map(_ => new RawVector(_));
  }

  clone() {
    const item = new vectorItem();
    item.widthInMm  = this.widthInMm;
    item.heightInMm = this.heightInMm;
    item.widthInVu  = this.widthInVu;
    item.heightInVu = this.heightInVu;

    item.serializedWidthInVu = this.serializedWidthInVu;
    item.serializedHeightInVu = this.serializedHeightInVu;

    item.rawVectors = this.rawVectors.map(_ => _.clone());
    item.serializedRawVectors = this.serializedRawVectors.map(_ => _);

    return item;
  }

  addRawVector(rawVector: RawVector | string) {
    if (typeof rawVector === 'string') {
      rawVector = new RawVector(rawVector);
    }
    this.rawVectors.push(rawVector);
    this.serializedRawVectors.push(rawVector.asString());
  }

  get merged() {
    return this.mergedRawVectors ?? this.rawVectors[0];
  }

  normalizeDocument() {
    if (this.isDocumentNormalized) return;

    const normalizeRatioX = this.widthInMm / this.widthInVu;
    const normalizeRatioY = this.heightInMm / this.heightInVu;

    this.rawVectors.forEach((vdoc) => {
      vdoc.scale(normalizeRatioX, normalizeRatioY);
    });

    this.mergeItems();

    this.widthInVu  = this.widthInMm;
    this.heightInVu = this.heightInMm;
  }

  normalizeItems() {
    if (this.isItemsMerged)  {
      if (this.isItemListNormalized) return;
      this.mergedRawVectors.normalize();
    } else {
      this.rawVectors.forEach((vdoc) => {+
        vdoc.normalize();
      });
    }
    this.isItemListNormalized = true;
  }


  mergeItems() {
    if (this.rawVectors.length === 1) {
      this.mergedRawVectors = this.rawVectors[0];
      return;
    }

    const newVectors = [] as RawVector[];
    const paths = [] as string[];

     this.rawVectors.forEach((vdoc, index) => {
        //vdoc.translate(vdoc.x, vdoc.y);
        vdoc.paths.forEach((path) => { path.setRelative(false); });
        paths.push(vdoc.asString());
      });

      const newVec = new RawVector(paths.join(" "));
      paths.length = 0;
      newVectors.push(newVec);
      let firstMoveTo = true;
      newVec.paths.forEach((path) => {
        if (path instanceof MoveTo && firstMoveTo) {
          path.setRelative(false);
          firstMoveTo = false;
        } else {
          path.setRelative(true);
        }
      });

      this.isItemsMerged = true;
    this.mergedRawVectors = newVec;
  }
}