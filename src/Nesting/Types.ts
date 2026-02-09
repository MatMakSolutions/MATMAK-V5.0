
  declare class XorShift {
    constructor(seed: number);
  }



   declare  class GA {
    constructor(rnd: XorShift, length: number, config: { population: number; mutationRate: number; steps: number });
    getDominant(): any;
    step(): void;
    population: any[];
  }



    declare class PlaceWorker {
    postMessage(message: any): void;
    onmessage: (e: MessageEvent) => void;
    terminate(): void;
  }



    declare class NfpWorker {
    postMessage(message: any): void;
    onmessage: (e: MessageEvent) => void;
    terminate(): void;
  }



    declare function createUniqueKey(A: any, B: any, inside: boolean, edges: boolean): string;
    declare function offsetPolygon(part: any, spacing: number): any;

    declare class Svg {

      constructor();
      toSVG(): SVGPolylineElement;

    }


declare class BoundingBox {
  width: number;
  height: number;
  x: number;
  y: number;
  min : {x: number, y: number};
  max : {x: number, y: number};
  constructor(min: {x: number, y: number}, max: {x: number, y: number});

}


  declare class Polygon extends Svg {
    points: Vector[];
    options: { [key: string]: any };
    groupId?: string;

    constructor(points: Vector[], options?: { [key: string]: any });

    static fromJSON(json: { points: { x: number; y: number; marked?: boolean }[]; options?: { [key: string]: any }; groupId?: string }): Polygon;

    bounds(): BoundingBox;

    translate(dx: number, dy: number): Polygon;

    rotate(angle?: number): Polygon;

    clone<T extends Polygon>(): T;

    area(): number;

    toTextSVG(): SVGGElement;

    toSVG(): SVGPolylineElement;

    approximately(other: Polygon): boolean;
  }

    declare class Part extends Polygon {
      id: number;
      offset: Vector;
      transformed: number;
      rotation: number;
      groupId?: string;

      constructor(id: number, points: Vector[], options?: any);

      static fromJSON(json: { id: string; points: { x: number; y: number; marked?: boolean }[]; options: any; offset?: { x: number; y: number }; transformed?: number; rotation?: number; groupId?: string }): Part;

      transform(index: number, range: number): Part;

      clone<Part>(): Part;

      toString(): string;
    }



declare type Callbacks = {
  onStart?: () => void;
  onEvaluation?: (e: {
    generation : number,
    progress   : number
}) => void;
  onPacking?: (e: PackResult) => void;
  onPackingCompleted?: (e: PackResult) => void;
};

declare class Packer {
  running: boolean;
  bins: Bin[];
  parts: Part[];
  config: any;
  rnd: XorShift;
  source: Part[];

  constructor();

  start(bins: Bin[], parts: Part[], config: any, callbacks?: Callbacks): Promise<any>;

  group(polygons: Part[], prefix: string): void;

  onPacking(e: any, callback: (e: any) => void): void;

  stop(): void;

  transform(dna: any, parts: Part[], range: number): Part[];

  format(args: any): any;

  applyPlacements(placements: any[], parts: Part[]): Part[];

  addBin(bin: Bin): void;

  packAsync(callbacks: Callbacks): Promise<any>;

  stepAsync(dominant: any, current: number, generations: number, ga: GA, cache: any, callbacks: Callbacks): Promise<any>;

  evaluateAllAsync(generation: number, population: any[], current: number, cache: any, callbacks: Callbacks): Promise<void>;

  evaluateAsync(dna: any, cache: any, onProgress: (progress: number) => void): Promise<any>;

  placeAsync(parts: Part[], cache: any): Promise<any>;

  createNfpsAsync(parts: Part[], cache: any, inside?: boolean, edges?: boolean, onProgress?: (progress: number) => void): Promise<any>;

  createAllNfpAsync(pairs: any[], current: number, cache: any, onProgress?: (progress: number) => void): Promise<any>;

  createNfpAsync(A: Part, B: Part, inside?: boolean, edges?: boolean): Promise<{ key: string; nfp: any }>;
}

declare class Vector {
  x: number;
  y: number;
  marked: boolean;

  constructor(x?: number, y?: number, marked?: boolean);

  static fromJSON(json: { x: number; y: number; marked?: boolean }): Vector;

  set(v: Vector): this;

  normalize(): Vector;

  add(v: Vector): Vector;

  sub(v: Vector): Vector;

  multiplyScalar(scalar: number): Vector;

  squaredLength(): number;

  length(): number;

  dot(v: Vector): number;

  cross(v: Vector): number;

  perpendicular(): Vector;

  negative(): Vector;

  translate(dx: number, dy: number): Vector;

  mark(): this;

  unmark(): this;

  approximately(v: Vector, tolerance?: number): boolean;

  clone(): Vector;
}

declare class Bin extends Part {
  width: number;
  height: number;
  isBin: boolean;
  offset: Vector;
  rotation: number;
  groupId?: string;

  constructor(id: number, width: number, height: number, options?: any);

  //static fromJSON(json: { id: string; width: number; height: number; options: any; offset?: { x: number; y: number }; rotation?: number; groupId?: string }): Bin;

  clone<Bin>(): Bin;

  toString(): string;
}


declare class Fit  {
  static XorShift : typeof XorShift;
  static Vector   : typeof Vector;
  static Part     : typeof Part;
  static Bin      : typeof Bin;
  static Packer   : typeof Packer;
}

/** */
declare interface PackResult {
  generation : number
  placements : Placement[]
  unplaced   : Placed[]
  dominant   : Dominant
  bins       : Bin[]
  placed     : Placed[]
  isLast     : boolean
}

declare interface Placement {
  bin: number
  part: number
  position: Position
  rotation: number
}

declare interface Position {
  x: number
  y: number
  marked: boolean
}

declare interface Dominant {
  genes: number[]
  cost: number
  options: Options
}

declare interface Options {
  placements: Placement2[]
  cost: number
  unplaced: any[]
}

declare interface Placement2 {
  bin: number
  part: number
  position: Position2
  rotation: number
}

declare interface Position2 {
  x: number
  y: number
  marked: boolean
}

declare interface BinP {
  points: Point[]
  options: Options2
  groupId: string
  id: number
  offset: Offset
  transformed: number
  rotation: number
  width: number
  height: number
  isBin: boolean
}

declare interface Point {
  x: number
  y: number
  marked: boolean
}

declare interface Options2 {}

declare interface Offset {
  x: number
  y: number
  marked: boolean
}

declare interface Placed {
  points: Point2[]
  options: Options3
  groupId: string
  id: number
  offset: Offset2
  transformed: number
  rotation: number
}

declare interface Point2 {
  x: number
  y: number
  marked: boolean
}

declare interface Options3 {}

declare interface Offset2 {
  x: number
  y: number
  marked: boolean
}
