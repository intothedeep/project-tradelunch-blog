// API-contract types for @repo/types.
// These are consumed by both dashboard_client_web and dashboard_server.
// No build step — consumers compile raw TS via transpilePackages / tsc, and the
// server function loads this at runtime via Node's native TS (strip-only) mode.
// IMPORTANT: keep all domain files strip-only-safe — NO `enum`/`namespace`.
// Use a const-object + union instead of an enum.

export * from './tree'
export * from './category'
export * from './post'
export * from './user'
export * from './comment'
export * from './log'
