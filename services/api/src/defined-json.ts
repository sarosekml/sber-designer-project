/** JSON schemas may produce optional keys with undefined; domain objects omit them. */
export type DefinedJson<T> = T extends readonly unknown[]
  ? { [K in keyof T]: DefinedJson<T[K]> }
  : T extends object
    ? { [K in keyof T]: DefinedJson<Exclude<T[K], undefined>> }
    : T;

/** Only for parsed JSON values, never class instances or binary data. */
export function definedJson<T>(value: T): DefinedJson<T> {
  if (Array.isArray(value)) return value.map(definedJson) as DefinedJson<T>;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, definedJson(item)]),
    ) as DefinedJson<T>;
  }
  return value as DefinedJson<T>;
}
