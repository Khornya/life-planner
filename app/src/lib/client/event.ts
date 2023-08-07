import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3'
import { getExpressClient } from '../server/api/axiosClient'

export const editEvent: (event: calendar_v3.Schema$Event) => Promise<void> = async event => {
  const { data } = await getExpressClient().post('/api/event', event)
  return data
}
