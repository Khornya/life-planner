import type { GetServerSidePropsContext } from 'next/types'
import type { Session } from 'next-auth/core/types'
import { signOut } from 'next-auth/react'
import '@/styles/home.css'
import { useRouter } from 'next/navigation'
import { authOptions } from './api/auth/[...nextauth]'
import { getServerSession } from 'next-auth/next'
import { getGoogleCalendar } from '@/lib/server/api/google/calendar'
import { ScheduleEventResult, Task, parseGoogleEvents, schedule } from '@/lib/server/api/services/scheduler'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { logger } from '@/lib/tools/logger'
import moment from 'moment'
import Link from 'next/link'
import { Event } from '@/lib/server/api/services/scheduler'

const Home: React.FC<{
  scheduledEvents: ScheduleEventResult[] | null
  unplannedEvents: ScheduleEventResult[]
  lateEvents: Event[]
  reservedIntervals: Event[]
  session: Session
}> = ({ scheduledEvents, unplannedEvents, lateEvents, reservedIntervals, session }) => {
  const router = useRouter()

  return (
    <div>
      <div>
        <h2>hi {session.user?.name}</h2>
        <img src={session.user?.image || ''} alt={`${session.user?.name} photo`} />
        <button onClick={() => signOut()}>sign out</button>
      </div>
      <h1>My events</h1>
      <Link href={'/events'}>See task list</Link>
      {!scheduledEvents ? <p>/!\ No solution found !</p> : null}
      {unplannedEvents.length ? <p>Unplanned events : {unplannedEvents.map(event => event.event.summary + ' ')}</p> : null}
      {lateEvents.length ? <p>Late events : {lateEvents.map(event => event.event.summary + ' ')}</p> : null}
      <FullCalendar
        plugins={[timeGridPlugin]}
        initialView="timeGridWeek"
        weekends={true}
        events={scheduledEvents
          ?.map(scheduledEvent => ({
            id: scheduledEvent.event.id || undefined,
            title: scheduledEvent.event.summary || undefined,
            start: scheduledEvent.scheduledEvent
              ? new Date((scheduledEvent.scheduledEvent as Task).start)
              : new Date(scheduledEvent.event.start?.dateTime || scheduledEvent.event.start?.date || ''),
            end: scheduledEvent.scheduledEvent
              ? new Date((scheduledEvent.scheduledEvent as Task).end)
              : new Date(scheduledEvent.event.end?.dateTime || scheduledEvent.event.end?.date || ''),
            allDay: !!scheduledEvent.event.start?.date,
            classNames: `${scheduledEvent.extendedProperties?.private.isFlexible ? 'flexible' : ''}`,
          }))
          .concat(
            reservedIntervals.map(reservedInterval => ({
              id: reservedInterval.event.id || undefined,
              title: reservedInterval.extendedProperties?.private.tags?.join(', ') || '',
              start: new Date(reservedInterval.event.start?.dateTime || reservedInterval.event.start?.date || ''),
              end: new Date(reservedInterval.event.end?.dateTime || reservedInterval.event.end?.date || ''),
              allDay: !!reservedInterval.event.start?.date,
              classNames: '',
              color: 'orange',
            }))
          )}
        eventClick={eventClick => {
          const sourceEvent = scheduledEvents?.find(scheduledEvent => scheduledEvent.event.id === eventClick.event.id)
          const sourceReservedTag = reservedIntervals.find(reservedInterval => reservedInterval.event.id === eventClick.event.id)
          if (sourceEvent) return router.push(`/event/${sourceEvent.event.id}/edit`)
          router.push(`/reserved/${sourceReservedTag?.event.recurringEventId || sourceReservedTag?.event.id}/edit`)
        }}
      />
    </div>
  )
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req, res } = context
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return {
      redirect: {
        permanent: false,
        destination: '/',
      },
    }
  }

  if ((session as any).error) {
    return {
      redirect: {
        permanent: false,
        destination: '/logout',
      },
    }
  }

  const calendar = getGoogleCalendar(session)

  const regularEvents = await calendar.events.list({
    calendarId: 'primary',
    timeMin: moment().subtract(1, 'months').toISOString(),
    singleEvents: true,
  })

  if (regularEvents.data.nextPageToken) logger('warn', 'More events available')

  const flexibleEvents = await calendar.events.list({
    calendarId: 'primary',
    timeMin: '1900-01-01T00:00:00Z',
    timeMax: '1900-01-02T00:00:00Z',
  })

  const reservedIntervals = await calendar.events.list({
    calendarId: process.env.NEXT_PUBLIC_RESERVED_CALENDAR_ID, // TODO dynamic calendar id
    timeMin: moment().subtract(1, 'months').toISOString(),
    timeMax: moment().add(1, 'months').toISOString(),
    singleEvents: true,
  })

  if (reservedIntervals.data.nextPageToken) logger('warn', 'More reserved intervals available')

  const scheduledEventResults = await schedule(
    regularEvents.data.items || [],
    flexibleEvents.data.items || [],
    reservedIntervals.data.items || []
  )

  return {
    props: {
      scheduledEvents: scheduledEventResults?.filter(
        scheduledEventResult => !scheduledEventResult.scheduledEvent || scheduledEventResult.scheduledEvent?.isPresent
      ),
      unplannedEvents: scheduledEventResults?.filter(
        scheduledEvent => scheduledEvent.scheduledEvent && !scheduledEvent.scheduledEvent.isPresent
      ),
      lateEvents: parseGoogleEvents(flexibleEvents.data.items || []).filter(
        parsedEvent =>
          parsedEvent.extendedProperties?.private.isFlexible && (parsedEvent.extendedProperties.private.maxDueDate || 0) <= Date.now()
      ),
      reservedIntervals: parseGoogleEvents(reservedIntervals.data.items || []),
      session: {
        user: session.user,
        expires: session.expires,
      },
    },
  }
}

export default Home
