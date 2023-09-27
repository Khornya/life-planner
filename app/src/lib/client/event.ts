import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3'
import { getNextApiClient } from '../server/api/nextApiClient'

export const editEvent: (event: calendar_v3.Schema$Event) => Promise<void> = async event => {
  await getNextApiClient().post('/api/event', event)
}

export const deleteEvents: (ids: string[]) => Promise<void> = async ids => {
  await getNextApiClient().delete(`/api/event?ids=${encodeURIComponent(JSON.stringify(ids))}`)
}
