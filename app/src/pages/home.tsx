import type { calendar_v3 } from 'googleapis'
import { google } from 'googleapis'
import type { GetServerSidePropsContext } from 'next/types'
import { getSession } from 'next-auth/react'

const Home: React.FC<{ events: calendar_v3.Schema$Event[] | undefined }> = ({ events }) => {
  return (
    <div>
      <h1>My events</h1>
      {events?.map(event => (
        <div key={event.id}>
          {event.start?.dateTime || event.start?.date} - {event.end?.dateTime || event.end?.date} : {event.summary}
        </div>
      ))}
    </div>
  )
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req } = context
  const session = await getSession({ req })

  console.log('session', session)

  if (!session) {
    // redirect 401
  }

  const clientId = process.env.GOOGLE_ID
  const clientSecret = process.env.GOOGLE_SECRET
  const accessToken = session?.accessToken
  const refreshToken = session?.refreshToken

  const auth = new google.auth.OAuth2({
    clientId,
    clientSecret,
  })

  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  const calendar = google.calendar({
    version: 'v3',
    auth,
  })

  const result = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  })

  console.log('result', result)

  return {
    props: {
      events: result.data.items,
    },
  }
}

export default Home
