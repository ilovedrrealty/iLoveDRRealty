import { isGroupInvitePath } from './lib/groupInviteMemory'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App'
import './i18n'
import './index.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

const application = <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontSize: '13px', fontWeight: 600, borderRadius: '12px', padding: '12px 16px' },
        }}
      />
    </BrowserRouter>

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isGroupInvitePath(window.location.pathname) ? application
      : <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{application}</GoogleOAuthProvider>}
  </React.StrictMode>,
)
