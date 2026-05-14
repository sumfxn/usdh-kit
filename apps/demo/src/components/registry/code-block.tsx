'use client'

import { Check, Clipboard, Terminal } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CodeBlock({
  code,
  language,
  copied,
  onCopy,
  embedded,
}: {
  code: string
  language?: string
  copied: boolean
  onCopy: () => void
  embedded?: boolean
}) {
  return (
    <div
      className={cn(
        'relative min-w-0 w-full max-w-full overflow-hidden bg-[#101010] text-neutral-100',
        embedded ? 'border-t border-neutral-800' : 'rounded-lg border border-neutral-800',
      )}
    >
      <div className="flex h-10 min-w-0 items-center justify-between border-b border-neutral-800 bg-[#151515] px-4">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Terminal className="h-3.5 w-3.5" />
          {language ?? 'tsx'}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          className="h-7 text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden bg-[#101010] p-0 text-xs leading-6">
        <code className="block w-max min-w-full max-w-none py-4 font-mono">
          {code.split('\n').map((line, index) => (
            <span
              key={`${index}-${line}`}
              className="grid min-h-6 w-max min-w-full grid-cols-[3rem_max-content] px-4 transition-colors hover:bg-neutral-900/60"
            >
              <span className="select-none pr-4 text-right tabular-nums text-neutral-600">
                {index + 1}
              </span>
              <span className="whitespace-pre">{highlightCodeLine(line, language)}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

function highlightCodeLine(line: string, language?: string) {
  const shell = language === 'shell'
  const pattern = shell
    ? /(#.*|\b(?:pnpm|npm|yarn|bun|bunx|npx)\b|--[\w-]+|\b\d[\d.]*\b)/g
    : /(\/\/.*|(['"`])(?:\\.|(?!\2).)*\2|\b(?:import|from|export|function|return|const|let|await|async|if|else|true|false|null|undefined|type|as)\b|<\/?[A-Za-z][\w.:/-]*|\b\d[\d._]*\b)/g
  const parts: ReactNode[] = []
  let lastIndex = 0

  for (const match of line.matchAll(pattern)) {
    const token = match[0]
    const index = match.index ?? 0
    if (index > lastIndex) parts.push(line.slice(lastIndex, index))
    parts.push(
      <span key={`${index}-${token}`} className={codeTokenClass(token, shell)}>
        {token}
      </span>,
    )
    lastIndex = index + token.length
  }

  if (lastIndex < line.length) parts.push(line.slice(lastIndex))
  return parts.length > 0 ? parts : line
}

function codeTokenClass(token: string, shell: boolean) {
  if (token.startsWith('//') || token.startsWith('#')) return 'text-neutral-500'
  if (!shell && /^['"`]/.test(token)) return 'text-emerald-300'
  if (!shell && /^<\/?[A-Za-z]/.test(token)) return 'text-sky-300'
  if (/^--/.test(token)) return 'text-amber-300'
  if (/^\d/.test(token)) return 'text-amber-300 tabular-nums'
  if (shell) return 'text-violet-300'
  return 'text-rose-300'
}
