import { EventBus } from "../EventBus" ;
import { guid } from "../Guid";

type TimerManager = {
  register(timer: Timer): void;
  unregister(timerIdentifier: Timer | string): void;
}

// Timer related events
type TimerEvent = "START_TICK"        | "TACK"              | "LOOP_END" | "LOOP_START"           |
                  "FINISHED"          | "PAUSED"            | "PLAYING"  | "WAITING_BEFORE_START" |
                  "WAITING_AFTER_END" | "DIRECTION_CHANGED" | "RESET"    | "END_TICK"             ;

const MAX_TIME = 3155760000000; // 1 century, will be used instead of a real infinite loop.

export type CancelTimer  = { clear: () => void };

export type TimerOptions = {
  delay         : number  ; // Delay before first start
  delayAfterEnd : number  ; // Delay before first start
  repeat        : number  ; // Number of repeat after first pass, < 0 = infinite loop
  interval      : number  ; // Interval between each loop
  yoyo          : boolean ; // Will play forward / backward in time
  autoStart     : boolean ; // Defines if time rshould start automatically
};

export enum Direction {
  Backward = 0 ,
  Forward  = 1 ,
};

export enum TimerState {
  NotStarted         = 0,
  WaitingBeforeStart = 1,
  WaitingAfterEnd    = 2,
  Playing            = 3,
  Paused             = 4,
  Finished           = 5,
};

export class Timer {
  #guid     : string   = guid() ;
  #eventbus : EventBus = new EventBus() ;
  private static timerManager ?: TimerManager;

  // Options
  #opDelay            : number  = 0     ;
  #opEndDelay         : number  = 0     ;
  #opInterval         : number  = 0     ;
  #opRepeat           : number  = 0     ;
  #opYoyo             : boolean = false ;
  #opAutoStart        : boolean = false ;
  private opStartTime : number  = 0     ; // For timeline use

  getOptions() {
    return {
      delay     : this.#opDelay     ,
      interval  : this.#opInterval  ,
      repeat    : this.#opRepeat    ,
      yoyo      : this.#opYoyo      ,
      autoStart : this.#opAutoStart ,
      endDelay  : this.#opEndDelay  ,
    };
  }

  // Runtime values
  #curElapsed   : number     = 0                     ;
  #curRepeat    : number     = 0                     ;
  #totalTime    : number     = 0                     ;
  #curPosition  : number     = 0                     ;
  #curState     : TimerState = TimerState.NotStarted ;
  #pausedState  : TimerState = TimerState.NotStarted ;
  #curDirection : Direction  = Direction.Forward     ;

  static setManager(manager: TimerManager) {
    Timer["timerManager"] = manager;
  }

  #applyTick = (delta: number) => {
    let targetTime = this.#curElapsed + delta                                 ;
    targetTime     = Math.min(targetTime, this.#totalTime + this.#opEndDelay) ;

    if (targetTime < 0) { // < 0 if a delay has been set
      if (this.#curState !== TimerState.WaitingBeforeStart) {
        this.#curState = TimerState.WaitingBeforeStart;
        this.#eventbus.emit("WAITING_BEFORE_START" as TimerEvent, this);
      }
      this.#curElapsed = targetTime;
      return;
    }

    if ((this.#curState === TimerState.WaitingBeforeStart || this.#curState === TimerState.NotStarted) && targetTime > 0) {
      this.#curState = TimerState.Playing;
      this.#eventbus.emit("PLAYING" as TimerEvent, this);
      this.#eventbus.emit("LOOP_START" as TimerEvent, this);
    }

    const oldDirection = this.#curDirection;
    if (this.#opYoyo === true) {
      this.#curDirection = ((targetTime / this.#opInterval) >> 0) % 2 === 0
        ? Direction.Forward
        : Direction.Backward;
    }

    this.#curState !== TimerState.WaitingAfterEnd
      && oldDirection !== this.#curDirection
      && (this.#eventbus.emit("DIRECTION_CHANGED" as TimerEvent, this));

    let loopCount = ((targetTime / this.#opInterval) >> 0) - ((this.#curElapsed / this.#opInterval) >> 0);
    this.#curRepeat	+= loopCount;
    // End of loop
    this.#curState !== TimerState.WaitingAfterEnd
      && loopCount > 0
      && (this.#eventbus.emit("LOOP_END" as TimerEvent, this), this.#curRepeat - loopCount);

    this.#curElapsed = targetTime;

    let positionInInterval = this.#curDirection === Direction.Forward
      ? (targetTime % this.#opInterval)
      : this.#opInterval - (targetTime % this.#opInterval);

    if (this.#curElapsed >= this.#totalTime) {
      if (this.#curElapsed < this.#totalTime + this.#opEndDelay) {
        if (this.#curState !== TimerState.WaitingAfterEnd) {
          this.#eventbus.emit("WAITING_AFTER_END" as TimerEvent, this);
          this.#curState = TimerState.WaitingAfterEnd;
        }
      } else {
        this.#curState = TimerState.Finished;
        if (this.#opYoyo) {
          this.#curPosition = this.#curDirection !== Direction.Forward ? this.#opInterval : 0;
        } else {
          this.#curPosition = this.#curDirection === Direction.Forward ? this.#opInterval : 0;
        }
        this.#eventbus.emit("FINISHED" as TimerEvent, this);
      }
    } else {
      // New loop
      loopCount > 0 && (this.#eventbus.emit("LOOP_START" as TimerEvent, this), this.#curRepeat);
    }

    this.#curPosition = positionInInterval;

    return {
      elapsed   : this.#curElapsed   ,
      direction : this.#curDirection ,
      loopCount : this.#curRepeat    ,
      positionInInterval
    };
  }

  constructor(options?: Partial<TimerOptions>) {
    Timer["timerManager"]?.register(this);
    this.setOptions(options);
  }

  setOptions(options?: Partial<TimerOptions>) {
    this.#opDelay     = options?.delay         ?? 0     ;
    this.#opEndDelay  = options?.delayAfterEnd ?? 0     ;
    this.#opInterval  = options?.interval      ?? 0     ;
    this.#opRepeat    = options?.repeat        ?? 0     ;
    this.#opYoyo      = options?.yoyo          ?? false ;
    this.#opAutoStart = options?.autoStart     ?? false ;
    this.opStartTime  = 0                               ;

    this.reset();
    if (!this.#opAutoStart) this.pause();
  }

  /**
   * Move to the next cycle
   * @param delta The delta since the last tick in ms
   */
  tick(delta: number) {
    if (this.#curState === TimerState.Paused || this.#curState === TimerState.Finished) return;
    this.#eventbus.emit("START_TICK" as TimerEvent, this);
    const result = this.#applyTick(delta);
    this.#eventbus.emit("END_TICK" as TimerEvent, this);
    return result;
  }

  /**
   * Move to a specific value
   * Usefull when used with the timeline
   * @param value The fixed value to go to
   */
  tack(value: number) {
    this.#curElapsed = value;
    this.#applyTick(0);
    this.#eventbus.emit("TACK" as TimerEvent, this);
  }

  /**
   * Use this instead of setTimeout
   * @param delay Delay before calling the action
   * @param handler The code to run
   */
  static once(delay: number, handler: () => void): CancelTimer {
    const timer = new Timer({ autoStart: true, interval: delay }) ;
    return timer.once("FINISHED", handler);
  }

  /**
   * Return a new ppromise to wait for a specified amount of time
   * @param time Time to wait in ms
   * @returns Promise
   */
  static for(time: number) {
    return new Promise(r => Timer.once(time, () => r(0)));
  }

  /**
   * Use this instead of setInterval
   * @param delay Delay before calling the action
   * @param handler The code to run
   */
  static repeat(delay: number, handler: () => void, howMany: number = -1): CancelTimer {
    const timer = new Timer({ autoStart: true, interval: delay, repeat: howMany }) ;
    return timer.on("LOOP_END", handler);
  }

  /**
   * Register to some timer events
   * @param handler Callback
   */
  on(event: TimerEvent, handler: (timer: Timer) => void) {
    const res = this.#eventbus.on(event, handler);
    return { clear: () => res.off() } as CancelTimer
  }

  /**
   * Register for one time to some timer events
   * @param handler Callback
   */
  once(event: TimerEvent, handler: (timer: Timer) => void) {
    const res = this.#eventbus.on(event, handler, true);
    return { clear: () => res.off() } as CancelTimer
  }

  /**
   * Start or resume teh timer
   */
  play() {
    if (this.#curState === TimerState.Finished) return;
    if (this.#curState === TimerState.Paused) {
      this.#curState = this.#pausedState;
      this.#curState === TimerState.Playing && (this.#eventbus.emit("PLAYING" as TimerEvent, this));
      return;
    }
    this.#curState = TimerState.Playing;
  }

  /**
   * Pause the Timer
   */
  pause() {
    if (this.#curState !== TimerState.Paused && this.#curState !== TimerState.Finished) {
      this.#pausedState = this.#curState;
      this.#curState = TimerState.Paused;
      this.#eventbus.emit("PAUSED" as TimerEvent, this);
    }
  }

  /**
   * Terminate the timer
   */
  stop() {
    if (this.#curState === TimerState.Finished) return;
    this.#curState = TimerState.Finished;
    this.#eventbus.emit("FINISHED" as TimerEvent, this);
  }

  /**
   * Reset the timer
   */
  reset() {
    this.#totalTime  = this.#opInterval;

    // if < 0, infinite loop is defined
    if (this.#opRepeat < 0) {
      this.#opRepeat  = (MAX_TIME / this.#opInterval) >> 0;
      this.#totalTime = MAX_TIME;
    } else {
      this.#totalTime += this.#opInterval * this.#opRepeat;
    }

    this.#curElapsed = -this.#opDelay   ;
    this.#curState   = TimerState.NotStarted ;
    this.#eventbus.emit("RESET" as TimerEvent, this);
  }

  setDirection(direction: Direction) {
    this.#curDirection = direction === 1 ? 1 : 0;
  }

  get id() {
    return this.#guid;
  }

  dispose() {
    Timer["timerManager"]?.unregister(this);
    this.#eventbus.clear();
  }

  get state() {
    return this.#curState;
  }

  get timeInInterval() {
    return this.#curPosition;
  }

  get elapsedTime() {
    return this.#curElapsed;
  }

  get currentLoop() {
    return this.#curRepeat;
  }
}
