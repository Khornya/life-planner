import type { GetServerSidePropsContext } from 'next/types'
import type { Session } from 'next-auth/core/types'
import { signOut } from 'next-auth/react'
import '@/styles/home.css'
import { useRouter } from 'next/navigation'
import { authOptions } from './api/auth/[...nextauth]'
import { getServerSession } from 'next-auth/next'
import { getGoogleCalendar } from '@/lib/server/api/google/calendar'
import { ScheduleEventResult, Task, schedule } from '@/lib/server/api/services/scheduler'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { logger } from '@/lib/tools/logger'
import moment from 'moment'

const Home: React.FC<{ scheduledEvents: ScheduleEventResult[] | null; session: Session }> = ({ scheduledEvents, session }) => {
  const router = useRouter()

  return (
    <div>
      <div>
        <h2>hi {session.user?.name}</h2>
        <img src={session.user?.image || ''} alt={`${session.user?.name} photo`} />
        <button onClick={() => signOut()}>sign out</button>
      </div>
      <h1>My events</h1>
      {!scheduledEvents ? <p>/!\ No solution found !</p> : null}
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridWeek"
        weekends={true}
        events={scheduledEvents?.map(scheduledEvent => ({
          id: scheduledEvent.event.id || undefined,
          title: scheduledEvent.event.summary as string,
          start: scheduledEvent.scheduledEvent
            ? new Date((scheduledEvent.scheduledEvent as Task).start)
            : Date.parse(scheduledEvent.event.start?.dateTime || scheduledEvent.event.start?.date || ''),
          end: scheduledEvent.scheduledEvent
            ? new Date((scheduledEvent.scheduledEvent as Task).start + (scheduledEvent.scheduledEvent as Task).duration)
            : new Date(scheduledEvent.event.end?.dateTime || scheduledEvent.event.end?.date || ''),
          allDay: !!scheduledEvent.event.start?.date,
          classNames: `${scheduledEvent.extendedProperties.private.isFlexible ? 'flexible' : ''}`,
        }))}
        eventClick={event => router.push(`/event/${event.event.id}/edit`)}
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
  })

  const flexibleEvents = await calendar.events.list({
    calendarId: 'primary',
    timeMin: '1900-01-01T00:00:00Z',
    timeMax: '1900-01-02T00:00:00Z',
  })

  if (regularEvents.data.nextPageToken) logger('warn', 'More events available')

  const scheduledEvents = await schedule(regularEvents.data.items || [], flexibleEvents.data.items || [])

  return {
    props: {
      scheduledEvents: scheduledEvents,
      session: {
        user: session.user,
        expires: session.expires,
      },
    },
  }
}

export default Home
