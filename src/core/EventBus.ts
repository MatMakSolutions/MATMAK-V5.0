import config from "forge.config";
import { createEventWrapper, EventDefinition, EventWrapperConfig } from "../utils/EventWrapper";
import { constantTree } from "./ConstantTree";
import { guid } from "./Guid";
import { MultiViewItem } from "src/mvd/MultiViewItem";
import "../Nesting/Types";
import { Pattern } from "src/Pattern/Pattern";

type THandler = {
  id       : string                  ;
  callback : (data: unknown) => void ;
  once     : boolean                 ;
}

export type CancelEvent = {
  id  : string;
  off : () => boolean | void;
}

export class EventBus {
  #events = new Map<string, Map<string, THandler>>();

  on<T>(eventName: string, callback: (data: T) => void, once: boolean = false) {
    !this.#events.has(eventName)
      && this.#events.set(eventName, new Map<string, THandler>());

    const fullHandler = { id: guid(), callback, once } as THandler;
    this.#events.get(eventName)!.set(fullHandler.id, fullHandler);

    return {
      id  : fullHandler.id,
      off : () => this.#events.get(eventName)?.delete(fullHandler.id)
    };
  };

  emit(eventName: string, data?: unknown) {
   // setTimeout(() => {
      this.#events.get(eventName)?.forEach((v,k,m)=> {
        v.callback(data);
        v.once && m.delete(k);
      });
   // }, 0);
  }

  clear() {
    this.#events = new Map<string, Map<string, THandler>>();
  }
}

export const _evtBus = new EventBus();
export const _evts = constantTree({
  ButtonBar: {
    Click: ""
  },
  PatternSelection: {
    zoomIn      : "",
    zoomOut     : "",
    addAll      : "",
    addSelected : "",
    onResize    : ""
  },
  cutBoard: {
    zoomIn      : "",
    zoomOut     : "",
  }
});


export const _boardEvts = constantTree({
  Utils: {
    Nesting: {
      Do: {
        // Sending events
        CreateSession : "",  // Initiate a new Nesting session
        AddPart       : "",  // Add a new Part to the Nesting session
        Start         : "",  // Start the Nesting session
        Stop          : ""   // Stop the Nesting session
      },
      WaitFor: {
        // Listening events
        SessionCreation : "",  // Nesting Session Created
        Progress        : "",  // Nesting Progress
        PackingResult   : "",  // Nesting Result
        SessionAbortion : ""   // Nesting Session Aborted
      }
    }
  },
  BoardSurface: {
    onConfigChange            : "",   // On Config Change
    zoomIn                    : "",   // Board Zoom In
    zoomOut                   : "",   // Board Zoom Out
    addAll                    : "",   // Add All
    addSelected               : "",   // Add Selected
    onResize                  : "",   // On Resize window
    onMove                    : "",   // On Mouse Move
    onMouseDown               : "",   // On Mouse Down
    onMouseUp                 : "",   // On Mouse Up
    onMouseScroll             : "",   // On Mouse Scroll
    onMouseLeave              : "",   // On Mouse Leave
    onMouseOut                : "",   // On Mouse Out
    onNesting                 : "",   // On Nesting
    onNestingResult           : "",   // On Nesting Result
    onNestingProgress         : "",   // On Nesting Progress
    onNestingAbort            : "",   // On Nesting Abort
    onNestingComplete         : "",   // On Nesting Complete
    onNestingError            : "",   // On Nesting Error
    onAskForNesting           : "",   // On Ask For Nesting
    onRotate                  : "",   // On Rotate
    onCutCommand              : "",   // On Cut Command
    onOutward                 : "",   // On Outward
    onGlobalCollisionComplete : "",   // On Global Collision Complete
    onToggleMaterialusage     : "",   // On Toggle Material Usage
    onReloadConfig            : "",   // On Reload Config
    onUndo                    : "",   // On Undo
    onRedo                    : "",   // On Redo
  },
  Item: {
    onSelected       : "", // On Item Selected
    onUnselected     : "", // On Item Unselected
    onMove           : "", // On Item Move
    onRebuild        : "", // On Item Rebuild
    onRefresh        : "", // On Item Refresh
    onApplyUIChanges : "", // On Item Apply UI Changes
    onZoom           : "", // On Item Zoom

    onSetState   : "", // On Item Set State
    onGetState   : "", // On Item Get State

    onSerialize   : "",   // On Item Serialize
    onDeserialize : "",   // On Item Deserialize

    onEnterEdit       : "",   // On Item Enter Edit
    onEnterSubPatternRemove : "", // On Item Enter Sub Pattern Removal
    onEnterWrapEdit   : "",   // On Item Enter Wrap Edit
    onEnterSplitEdit  : "",   // On Item Enter Split Edit
    onSegmentHover    : "",   // On Item Segment Hover
    onSegmentSelected : "",   // On Item Segment Selected
    onExitEdit        : "",   // On Item Exit Edit

    onEnterWrap       : "",   // On Item Enter Wrap
    onExitWrap        : "",   // On Item Exit Wrap
    onSetWrapStart    : "",   // On Item Set Wrap Start
    onSetWrapEnd      : "",   // On Item Set Wrap End
    onWrapSelected    : "",   // On Item Wrap Selected
    onFullWrap        : "",   // On Item Full Wrap
    onCheckCollisions : "",   // On Item Check Collisions
  }
});

type TProgress = {generation : number;progress   : number;};
type BinSize = {width: number; height: number;};

export const nestingEvents = createEventWrapper({
  sessionCreation : <EventDefinition<void,          boolean,    CancelEvent>>{},
  addPart         : <EventDefinition<{idx: number, item: typeof Pattern}, void,       CancelEvent>>{},
  setBin          : <EventDefinition<BinSize,       void,       CancelEvent>>{},
  start           : <EventDefinition<void,          boolean,    CancelEvent>>{},
  stop            : <EventDefinition<void,          boolean,    CancelEvent>>{},
  progress        : <EventDefinition<TProgress,     TProgress,  CancelEvent>>{},
  packingResult   : <EventDefinition<PackResult,    PackResult, CancelEvent>>{},
    error: <EventDefinition<Error | string, Error | string, CancelEvent>>{},
},{
  init: (ctx) => {
    const events = [] as CancelEvent[];
    ctx.set("events", events);
  },
  onEvent: (name, type, payload, ctx) => {
    const events = ctx.get("events") as CancelEvent[];
    const config = ctx.get("config") as EventWrapperConfig;
    switch (type) {
      case "Do":
        _evtBus.emit(`nesting-do-${name}`, payload);
        break;
      case "Handle":
        const cancelListener = _evtBus.on(`nesting-do-${name}`, _ => {
          (payload as any).handler(_, (payload as any).response);
        });
        events.push(cancelListener);
        return cancelListener;
      case "WaitFor":
        const cancelWaiter = _evtBus.on(`nesting-wait-${name}`, _ => {
          (payload as any)(_);
        });
        events.push(cancelWaiter);
        return cancelWaiter;
      case "Response":
        _evtBus.emit(`nesting-wait-${name}`, payload);
        break;
    }
  },
  dispose: (ctx) => {
    const events = ctx.get("events") as CancelEvent[];
    events.forEach(e => e.off());
  }
})