import '../styles/global.css'

import type { AppProps } from 'next/app'
import Head from 'next/head'
import { SessionProvider } from 'next-auth/react'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

const MyApp = ({ Component, pageProps }: AppProps) => (
  <>
    <Head>
      <meta name="viewport" content="initial-scale=1, width=device-width" />
      <link rel="shortcut icon" href="/assets/favicon.ico" />
    </Head>
    <SessionProvider session={pageProps.session}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Component {...pageProps} />
      </LocalizationProvider>
    </SessionProvider>
  </>
)

export default MyApp
