import prisma from './prisma'

export async function notify(userId: string, title: string, body: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', link?: string) {
  await prisma.notification.create({ data: { userId, title, body, type, link } })
}

export async function notifyAll(userIds: string[], title: string, body: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', link?: string) {
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, title, body, type, link: link ?? null })),
  })
}
