import { auth, signOut } from '@/auth'
import { getActiveSession } from '@/lib/impersonation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import type { ReactNode } from 'react'
import ThemeToggle from './ThemeToggle'
import LangPicker from './LangPicker'
import SidebarToggle from './SidebarToggle'
import MobileDrawer from './MobileDrawer'
import ImpersonationBanner from './ImpersonationBanner'
import { getT } from '@/lib/i18n-server'
import { type DictKey } from '@/lib/i18n'

type NavItem = { href: string; labelKey: DictKey; icon: ReactNode }

const ICONS: Record<string, ReactNode> = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  truck:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  users:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  building:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  box:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chart:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M3 3v18h18M7 14l3-3 4 4 5-7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  bell:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  upload:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  cog:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  cash:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  route:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 003.5-3.5v0a3.5 3.5 0 00-3.5-3.5h-11A3.5 3.5 0 013 8.5v0A3.5 3.5 0 016.5 5H15"/><circle cx="18" cy="5" r="3"/></svg>,
  pkg:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M16 16v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3M21 12V5a2 2 0 00-2-2H10a2 2 0 00-2 2v7M3 8h13M16 12h5M21 12l-3-3M21 12l-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

const ROLE_NAV: Record<string, NavItem[]> = {
  ADMIN: [
    { href: '/admin',             labelKey: 'nav_dashboard',  icon: ICONS.dashboard },
    // Two related entries now distinguished by label:
    //   "შეკვეთები" (Orders) — grouped: imports + courier assignments.
    //   "ამანათები" (Parcels) — flat list of every individual parcel.
    // Both exist; they used to share the same Georgian label which was the
    // source of confusion.
    { href: '/admin/orders',      labelKey: 'nav_orders',     icon: ICONS.cash },
    { href: '/admin/deliveries',  labelKey: 'nav_deliveries', icon: ICONS.truck },
    { href: '/admin/verify',      labelKey: 'nav_verify',     icon: ICONS.pkg },
    { href: '/admin/assign',      labelKey: 'nav_assign',     icon: ICONS.route },
    { href: '/admin/denied',      labelKey: 'nav_denied',     icon: ICONS.bell },
    { href: '/admin/import',      labelKey: 'nav_import',     icon: ICONS.upload },
    { href: '/admin/companies',   labelKey: 'nav_companies',  icon: ICONS.building },
    { href: '/admin/audit',       labelKey: 'nav_audit',      icon: ICONS.chart },
    // Users, Tariffs, Regions (places) — accessed via /admin/settings hub.
    // Inventory removed: not in PRD; pages still exist but unlinked.
    { href: '/admin/settings',    labelKey: 'nav_settings',   icon: ICONS.cog },
  ],
  COMPANY: [
    { href: '/company',           labelKey: 'nav_dashboard',  icon: ICONS.dashboard },
    { href: '/company/orders',    labelKey: 'nav_orders',     icon: ICONS.cash },
    { href: '/company/parcels',   labelKey: 'nav_my_parcels', icon: ICONS.truck },
    { href: '/company/import',    labelKey: 'nav_upload',     icon: ICONS.upload },
  ],
  COURIER: [
    { href: '/courier',           labelKey: 'nav_my_deliveries', icon: ICONS.truck },
    { href: '/courier/pickups',   labelKey: 'nav_pickups',       icon: ICONS.upload },
    { href: '/courier/history',   labelKey: 'nav_history',       icon: ICONS.chart },
  ],
}

export default async function Shell({
  currentPath,
  breadcrumb,
  title,
  subtitle,
  search,
  actions,
  children,
}: {
  currentPath?: string
  // Optional back-link rendered above the page title — used for nested pages
  // (e.g. Users / Tariffs / Regions reached via the Settings hub).
  breadcrumb?: { href: string; label: string }
  title?: string
  subtitle?: string
  search?: { name: string; placeholder?: string; defaultValue?: string; action?: string }
  actions?: ReactNode
  children: ReactNode
}) {
  const session = await getActiveSession()
  if (!session?.user) return <>{children}</>

  const role = session.user.role
  const userId = session.user.id
  const nav = ROLE_NAV[role] ?? []
  const unread = userId ? await prisma.notification.count({ where: { userId, read: false } }) : 0
  const initials = (session.user.name ?? '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
  const { t: tr, lang } = await getT()
  const roleLabel = role === 'ADMIN' ? tr('role_ADMIN') : role === 'COMPANY' ? tr('role_COMPANY') : role === 'COURIER' ? tr('role_COURIER') : role

  const impersonatedBy = session.impersonatedBy

  return (
    <div className="min-h-screen bg-[var(--color-app)] text-[var(--color-text)]">
      {impersonatedBy && (
        <ImpersonationBanner
          asUserName={session.user.name ?? '?'}
          asUserRole={role}
          realAdminName={impersonatedBy.name}
          lang={lang}
        />
      )}
      {/* Sidebar */}
      <aside data-sidebar className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 bg-[var(--color-app-elev)] border-r border-[var(--color-border)] z-30 overflow-hidden">
        <div className="px-3 h-16 flex items-center border-b border-[var(--color-border)]">
          <SidebarToggle ariaLabel="Toggle sidebar">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              {/* Brand logo — delivery truck. We're a moving company. */}
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <div data-sidebar-label className="flex-1 min-w-0 text-left">
              <p className="text-sm font-bold text-[var(--color-text-strong)] leading-tight">CourierOS</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">{roleLabel}</p>
            </div>
          </SidebarToggle>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((item) => {
            const active = currentPath === item.href || currentPath?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                data-sidebar-item
                title={tr(item.labelKey)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-primary)] text-white shadow-sm shadow-blue-900/30'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)]'
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span data-sidebar-label>{tr(item.labelKey)}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-[var(--color-border)] px-3 py-3">
          <div data-sidebar-user className="flex items-center gap-3 px-2 py-2" title={session.user.name ?? undefined}>
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-text-strong)] text-xs font-bold flex items-center justify-center flex-shrink-0">
              {initials || '?'}
            </div>
            <div data-sidebar-user-meta className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{session.user.name}</p>
              <p className="text-xs text-[var(--color-text-faint)] truncate">{session.user.email}</p>
            </div>
          </div>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }} data-sidebar-signout>
            <button className="mt-1 w-full text-left text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1.5 rounded-md hover:bg-[var(--color-card)] transition-colors">
              {tr('btn_signout')}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top nav */}
      <header className="lg:hidden bg-[var(--color-app-elev)] border-b border-[var(--color-border)] px-3 h-14 flex items-center gap-2 sticky top-0 z-20">
        <MobileDrawer
          brandLabel="CourierOS"
          brandSubtitle={roleLabel}
          nav={nav.map((item) => ({
            href: item.href,
            label: tr(item.labelKey),
            icon: item.icon,
            active: currentPath === item.href || (currentPath?.startsWith(item.href + '/') ?? false),
          }))}
          userBlock={
            <>
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-9 h-9 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-text-strong)] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text-strong)] truncate">{session.user.name}</p>
                  <p className="text-xs text-[var(--color-text-faint)] truncate">{session.user.email}</p>
                </div>
              </div>
              <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
                <button className="mt-1 w-full text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-3 py-2.5 rounded-md hover:bg-[var(--color-card)] transition-colors min-h-[44px]">
                  {tr('btn_signout')}
                </button>
              </form>
            </>
          }
        />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
          </div>
          <p className="font-bold text-[var(--color-text-strong)] truncate">CourierOS</p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <LangPicker />
          <ThemeToggle />
          <Link href="/notifications" aria-label="Notifications" className="relative p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-lg hover:bg-[var(--color-card-hover)] transition-colors">
            {ICONS.bell}
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[1rem] h-4 px-1 bg-[var(--color-warning)] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Main */}
      <div data-sidebar-spacer className="lg:pl-60">
        {/* Top toolbar */}
        <div className="sticky top-0 z-10 bg-[var(--color-app-elev)]/95 backdrop-blur border-b border-[var(--color-border)] hidden lg:block">
          <div className="px-6 lg:px-8 h-16 flex items-center gap-4">
            {search ? (
              <form action={search.action} className="flex-1 max-w-xl">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <input
                    name={search.name}
                    defaultValue={search.defaultValue}
                    placeholder={search.placeholder ?? 'Search…'}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  />
                </div>
              </form>
            ) : <div className="flex-1" />}

            <LangPicker />
            <ThemeToggle />
            <Link href="/notifications" className="relative p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-lg hover:bg-[var(--color-card-hover)] transition-colors">
              {ICONS.bell}
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--color-warning)] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Page content */}
        <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {breadcrumb && (
            <Link
              href={breadcrumb.href}
              className="inline-flex items-center text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-3"
            >
              {breadcrumb.label}
            </Link>
          )}
          {(title || actions) && (
            <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
              <div>
                {title && <h1 className="text-2xl lg:text-3xl font-bold text-[var(--color-text-strong)] tracking-tight">{title}</h1>}
                {subtitle && <p className="text-sm text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
