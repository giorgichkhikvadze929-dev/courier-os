import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import Shell from '@/app/components/Shell'
import { IconInfo, IconCheck, IconAlert, IconX } from '@/app/components/Icons'
import type { ReactNode } from 'react'
import { getT } from '@/lib/i18n-server'

async function markAllRead(userId: string): Promise<void> {
  'use server'
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
  revalidatePath('/notifications')
}

export default async function NotificationsPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { t } = await getT()
  const userId = (session.user as { id?: string }).id!

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const TYPE_STYLE: Record<string, { ring: string; icon: ReactNode; iconColor: string; iconBg: string }> = {
    INFO:    { ring: 'ring-blue-500/30',   icon: <IconInfo />,  iconColor: 'text-blue-500',   iconBg: 'bg-blue-500/15' },
    SUCCESS: { ring: 'ring-green-500/30',  icon: <IconCheck />, iconColor: 'text-[var(--color-success)]', iconBg: 'bg-green-500/15' },
    WARNING: { ring: 'ring-orange-500/30', icon: <IconAlert />, iconColor: 'text-[var(--color-warning)]', iconBg: 'bg-orange-500/15' },
    ERROR:   { ring: 'ring-red-500/30',    icon: <IconX />,     iconColor: 'text-[var(--color-danger)]',  iconBg: 'bg-red-500/15' },
  }

  const fmt = (d: Date) => {
    const diff = Date.now() - new Date(d).getTime()
    if (diff < 60_000)  return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return new Date(d).toLocaleDateString()
  }

  return (
    <Shell currentPath="/notifications">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-strong)]">{t('title_notifications')}</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{unreadCount} {t('notifications_unread_count')}</p>
            )}
          </div>
          {unreadCount > 0 && (
            <form action={markAllRead.bind(null, userId)}>
              <button type="submit" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium border border-[var(--color-border)] rounded-xl px-4 py-2 hover:bg-blue-500/10 transition-colors">
                {t('notifications_mark_all')}
              </button>
            </form>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-[var(--color-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-10 text-center">
            <p className="text-[var(--color-text-faint)] text-sm">{t('notifications_empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => {
              const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.INFO
              const content = (
                <div className={`bg-[var(--color-card)] rounded-xl shadow-sm border border-[var(--color-border)] px-5 py-4 flex gap-4 ${!n.read ? `ring-1 ${style.ring}` : ''}`}>
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full ${style.iconBg} flex items-center justify-center ${style.iconColor}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${n.read ? 'text-[var(--color-text)]' : 'text-[var(--color-text-strong)]'}`}>{n.title}</p>
                      <span className="text-xs text-[var(--color-text-faint)] flex-shrink-0">{fmt(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{n.body}</p>
                    {!n.read && (
                      <div className="mt-2">
                        <MarkReadButton id={n.id} userId={userId} />
                      </div>
                    )}
                  </div>
                </div>
              )

              return n.link ? (
                <Link key={n.id} href={n.link} className="block hover:opacity-80 transition-opacity">
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              )
            })}
          </div>
        )}
      </Shell>
    )
}

async function MarkReadButton({ id, userId }: { id: string; userId: string }) {
  async function mark(): Promise<void> {
    'use server'
    await prisma.notification.update({ where: { id }, data: { read: true } })
    revalidatePath('/notifications')
  }

  return (
    <form action={mark}>
      <button type="submit" className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
        Mark as read
      </button>
    </form>
  )
}
