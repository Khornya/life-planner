import '@/styles/index.css'

import type { GetServerSidePropsContext } from 'next/types'
import { getSession, signIn, useSession } from 'next-auth/react'

const IndexPage: React.FC<{}> = () => {
  const { status } = useSession()

  if (status === 'loading') return <h1> loading... please wait</h1>

  return (
    <div>
      <button className="login-with-google-btn" onClick={() => signIn('google')}>
        Sign in with Google
      </button>
    </div>
  )
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req } = context
  const session = await getSession({ req })

  if (session) {
    return {
      redirect: {
        permanent: false,
        destination: '/home',
      },
    }
  }

  return {
    props: {},
  }
}

export default IndexPage
