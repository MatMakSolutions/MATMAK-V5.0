import { VectorItemDocument } from "src/mvd/VectorItemDocument";
import { PatternFile } from "./SearchType";

export const PatternRepo = new Map<string, VectorItemDocument>();
export const PatternSelect = {
  patternId: "",
  pattern: null as null | VectorItemDocument,
  item: null as PatternFile | null
}