import type { RenderPropsOf } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { dueNudge, statusText } from '../hooks/gauge'
import { DEFAULT_TEXT, mergeText, toastText } from '../hooks/pack'
import { stageOf, treeSvg } from '../hooks/scene'
import { extractHandoff } from '../hooks/handoff'

test('each threshold nudges once, highest crossed first', async () => {
  expect(dueNudge(30, [])).toBe(null)
  expect(dueNudge(62, [])).toBe(60)
  expect(dueNudge(70, [60])).toBe(null)
  expect(dueNudge(83, [60])).toBe(80)
  expect(dueNudge(85, [])).toBe(80)
  expect(dueNudge(90, [60, 80])).toBe(null)
})

test('the status line grows from sapling to axe', async () => {
  expect(statusText(undefined, 40)).toBe(undefined)
  expect(statusText(22, undefined)).toBe('🌱 context 22%')
  expect(statusText(64, 41.5)).toBe('🌳 context 64% · 5h 42%')
  expect(statusText(81, 7)).toBe('🪓 context 81% · 5h 7%')
})

test("the toasts fill in the percent, and a pack's words win over the defaults", async () => {
  expect(toastText(DEFAULT_TEXT, 80, 81)).toBe('🚨 DIVE! DIVE! Tree time! Context at 81%. Write the handoff, then clear.')
  expect(toastText(DEFAULT_TEXT, 60, 61)).toContain('coming')
  const text = mergeText({ lab: 'MY LAB', toasts: { now: 'Wake up! {percent}% full.' }, captions: { plums: 'RIPE' } })
  expect(text.lab).toBe('MY LAB')
  expect(toastText(text, 80, 90)).toBe('Wake up! 90% full.')
  expect(toastText(text, 60, 62)).toBe(toastText(DEFAULT_TEXT, 60, 62))
  expect(text.captions.plums).toBe('RIPE')
  expect(text.captions.buds).toBe(DEFAULT_TEXT.captions.buds)
  expect(text.prompt).toBe(DEFAULT_TEXT.prompt)
})

test('pack text is escaped and a napper spot moves the napper', async () => {
  const svg = treeSvg({ percent: 70, fiveHour: undefined, bonkAt: null, lab: 'R&D <LAB>', backdrop: 'data:,', asleep: 'data:,z', napper: { x: 11, y: 222, size: 99, headX: 50, headY: 260 } }, 1000)
  expect(svg).toContain('R&#38;D &#60;LAB&#62;')
  expect(svg).toContain('x="11" y="222" width="99" height="99"')
})

test('the tree grows through its stages and the plum falls at the call', async () => {
  expect(stageOf(undefined)).toBe('buds')
  expect(stageOf(45)).toBe('blossoms')
  expect(stageOf(65)).toBe('plums')
  expect(stageOf(82)).toBe('tree-time')
  expect(treeSvg({ percent: 20, fiveHour: undefined, bonkAt: null }, 1000)).toContain('BUDDING')
  expect(treeSvg({ percent: 85, fiveHour: 40, bonkAt: 900 }, 1000)).toContain('TREE TIME!')
})

test('the handoff is the long fenced block of the newest tree-time message', async () => {
  const handoff = 'STATE: all green\nNEXT: ship it'
  const messages = [
    { role: 'user', text: 'tree time' },
    { role: 'assistant', text: `🌳 TREE TIME handoff:\n\n\`\`\`\n${handoff}\n\`\`\`\n\n\`\`\`\n/clear\n\`\`\`` },
    { role: 'user', text: 'thanks' },
  ]
  expect(extractHandoff(messages)).toBe(handoff)
  expect(extractHandoff([{ role: 'assistant', text: 'no blocks here' }])).toBe(null)
})

test('the tree pane draws its four ritual keys in one row on the desktop', async ($, on) => {
  mock.clock(on)
  mock.env(on, { HOME: '/nowhere' })
  const ui = await $.ui.mount({
    plugin: 'tree-time',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'tree-time',
    props: { title: 'Tree Time', isFocused: false, bodyColumns: 60, placement: 'dock' } as RenderPropsOf['Pane'],
  })
  for (const key of ['run', 'copy', 'clear', 'go']) expect(await ui.find({ key })).toBeDefined()
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await ui.unmount()
})
