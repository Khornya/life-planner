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
import { useEffect } from 'react'

const Home: React.FC<{ scheduledEvents: ScheduleEventResult[]; session: Session }> = ({ scheduledEvents, session }) => {
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
        events={scheduledEvents.map(scheduledEvent => ({
          id: scheduledEvent.event.id || undefined,
          title: scheduledEvent.event.summary as string,
          start: scheduledEvent.extendedProperties.private.isFlexible
            ? new Date((scheduledEvent.scheduledEvent as Task).start)
            : Date.parse(scheduledEvent.event.start?.dateTime || scheduledEvent.event.start?.date || ''),
          end: scheduledEvent.extendedProperties.private.isFlexible
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

  const calendar = getGoogleCalendar(session)

  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  })

  const scheduledEvents = await schedule(events.data.items || [])

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
