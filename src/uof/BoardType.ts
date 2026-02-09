import { TSurfaceDataPattern } from "src/data/repository/SurfaceData"
import { PatternFile } from "./SearchType"

export type BoardType = {
  zoomLevel      : number,
  angle          : number,
  x              : number,
  y              : number,
  originalPath   : string[],
  normalizePaths : string[],
  workingPaths   : string[],
  carColor       : number,
  rawPattern?     : PatternFile | TSurfaceDataPattern,
}