import '../styles/global.css'

import type { AppProps } from 'next/app'
import Head from 'next/head'

const MyApp = ({ Component, pageProps }: AppProps) => (
  <>
    <Head>
      <link rel="shortcut icon" href="/assets/favicon.ico" />
    </Head>
    <Component {...pageProps} />
  </>
)

export default MyApp
