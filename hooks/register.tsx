import type { EngineInterface, Register, RenderElement } from 'claude-code'

import type { TreeReading } from '../types'
import { dueNudge, REARM_BELOW, statusText } from './gauge'
import type { Threshold } from './gauge'
import { extractHandoff } from './handoff'
import { BUNDLED_PICTURES, BUNDLED_SOUNDS, mergeText, soundKey, toastText } from './pack'
import type { Pack, TreeSection } from './pack'
import { treeSvg } from './scene'
import type { Scene } from './scene'

const PANE = 'tree-time'
const TITLE = 'Tree Time'
// The Ooze-o-Meter's pane: when its plugin draws the bench, the tree is stacked under it.
const OOZE_PANE = 'ooze-o-meter'
const FIRED = { plugin: 'tree-time', key: 'fired' } as const
const READING = { plugin: 'tree-time', key: 'reading' } as const
const BONK_AT = { plugin: 'tree-time', key: 'bonkAt' } as const
// Kept in the store, not the session's state, so it survives the /clear it is meant for.
const HANDOFF_KEY = 'handoff'

// ── The mascot pack ────────────────────────────────────────────────────────────
// Tree Time shares the Ooze-o-Meter's pack folder. The first folder with a mascot.json wins:
// $OOZE_MASCOT, then ~/.claude/ooze/mascot, then the Servo-Crab bundled here. Its "tree"
// section names the pictures, sounds and texts; anything it leaves out comes from the crab.

async function readSection($: EngineInterface, dir: string): Promise<TreeSection | null> {
  try {
    const file = JSON.parse(await $.fs.read(`${dir}/mascot.json`)) as { tree?: TreeSection }
    return file.tree ?? {}
  } catch {
    return null
  }
}

async function picture($: EngineInterface, path: string): Promise<string | undefined> {
  try {
    const { base64 } = await $.fs.read(path, { as: 'bytes' })
    const type = path.endsWith('.png') ? 'png' : path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'jpeg' : 'webp'
    return `data:image/${type};base64,${base64}`
  } catch {
    return undefined
  }
}

async function exists($: EngineInterface, path: string): Promise<boolean> {
  try {
    await $.fs.read(path, { as: 'bytes' })
    return true
  } catch {
    return false
  }
}

async function loadPack($: EngineInterface): Promise<Pack> {
  const home = (await $.env.get('HOME')) ?? ''
  const bundled = `${$.plugin.root}/mascot`
  const dirs = [await $.env.get('OOZE_MASCOT'), `${home}/.claude/ooze/mascot`].filter((d): d is string => !!d)
  let dir = bundled
  let section: TreeSection = {}
  for (const candidate of dirs) {
    const found = await readSection($, candidate)
    if (found !== null) {
      dir = candidate
      section = found
      break
    }
  }

  const pictures: Pack['pictures'] = {}
  for (const [name, fallback] of BUNDLED_PICTURES) {
    const own = section.pictures?.[name]
    pictures[name] = (own === undefined ? undefined : await picture($, `${dir}/${own}`)) ?? (await picture($, `${bundled}/${fallback}`))
  }
  const sounds: Pack['sounds'] = {}
  for (const key of ['soon', 'now'] as const) {
    const own = section.sounds?.[key]
    const path = own === undefined ? undefined : `${dir}/${own}`
    sounds[key] = path !== undefined && (await exists($, path)) ? path : `${bundled}/${BUNDLED_SOUNDS[key]}`
  }
  // A napper's spot only makes sense with that pack's own pictures.
  const napper = section.pictures?.asleep === undefined ? undefined : section.napper
  return { text: mergeText(section), pictures, sounds, napper }
}

// The pack, read once per load (a reload reads it again).
let pack: Pack | null = null
const thePack = async ($: EngineInterface): Promise<Pack> => (pack ??= await loadPack($))

async function speak($: EngineInterface, threshold: Threshold): Promise<void> {
  const path = (await thePack($)).sounds[soundKey(threshold)]
  if (path === undefined) return
  try {
    const { base64 } = await $.fs.read(path, { as: 'bytes' })
    await $.audio.play({ base64, mime: path.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg' })
  } catch {
    // no sound, no voice; the toast still says it
  }
}

/** Says the nudge; at the real call, drops the plum on the napper first so it wakes up saying it. */
async function nudge($: EngineInterface, threshold: Threshold, percent: number): Promise<void> {
  if (threshold === 80) {
    await $.state.set(BONK_AT, await $.clock.now())
    await $.ui.open({ id: PANE, title: TITLE })
    await $.clock.sleep(700)
  }
  if (threshold === 60) await $.ui.open({ id: PANE, title: TITLE })
  $.ui.toast(toastText((await thePack($)).text, threshold, percent))
  await speak($, threshold)
}

/** Everything the scene needs from the pack, plus the reading. */
function sceneOf(p: Pack, reading: TreeReading | null, bonkAt: number | null): Scene {
  return {
    percent: reading?.percent,
    fiveHour: reading?.fiveHour,
    bonkAt,
    lab: p.text.lab,
    captions: p.text.captions,
    napper: p.napper,
    ...p.pictures,
  }
}

// ── The four ritual buttons ────────────────────────────────────────────────────

async function runTreeTime($: EngineInterface): Promise<void> {
  try {
    await $.command.run({ command: 'tree' })
  } catch {
    // No /tree command here: ask for the handoff in plain words.
    await $.prompt.submit({ text: (await thePack($)).text.prompt, asUser: true })
  }
}

async function copyHandoff($: EngineInterface, surface: Parameters<EngineInterface['ui']['copy']>[0]['surface']): Promise<void> {
  const handoff = extractHandoff(await $.session.messages())
  if (handoff === null) {
    $.ui.toast('No handoff yet. Run tree time first.')
    return
  }
  await $.store.set(HANDOFF_KEY, handoff)
  const copied = await $.ui.copy({ text: handoff, surface })
  $.ui.toast(copied.isCopied ? '📋 Handoff copied (and kept for Paste & go).' : '📋 Handoff kept for Paste & go (clipboard unavailable here).')
}

async function clearSession($: EngineInterface): Promise<void> {
  try {
    await $.command.run({ command: 'clear' })
  } catch {
    $.ui.toast('Type /clear to start fresh.')
  }
}

async function pasteAndGo($: EngineInterface): Promise<void> {
  const kept = await $.store.get(HANDOFF_KEY)
  if (typeof kept !== 'string' || kept.trim() === '') {
    $.ui.toast('No handoff kept yet. Copy one first.')
    return
  }
  await $.prompt.submit({ text: kept, asUser: true })
}

type Elements = ReturnType<EngineInterface['ui']['resolve']>

/**
 * The scene and its ritual bar as one module: the scene's own top corners are round and its
 * bottom is square, so the bar sits flush under it. (A bordered, clipped Box frame draws an
 * extra outline with padding on the desktop, and it can't round one side of a box.)
 */
function treeModule(ui: Elements, scene: RenderElement, row: RenderElement, gapAbove: boolean): RenderElement {
  const { Box } = ui
  return (
    <Box flexDirection="column" marginTop={gapAbove ? 1 : 0}>
      {scene}
      {row}
    </Box>
  )
}

/**
 * The ritual buttons as one row of little CRT keys in a lab panel: dark screens with an ooze
 * rim and phosphor labels, Clear in amber since it wipes the window. The row wears the
 * panel's own colours and square corners, flush under the scene's square bottom. The keys
 * share the width so they never overflow a narrow pane.
 */
function ritualRow($: EngineInterface, ui: Elements): RenderElement {
  const { Box, Button, Text } = ui as Extract<Elements, { Button: unknown }>
  const key = (id: string, label: string, color: string, onPress: Parameters<typeof Button>[0]['onPress']) => (
    <Box key={id} flexGrow={1} flexShrink={1} width="25%" minWidth={0} justifyContent="center" borderStyle="round" borderColor="#2f6b2a" backgroundColor="#061306" hover={{ borderColor: color }}>
      <Button key={id} plain onPress={onPress}>
        <Text color={color}>{label}</Text>
      </Button>
    </Box>
  )
  return (
    <Box flexDirection="row" flexWrap="nowrap" gap={1} paddingX={1} paddingY={1} backgroundColor="#0a0f0b">
      {key('run', '🌳 TREE', '#7dff5a', () => void runTreeTime($))}
      {key('copy', '📋 COPY', '#7dff5a', press => void copyHandoff($, press.surface))}
      {key('clear', '🧹 CLEAR', '#ffc24a', () => void clearSession($))}
      {key('go', '🚀 GO', '#7dff5a', () => void pasteAndGo($))}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tree-gauge',
      description: 'Open the tree; "/tree-gauge test" plays the nudge, "/tree-gauge preview 85" shows a fill',
    })
    return next(e)
  })

  // Every new context or rate-limit reading: refresh the status line and the tree, nudge once per threshold.
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    const percent = e.context.percent
    const fiveHour = e.rateLimits.find(limit => limit.kind === 'five_hour')?.percentUsed
    $.ui.status(statusText(percent, fiveHour))
    const reading: TreeReading = { percent, fiveHour }
    await $.state.set(READING, reading)
    if (percent === undefined) return result

    const { value: fired = [] } = await $.state.get(FIRED)
    if (percent < REARM_BELOW && fired.length > 0) {
      await $.state.set(FIRED, [])
      await $.state.set(BONK_AT, null)
      return result
    }
    const due = dueNudge(percent, fired)
    if (due !== null) {
      // Crossing 80 first also counts 60 as said, so it never nags twice.
      await $.state.set(FIRED, [...new Set([...fired, 60, due].filter(t => t <= due))])
      await nudge($, due, percent)
    }
    return result
  })

  // A /clear starts a fresh window: arm the nudges again and let the napper nod back off.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await $.state.set(FIRED, [])
      await $.state.set(BONK_AT, null)
      await $.state.set(READING, null)
      $.ui.status(undefined)
    }
    return next(e)
  })

  on('command.run', { command: 'tree-gauge' }, async ($, e) => {
    const { context, rateLimits } = await $.session.usage()
    const fiveHour = rateLimits.find(limit => limit.kind === 'five_hour')?.percentUsed
    const [verb = '', arg = ''] = e.args.trim().split(/\s+/)
    if (verb === 'test') {
      await nudge($, (context.percent ?? 0) >= 80 ? 80 : 60, context.percent ?? 0)
      return { text: 'Played the tree-time nudge.' }
    }
    if (verb === 'preview') {
      const percent = Math.max(0, Math.min(100, Number(arg) || 0))
      await $.state.set(READING, { percent, fiveHour })
      await $.state.set(BONK_AT, null)
      await $.ui.open({ id: PANE, title: TITLE })
      // At 80 and up, the preview plays the whole bonk: the drop, then the line.
      if (percent >= 80) await nudge($, 80, percent)
      return { text: `Previewing the tree at ${percent}%. The next real reading puts it back.` }
    }
    await $.state.set(READING, { percent: context.percent, fiveHour })
    await $.ui.open({ id: PANE, title: TITLE })
    const line = statusText(context.percent, fiveHour) ?? 'No context reading yet.'
    return { text: `${line} (window ${context.window.toLocaleString()} tokens)` }
  })

  // The tree on its own tab.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { value: reading = null } = await $.state.get(READING)
    const { value: bonkAt = null } = await $.state.get(BONK_AT)
    const now = await $.clock.now()
    const percent = reading?.percent
    const fiveHour = reading?.fiveHour

    if (e.surface === 'desktop' || e.surface === 'vscode') {
      const ui = $.ui.resolve(e)
      const { Svg } = ui
      const scene = sceneOf(await thePack($), reading, bonkAt)
      const alt = percent === undefined ? 'Tree time gauge, waiting for a reading' : `Context ${percent} percent full`
      // Image mode, not an interactive frame: the frame blocks the painted pictures.
      return treeModule(ui, <Svg source={treeSvg(scene, now)} alt={alt} />, ritualRow($, ui), false)
    }

    const { Text } = $.ui.resolve(e)
    return <Text>{statusText(percent, fiveHour) ?? 'Waiting for a context reading.'}</Text>
  })

  // The Ooze-o-Meter's pane: let its plugin draw the bench, then stack the tree under it,
  // so both show at once, the tree as wide as the bench (both scale with the pane). If this hook sits beneath that plugin, it never runs: no harm.
  on('ui.render', { component: 'Pane', requestId: OOZE_PANE }, async ($, e, next) => {
    const bench = await next(e)
    if (e.surface !== 'desktop' && e.surface !== 'vscode') return bench
    const { value: reading = null } = await $.state.get(READING)
    const { value: bonkAt = null } = await $.state.get(BONK_AT)
    const now = await $.clock.now()
    const ui = $.ui.resolve(e)
    const { Box, Svg } = ui
    return (
      <Box flexDirection="column">
        {bench}
        {treeModule(
          ui,
          <Svg source={treeSvg(sceneOf(await thePack($), reading, bonkAt), now)} alt={`Tree time: context ${reading?.percent ?? 'unknown'} percent`} />,
          ritualRow($, ui),
          true,
        )}
      </Box>
    )
  })
}
