import { _evtBus } from "../core/EventBus";

const uowMap = new Map<string, any>();

_evtBus.on("uow:register", (uow: {key: string, data: any}) => {
  uowMap.set(uow.key, uow.data);
});

_evtBus.on("uow:unregister", (uow: {key: string }) => {
  uowMap.delete(uow.key);
});

export function getUow<T>(name: string) {
  return uowMap.get(name) as T;
}

export function registerUow(uow: {key: string, data: any}) {
  _evtBus.emit("uow:register", uow);
}