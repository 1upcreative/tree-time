/** Context-fill thresholds (percent) already nudged in this window. */
export type TreeFired = number[]

/** The last context and 5-hour readings, as the pane draws them. */
export type TreeReading = { percent?: number; fiveHour?: number }

declare module 'claude-code' {
  interface PluginState {
    'tree-time': { fired: TreeFired; reading: TreeReading | null; bonkAt: number | null }
  }
}
