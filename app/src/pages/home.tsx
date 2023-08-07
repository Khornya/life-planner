import type { calendar_v3 } from 'googleapis'
import { google } from 'googleapis'
import type { GetServerSidePropsContext } from 'next/types'
import type { Session } from 'next-auth/core/types'
import { signOut } from 'next-auth/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen } from '@fortawesome/free-solid-svg-icons'
import '@/styles/home.css'
import { useRouter } from 'next/navigation'
import { authOptions } from './api/auth/[...nextauth]'
import { getServerSession } from 'next-auth/next'
import { getGoogleCalendar } from '@/lib/client/google/calendar'

const Home: React.FC<{ events: calendar_v3.Schema$Event[]; session: Session }> = ({ events, session }) => {
  const router = useRouter()

  return (
    <div>
      <div>
        <h2>hi {session.user?.name}</h2>
        <img src={session.user?.image || ''} alt={`${session.user?.name} photo`} />
        <button onClick={() => signOut()}>sign out</button>
      </div>
      <h1>My events</h1>
      {events.map(event => {
        return (
          <div key={event.id}>
            {event.start?.dateTime || event.start?.date} - {event.end?.dateTime || event.end?.date} : {event.summary}
            <FontAwesomeIcon icon={faPen} className="icon edit-icon" onClick={() => router.push(`/event/${event.id}/edit`)} />
          </div>
        )
      })}
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

  const result = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  })

  return {
    props: {
      events: result.data.items || [],
      session,
    },
  }
}

export default Home
