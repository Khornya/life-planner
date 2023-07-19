import type { calendar_v3 } from 'googleapis'
import { google } from 'googleapis'
import type { GetServerSidePropsContext } from 'next/types'

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
  const jwtClient = new google.auth.JWT(process.env.GOOGLE_CLIENT_EMAIL, process.env.GOOGLE_PRIVATE_KEY_FILE, undefined, process.env.SCOPES)

  const calendar = google.calendar({
    version: 'v3',
    auth: jwtClient,
  })

  const result = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  })

  return {
    props: {
      events: result.data.items,
    },
  }
}

export default Home
