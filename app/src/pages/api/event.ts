import { getServerSession } from 'next-auth/next'
import { createRouter } from 'next-connect'
import { NextApiRequest, NextApiResponse } from 'next/types'
import { authOptions } from './auth/[...nextauth]'
import { getGoogleCalendar } from '@/lib/client/google/calendar'

const router = createRouter<NextApiRequest, NextApiResponse>()

router.post(async (req, res) => {
  const { id } = req.body
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ message: 'You must be logged in.' })
  }

  const calendar = getGoogleCalendar(session)

  return res.send(
    await calendar.events.update({
      calendarId: 'primary',
      eventId: id,
      sendUpdates: 'all',
      requestBody: req.body,
    })
  )
})

export default router.handler()
