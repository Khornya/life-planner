import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { Session } from 'next-auth'

let auth: OAuth2Client

export const getGoogleCalendar = (session: Session) => {
  const { accessToken, refreshToken } = session

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
