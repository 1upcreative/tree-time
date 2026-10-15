// The tree-time gauge: which nudge is due, and what the status line says.

/** The context fills that earn a nudge, lowest first: a heads-up, then the real call. */
export const THRESHOLDS = [60, 80] as const
export type Threshold = (typeof THRESHOLDS)[number]

/** Below this the window has been compacted or cleared, so the nudges arm again. */
export const REARM_BELOW = 40

/** The highest threshold `percent` has crossed that has not fired yet, if any. */
export function dueNudge(percent: number, fired: readonly number[]): Threshold | null {
  const crossed = THRESHOLDS.filter(t => percent >= t && !fired.includes(t))
  return crossed.length > 0 ? (crossed[crossed.length - 1] ?? null) : null
}

/** A sapling while there's room, a tree once it's time to think about it, an axe at the call. */
export function statusText(percent: number | undefined, fiveHour: number | undefined): string | undefined {
  if (percent === undefined) return undefined
  const glyph = percent >= 80 ? '🪓' : percent >= 60 ? '🌳' : '🌱'
  const limit = fiveHour === undefined ? '' : ` · 5h ${Math.round(fiveHour)}%`
  return `${glyph} context ${percent}%${limit}`
}
