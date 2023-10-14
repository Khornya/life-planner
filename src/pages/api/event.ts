import { getServerSession } from 'next-auth/next'
import { createRouter } from 'next-connect'
import { NextApiRequest, NextApiResponse } from 'next/types'
import { authOptions } from './auth/[...nextauth]'
import { getGoogleCalendar } from '@/lib/server/api/google/calendar'

const router = createRouter<NextApiRequest, NextApiResponse>()

router.post(async (req, res) => {
  const { id, calendarId } = req.body
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ message: 'You must be logged in.' })
  }

  const calendar = getGoogleCalendar(session)

  return res.send(
    await calendar.events.update({
      calendarId,
      eventId: id,
      sendUpdates: 'all',
      requestBody: req.body,
    })
  )
})

router.delete(async (req, res) => {
  const ids: string[] = JSON.parse(decodeURIComponent(req.query.ids as string))
  const { calendarId } = req.query

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ message: 'You must be logged in.' })
  }

  const calendar = getGoogleCalendar(session)

  const deletePromises = ids.map(id => calendar.events.delete({ calendarId: (calendarId as string) || 'primary', eventId: id }))
  Promise.all(deletePromises)

  return res.status(200).end()
})

export default router.handler()
