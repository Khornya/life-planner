import '@/styles/index.css'

import type { GetServerSidePropsContext } from 'next/types'
import { signIn, useSession } from 'next-auth/react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './api/auth/[...nextauth]'
import { Main } from '@/components/Main/Main'
import { redirect } from 'next/navigation'

const IndexPage: React.FC<{}> = () => {
  const { status } = useSession()

  return (
    <Main>
      <div className="login-wrapper">
        {status === 'loading' && <h1>loading... please wait</h1>}
        <img src="https://img.freepik.com/vecteurs-premium/planifier-planification-organisateur-date-limite-calendrier-quotidien-liste-controle-organisation-concept-date-limite_133260-744.jpg?w=826" />
      </div>
    </Main>
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
