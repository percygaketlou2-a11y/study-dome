// A deliberately small Markdown subset - paragraphs, **bold**, *italic*,
// bullet and numbered lists, and pipe tables - which is everything the study
// notes use. It produces plain data that React renders as elements, so note
// text is never interpreted as HTML.

export type Inline = { kind: 'text' | 'strong' | 'em'; text: string }

export type Block =
  | { type: 'p'; lines: Inline[][] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; items: Inline[][] }
  | { type: 'table'; header: Inline[][]; rows: Inline[][][] }

const UL = /^\s*[-*]\s+(.*)$/
const OL = /^\s*\d+[.)]\s+(.*)$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const pattern = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push({ kind: 'text', text: text.slice(last, match.index) })
    if (match[1] !== undefined) out.push({ kind: 'strong', text: match[1] })
    else out.push({ kind: 'em', text: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function startsTable(lines: string[], i: number): boolean {
  return TABLE_ROW.test(lines[i] ?? '') && TABLE_SEPARATOR.test(lines[i + 1] ?? '')
}

export function parseBlocks(source: string): Block[] {
  const lines = source.split(/\r?\n/)
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }

    if (startsTable(lines, i)) {
      const header = splitRow(line).map(parseInline)
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(splitRow(lines[i]).map(parseInline))
        i += 1
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    const listKind = UL.test(line) ? 'ul' : OL.test(line) ? 'ol' : null
    if (listKind) {
      const pattern = listKind === 'ul' ? UL : OL
      const items: Inline[][] = []
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(parseInline(lines[i].match(pattern)![1]))
        i += 1
      }
      blocks.push({ type: listKind, items })
      continue
    }

    const paragraph: Inline[][] = []
    while (i < lines.length && lines[i].trim() && !UL.test(lines[i]) && !OL.test(lines[i]) && !startsTable(lines, i)) {
      paragraph.push(parseInline(lines[i]))
      i += 1
    }
    blocks.push({ type: 'p', lines: paragraph })
  }

  return blocks
}
