import '@/styles/index.css'

import { signOut } from 'next-auth/react'

const LogoutPage: React.FC<{}> = () => {
  return (
    <div className="logout-wrapper">
      <h1>Life planner</h1>
      <p>An error occurred while getting your session. Please log out and try to log in again.</p>
      <button className="login-with-google-btn" onClick={() => signOut({ callbackUrl: '/' })}>
        Log out
      </button>
    </div>
  )
}

export default LogoutPage
