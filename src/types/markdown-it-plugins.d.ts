// Ambient declarations for markdown-it plugins that ship no types.
//
// All are used as `md.use(plugin, options)`; markdown-it's `use` accepts a
// loosely-typed PluginWithOptions, so `any` here is what the call site already
// gets — this only tells the compiler the modules exist. (@types/markdown-it-footnote
// exists but is written against markdown-it's CommonJS types, which the ESM
// types this app uses don't accept.)
declare module "markdown-it-task-lists";
declare module "markdown-it-texmath";
declare module "markdown-it-footnote";
