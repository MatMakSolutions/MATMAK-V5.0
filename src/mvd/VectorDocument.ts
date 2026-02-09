import { i } from "vite/dist/node/types.d-aGj9QkWt";
import { DecomposedMatrix, decomposeMatrix, parseTransform } from "./matrix/MatrixHelper";
import { ClosePath, CurveTo, HorizontalLineTo, LineTo, MoveTo, QuadraticBezierCurveTo, RawVector, SmoothCurveTo, SmoothQuadraticBezierCurveTo, VerticalLineTo } from "./RawVector/RawVector";
import { convertToPath } from "./ShapeToPath";
import * as Paper from 'paper';
const paper = (Paper as any).default as typeof Paper;
paper.setup(new paper.Size(100, 100));

export type TGlobalMatrixTransform = TStringMatrixTransform | TMatrixTransform;
export type TStringMatrixTransform = string;
export type TMatrixTransform       = [number, number, number, number, number, number];


export interface IVectorDocument {
  vdocs              : RawVector[];
  widthInMm          : number;
  heightInMm         : number;
  widthInVu          : number;
  heightInVu         : number;
  hasBeenNormalized  : boolean;
}

export class VectorDocument implements IVectorDocument {
  vdocs      : RawVector[]     = []; // Vector documents

  widthInMm        : number  = 0;      // width in mm
  heightInMm       : number  = 0;      // height in mm
  widthInVu        : number  = 0;      // width in vector units
  heightInVu       : number  = 0;      // height in vector units
  hasBeenNormalized: boolean = false;  // has been normalized

  normalizeDocument() {
    if (this.hasBeenNormalized) return;

    const normalizeRatioX = this.widthInMm / this.widthInVu;
    const normalizeRatioY = this.heightInMm / this.heightInVu;

    this.vdocs.forEach((vdoc) => {
      (vdoc.scale(normalizeRatioX, normalizeRatioY));
    });

    for (let i=0; i<this.vdocs.length; i++) {
      const vdoc = this.vdocs[i];
      const path = new paper.Path(vdoc.asString());
      path.simplify(10);
      vdoc.rebuild(path.pathData)
    }

    this.hasBeenNormalized = true;

    this.widthInVu  = this.widthInMm;
    this.heightInVu = this.heightInMm;
  }

  applyMatrixToRawVector(rawVector: RawVector, matrixTransform?: TGlobalMatrixTransform) {
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


  addPolylines(polylineDefinition: { points: string }, matrixTransform?: TGlobalMatrixTransform) {
    const polyLines = new RawVector(convertToPath("polyline", polylineDefinition)!);
    this.applyMatrixToRawVector(polyLines, matrixTransform);
    this.vdocs.push(...this.splitPath(polyLines.asString()));
  }

  addEllipse(ellipseDefinition: { cx: number, cy: number, rx: number, ry: number }, matrixTransform?: TGlobalMatrixTransform) {
    const ellipse = new RawVector(convertToPath("ellipse", ellipseDefinition)!);
    this.applyMatrixToRawVector(ellipse, matrixTransform);
    this.vdocs.push(...this.splitPath(ellipse.asString()));
  }

  addCircle(circleDefinition: { cx: number, cy: number, r: number }, matrixTransform?: TGlobalMatrixTransform) {
    const circle = new RawVector(convertToPath("circle", circleDefinition)!);
    this.applyMatrixToRawVector(circle, matrixTransform);
    this.vdocs.push(...this.splitPath(circle.asString()));
  }

  addRectangle(rectDefinition: { x: number, y: number, width: number, height: number }, matrixTransform?: TGlobalMatrixTransform) {
    const rect = new RawVector(convertToPath("rect", rectDefinition)!);
    this.applyMatrixToRawVector(rect, matrixTransform);
    const finalRects = this.splitPath(rect.asString());

    this.vdocs.push(...finalRects);
  }

  addLine(lineDefinition: { x1: number, y1: number, x2: number, y2: number }, matrixTransform?: TGlobalMatrixTransform) {
    const line = new RawVector(convertToPath("line", lineDefinition)!);
    this.applyMatrixToRawVector(line, matrixTransform);
    this.vdocs.push(...this.splitPath(line.asString()));
  }

  public addPath(pathData: string, matrixTransform?: TGlobalMatrixTransform) {
    const path = new RawVector(pathData);
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
    this.applyMatrixToRawVector(path, matrixTransform);
    const finalRects = this.splitPath(path.asString());

    finalRects.forEach(rawVector => {
      //rawVector.normalize();
      //rawVector.setRelative(true);
    });

    const curLength = this.vdocs.length;
    this.vdocs.push(...finalRects);
    const newLength = this.vdocs.length;

    // return all new indexes into an array
    return Array.from({ length: newLength - curLength }, (_, i) => i + curLength);
  }



  /**
   * Split the SVG path data definition into sub paths
   * @param pathData the main SVG path data definition
   * @returns an array of Vdocs
   */
  public splitPath(pathData: string): RawVector[] {
    const _svgPath = new RawVector(pathData);
    const _subPaths: [number, number][] = [];
    const res = [] as RawVector[];

    // Iterate through each path in the SVG
    let startPath = 0;
    _svgPath.paths.forEach((path, index, paths) => {
      if (path instanceof MoveTo) {
        if (index === 0 || paths[index - 1] instanceof ClosePath) {
          path.setRelative(false);
          startPath = index;
        } else {
          path.setRelative(true);
        }
      } else {
        path.setRelative(true);
        if (path instanceof ClosePath) {
          _subPaths.push([startPath, index]);

          // In case new path is relative to previous but with no move to
          startPath = index + 1;
        }
      }
    });

    // Split the SVG into sub paths
    _subPaths.forEach((subPath) => {
      let pathData = "";
      for (let i = subPath[0]; i <= subPath[1]; i++) {
        pathData += _svgPath.paths[i].asString();
      }
      res.push(new RawVector(pathData));
    });

    return res;
  }

}