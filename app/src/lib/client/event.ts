import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3'
import { getNextApiClient } from '../server/api/nextApiClient'

export const editEvent: (event: calendar_v3.Schema$Event) => Promise<void> = async event => {
  const { data } = await getNextApiClient().post('/api/event', event)
  return data
}
