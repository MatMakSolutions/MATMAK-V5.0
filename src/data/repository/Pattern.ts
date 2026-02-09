import { PatternFile } from "../../uof/SearchType";
import { apiPath, sFetch} from "../../uof/Globals"

type Nullable<T> = T | null;
type Nilable<T> = T | undefined;

// This repository aims to store all data of every Pattern loaded in the application.
export class PatternRepository {
  _patterns: Map<string, PatternFile> = new Map<string, PatternFile>();

  // Add a Pattern to the repository
  addPattern(pattern: PatternFile) {
    this._patterns.set(pattern.pattern_id, pattern);
  }

  // Get a Pattern from the repository
  async getPattern(patternId: string): Promise<Nilable<PatternFile>> {
    // If the Pattern is not in the repository, fetch it from the server
    if (!this._patterns.has(patternId)) {
      const pattern = await sFetch<Nilable<PatternFile>>(apiPath + `pattern/precuttool/${patternId}`, "get", null, true);
      if (!pattern) {
        return undefined;
      }
      this.addPattern(pattern);
      return pattern;
    }
    return this._patterns.get(patternId);
  }

  // Process a pattern by reading, normalizing, and groupping the patterns
  private processPatternFile(pattern: PatternFile) {

  }
}