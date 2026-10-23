import { parseBlocks, type Inline } from '../lib/markdown'

function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'strong' ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part.text}
          </strong>
        ) : part.kind === 'em' ? (
          <em key={i}>{part.text}</em>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

// Renders the study-note Markdown subset as React elements. Text is never
// injected as HTML, so note content can't add markup or scripts to the page.
export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-3 text-sm leading-6 text-slate-700">
      {parseBlocks(source).map((block, i) => {
        if (block.type === 'p') {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  <Inlines parts={line} />
                </span>
              ))}
            </p>
          )
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type
          return (
            <List key={i} className={`ml-5 space-y-1 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inlines parts={item} />
                </li>
              ))}
            </List>
          )
        }
        if (block.type !== 'table') return null
        return (
          <div key={i} className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-900">
                <tr>
                  {block.header.map((cell, j) => (
                    <th key={j} scope="col" className="px-3 py-2 font-semibold">
                      <Inlines parts={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, j) => (
                  <tr key={j} className="border-t border-slate-100">
                    {row.map((cell, k) => (
                      <td key={k} className="px-3 py-2">
                        <Inlines parts={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
