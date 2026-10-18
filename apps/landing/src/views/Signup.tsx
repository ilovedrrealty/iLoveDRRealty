'use client'
import { useNav } from '../hooks/useNav'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'
import { isValidPhoneNumber } from 'libphonenumber-js'
import * as Yup from 'yup'
import toast from 'react-hot-toast'
import { register } from '../api/auth'
import GoogleAuthSection from '../components/GoogleAuthSection'
import { useTranslation } from 'react-i18next'
import { usePlatformStats } from '../hooks/usePlatformStats'
import { professionalAuthParams, rememberProfessionalJoin } from '../lib/professionalJoin'

type Fields = { name: string; phone: string; email: string; password: string; confirmPassword: string; agreed: boolean }
type FieldErrors = Partial<Record<keyof Fields, string>>

export default function Signup() {
  const [professionalJoin, setProfessionalJoin] = useState(false)
  const { t: tProfessional } = useTranslation('professionals')
  useEffect(() => { setProfessionalJoin(rememberProfessionalJoin()) }, [])
  const go = useNav()
  const router = useRouter()
  const { t } = useTranslation('auth')
  const platformStats = usePlatformStats()
  const registeredCount = platformStats ? platformStats.registered_users.toLocaleString() : '—'

  const schema = useMemo(() => Yup.object({
    name:            Yup.string().required(t('signup.validation.name_required')).min(2, t('signup.validation.name_min')),
    phone:           Yup.string().required(t('signup.validation.phone_required')).test('valid-phone', t('signup.validation.phone_invalid'), v => !!v && isValidPhoneNumber(v)),
    email:           Yup.string().required(t('signup.validation.email_required')).email(t('signup.validation.email_invalid')),
    password:        Yup.string()
      .min(8, t('signup.validation.password_min'))
      .matches(/[a-z]/, t('signup.validation.password_lowercase'))
      .matches(/[A-Z]/, t('signup.validation.password_uppercase'))
      .matches(/\d/, t('signup.validation.password_number'))
      .matches(/[!@#$%^&*(),.?":{}|<>]/, t('signup.validation.password_special'))
      .required(t('signup.validation.password_required')),
    confirmPassword: Yup.string().required(t('signup.validation.confirm_required')).oneOf([Yup.ref('password')], t('signup.validation.confirm_match')),
    agreed:          Yup.boolean().oneOf([true], t('signup.validation.terms_required')),
  }), [t])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  function clearField(field: keyof FieldErrors) {
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
  }

  async function handleSignup() {
    setFieldErrors({})
    try {
      await schema.validate({ name, phone, email, password, confirmPassword, agreed }, { abortEarly: false })
    } catch (err) {
      if (err instanceof Yup.ValidationError) {
        const errs: FieldErrors = {}
        err.inner.forEach(e => { if (e.path) errs[e.path as keyof FieldErrors] = e.message })
        setFieldErrors(errs)
      }
      return
    }
    setLoading(true)
    try {
      await register({ display_name: name, email, password, phone: phone || undefined })
      toast.success(t('signup.toast.email_sent'))
      const verifyParams = new URLSearchParams({ email, ...professionalAuthParams() })
      setTimeout(() => router.push(`/verify?${verifyParams}`), 1500)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('signup.toast.signup_error'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = (field: keyof FieldErrors) =>
    `w-full py-3 px-3.5 rounded-xl border font-sans text-3.75 text-ink outline-none transition-colors duration-150 bg-paper ${fieldErrors[field] ? 'border-coral' : 'border-line'}`
  const labelCls = 'text-xs font-semibold text-ink2 block mb-1.75'
  const errCls = 'text-[11px] text-coral mt-1'

  return (
    <div className="min-h-[calc(100vh-74px)] grid grid-cols-1 md:grid-cols-2 font-sans">

      {/* ── Left panel ── */}
      <div className="hidden md:flex flex-col py-15 px-14 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1683336474667-420dabe065b5?q=80&w=1471&auto=format&fit=crop)' }} />
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(0,8,24,.97) 0%, rgba(0,16,46,.88) 30%, rgba(0,20,50,.55) 60%, rgba(0,10,30,.18) 100%)' }} />

        <div className="relative">
          <button onClick={() => go('landing')} className="bg-transparent border-0 cursor-pointer p-0 mb-12 block">
            <img src="/iLoveDRRealty_White.png" alt="I Love DR Realty" className="h-10 w-auto block" width={87} height={36} />
          </button>

          <div className="text-2.75 font-bold tracking-[.18em] uppercase text-gold mb-3.5">{t('signup.eyebrow')}</div>
          <h1 className="font-sans text-[clamp(26px,3vw,40px)] font-extrabold text-white leading-[1.1] tracking-[-.02em] mb-4.5 max-w-90">
            {t('signup.heading_pre')}{' '}
            <span className="text-coral">{registeredCount}</span> {t('signup.heading_post')}
          </h1>
          <p className="text-3.75 text-white/65 leading-[1.7] max-w-80 mb-10">
            {t('signup.sub')}
          </p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="bg-paper2 flex items-center justify-center py-10 sm:py-12 px-4 sm:px-7 overflow-y-auto">
        <div className="w-full max-w-110">

          <h2 className="font-sans text-7 font-bold text-ink mb-1.5 tracking-[-.02em]">{t('signup.form.heading')}</h2>
          <p className="text-[14.5px] text-ink2 mb-7">
            {t('signup.form.has_account')}{' '}
            <button onClick={() => go('login', undefined, professionalAuthParams())}
              className="bg-transparent border-0 cursor-pointer text-coral font-bold text-[14.5px] font-sans p-0">
              {t('signup.form.login_cta')}
            </button>
          </p>

          {professionalJoin && <p className="mb-4 rounded-xl border border-line bg-white p-4 text-sm text-ink2">{tProfessional('join_auth')}</p>}
          <div className="bg-paper border border-line rounded-2xl p-5 sm:p-7">

            {/* Name */}
            <div className="mb-3.5">
              <label className={labelCls}>{t('signup.form.name_label')}</label>
              <input value={name} onChange={e => { setName(e.target.value); clearField('name') }} placeholder="Maria Rodríguez" className={inputCls('name')} />
              {fieldErrors.name && <p className={errCls}>{fieldErrors.name}</p>}
            </div>

            {/* Phone */}
            <div className="mb-3.5">
              <label className={labelCls}>{t('signup.form.phone_label')}</label>
              <PhoneInput
                defaultCountry="do"
                value={phone}
                onChange={v => { setPhone(v); clearField('phone') }}
                placeholder="+1 (809) 000-0000"
                inputStyle={{
                  flex: 1, width: '100%', outline: 'none',
                  border: '1px solid #e4ddcf', borderLeft: 'none',
                  borderRadius: '0 0.75rem 0.75rem 0',
                  background: '#ffffff', padding: '0.75rem 0.875rem',
                  fontFamily: 'inherit', fontSize: '0.9375rem', color: '#00102e',
                  height: 'auto', boxSizing: 'border-box',
                }}
                countrySelectorStyleProps={{
                  buttonStyle: {
                    border: '1px solid #e4ddcf', borderRight: 'none',
                    borderRadius: '0.75rem 0 0 0.75rem',
                    background: '#ffffff', padding: '0 0.75rem',
                    cursor: 'pointer', height: '100%',
                  },
                }}
                style={{ width: '100%', display: 'flex' }}
              />
              {fieldErrors.phone && <p className={errCls}>{fieldErrors.phone}</p>}
            </div>

            {/* Email */}
            <div className="mb-3.5">
              <label className={labelCls}>{t('signup.form.email_label')}</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); clearField('email') }} placeholder="you@email.com" className={inputCls('email')} />
              {fieldErrors.email && <p className={errCls}>{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="mb-3.5">
              <label className={labelCls}>{t('signup.form.password_label')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearField('password') }}
                  placeholder={t('signup.form.password_placeholder')}
                  className={`${inputCls('password')} pr-10`}
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
              {fieldErrors.password && <p className={errCls}>{fieldErrors.password}</p>}
            </div>

            {/* Confirm password */}
            <div className="mb-5">
              <label className={labelCls}>{t('signup.form.confirm_label')}</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); clearField('confirmPassword') }}
                  placeholder={t('signup.form.confirm_placeholder')}
                  className={`${inputCls('confirmPassword')} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer p-0 text-ink2 hover:text-ink transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? (
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
              {fieldErrors.confirmPassword && <p className={errCls}>{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Terms */}
            <div className="mb-4.5">
              <label className="flex items-start gap-2.25 text-[12.5px] text-ink2 leading-normal cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); clearField('agreed') }}
                  className="accent-coral w-3.75 h-3.75 mt-0.5 shrink-0" />
                <span>
                  {t('signup.form.terms_pre')}{' '}
                  <button className="bg-transparent border-0 cursor-pointer text-sea font-semibold font-sans text-[12.5px] p-0">{t('signup.form.terms_link')}</button>
                  {' '}{t('signup.form.terms_and')}{' '}
                  <button className="bg-transparent border-0 cursor-pointer text-sea font-semibold font-sans text-[12.5px] p-0">{t('signup.form.privacy_link')}</button>
                  .
                </span>
              </label>
              {fieldErrors.agreed && <p className={errCls}>{fieldErrors.agreed}</p>}
            </div>


            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full py-3.25 rounded-full border-none font-sans text-3.75 font-bold transition-colors duration-150 bg-coral text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? t('signup.form.submitting') : t('signup.form.submit')}
            </button>

            <GoogleAuthSection mode="signup" />
          </div>

        </div>
      </div>

    </div>
  )
}
