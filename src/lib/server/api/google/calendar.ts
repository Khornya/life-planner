import { OAuth2Client } from 'google-auth-library'
import { calendar_v3, google } from 'googleapis'
import moment from 'moment'
import { Session } from 'next-auth'

export interface ExtendedProperties {
  shared: {}
  private: {
    isFlexible: boolean
    duration?: number
    impact?: number
    dueDate?: number
    maxDueDate?: number
    tags: string[]
  }
}

let auth: OAuth2Client

export const getGoogleCalendar = (session: Session) => {
  const { accessToken, refreshToken } = session as any

  if (!auth) {
    const clientId = process.env.GOOGLE_ID
    const clientSecret = process.env.GOOGLE_SECRET

    auth = new google.auth.OAuth2({
      clientId,
      clientSecret,
    })
  }

  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  return google.calendar({
    version: 'v3',
    auth,
  })
}

export const parseExtendedProperties: (event: calendar_v3.Schema$Event) => ExtendedProperties = event => {
  const privateExtendedProperties = Object.fromEntries(
    Object.entries(event.extendedProperties?.private || {}).map(([key, value]) => [key, JSON.parse(value)])
  )
  const sharedExtendedProperties = Object.fromEntries(
    Object.entries(event.extendedProperties?.shared || {}).map(([key, value]) => [key, JSON.parse(value)])
  )

  return {
    private: privateExtendedProperties,
    shared: sharedExtendedProperties,
  } as ExtendedProperties
}

export const getFlexibleEvents = async (calendar: calendar_v3.Calendar) =>
  await calendar.events.list({
    calendarId: 'primary',
    timeMin: '1900-01-01T00:00:00Z',
    timeMax: '1900-01-02T00:00:00Z',
  })

export const isEventEnded: (event: calendar_v3.Schema$Event) => boolean = (event: calendar_v3.Schema$Event) =>
  (event.end?.date && event.end?.date <= moment().format('yyyy-MM-DD')) ||
  ((event.end?.dateTime && event.end?.dateTime <= moment().toISOString()) as boolean)
