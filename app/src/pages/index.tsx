import { signIn, signOut, useSession } from 'next-auth/react'

const IndexPage: React.FC<{}> = () => {
  const { data, status } = useSession()

  if (status === 'loading') return <h1> loading... please wait</h1>

  if (status === 'authenticated') {
    return (
      <div>
        <h1> hi {data.user?.name}</h1>
        <img src={data.user?.image || ''} alt={`${data.user?.name} photo`} />
        <button onClick={signOut}>sign out</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => signIn('google')}>sign in with gooogle</button>
    </div>
  )
}

export default IndexPage
