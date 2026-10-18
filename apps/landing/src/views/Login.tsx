'use client'
import { useNav } from '../hooks/useNav'
import { useState, useEffect } from 'react'
import { Star, Home, Users, Handshake } from 'lucide-react'
import toast from 'react-hot-toast'
import { login, getMe, googleAuth } from '../api/auth'
import { useGoogleLogin } from '@react-oauth/google'
import { useTranslation } from 'react-i18next'
import { usePlatformStats } from '../hooks/usePlatformStats'
import { fmt } from '../data/listings'
import { dashboardAfterAuth, professionalAuthParams, rememberProfessionalJoin } from '../lib/professionalJoin'

const _dashRaw = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://app.ilovedrrealty.com'
const DASHBOARD_URL = _dashRaw.startsWith('http') ? _dashRaw : `https://${_dashRaw}`

export default function Login() {
  const go = useNav()
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [professionalJoin, setProfessionalJoin] = useState(false)
  const { t: tProfessional } = useTranslation('professionals')
  const platformStats = usePlatformStats()

  const STATS = [
    { value: '4.9', labelKey: 'login.stats.rating', Icon: Star, iconCls: 'text-gold fill-gold' },
    { value: platformStats ? platformStats.active_listings.toLocaleString() : '—', labelKey: 'login.stats.listings', Icon: Home, iconCls: 'text-white/80' },
    { value: platformStats ? platformStats.registered_users.toLocaleString() : '—', labelKey: 'login.stats.buyers', Icon: Users, iconCls: 'text-white/80' },
    { value: platformStats ? fmt(platformStats.total_value) : '—', labelKey: 'login.stats.volume', Icon: Handshake, iconCls: 'text-white/80' },
  ]

  const handleGoogleLogin = useGoogleLogin({
    prompt: 'select_account',
    onSuccess: async tokenResponse => {
      setGoogleLoading(true)
      try {
        await googleAuth(tokenResponse.access_token)
        toast.success(t('login.toast.success'))
        setTimeout(() => { window.location.href = dashboardAfterAuth(DASHBOARD_URL) }, 1500)
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : t('login.toast.google_error'))
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => toast.error(t('login.toast.google_error')),
  })

  useEffect(() => {
    setProfessionalJoin(rememberProfessionalJoin())
    getMe()
      .then(() => { window.location.href = dashboardAfterAuth(DASHBOARD_URL) })
      .catch(() => setChecking(false))
  }, [])

  if (checking) return null
  const inputCls = 'w-full py-3 px-3.5 rounded-xl border border-line bg-paper font-sans text-3.75 text-ink outline-none transition-colors duration-150'

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true)
    try {
      await login({ email, password })
      toast.success(t('login.toast.success'))
      setTimeout(() => { window.location.href = dashboardAfterAuth(DASHBOARD_URL) }, 1500)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('login.toast.login_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-74px)] grid grid-cols-1 md:grid-cols-2 font-sans">

      {/* ── Left panel — decorative ── */}
      <div className="hidden md:flex relative overflow-hidden flex-col justify-between py-15 px-14">
        {/* Background photo */}
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1683336474667-420dabe065b5?q=80&w=1471&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D?w=1200&q=80&auto=format&fit=crop)' }} />
        {/* Dark gradient overlay — heavy top-left, fades to transparent bottom-right */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(0,8,24,.97) 0%, rgba(0,16,46,.88) 30%, rgba(0,20,50,.55) 60%, rgba(0,10,30,.18) 100%)' }} />

        <div className="relative">
          <button onClick={() => go('landing')} className="bg-transparent border-0 cursor-pointer p-0 mb-12 block">
            <img src="/iLoveDRRealty_White.png" alt="I Love DR Realty" className="h-10 w-auto block" width={87} height={36} />
          </button>

          <div className="text-2.75 font-bold tracking-[.18em] uppercase text-gold mb-3.5">{t('login.eyebrow')}</div>
          <h1 className="font-sans text-[clamp(28px,3vw,42px)] font-extrabold text-white leading-[1.1] tracking-[-.02em] mb-4.5 max-w-95">
            {t('login.heading')}
          </h1>
          <p className="text-3.75 text-white/65 leading-[1.7] max-w-85">
            {t('login.sub')}
          </p>
        </div>

        {/* Stats strip */}
        <div className="relative flex items-center bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 overflow-hidden divide-x divide-white/15">
          {STATS.map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-3 px-5 py-5">
              <s.Icon size={22} className={s.iconCls} />
              <div>
                <div className="font-sans text-5.5 font-bold text-white leading-none">{s.value}</div>
                <div className="text-xs text-white/55 mt-1.5 leading-none">{t(s.labelKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="bg-paper2 flex items-center justify-center py-10 sm:py-15 px-4 sm:px-7">
        <div className="w-full max-w-105">

          <h2 className="font-sans text-7.5 font-bold text-ink mb-1.5 tracking-[-.02em]">{t('login.form.heading')}</h2>
          <p className="text-[14.5px] text-ink2 mb-8">
            {t('login.form.no_account')}{' '}
            <button onClick={() => go('signup', undefined, professionalAuthParams())} className="bg-transparent border-0 cursor-pointer text-coral font-bold text-[14.5px] font-sans p-0">
              {t('login.form.signup_cta')}
            </button>
          </p>

          {professionalJoin && <p className="mb-4 rounded-xl border border-line bg-white p-4 text-sm text-ink2">{tProfessional('join_auth')}</p>}
          <div className="bg-paper border border-line rounded-2xl p-8">
            <div className="mb-4.5">
              <label className="text-xs font-semibold text-ink2 block mb-1.75">{t('login.form.email_label')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" className={inputCls} />
            </div>

            <div className="mb-5.5">
              <div className="flex justify-between items-center mb-1.75">
                <label className="text-xs font-semibold text-ink2">{t('login.form.password_label')}</label>
                <button onClick={() => { window.location.href = '/forgot-password' }} className="bg-transparent border-0 cursor-pointer text-xs text-sea font-semibold font-sans p-0">{t('login.form.forgot')}</button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0 text-ink2 hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full py-3.25 rounded-full border-none cursor-pointer bg-coral text-white font-sans text-3.75 font-bold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('login.form.submitting') : t('login.form.submit')}
            </button>

            <div className="flex items-center gap-3 my-5.5">
              <div className="flex-1 h-px bg-line" />
              <span className="text-xs text-dim font-medium">{t('login.form.or')}</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={googleLoading}
              className="w-full py-2.75 rounded-full font-sans text-sm font-semibold cursor-pointer bg-white border border-[#dadce0] text-[#3c4043] flex items-center justify-center gap-3 hover:bg-[#f8f9fa] transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              )}
              {googleLoading ? t('login.form.google_loading') : t('login.form.google')}
            </button>
          </div>


        </div>
      </div>

    </div>
  )
}
