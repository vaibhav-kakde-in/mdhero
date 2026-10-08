import en from "./locales/en.json";

/** Dotted key paths of a nested dictionary. An object with an `other` entry is
 *  a set of plural forms, so it is one key, not a section. */
type FlattenKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends { other: string }
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? FlattenKeys<T[K], `${Prefix}${K}.`>
      : `${Prefix}${K}`;
}[keyof T & string];

/** A valid translation key, e.g. "toolbar.openTitle". */
export type MessageKey = FlattenKeys<typeof en>;

/** Values for a message's `{placeholders}`; `count` also picks plural forms. */
export type MessageParams = Record<string, string | number>;
