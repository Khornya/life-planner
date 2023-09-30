import '@/styles/index.css'

import type { GetServerSidePropsContext } from 'next/types'
import { signIn, useSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './api/auth/[...nextauth]'

const IndexPage: React.FC<{}> = () => {
  const { status } = useSession()

  if (status === 'loading') return <h1>loading... please wait</h1>

  return (
    <div className="login-wrapper">
      <h1>Life planner</h1>
      <button className="login-with-google-btn" onClick={() => signIn('google')}>
        Sign in with Google
      </button>
    </div>
  )
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req, res } = context
  const session = await getServerSession(req, res, authOptions)

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
