type TPlugin = {
  methods : {name:string, body: Function}[]
  fields  : string[]
}

export function extendClass<T, U>(classObject: T, plugin: TPlugin): T & U {
  // apply the plugin to the Pattern class at prototype level.
  const prototype = (classObject as any).prototype;
  const fields    = plugin.fields;
  const methods   = plugin.methods;

  fields.forEach(field => {
    Object.defineProperty(prototype, field, {
      get() {
        return this[`_${field}`];
      },
      set(value) {
        this[`_${field}`] = value;
      }
    });
  });

  methods.forEach(method => {
    (prototype as any)[method.name] = method.body;
  });

  return classObject as any as T & U
}
