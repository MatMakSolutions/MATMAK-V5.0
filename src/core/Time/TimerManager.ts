import { Timer }    from "./Timer"    ;

export class TimerManager {
  #timers = new Map<string, (tick: number) => void>();

  register(timer: Timer) {
    this.#timers.set(timer.id, (_: number) => timer.tick(_));
  }

  unregister(timerIdentifier: Timer | string) {
   const id = typeof timerIdentifier === "string" ? timerIdentifier : timerIdentifier.id;
   this.#timers.delete(id);
  }

  tick(delta: number) {
    for(const timer of this.#timers.values()) {
      timer(delta);
    }
  }
}