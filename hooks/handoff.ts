// Finding the tree-time handoff in the conversation: the fenced block the ritual prints.

type Said = { role: string; text: string }

const FENCE = /```[^\n]*\n([\s\S]*?)```/g
const HANDOFF_HINT = /tree time|handoff|next steps|wake-?up order/i

/**
 * The handoff block from the newest assistant message that has one: the longest fenced
 * block in a message that reads like a handoff (or any block long enough to be one).
 * `/clear` blocks are skipped; they are the command, not the handoff.
 */
export function extractHandoff(messages: readonly Said[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message === undefined || message.role !== 'assistant') continue
    const blocks = [...message.text.matchAll(FENCE)]
      .map(match => (match[1] ?? '').trim())
      .filter(block => block.length > 0 && !/^\/clear\s*$/.test(block))
    if (blocks.length === 0) continue
    const longest = blocks.reduce((a, b) => (b.length > a.length ? b : a))
    if (HANDOFF_HINT.test(message.text) || longest.length > 400) return longest
  }
  return null
}
