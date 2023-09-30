/* eslint-disable no-param-reassign */
import type { AuthOptions, TokenSet } from 'next-auth'
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          // following options required is refresh token not stored in DB
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user, profile, session, trigger }) {
      if (account) {
        // Save the access token and refresh token in the JWT on the initial login
        return {
          access_token: account.access_token,
          expires_at: Math.floor(Date.now() / 1000 + (account as any).expires_in),
          refresh_token: account.refresh_token,
          user,
          profile,
        }
      } else if (Date.now() < (token as any).expires_at * 1000) {
        // If the access token has not expired yet, return it
        console.log('Valid token found, expires in ', (token as any).expires_at * 1000 - Date.now())
        return token
      } else {
        // If the access token has expired, try to refresh it
        try {
          // https://accounts.google.com/.well-known/openid-configuration
          // We need the `token_endpoint`.
          const response = await fetch('https://oauth2.googleapis.com/token', {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_ID,
              client_secret: process.env.GOOGLE_SECRET,
              grant_type: 'refresh_token',
              refresh_token: (token as any).refresh_token,
            }),
            method: 'POST',
          })

          const tokens: TokenSet = await response.json()

          if (!response.ok) throw tokens

          return {
            ...token, // Keep the previous token properties
            access_token: tokens.access_token,
            expires_at: Math.floor(Date.now() / 1000 + (tokens as any).expires_in),
            // Fall back to old refresh token, but note that
            // many providers may only allow using a refresh token once.
            refresh_token: tokens.refresh_token ?? token.refresh_token,
          }
        } catch (error) {
          console.error('Error refreshing access token', error)
          // The error property will be used client-side to handle the refresh token error
          return { ...token, error: 'RefreshAccessTokenError' as const }
        }
      }
    },
    async session({ session, token, newSession, trigger, user }) {
      ;(session.user as any) = token.user
      ;(session as any).accessToken = token.access_token
      ;(session as any).refreshToken = token.refresh_token
      ;(session as any).error = token.error
      return session
    },
  },
  debug: process.env.NODE_ENV !== 'production',
}

export default NextAuth(authOptions)
