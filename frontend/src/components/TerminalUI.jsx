import React from 'react'

/**
 * Strips raw markdown asterisks from text.
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return text
  return text.replace(/\*/g, '')
}

/**
 * Risk badge with bracket notation: [LOW], [MEDIUM], [HIGH]
 * Monospace, no background fill, colored bracketed text.
 */
export function RiskBadge({ level }) {
  if (!level) return null
  const l = String(level).toUpperCase().trim()
  if (l.includes('LOW')) {
    return <span className="font-mono text-[#39d98a] font-bold tracking-wider">[LOW]</span>
  }
  if (l.includes('MED')) {
    return <span className="font-mono text-[#e8b339] font-bold tracking-wider">[MEDIUM]</span>
  }
  if (l.includes('HIGH')) {
    return <span className="font-mono text-[#ff5c5c] font-bold tracking-wider">[HIGH]</span>
  }
  return <span className="font-mono text-[#5f7a66] font-bold tracking-wider">[{l}]</span>
}

/**
 * Policy action badge with bracket notation: [APPROVE], [REVIEW], [DECLINE]
 */
export function ActionBadge({ action }) {
  if (!action) return null
  const a = String(action).toUpperCase().trim()
  if (a.includes('APPROVE')) {
    return <span className="font-mono text-[#39d98a] font-bold tracking-wider">[APPROVE]</span>
  }
  if (a.includes('DECLINE') || a.includes('REJECT')) {
    return <span className="font-mono text-[#ff5c5c] font-bold tracking-wider">[DECLINE]</span>
  }
  return <span className="font-mono text-[#e8b339] font-bold tracking-wider">[REVIEW]</span>
}

/**
 * Terminal Section Divider with ASCII art box-drawing characters
 */
export function AsciiDivider({ label, className = "" }) {
  return (
    <div className={`flex items-center gap-2 text-[#5f7a66] font-mono text-xs my-4 select-none ${className}`}>
      <span>├──</span>
      {label && (
        <>
          <span className="text-[#39d98a] font-bold uppercase tracking-wider">{`[ ${label} ]`}</span>
          <span>─</span>
        </>
      )}
      <span className="flex-1 overflow-hidden whitespace-nowrap text-[#1c2a20]">
        ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
      </span>
      <span>┤</span>
    </div>
  )
}

/**
 * Terminal Container Box with box-drawing header and hairline borders
 */
export function TerminalCard({ title, badge, children, className = "", noPadding = false }) {
  return (
    <div className={`bg-[#0a0f0c] border border-[#1c2a20] ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2a20] bg-[#080d09] text-xs font-mono">
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="text-[#5f7a66]">┌─</span>
            <span className="text-[#d7ecd9] font-semibold tracking-wider uppercase">{title}</span>
            <span className="text-[#1c2a20] flex-1">──────────────────────</span>
          </div>
          {badge && <div className="ml-2 flex-shrink-0">{badge}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>
        {children}
      </div>
      <div className="px-3 py-0.5 border-t border-[#1c2a20] bg-[#080d09] text-[#5f7a66] text-[10px] font-mono flex justify-between select-none">
        <span>└─</span>
        <span>─┘</span>
      </div>
    </div>
  )
}
