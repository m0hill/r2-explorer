import React from 'react'

type Props = {
  text: string
  className?: string
  label?: string
}

export default function CopyButton({ text, className, label }: Props) {
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // Fallback
      alert('Failed to copy')
    }
  }

  return (
    <button
      onClick={copy}
      className={
        className ??
        'ml-2 inline-flex items-center rounded border px-2 py-1 ' + 'text-sm hover:bg-gray-50'
      }
      title="Copy to clipboard"
    >
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  )
}
