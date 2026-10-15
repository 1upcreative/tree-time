// The tree-time pane: an evening hill under a sunset sky, a tree whose fruit grows with the
// session's context fill (buds → blossoms → googly-eyed ooze plums), and a specimen napping
// against the trunk until, at the call, a ripe plum drops on its head.
//
// With a painted backdrop from the mascot pack, the sky, hill and tree are one painting and
// the fruit, stars, cloud wisps and fireflies are drawn over it; without it, everything is
// drawn in vector. The HUD wears the Ooze-o-Meter's lab look: screwed panels, phosphor type,
// an ooze tube for the gauge, a CRT strip for the caption.
//
// All motion is SMIL. Loops start at a negative offset from the clock so a redraw keeps
// them in stride; the plum drop is a one-shot drawn at its finished look and animated only
// while it is still falling (Chromium never applies the frozen end of a one-shot that
// finished before the drawing loaded).

const W = 240
const H = 427
const INK = '#14110f'
const OOZE = '#39ff14'
const PHOSPHOR = '#7dff5a'
const RED = '#ff5a4f'
const AMBER = '#ffc24a'
const MONO = "Menlo, 'Courier New', monospace"
const IMPACT = "Impact, 'Arial Black', sans-serif"
const SANS = "'Helvetica Neue', Arial, sans-serif"
const HORIZON = 300

/** What the pane shows: the fill, the 5-hour window, when the plum fell, and the pack's pictures. */
export type Scene = {
  percent: number | undefined
  fiveHour: number | undefined
  bonkAt: number | null
  asleep?: string
  bonked?: string
  backdrop?: string
  lab?: string
  /** The CRT caption for each stage; defaults below. */
  captions?: Partial<Record<Stage, string>>
  /** Where the pack's napper sits on the painted hill, if it says. */
  napper?: Spot
}

/** A napper's box (top-left and size) and its head, where the plum lands. */
export type Spot = { x: number; y: number; size: number; headX: number; headY: number }

export type Stage = 'buds' | 'blossoms' | 'plums' | 'tree-time'

export function stageOf(percent: number | undefined): Stage {
  const p = percent ?? 0
  return p >= 80 ? 'tree-time' : p >= 60 ? 'plums' : p >= 40 ? 'blossoms' : 'buds'
}

/** Where things sit: on the painted backdrop, or on the vector tree (whose crown is shrunk). */
type Layout = {
  fruit: [number, number][]
  dropper: number
  crown: { px: number; py: number; s: number }
  napper: { x: number; y: number; size: number }
  head: { x: number; y: number }
  rest: { x: number; y: number }
}

const PAINTED: Layout = {
  fruit: [[30, 152], [62, 124], [100, 114], [134, 126], [152, 162], [112, 166], [76, 174], [40, 198], [116, 216]],
  dropper: 8,
  crown: { px: 0, py: 0, s: 1 },
  napper: { x: 70, y: 252, size: 128 },
  head: { x: 138, y: 268 },
  rest: { x: 168, y: 368 },
}

const VECTOR: Layout = {
  fruit: [[34, 150], [62, 110], [98, 92], [132, 118], [160, 150], [118, 168], [74, 176], [44, 196], [146, 188]],
  dropper: 8,
  crown: { px: 79, py: 206, s: 0.68 },
  napper: { x: 84, y: 246, size: 132 },
  head: { x: 136, y: 262 },
  rest: { x: 104, y: 366 },
}

const crownTransform = (c: Layout['crown']) =>
  c.s === 1 ? '' : `translate(${c.px} ${c.py}) scale(${c.s}) translate(${-c.px} ${-c.py})`
const crownAt = (c: Layout['crown'], x: number, y: number): [number, number] =>
  [c.px + c.s * (x - c.px), c.py + c.s * (y - c.py)]

// Deterministic scatter so redraws keep the same stars and clouds.
function rand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Pack text goes into the markup, so it is escaped. */
const esc = (text: string) => text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

function phase(now: number, dur: number, shift = 0): string {
  return `-${(((now / 1000 + shift) % dur) + dur) % dur}s`
}

function oneShot(now: number, at: number, delay: number, dur: number, make: (begin: string) => string): string {
  const start = (at - now) / 1000 + delay
  return start + dur <= 0 ? '' : make(`${start.toFixed(2)}s`)
}

// ── Sky, hill and tree ─────────────────────────────────────────────────────────

function stars(now: number, n: number, top: number): string {
  const r = rand(11)
  return Array.from({ length: n }, (_, i) => {
    const x = r() * W
    const y = top + r() * 110 * (0.4 + r() * 0.6)
    const size = 0.6 + r() * 1.2
    const dur = 1.8 + r() * 3
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(2)}" fill="#fff8e7">
      <animate attributeName="opacity" values="0.2;1;0.2" dur="${dur.toFixed(2)}s" begin="${phase(now, dur, i * 0.4)}" repeatCount="indefinite"/>
    </circle>`
  }).join('')
}

// Wispy clouds: soft stretched blobs lit from below by the sunset, drifting right.
function clouds(now: number, opacity: number): string {
  const cloud = (y: number, scale: number, dur: number, shift: number, tint: string) => `
    <g opacity="${opacity}" filter="url(#wisp)">
      <animateTransform attributeName="transform" type="translate" values="-140 0;${W + 40} 0" dur="${dur}s" begin="${phase(now, dur, shift)}" repeatCount="indefinite"/>
      <ellipse cx="0" cy="${y}" rx="${46 * scale}" ry="${6 * scale}" fill="${tint}"/>
      <ellipse cx="${26 * scale}" cy="${y - 4 * scale}" rx="${30 * scale}" ry="${5 * scale}" fill="${tint}"/>
      <ellipse cx="${-22 * scale}" cy="${y + 3 * scale}" rx="${28 * scale}" ry="${4 * scale}" fill="#ffd2a8"/>
    </g>`
  return cloud(96, 1.1, 70, 0, '#f6a6b8') + cloud(150, 1.4, 95, 40, '#ff9c7a') + cloud(206, 0.9, 58, 20, '#ffb38a') + cloud(124, 0.7, 82, 63, '#d78fc4')
}

function fireflies(now: number): string {
  const r = rand(5)
  return Array.from({ length: 6 }, (_, i) => {
    const x = 20 + r() * 200
    const y = 330 + r() * 50
    const dur = 4 + r() * 4
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="#d9ff7a" filter="url(#moonglow)">
      <animate attributeName="opacity" values="0;1;0" dur="${(dur / 2).toFixed(2)}s" begin="${phase(now, dur / 2, i)}" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;${(r() * 16 - 8).toFixed(1)} -10;0 0" dur="${dur.toFixed(2)}s" begin="${phase(now, dur, i * 0.7)}" repeatCount="indefinite"/>
    </circle>`
  }).join('')
}

function vectorWorld(now: number, L: Layout): string {
  const t = { x: 64, top: 200, bottom: 352, w: 30 }
  const blobs = [[100, 110, 82], [42, 150, 52], [160, 146, 54], [96, 176, 60], [64, 96, 46], [138, 92, 44]]
  return `
  <rect width="${W}" height="${H}" fill="url(#dusk)"/>
  ${stars(now, 26, 50)}
  <g filter="url(#moonglow)"><circle cx="196" cy="84" r="15" fill="#fff4d6"/></g>
  ${clouds(now, 0.55)}
  <path d="M0 ${HORIZON + 6} Q60 ${HORIZON - 18} 120 ${HORIZON + 2} T240 ${HORIZON - 6} V${H} H0Z" fill="#3b2a52"/>
  <path d="M0 ${HORIZON + 40} Q70 ${HORIZON + 4} 150 ${HORIZON + 28} T240 ${HORIZON + 30} V${H} H0Z" fill="#1d3a2a" stroke="${INK}" stroke-width="3"/>
  <path d="M0 ${H} V${HORIZON + 70} Q120 ${HORIZON + 52} 240 ${HORIZON + 76} V${H}Z" fill="#142a1e"/>
  <path d="M${t.x} ${t.bottom} C${t.x + 4} ${t.top + 60}, ${t.x - 6} ${t.top + 20}, ${t.x + 4} ${t.top}
           L${t.x + t.w - 4} ${t.top} C${t.x + t.w + 6} ${t.top + 30}, ${t.x + t.w - 2} ${t.top + 80}, ${t.x + t.w + 8} ${t.bottom} Z"
        fill="#6a4426" stroke="${INK}" stroke-width="3.5"/>
  <g transform="${crownTransform(L.crown)}">
    ${blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2c5e36" stroke="${INK}" stroke-width="3.5"/>`).join('')}
    ${blobs.map(([x = 0, y = 0, r = 0]) => `<circle cx="${x - r * 0.18}" cy="${y - r * 0.22}" r="${r * 0.72}" fill="#3f7f45"/>`).join('')}
  </g>
  ${fireflies(now)}`
}

function paintedWorld(now: number, href: string): string {
  return `
  <image href="${href}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  ${stars(now, 14, 46)}
  ${clouds(now, 0.28)}
  ${fireflies(now)}`
}

// ── Fruit ──────────────────────────────────────────────────────────────────────

function bud(x: number, y: number, grow: number): string {
  const r = 2.5 + grow * 2
  return `<ellipse cx="${x}" cy="${y}" rx="${r.toFixed(1)}" ry="${(r * 1.3).toFixed(1)}" fill="#b9e27a" stroke="${INK}" stroke-width="1.5"/>`
}

function blossom(x: number, y: number, grow: number, now: number, i: number): string {
  const r = 4 + grow * 3
  const petals = Array.from({ length: 5 }, (_, k) => {
    const a = (k / 5) * Math.PI * 2
    return `<circle cx="${(x + Math.cos(a) * r * 0.8).toFixed(1)}" cy="${(y + Math.sin(a) * r * 0.8).toFixed(1)}" r="${(r * 0.62).toFixed(1)}" fill="#ffd3e6" stroke="${INK}" stroke-width="1.2"/>`
  }).join('')
  return `<g>
    <animateTransform attributeName="transform" type="rotate" values="-8 ${x} ${y};8 ${x} ${y};-8 ${x} ${y}" dur="4s" begin="${phase(now, 4, i * 0.5)}" repeatCount="indefinite"/>
    ${petals}<circle cx="${x}" cy="${y}" r="${(r * 0.38).toFixed(1)}" fill="#ffc94a" stroke="${INK}" stroke-width="1"/>
  </g>`
}

/** A googly-eyed ooze plum hanging from its stem. */
function plum(x: number, y: number, grow: number, now: number, i: number): string {
  const r = 7 + grow * 3
  return `<g>
    <animateTransform attributeName="transform" type="rotate" values="-5 ${x} ${y - r};5 ${x} ${y - r};-5 ${x} ${y - r}" dur="3.2s" begin="${phase(now, 3.2, i * 0.37)}" repeatCount="indefinite"/>
    ${plumBody(x, y, r, now, i)}
  </g>`
}

function plumBody(x: number, y: number, r: number, now: number, i: number): string {
  return `
    <path d="M${x} ${y - r} q1 -6 4 -8" stroke="${INK}" stroke-width="2" fill="none"/>
    <path d="M${x + 3} ${y - r - 6} q6 -4 10 0 q-5 3 -10 0Z" fill="#5aa357" stroke="${INK}" stroke-width="1.2"/>
    <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r * 1.1).toFixed(1)}" fill="url(#plum)" stroke="${INK}" stroke-width="2" filter="url(#plumglow)"/>
    <ellipse cx="${(x - r * 0.35).toFixed(1)}" cy="${(y - r * 0.4).toFixed(1)}" rx="${(r * 0.25).toFixed(1)}" ry="${(r * 0.35).toFixed(1)}" fill="#e9ffd6" opacity="0.7"/>
    ${[-0.34, 0.34].map(dx => `
      <circle cx="${(x + dx * r).toFixed(1)}" cy="${(y - r * 0.05).toFixed(1)}" r="${(r * 0.32).toFixed(1)}" fill="#fff" stroke="${INK}" stroke-width="1.2"/>
      <circle cx="${(x + dx * r + r * 0.08).toFixed(1)}" cy="${(y + r * 0.04).toFixed(1)}" r="${(r * 0.15).toFixed(1)}" fill="${INK}">
        <animateTransform attributeName="transform" type="translate" values="0 0;${(-r * 0.12).toFixed(1)} ${(r * 0.06).toFixed(1)};${(r * 0.06).toFixed(1)} 0;0 0" dur="2.6s" begin="${phase(now, 2.6, i * 0.3)}" repeatCount="indefinite"/>
      </circle>`).join('')}`
}

function fruit(scene: Scene, now: number, L: Layout): string {
  const p = scene.percent ?? 0
  const stage = stageOf(p)
  // How far through its own stage the fruit has grown, 0 to 1.
  const grow = stage === 'buds' ? p / 40 : stage === 'blossoms' ? (p - 40) / 20 : stage === 'plums' ? (p - 60) / 20 : 1
  return `<g transform="${crownTransform(L.crown)}">` + L.fruit.map(([x, y], i) => {
    if (stage === 'tree-time' && i === L.dropper) return ''
    if (stage === 'buds') return bud(x, y, grow)
    if (stage === 'blossoms') return blossom(x, y, grow, now, i)
    return plum(x, y, grow, now, i)
  }).join('') + '</g>'
}

// ── The napper ─────────────────────────────────────────────────────────────────

/** The plum that fell: lying in the grass, dropping from the branch while it still falls. */
/** The layout with the pack's own napper spot, when it gives one. */
function placed(L: Layout, spot: Spot | undefined): Layout {
  if (spot === undefined) return L
  return { ...L, napper: { x: spot.x, y: spot.y, size: spot.size }, head: { x: spot.headX, y: spot.headY } }
}

function fallenPlum(scene: Scene, now: number, L: Layout): string {
  if (stageOf(scene.percent) !== 'tree-time') return ''
  const [bx = 0, by = 0] = L.fruit[L.dropper] ?? []
  const [fx, fy] = crownAt(L.crown, bx, by)
  const { head, rest } = L
  // Branch → the napper's head → a bounce into the grass.
  const fall = oneShot(now, scene.bonkAt ?? 0, 0, 1.1, begin => `
    <animateTransform attributeName="transform" type="translate" dur="1.1s" begin="${begin}"
      values="${fx - rest.x} ${fy - rest.y};${head.x - rest.x} ${head.y - 16 - rest.y};${(head.x - rest.x) / 2} ${head.y - 50 - rest.y};0 0"
      keyTimes="0;0.45;0.7;1"/>`)
  return `<g>${fall}${plumBody(rest.x, rest.y, 9, now, 0)}</g>`
}

function napper(scene: Scene, now: number, L: Layout): string {
  const awake = stageOf(scene.percent) === 'tree-time'
  const href = awake ? scene.bonked : scene.asleep
  const { napper: n, head } = L
  const picture = href === undefined
    ? ''
    : `<image href="${href}" x="${n.x}" y="${n.y}" width="${n.size}" height="${n.size}" preserveAspectRatio="xMidYMid meet"/>`
  const breathe = awake
    ? ''
    : `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur="3.6s" begin="${phase(now, 3.6)}" repeatCount="indefinite"/>`
  const zzz = awake
    ? ''
    : [0, 1, 2].map(i => `
      <text x="${head.x + 8}" y="${head.y - 10}" font-family="'Comic Sans MS', 'Chalkboard SE', sans-serif" font-weight="bold" font-size="${11 + i * 3}" fill="#fff4d6" stroke="${INK}" stroke-width="0.8" opacity="0">z
        <animate attributeName="opacity" values="0;1;0" dur="3s" begin="${phase(now, 3, i)}" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="translate" values="0 0;${10 + i * 6} ${-26 - i * 6}" dur="3s" begin="${phase(now, 3, i)}" repeatCount="indefinite"/>
      </text>`).join('')
  const dazed = awake
    ? `<g>
        <animateTransform attributeName="transform" type="rotate" values="0 ${head.x} ${head.y - 22};360 ${head.x} ${head.y - 22}" dur="1.6s" begin="${phase(now, 1.6)}" repeatCount="indefinite"/>
        ${[0, 1, 2].map(k => {
          const a = (k / 3) * Math.PI * 2
          const x = head.x + Math.cos(a) * 18
          const y = head.y - 22 + Math.sin(a) * 6
          return `<path d="M${x} ${y - 4} l1.2 2.8 3 .3 -2.3 2 .7 3 -2.6 -1.6 -2.6 1.6 .7 -3 -2.3 -2 3 -.3Z" fill="#ffd84a" stroke="${INK}" stroke-width="0.8"/>`
        }).join('')}
      </g>`
    : ''
  return `<g>${breathe}${picture}</g>${zzz}${dazed}`
}

// ── HUD: the Ooze-o-Meter's lab look ───────────────────────────────────────────

function screw(cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="2.4" fill="#3b4a3b" stroke="#0a0d0a" stroke-width="0.8"/><path d="M${cx - 1.6} ${cy + 1.6} l3.2 -3.2" stroke="#0a0d0a" stroke-width="1"/>`
}

function panel(x: number, y: number, w: number, h: number): string {
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#0a0f0bdd" stroke="#2a3b2a" stroke-width="1.2"/>
  <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${Math.min(18, h / 2)}" rx="9" fill="#ffffff" opacity="0.03"/>
  ${screw(x + 7, y + 7)}${screw(x + w - 7, y + 7)}${screw(x + 7, y + h - 7)}${screw(x + w - 7, y + h - 7)}`
}

export const CAPTION: Record<Stage, string> = {
  buds: 'BUDDING · PLENTY OF ROOM',
  blossoms: 'IN BLOOM · ALL GOOD',
  plums: 'OOZE PLUMS RIPENING · WRAP UP SOON',
  'tree-time': 'TREE TIME! HANDOFF, THEN CLEAR',
}

/** The header: title, hero percent, the 5-hour line, and an ooze tube for the gauge. */
function header(scene: Scene, now: number): string {
  const p = scene.percent
  const stage = stageOf(p)
  const urgent = stage === 'tree-time'
  const fill = Math.max(0, Math.min(100, p ?? 0))
  const tube = { x: 16, y: 54, w: W - 32, h: 12 }
  const level = (tube.w - 4) * (fill / 100)
  const heroColor = urgent ? RED : stage === 'plums' ? AMBER : '#f2fff0'
  const ticks = [[40, 'BLOOM'], [60, 'PLUM'], [80, 'TREE']] as const
  return `
  ${panel(6, 6, W - 12, 82)}
  <text x="16" y="31" font-family="${IMPACT}" font-size="21" fill="#eaffe2" letter-spacing="0.4">TREE TIME</text>
  <text x="16" y="44" font-family="${MONO}" font-size="6.6" fill="#8fb88a" letter-spacing="0.8">${esc(scene.lab ?? 'OOZE LAB · ARBORETUM 001')}</text>
  <text x="${W - 16}" y="35" text-anchor="end" font-family="${SANS}" font-weight="200" font-size="27" fill="${heroColor}">${p === undefined ? '—' : `${p}%`}</text>
  <text x="${W - 16}" y="45" text-anchor="end" font-family="${MONO}" font-size="6.4" fill="${PHOSPHOR}" letter-spacing="0.6">${scene.fiveHour === undefined ? 'CONTEXT' : `5H LIMIT ${Math.round(scene.fiveHour)}%`}</text>
  <rect x="${tube.x}" y="${tube.y}" width="${tube.w}" height="${tube.h}" rx="6" fill="#06130a" stroke="#a9c4b4" stroke-width="1.6"/>
  <g clip-path="url(#tube)">
    <rect x="${tube.x + 2}" y="${tube.y + 2}" width="${level.toFixed(1)}" height="${tube.h - 4}" rx="4" fill="url(#ooze)" filter="url(#plumglow)"/>
    ${[0, 1, 2, 3].map(i => `<circle cx="${(tube.x + 6 + ((level - 8) * (i + 0.5)) / 4).toFixed(1)}" cy="${tube.y + tube.h / 2}" r="1.6" fill="#e2ffd0" opacity="0">
      <animate attributeName="opacity" values="0;0.9;0" dur="1.6s" begin="${phase(now, 1.6, i * 0.4)}" repeatCount="indefinite"/>
    </circle>`).join('')}
    <rect x="${tube.x + 4}" y="${tube.y + 2.5}" width="${tube.w - 8}" height="2" rx="1" fill="#fff" opacity="0.18"/>
  </g>
  ${ticks.map(([t, label]) => {
    const x = tube.x + 2 + ((tube.w - 4) * t) / 100
    return `<path d="M${x} ${tube.y - 2} v${tube.h + 4}" stroke="#a9c4b4" stroke-width="1" opacity="0.7"/>
      <text x="${x}" y="${tube.y + tube.h + 9}" text-anchor="middle" font-family="${MONO}" font-size="5.6" fill="#8fb88a" letter-spacing="0.5">${label}</text>`
  }).join('')}
  <text x="${tube.x + 2}" y="${tube.y + tube.h + 9}" font-family="${MONO}" font-size="5.6" fill="#8fb88a" letter-spacing="0.5">BUD</text>`
}

/** The caption as a little CRT: scanlines, phosphor glow, a status light, a blinking cursor. */
function crtStrip(scene: Scene, now: number): string {
  const stage = stageOf(scene.percent)
  const urgent = stage === 'tree-time'
  const y = H - 38
  const color = urgent ? RED : PHOSPHOR
  return `
  ${panel(6, y - 4, W - 12, 36)}
  <rect x="24" y="${y + 4}" width="${W - 40}" height="20" rx="6" fill="#061306" stroke="#000" stroke-width="1.5"/>
  <circle cx="16" cy="${y + 14}" r="3" fill="${urgent ? RED : OOZE}">
    <animate attributeName="opacity" values="1;0.25;1" dur="${urgent ? 0.6 : 1.4}s" begin="${phase(now, urgent ? 0.6 : 1.4)}" repeatCount="indefinite"/>
  </circle>
  <g clip-path="url(#crt)">
    <text x="30" y="${y + 17}" font-family="${MONO}" font-size="6.8" font-weight="bold" letter-spacing="0.5" fill="${color}" filter="url(#phosphor)">${esc(scene.captions?.[stage] ?? CAPTION[stage])}<tspan>▌<animate attributeName="opacity" values="1;0" dur="1s" calcMode="discrete" begin="${phase(now, 1)}" repeatCount="indefinite"/></tspan></text>
    <rect x="24" y="${y + 4}" width="${W - 40}" height="20" fill="url(#scan)"/>
    <rect x="24" y="${y + 4}" width="${W - 40}" height="20" fill="url(#vignette)"/>
  </g>`
}

/**
 * The full pane. Drawn at three times its view box so the surface scales it to the slot's
 * width (the slot caps it), the way the Ooze-o-Meter fills its pane.
 */
export function treeSvg(scene: Scene, now: number): string {
  const L = scene.backdrop === undefined ? VECTOR : placed(PAINTED, scene.napper)
  const world = scene.backdrop === undefined ? vectorWorld(now, L) : paintedWorld(now, scene.backdrop)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 3}" height="${H * 3}">
  <defs>
    <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="${HORIZON}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0a0d2e"/><stop offset="0.32" stop-color="#2b2468"/>
      <stop offset="0.58" stop-color="#8e3f7e"/><stop offset="0.8" stop-color="#ec6f55"/><stop offset="1" stop-color="#ffb35c"/>
    </linearGradient>
    <linearGradient id="ooze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b6ff3b"/><stop offset="0.4" stop-color="${OOZE}"/><stop offset="1" stop-color="#0f9d00"/>
    </linearGradient>
    <radialGradient id="plum" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#c8ff8a"/><stop offset="0.45" stop-color="${OOZE}"/><stop offset="1" stop-color="#0f8a00"/>
    </radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.7"/>
    </radialGradient>
    <pattern id="scan" width="4" height="2" patternUnits="userSpaceOnUse"><rect width="4" height="0.7" fill="#000" opacity="0.3"/></pattern>
    <clipPath id="tube"><rect x="18" y="56" width="${W - 36}" height="8" rx="4"/></clipPath>
    <clipPath id="crt"><rect x="24" y="${H - 34}" width="${W - 40}" height="20" rx="6"/></clipPath>
    <filter id="moonglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="plumglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="phosphor" x="-5%" y="-60%" width="110%" height="220%"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="wisp" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="frame"><path d="M0 ${H} V12 Q0 0 12 0 H${W - 12} Q${W} 0 ${W} 12 V${H} Z"/></clipPath>
  </defs>
  <g clip-path="url(#frame)">
  ${world}
  ${fruit(scene, now, L)}
  ${napper(scene, now, L)}
  ${fallenPlum(scene, now, L)}
  ${header(scene, now)}
  ${crtStrip(scene, now)}
  </g>
</svg>`
}
