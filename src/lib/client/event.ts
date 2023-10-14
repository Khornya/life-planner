import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3'
import { getNextApiClient } from '../server/api/nextApiClient'

export const editEvent: (event: calendar_v3.Schema$Event, calendarId?: string) => Promise<void> = async (event, calendarId) => {
  await getNextApiClient().post('/api/event', { ...event, calendarId: calendarId || 'primary' })
}

export const deleteEvents: (ids: string[], calendarId?: string) => Promise<void> = async (ids, calendarId) => {
  await getNextApiClient().delete(`/api/event?ids=${encodeURIComponent(JSON.stringify(ids))}&calendarId=${calendarId || 'primary'}`)
}
