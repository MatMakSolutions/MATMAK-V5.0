export type EventDefinition<DoPayload, WaitForPayload, ReturnForWaitOrHandle> = {
  DoPayload: DoPayload;
  WaitForPayload: WaitForPayload;
  ReturnForWaitOrHandle: ReturnForWaitOrHandle;
};

type EventHandler<Def extends EventDefinition<any, any, any>> = {
  do: (payload: Def['DoPayload']) => void;
  handle: (
    handler: (
      payload: Def['DoPayload'],
      result: (response: Def['WaitForPayload']) => void
    ) => void
  ) => Def['ReturnForWaitOrHandle'];
  waitFor: (listener: (payload: Def['WaitForPayload']) => void) => Def['ReturnForWaitOrHandle'];
};

export type EventWrapperConfig = {
  init: (ctx: Map<string, unknown>) => void;
  onEvent: (name: string, type: "Do" | "Handle" | "WaitFor" | "Response", payload: unknown, ctx: Map<string, unknown>) => unknown;
  dispose: (ctx: Map<string, unknown>) => void;
};

export function createEventWrapper<Def extends Record<string, EventDefinition<any, any, any>>>(
  definition: Def,
  config: EventWrapperConfig
): {
  [K in keyof Def]: EventHandler<Def[K]>;
} & { dispose: () => void } {
  const ctx = new Map<string, unknown>();
  ctx.set("config", config);

  config.init(ctx);

  const eventHandlers = Object.keys(definition).reduce((acc, eventName) => {
    let handleCallback: any = null;
    let waitForCallback: any = null;

    const eventHandler: EventHandler<Def['ReturnForWaitOrHandle']> = {
      do: (payload) => {
        config.onEvent(eventName, "Do", payload, ctx);
      },
      handle: (handler) => {
        const response = (resp: Def["WaitForPayload"]) => {
          config.onEvent(eventName, "Response",  resp, ctx);
        };

        return config.onEvent(eventName, "Handle", {handler, response}, ctx);
      },
      waitFor: (listener) => {
        return config.onEvent(eventName, "WaitFor", listener, ctx);
      },
    };

    acc[eventName] = eventHandler;
    return acc;
  }, {} as Record<string, EventHandler<any>>);

  return {
    ...eventHandlers as {
      [K in keyof Def]: EventHandler<Def[K]>;
    },
    dispose: () => { config.dispose(ctx) },
  };
}