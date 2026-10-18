import { useRef, useState } from 'react'
import { Shield, Bell, Eye, EyeOff, Mail, Unlink, Link2, AlertTriangle, Camera, Save, Trash2, LogOut, CalendarDays, Plug } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import { PhoneInput } from 'react-international-phone'
import { isValidPhoneNumber } from 'libphonenumber-js'
import 'react-international-phone/style.css'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import type { UserInfo } from '../lib/auth'
import type { Role } from '../App'
import { changePassword, deactivateAccount, linkGoogle, requestAccountDeletion, setPassword, unlinkGoogle, updateProfile, uploadAvatar } from '../api/auth'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { PAYPAL_ENABLED } from '../lib/features'
import { SCHEDULING_COLOR, SCHEDULING_LABEL, SCHEDULING_PLACEHOLDER, SCHEDULING_PROVIDERS, schedulingProvider, validateSchedulingUrl, type SchedulingProvider } from '../lib/scheduling'

const inp = 'w-full px-3 py-2.5 rounded-lg border border-line bg-white text-[13.5px] text-ink outline-none transition-colors focus:border-[#0d9488] disabled:bg-[#f4f5f7] disabled:text-dim'

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper border border-line rounded-2xl overflow-hidden">
      <div className="px-5.5 py-4 border-b border-line flex items-center gap-2">
        <Icon size={15} className="text-ink2" />
        <div className="font-sans text-[16px] font-bold text-ink">{title}</div>
      </div>
      <div className="px-5.5 py-5">{children}</div>
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative w-9 h-5 rounded-full border-0 cursor-pointer transition-colors duration-200 shrink-0"
      style={{ background: on ? '#0d9488' : '#d1d5db' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  )
}

const GoogleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border"
      style={active
        ? { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
        : { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
      }
    >
      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />}
      {label}
    </span>
  )
}

type SettingsTab = 'profile' | 'security' | 'notifications' | 'connections'

export function UserSettings({ user, role, tone, onUserUpdate, initialTab }: { user: UserInfo; role: Role; tone: string; onUserUpdate: (updates: Partial<UserInfo>) => void; initialTab?: SettingsTab }) {
  const { t } = useTranslation('settings')
  const accountRoleLabel = user.role === 'admin' ? t('profile.admin_role') : role

  const [tab, setTab] = useState<SettingsTab>(initialTab ?? 'profile')

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'profile',       label: t('tabs.profile')       },
    { id: 'security',      label: t('tabs.security')      },
    { id: 'notifications', label: t('tabs.notifications') },
    ...(role === 'Realtor' || role === 'Owner' ? [{ id: 'connections' as const, label: 'Connections' }] : []),
  ]

  // Profile state
  const [displayName, setDisplayName] = useState(user.display_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [calendlyUrl, setCalendlyUrl] = useState(user.calendly_url ?? '')
  const [calendlyInput, setCalendlyInput] = useState('')
  const [calendlySaving, setCalendlySaving] = useState(false)
  const [pickedProvider, setPickedProvider] = useState<SchedulingProvider>('calendly')
  // Once connected, the stored URL decides the provider; the picker only matters while connecting.
  const connectedProvider = calendlyUrl ? schedulingProvider(calendlyUrl) : null
  const providerLabel = SCHEDULING_LABEL[connectedProvider ?? pickedProvider]
  const [paypalEmail, setPaypalEmail] = useState(user.paypal_email ?? '')
  const [paypalEmailInput, setPaypalEmailInput] = useState('')
  const [paypalEmailSaving, setPaypalEmailSaving] = useState(false)

  async function handleCalendlyConnect() {
    const url = validateSchedulingUrl(calendlyInput, pickedProvider)
    if (!url) {
      toast.error(pickedProvider === 'google'
        ? 'Please enter your Google Calendar appointment page link (https://calendar.google.com/calendar/appointments/... or https://calendar.app.google/...)'
        : 'Please enter a valid Calendly URL (https://calendly.com/...)')
      return
    }
    setCalendlySaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), phone: phone || undefined, calendly_url: url, paypal_email: paypalEmail.trim() || undefined })
      setCalendlyUrl(url)
      setCalendlyInput('')
      onUserUpdate({ calendly_url: url })
      toast.success(`${SCHEDULING_LABEL[pickedProvider]} connected`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect')
    } finally {
      setCalendlySaving(false)
    }
  }

  async function handleCalendlyDisconnect() {
    setCalendlySaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), phone: phone || undefined, calendly_url: undefined, paypal_email: paypalEmail.trim() || undefined })
      setCalendlyUrl('')
      setCalendlyInput('')
      onUserUpdate({ calendly_url: undefined })
      toast.success(`${providerLabel} disconnected`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setCalendlySaving(false)
    }
  }

  async function handlePaypalConnect() {
    const email = paypalEmailInput.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid PayPal email address')
      return
    }
    setPaypalEmailSaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), phone: phone || undefined, calendly_url: calendlyUrl.trim() || undefined, paypal_email: email })
      setPaypalEmail(email)
      setPaypalEmailInput('')
      onUserUpdate({ paypal_email: email })
      toast.success('PayPal email saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setPaypalEmailSaving(false)
    }
  }

  async function handlePaypalDisconnect() {
    setPaypalEmailSaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), phone: phone || undefined, calendly_url: calendlyUrl.trim() || undefined, paypal_email: undefined })
      setPaypalEmail('')
      setPaypalEmailInput('')
      onUserUpdate({ paypal_email: undefined })
      toast.success('PayPal email removed')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setPaypalEmailSaving(false)
    }
  }

  const [avatarSrc, setAvatarSrc] = useState(user.avatar_url ?? '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const initials = (displayName || user.display_name || user.email)[0].toUpperCase()

  // Security state
  const [hasPassword, setHasPassword] = useState(user.has_password !== false)
  const [hasGoogle, setHasGoogle] = useState(!!user.has_google)
  const [pwOpen, setPwOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [saving, setSaving] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [linking, setLinking] = useState(false)

  // Danger zone state
  const [deactivateOpen,  setDeactivateOpen]  = useState(false)
  const [deactivating,    setDeactivating]    = useState(false)
  const [deleteOpen,      setDeleteOpen]      = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [deleteEmail,     setDeleteEmail]     = useState('')
  const [deleteDone,      setDeleteDone]      = useState(false)

  const startLinkGoogle = useGoogleLogin({
    onSuccess: async ({ access_token }) => {
      setLinking(true)
      try {
        await linkGoogle(access_token)
        setHasGoogle(true)
        toast.success(t('security.toast_google_linked'))
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : t('security.toast_google_linked'))
      } finally {
        setLinking(false)
      }
    },
    onError: () => toast.error(t('security.err_google_failed')),
  })

  // Notifications state
  const [notifs, setNotifs] = useState({
    inquiryAlerts:  true,
    bookingUpdates: true,
    weeklyDigest:   false,
  })
  const toggleNotif = (k: keyof typeof notifs) => setNotifs(s => ({ ...s, [k]: !s[k] }))

  // Profile handlers
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarSrc(URL.createObjectURL(file))
    setAvatarUploading(true)
    try {
      const { avatar_url } = await uploadAvatar(file)
      setAvatarSrc(avatar_url)
      onUserUpdate({ avatar_url })
      toast.success(t('profile.toast_photo'))
    } catch (err: unknown) {
      setAvatarSrc(user.avatar_url ?? '')
      toast.error(err instanceof Error ? err.message : t('profile.err_upload'))
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) { toast.error(t('profile.err_name')); return }
    if (phone && !isValidPhoneNumber(phone)) { toast.error(t('profile.err_phone')); return }
    setProfileSaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), phone: phone || undefined, calendly_url: calendlyUrl.trim() || undefined, paypal_email: paypalEmail.trim() || undefined })
      onUserUpdate({ display_name: displayName.trim(), phone: phone || undefined, calendly_url: calendlyUrl.trim() || undefined, paypal_email: paypalEmail.trim() || undefined })
      toast.success(t('profile.toast_saved'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('profile.err_upload'))
    } finally {
      setProfileSaving(false)
    }
  }

  // Security handlers
  function resetPwForm() {
    setCurrent(''); setNext(''); setConfirm('')
    setShowCurrent(false); setShowNext(false)
    setPwOpen(false)
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    if (!next || !confirm) { toast.error(t('security.err_required')); return }
    if (next.length < 8) { toast.error(t('security.err_min_8')); return }
    if (next !== confirm) { toast.error(t('security.err_no_match')); return }
    if (hasPassword && !current) { toast.error(t('security.err_current')); return }
    setSaving(true)
    try {
      if (hasPassword) {
        await changePassword(current, next)
        toast.success(t('security.toast_pw_updated'))
      } else {
        await setPassword(next)
        toast.success(t('security.toast_pw_set'))
        setHasPassword(true)
      }
      resetPwForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('security.err_required'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    setDeactivating(true)
    try {
      await deactivateAccount()
      window.location.href = `${window.location.origin.replace('dashboard', 'ilovedrrealty.com') || '/'}?msg=deactivated`
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('security.danger_zone.err_deactivate'))
    } finally {
      setDeactivating(false)
      setDeactivateOpen(false)
    }
  }

  async function handleDeleteRequest() {
    setDeleting(true)
    try {
      await requestAccountDeletion()
      setDeleteOpen(false)
      setDeleteDone(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('security.danger_zone.err_delete'))
    } finally {
      setDeleting(false)
    }
  }

  async function handleUnlinkConfirm() {
    setUnlinking(true)
    try {
      await unlinkGoogle()
      toast.success(t('security.toast_google_unlinked'))
      setHasGoogle(false)
      setUnlinkOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('security.err_required'))
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">

      {unlinkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !unlinking && setUnlinkOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative bg-white rounded-2xl shadow-xl border border-line w-full max-w-sm p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 grid place-items-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <div className="text-[15px] font-bold text-ink">{t('security.unlink_modal.title')}</div>
                <div className="text-[12.5px] text-dim mt-1 leading-relaxed">
                  {t('security.unlink_modal.sub')}
                </div>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                onClick={() => setUnlinkOpen(false)}
                disabled={unlinking}
                className="px-4 py-2 rounded-xl border border-line bg-white text-[13px] font-semibold text-ink cursor-pointer hover:bg-surface transition-colors disabled:opacity-60"
              >
                {t('security.unlink_modal.cancel')}
              </button>
              <button
                type="button"
                onClick={handleUnlinkConfirm}
                disabled={unlinking}
                className="px-4 py-2 rounded-xl border-0 bg-red-600 text-white text-[13px] font-bold cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                <Unlink size={13} />
                {unlinking ? t('security.unlink_modal.confirming') : t('security.unlink_modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1.5 p-1 bg-paper border border-line rounded-xl w-fit">
        {TABS.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className="px-4 py-1.75 rounded-lg text-[12.5px] font-semibold cursor-pointer transition-all duration-150 border-0"
            style={{
              background: tab === tb.id ? tone : 'transparent',
              color: tab === tb.id ? '#fff' : 'rgba(0,0,0,.45)',
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {tab === 'profile' && (
        <Section icon={Camera} title={t('profile.title')}>
          <div className="pb-5 mb-5 border-b border-line flex items-center gap-4">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="w-16 h-16 rounded-full overflow-hidden border-2 border-line cursor-pointer bg-transparent p-0 relative group disabled:opacity-70 disabled:cursor-wait"
                title={t('profile.change_photo')}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full grid place-items-center text-white text-xl font-bold"
                    style={{ background: `linear-gradient(135deg,${tone},${tone}aa)` }}
                  >
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                  {avatarUploading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera size={16} className="text-white" />
                  }
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <div className="font-sans text-[17px] font-bold text-ink">{displayName || user.display_name}</div>
              <div className="text-[12.5px] text-dim mt-0.5">{accountRoleLabel} · {user.email}</div>
              {user.user_code != null && (
                <div className="font-mono text-[11px] text-dim/60 mt-0.5 tracking-widest">
                  #{String(user.user_code).padStart(7, '0')}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                className="mt-1.5 text-[11.5px] font-semibold border-0 bg-transparent cursor-pointer p-0 transition-opacity disabled:opacity-50"
                style={{ color: tone }}
              >
                {avatarUploading ? t('profile.uploading') : t('profile.change_photo')}
              </button>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">{t('profile.full_name')}</label>
                <input
                  className={inp}
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder={t('profile.name_ph')}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">{t('profile.phone')}</label>
                <PhoneInput
                  defaultCountry="do"
                  value={phone}
                  onChange={setPhone}
                  inputClassName="!w-full !px-3 !py-2.5 !rounded-r-lg !border-line !bg-white !text-[13.5px] !text-ink !outline-none focus:!border-[#0d9488] !h-auto"
                  countrySelectorStyleProps={{
                    buttonClassName: '!border-line !bg-white !rounded-l-lg !h-auto !px-2.5 !py-2.5',
                  }}
                  style={{ '--react-international-phone-border-radius': '0.5rem' } as React.CSSProperties}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">{t('profile.email')}</label>
                <input className={inp} value={user.email} disabled />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">{t('profile.role')}</label>
                <input className={inp} value={accountRoleLabel} disabled />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={profileSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white border-0 cursor-pointer transition-opacity disabled:opacity-60"
                style={{ background: tone }}
              >
                <Save size={13} />
                {profileSaving ? t('profile.saving') : t('profile.save')}
              </button>
            </div>
          </form>
        </Section>
      )}

      {/* ── Security tab ── */}
      {tab === 'security' && (
        <>
        <Section icon={Shield} title={t('security.title')}>
          <div className="flex flex-col divide-y divide-line">

            <div className="flex items-center justify-between py-4 first:pt-0">
              <div>
                <div className="text-[13.5px] font-semibold text-ink">{t('security.email_label')}</div>
                <div className="text-[11.5px] text-dim mt-0.5">{t('security.email_sub')}</div>
              </div>
              <span className="text-[13px] text-ink ml-6 shrink-0">{user.email}</span>
            </div>

            <div className="py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{t('security.password_label')}</div>
                  <div className="text-[11.5px] text-dim mt-0.5">
                    {hasPassword ? t('security.password_sub_set') : t('security.password_sub_add')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPwOpen(v => !v)}
                  className="ml-6 shrink-0 px-3.5 py-1.5 rounded-lg border border-line bg-white text-[12.5px] font-semibold text-ink hover:bg-surface transition-colors cursor-pointer"
                >
                  {pwOpen ? t('security.cancel') : hasPassword ? t('security.change_pw') : t('security.set_pw')}
                </button>
              </div>

              {pwOpen && (
                <form onSubmit={handlePasswordSave} className="mt-4 flex flex-col gap-3">
                  {hasPassword && (
                    <div>
                      <label className="block text-[11.5px] font-semibold text-dim uppercase tracking-wide mb-1.5">{t('security.current_pw')}</label>
                      <div className="relative">
                        <input
                          className={inp + ' pr-10'}
                          type={showCurrent ? 'text' : 'password'}
                          value={current}
                          onChange={e => setCurrent(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent cursor-pointer text-dim hover:text-ink">
                          {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-semibold text-dim uppercase tracking-wide mb-1.5">{t('security.new_pw')}</label>
                      <div className="relative">
                        <input
                          className={inp + ' pr-10'}
                          type={showNext ? 'text' : 'password'}
                          value={next}
                          onChange={e => setNext(e.target.value)}
                          placeholder={t('security.new_pw_ph')}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent cursor-pointer text-dim hover:text-ink">
                          {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold text-dim uppercase tracking-wide mb-1.5">{t('security.confirm_pw')}</label>
                      <input
                        className={inp}
                        type="password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder={t('security.confirm_pw_ph')}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={resetPwForm} className="px-4 py-2 rounded-lg border border-line bg-white text-[12.5px] font-semibold text-ink cursor-pointer hover:bg-surface transition-colors">
                      {t('security.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 rounded-lg text-[12.5px] font-bold text-white border-0 cursor-pointer transition-opacity disabled:opacity-60"
                      style={{ background: tone }}
                    >
                      {saving ? t('security.saving_pw') : hasPassword ? t('security.update_pw_btn') : t('security.set_pw_btn')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-4">
              <div className="text-[13.5px] font-semibold text-ink">{t('security.linked_accounts')}</div>
              <div className="text-[11.5px] text-dim mt-0.5 mb-3">{t('security.linked_sub')}</div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-line bg-white">
                  <div className="w-8 h-8 rounded-lg border border-line bg-surface grid place-items-center shrink-0">
                    <Mail size={14} className="text-ink2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink">{t('security.email_pw_label')}</div>
                    <div className="text-[11px] text-dim mt-0.5">
                      {hasPassword ? t('security.pw_enabled') : t('security.pw_not_configured')}
                    </div>
                  </div>
                  <StatusBadge active={hasPassword} label={hasPassword ? t('security.pw_configured') : t('security.pw_not_set')} />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl border border-line bg-white">
                  <div className="w-8 h-8 rounded-lg border border-line bg-surface grid place-items-center shrink-0">
                    <GoogleIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink">{t('security.google_label')}</div>
                    <div className="text-[11px] text-dim mt-0.5">
                      {hasGoogle ? t('security.google_connected') : t('security.google_not_linked')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasGoogle && hasPassword ? (
                      <button
                        type="button"
                        onClick={() => setUnlinkOpen(true)}
                        className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-all duration-150 cursor-pointer"
                        style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                        onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }) }}
                        onMouseLeave={e => { Object.assign((e.currentTarget as HTMLElement).style, { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }) }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current group-hover:hidden" />
                        <Unlink size={10} className="hidden group-hover:block" />
                        <span className="group-hover:hidden">{t('security.google_connected')}</span>
                        <span className="hidden group-hover:inline">{t('security.google_unlink')}</span>
                      </button>
                    ) : hasGoogle ? (
                      <StatusBadge active={true} label={t('security.google_connected')} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startLinkGoogle()}
                        disabled={linking}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
                        style={{ background: '#f8faff', color: '#2563eb', borderColor: '#bfdbfe' }}
                      >
                        <Link2 size={10} />
                        {linking ? t('security.google_linking') : t('security.google_link')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-5 mt-2 border-t border-red-100">
              <div className="text-[11px] font-bold uppercase tracking-widest text-red-400 mb-4">{t('security.danger_zone.title')}</div>
              <div className="flex flex-col gap-3">

                {/* Deactivate */}
                <div className="flex items-start justify-between gap-4 py-3 px-4 rounded-xl border border-red-100 bg-red-50/40">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink">{t('security.danger_zone.deactivate_label')}</div>
                    <div className="text-[11.5px] text-dim mt-0.5">{t('security.danger_zone.deactivate_sub')}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeactivateOpen(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-200 bg-white text-[12.5px] font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                  >
                    <LogOut size={12} />
                    {t('security.danger_zone.deactivate_btn')}
                  </button>
                </div>

                {/* Delete */}
                <div className="flex items-start justify-between gap-4 py-3 px-4 rounded-xl border border-red-200 bg-red-50/60">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-red-700">{t('security.danger_zone.delete_label')}</div>
                    <div className="text-[11.5px] text-dim mt-0.5">{t('security.danger_zone.delete_sub')}</div>
                    {deleteDone && (
                      <div className="mt-2 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        {t('security.danger_zone.delete_done')}
                      </div>
                    )}
                  </div>
                  {!deleteDone && (
                    <div className="shrink-0 flex flex-col gap-2 min-w-40">
                      <input
                        type="email"
                        value={deleteEmail}
                        onChange={e => setDeleteEmail(e.target.value)}
                        placeholder={t('security.danger_zone.delete_email_ph')}
                        className="w-full px-3 py-1.5 rounded-lg border border-red-200 bg-white text-[12px] text-ink outline-none focus:border-red-400"
                      />
                      <button
                        type="button"
                        onClick={() => setDeleteOpen(true)}
                        disabled={deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-300 bg-red-600 text-[12.5px] font-bold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={12} />
                        {t('security.danger_zone.delete_btn')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </Section>

        {/* Deactivate ConfirmModal */}
        {deactivateOpen && (
          <ConfirmModal
            title={t('security.danger_zone.deactivate_modal_title')}
            description={t('security.danger_zone.deactivate_modal_desc')}
            confirmLabel={deactivating ? t('security.danger_zone.deactivating') : t('security.danger_zone.deactivate_modal_btn')}
            variant="warning"
            loading={deactivating}
            onConfirm={handleDeactivate}
            onCancel={() => setDeactivateOpen(false)}
          />
        )}

        {/* Delete ConfirmModal */}
        {deleteOpen && (
          <ConfirmModal
            title={t('security.danger_zone.delete_modal_title')}
            description={t('security.danger_zone.delete_modal_desc')}
            confirmLabel={deleting ? t('security.danger_zone.deleting') : t('security.danger_zone.delete_modal_btn')}
            variant="danger"
            loading={deleting}
            onConfirm={handleDeleteRequest}
            onCancel={() => setDeleteOpen(false)}
          />
        )}
        </>
      )}

      {/* ── Connections tab ── */}
      {tab === 'connections' && (
        <Section icon={Plug} title="Connections">
          <div className="rounded-xl border border-line overflow-hidden">
            <div className="px-4 py-3 bg-[#f8f9fc] border-b border-line flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${SCHEDULING_COLOR[connectedProvider ?? pickedProvider]}1a` }}>
                <CalendarDays size={15} style={{ color: SCHEDULING_COLOR[connectedProvider ?? pickedProvider] }} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-ink">{connectedProvider ? providerLabel : 'Scheduling calendar'}</div>
                <div className="text-[11px] text-dim">{connectedProvider ? 'Scheduling integration' : 'Calendly or Google Calendar'}</div>
              </div>
              {calendlyUrl ? (
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block" /> Connected
                </span>
              ) : (
                <span className="ml-auto text-[11px] font-semibold text-dim bg-white border border-line px-2.5 py-1 rounded-full">Not connected</span>
              )}
            </div>
            <div className="px-4 py-3.5">
              {calendlyUrl ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-ink truncate">{calendlyUrl}</div>
                    <div className="text-[11px] text-dim mt-0.5">{role === 'Owner' ? 'Shared with clients and your assigned realtor for scheduling.' : 'Shown on your Calendar page and shared with assigned leads.'}</div>
                  </div>
                  <button
                    type="button"
                    disabled={calendlySaving}
                    onClick={handleCalendlyDisconnect}
                    className="shrink-0 text-[12px] font-semibold text-red-500 hover:text-red-700 bg-transparent border-0 cursor-pointer p-0 disabled:opacity-50"
                  >
                    {calendlySaving ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-[12px] text-dim">{role === 'Owner' ? `Add your ${providerLabel} booking link so clients and your assigned realtor can schedule meetings with you.` : `Add your ${providerLabel} booking link to display your scheduling page on the Calendar tab and share it with your assigned leads.`}</div>
                  <div className="flex gap-1.5" role="group" aria-label="Scheduling provider">
                    {SCHEDULING_PROVIDERS.map(p => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={pickedProvider === p}
                        onClick={() => setPickedProvider(p)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border ${pickedProvider === p ? '' : 'border-line bg-white text-dim'}`}
                        style={pickedProvider === p
                          ? { color: SCHEDULING_COLOR[p], background: `${SCHEDULING_COLOR[p]}14`, borderColor: SCHEDULING_COLOR[p] }
                          : undefined}
                      >
                        {SCHEDULING_LABEL[p]}
                      </button>
                    ))}
                  </div>
                  {pickedProvider === 'google' && (
                    <div className="text-[11px] text-dim leading-[1.6]">
                      In Google Calendar, create an <strong>appointment schedule</strong> (requires Google Workspace or Google One), then paste its booking page link. To show it inline on your Calendar tab, use the <em>Add to website</em> link (calendar.google.com/…); the short calendar.app.google link opens in a new tab instead.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      className={`${inp} flex-1`}
                      type="url"
                      value={calendlyInput}
                      onChange={e => setCalendlyInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCalendlyConnect()}
                      placeholder={SCHEDULING_PLACEHOLDER[pickedProvider]}
                      maxLength={500}
                    />
                    <button
                      type="button"
                      disabled={calendlySaving}
                      onClick={handleCalendlyConnect}
                      className="shrink-0 px-4 py-2 rounded-lg text-[12.5px] font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                      style={{ background: SCHEDULING_COLOR[pickedProvider] }}
                    >
                      {calendlySaving ? 'Connecting…' : 'Connect'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PayPal email — Owner only */}
          {PAYPAL_ENABLED && role === 'Owner' && (
            <div className="rounded-xl border border-line overflow-hidden mt-4">
              <div className="px-4 py-3 bg-[#f8f9fc] border-b border-line flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#003087]/10 flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.5 6.5C19.5 9.5 17.5 12 14 12H11L10 17H7L9 7H14C17 7 19.5 6.5 19.5 6.5Z" fill="#009CDE"/>
                    <path d="M7 17H4.5L6.5 7H11C14 7 16 9 16 11.5C16 14 14 16.5 11 16.5H8.5L7 17Z" fill="#003087"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-bold text-ink">PayPal Payout Email</div>
                  <div className="text-[11px] text-dim">Receive booking payments</div>
                </div>
                {paypalEmail ? (
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] inline-block" /> Connected
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-semibold text-dim bg-white border border-line px-2.5 py-1 rounded-full">Not connected</span>
                )}
              </div>
              <div className="px-4 py-3.5">
                {paypalEmail ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-ink truncate">{paypalEmail}</div>
                      <div className="text-[11px] text-dim mt-0.5">Payouts are sent the day after guest check-out.</div>
                    </div>
                    <button
                      type="button"
                      disabled={paypalEmailSaving}
                      onClick={handlePaypalDisconnect}
                      className="shrink-0 text-[12px] font-semibold text-red-500 hover:text-red-700 bg-transparent border-0 cursor-pointer p-0 disabled:opacity-50"
                    >
                      {paypalEmailSaving ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="text-[12px] text-dim">Enter your PayPal email so we can send you booking payouts automatically.</div>
                    <div className="flex gap-2">
                      <input
                        className={`${inp} flex-1`}
                        type="email"
                        value={paypalEmailInput}
                        onChange={e => setPaypalEmailInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePaypalConnect()}
                        placeholder="your@paypal.com"
                        maxLength={255}
                      />
                      <button
                        type="button"
                        disabled={paypalEmailSaving || !paypalEmailInput.trim()}
                        onClick={handlePaypalConnect}
                        className="shrink-0 px-4 py-2 rounded-lg text-[12.5px] font-bold text-white border-0 cursor-pointer bg-[#003087] disabled:opacity-50"
                      >
                        {paypalEmailSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Notifications tab ── */}
      {tab === 'notifications' && (
        <Section icon={Bell} title={t('notifications.title')}>
          <div className="flex flex-col divide-y divide-line-soft">
            {([
              { key: 'inquiryAlerts'  as const, label: t('notifications.inquiry_alerts'),  sub: t('notifications.inquiry_alerts_sub')  },
              { key: 'bookingUpdates' as const, label: t('notifications.booking_updates'), sub: t('notifications.booking_updates_sub') },
              { key: 'weeklyDigest'   as const, label: t('notifications.weekly_digest'),   sub: t('notifications.weekly_digest_sub')   },
            ]).map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{label}</div>
                  <div className="text-[11.5px] text-dim mt-0.5">{sub}</div>
                </div>
                <Toggle on={notifs[key]} onToggle={() => toggleNotif(key)} />
              </div>
            ))}
          </div>
        </Section>
      )}

    </div>
  )
}
