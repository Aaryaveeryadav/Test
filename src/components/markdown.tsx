import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Safe markdown rendering — no raw HTML is ever injected.
 * The `node` prop from react-markdown is destructured out (never passed to DOM).
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
const components: Components = {
  p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ node, ...props }) => <li {...props} />,
  h1: ({ node, ...props }) => <h3 className="mb-2 text-lg font-bold" {...props} />,
  h2: ({ node, ...props }) => <h3 className="mb-2 font-bold" {...props} />,
  h3: ({ node, ...props }) => <h4 className="mb-1 font-semibold" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
  em: ({ node, ...props }) => <em className="text-slate-500" {...props} />,
  code: ({ node, ...props }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-sm" {...props} />,
  pre: ({ node, ...props }) => <pre className="mb-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-sm" {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-rose-600 underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="mb-2 border-l-4 border-rose-200 pl-3 text-slate-600" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: ({ node, ...props }) => <th className="border px-2 py-1 text-left font-semibold" {...props} />,
  td: ({ node, ...props }) => <td className="border px-2 py-1" {...props} />
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] text-slate-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

export function CitationList({ citations }: { citations: { id: string; label: string }[] }) {
  if (citations.length === 0) return null
  return (
    <ul className="mt-2 space-y-1">
      {citations.map((c) => (
        <li key={c.id} className="text-xs text-slate-500">
          <span className="mr-1 font-semibold text-rose-600">[{c.id}]</span>
          {c.label}
        </li>
      ))}
    </ul>
  )
}
