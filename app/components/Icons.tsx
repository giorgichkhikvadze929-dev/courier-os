import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
}

type Props = { className?: string }

export const IconUpload    = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
export const IconDownload  = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
export const IconPlus      = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M12 5v14M5 12h14"/></svg>
export const IconArrows    = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M3 7h13l-3-3M21 17H8l3 3"/></svg>
export const IconSearch    = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
export const IconChart     = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M3 3v18h18M7 14l3-3 4 4 5-7"/></svg>
export const IconBell      = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
export const IconUsers     = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
export const IconBuilding  = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/></svg>
export const IconBox       = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
export const IconCog       = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
export const IconCash      = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg>
export const IconFile      = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
export const IconCheck     = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M20 6L9 17l-5-5"/></svg>
export const IconAlert     = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></svg>
export const IconInfo      = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
export const IconX         = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><path d="M18 6L6 18M6 6l12 12"/></svg>
export const IconClock     = (p: Props) => <svg {...base} className={p.className ?? 'w-4 h-4'}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
