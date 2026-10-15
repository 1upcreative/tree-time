// The mascot pack: who naps under the tree, what they say, and the words around them.
//
// Tree Time shares the Ooze-o-Meter's pack folder. The first folder with a mascot.json wins:
// $OOZE_MASCOT, then ~/.claude/ooze/mascot, then the Servo-Crab bundled here. Its "tree"
// section names the pictures, sounds and texts; anything it leaves out comes from the crab.

import type { Threshold } from './gauge'
import { CAPTION } from './scene'
import type { Spot, Stage } from './scene'

export type TreeText = {
  lab: string
  toasts: Record<'soon' | 'now', string>
  captions: Record<Stage, string>
  /** Sent as your message by the Tree button when there's no /tree command to run. */
  prompt: string
}

/** The "tree" section of a pack's mascot.json. Paths are relative to the pack folder. */
export type TreeSection = Partial<Omit<TreeText, 'toasts' | 'captions'>> & {
  toasts?: Partial<TreeText['toasts']>
  captions?: Partial<TreeText['captions']>
  pictures?: Partial<Record<PictureName, string>>
  sounds?: Partial<Record<'soon' | 'now', string>>
  /** Where the napper sits on the painted hill, and where its head is (the plum lands there). */
  napper?: Spot
}

export type PictureName = 'asleep' | 'bonked' | 'backdrop'

/** A loaded pack: words, pictures as data: URIs, and full paths to the two sounds. */
export type Pack = {
  text: TreeText
  pictures: Partial<Record<PictureName, string>>
  sounds: Partial<Record<'soon' | 'now', string>>
  napper?: Spot
}

export const DEFAULT_TEXT: TreeText = {
  lab: 'OOZE LAB · ARBORETUM 001',
  toasts: {
    soon: "🌳 Tree time's coming. Context at {percent}%. Start wrapping up.",
    now: '🚨 DIVE! DIVE! Tree time! Context at {percent}%. Write the handoff, then clear.',
  },
  captions: CAPTION,
  prompt:
    "Tree time: the context window is getting full. Write a handoff for a fresh session: what we're working on, " +
    "where it stands, open decisions, gotchas, and the next steps in order. Put the whole handoff in one fenced code block.",
}

/** Where the bundled crab keeps each picture and sound; a pack that skips one gets the crab's. */
export const BUNDLED_PICTURES: [PictureName, string][] = [['asleep', 'nap/asleep.webp'], ['bonked', 'nap/bonked.webp'], ['backdrop', 'nap/scene.webp']]
export const BUNDLED_SOUNDS = { soon: 'ding.mp3', now: 'dive-klaxon.mp3' } as const

export const soundKey = (threshold: Threshold): 'soon' | 'now' => (threshold === 80 ? 'now' : 'soon')

/** Fills a toast's {percent}. */
export function toastText(text: TreeText, threshold: Threshold, percent: number): string {
  return text.toasts[soundKey(threshold)].replaceAll('{percent}', String(percent))
}

/** The pack's words over the defaults. */
export function mergeText(section: TreeSection | undefined): TreeText {
  return {
    lab: section?.lab ?? DEFAULT_TEXT.lab,
    toasts: { ...DEFAULT_TEXT.toasts, ...section?.toasts },
    captions: { ...DEFAULT_TEXT.captions, ...section?.captions },
    prompt: section?.prompt ?? DEFAULT_TEXT.prompt,
  }
}
