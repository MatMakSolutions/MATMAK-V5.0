import { Md5 } from "ts-md5";
import { PatternFile, TSearchResult } from "./SearchType";
import { VectorItemDocument } from "../mvd/VectorItemDocument";
import { vectorItem } from "../mvd/VectorItem";
import { VectorDisplay } from "../mvd/WebGL/VectorDisplay";
import { MyBoards } from "../ui/controls/MyBoards/MyBoards";

export const curProjectId = {
  id: "",
  name: ""
};


export const currentPatternSelection = {
  images: [] as string[],
  colorPacks: [] as number[],
  selections: [] as vectorItem[],
  selectionsDisp: [] as VectorDisplay[],
  shouldBeProcessed: false as boolean
}

//export const apiPath = "http://127.0.0.1:8080/https://backenduatapis.matmaksolutions.com/api/";
export const apiPath = "https://backendapis.matmaksolutions.com/api/";
//export const apiPath = "http://localhost:5109/";
//export const apiPath = "http://localhost:8080/api/";
//export const apiPath = "https://backendapis.matmaksolutions.com/api/";

export const sFetch = async <T>(url: string, method: string, body: any, noCache: boolean = true): Promise<T> => {
  const cache = getCache();
  let key = method + url + JSON.stringify(body ?? {});
  // Calculate a md5 hash of the key
  key = new Md5().appendStr(key).end()!.toString();


  const cached = await cache.get(key);

  if (cached && !noCache) {
    return cached as T;
  }

  const def = {
    method: method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + localStorage.getItem("token")
    }
  } as any;

  if (body) {
    def.body = JSON.stringify(body);
  }

  const res = await fetch(apiPath + url, def);
  const json =  await res.json();

  if (!noCache) {
    await cache.set(key, json);
  }

  return json as T;
};

// expose here the cache definition
export interface Cache {
  set: (key: string, data: any) => Promise<void>;
  get: <T>(key: string) => Promise<T>;
}

export const getCache = () => {
  return (window as any).cache as Cache;
}

// Search Results
export const searchResults = new Map<string, TSearchResult>();
export const searchParams = {
  currentSearchIdx: 0,
  currentName: "",
}
export const searchProjects = new Map<string, TSearchResult>();
export const searchCut = [] as Array<PatternFile>;
export function mapToArray<U>(map: Map<string, U>): Array<{ key: string, value: U }> {
  return Array.from(map, ([key, value]) => ({ key, value }));
}
export function mapToArray2<K,V>(map: Map<K, V>): Array<{ key: K, value: V }> {
  return Array.from(map, ([key, value]) => ({ key, value }));
}