import { useEffect, useRef, useState } from 'react'
import { Bell, Shield, Eye, EyeOff, Mail, Unlink, Link2, AlertTriangle, Camera, Save } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import { PhoneInput } from 'react-international-phone'
import { isValidPhoneNumber } from 'libphonenumber-js'
import 'react-international-phone/style.css'
import toast from 'react-hot-toast'
import type { UserInfo } from '../../lib/auth'
import { changePassword, linkGoogle, setPassword, unlinkGoogle, updateProfile, uploadAvatar } from '../../api/auth'
import { getPlatformSettings, updatePlatformSettings } from '../../api/admin'
import { TONE } from './shared'

const inp = 'w-full px-3 py-2.5 rounded-lg border border-line bg-white text-[13.5px] text-ink outline-none transition-colors focus:border-[#0d9488] disabled:bg-[#f4f5f7] disabled:text-dim'

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

function UnlinkGoogleModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
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
            <div className="text-[15px] font-bold text-ink">Unlink Google account?</div>
            <div className="text-[12.5px] text-dim mt-1 leading-relaxed">
              You'll no longer be able to sign in with Google. Make sure you remember your email and password before continuing.
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-line bg-white text-[13px] font-semibold text-ink cursor-pointer hover:bg-surface transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl border-0 bg-red-600 text-white text-[13px] font-bold cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            <Unlink size={13} />
            {loading ? 'Unlinking…' : 'Yes, unlink'}
          </button>
        </div>
      </div>
    </div>
  )
}

type AdminTab = 'profile' | 'platform' | 'security'

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'profile',  label: 'Profile'  },
  { id: 'platform', label: 'Platform' },
  { id: 'security', label: 'Security' },
]

export function AdminSettings({ user, onUserUpdate }: { user: UserInfo; onUserUpdate: (updates: Partial<UserInfo>) => void }) {
  const [tab, setTab] = useState<AdminTab>('profile')

  // Profile state
  const [displayName, setDisplayName] = useState(user.display_name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [avatarSrc, setAvatarSrc] = useState(user.avatar_url ?? '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const initials = (displayName || user.display_name || user.email)[0].toUpperCase()

  // Platform settings (DB-backed)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [savingNotifyEmail, setSavingNotifyEmail] = useState(false)
  useEffect(() => {
    getPlatformSettings().then(s => setNotifyEmail(s.notify_email || '')).catch(() => {})
  }, [])
  async function handleSaveNotifyEmail(e: React.FormEvent) {
    e.preventDefault()
    setSavingNotifyEmail(true)
    try {
      await updatePlatformSettings({ notify_email: notifyEmail })
      toast.success('Notification email saved')
    } catch {
      toast.error('Failed to save notification email')
    } finally {
      setSavingNotifyEmail(false)
    }
  }

  // Account security state
  const [hasPassword, setHasPassword] = useState(user.has_password !== false)
  const [hasGoogle, setHasGoogle] = useState(!!user.has_google)
  const [pwOpen, setPwOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [linking, setLinking] = useState(false)

  const startLinkGoogle = useGoogleLogin({
    onSuccess: async ({ access_token }) => {
      setLinking(true)
      try {
        await linkGoogle(access_token)
        setHasGoogle(true)
        toast.success('Google account linked')
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to link Google')
      } finally {
        setLinking(false)
      }
    },
    onError: () => toast.error('Google sign-in failed'),
  })

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
      toast.success('Profile picture updated')
    } catch (err: unknown) {
      setAvatarSrc(user.avatar_url ?? '')
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) { toast.error('Full name is required'); return }
    if (phone && !isValidPhoneNumber(phone)) { toast.error('Enter a valid phone number'); return }
    setProfileSaving(true)
    try {
      await updateProfile({ display_name: displayName.trim(), phone: phone || undefined, calendly_url: user.calendly_url || undefined, paypal_email: user.paypal_email || undefined })
      onUserUpdate({ display_name: displayName.trim(), phone: phone || undefined })
      toast.success('Profile saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  // Password handlers
  function resetPwForm() {
    setCurrent(''); setNext(''); setConfirm('')
    setShowCurrent(false); setShowNext(false)
    setPwOpen(false)
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    if (!next || !confirm) { toast.error('All fields are required'); return }
    if (next.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (next !== confirm) { toast.error('Passwords do not match'); return }
    if (hasPassword && !current) { toast.error('Current password is required'); return }
    setSavingPw(true)
    try {
      if (hasPassword) {
        await changePassword(current, next)
        toast.success('Password updated')
      } else {
        await setPassword(next)
        toast.success('Password set — you can now sign in with email')
        setHasPassword(true)
      }
      resetPwForm()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSavingPw(false)
    }
  }

  async function handleUnlinkConfirm() {
    setUnlinking(true)
    try {
      await unlinkGoogle()
      toast.success('Google account unlinked')
      setHasGoogle(false)
      setUnlinkOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink Google')
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {unlinkOpen && (
        <UnlinkGoogleModal
          onConfirm={handleUnlinkConfirm}
          onCancel={() => !unlinking && setUnlinkOpen(false)}
          loading={unlinking}
        />
      )}

      {/* Tab bar */}
      <div className="flex gap-1.5 p-1 bg-paper border border-line rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-1.75 rounded-lg text-[12.5px] font-semibold cursor-pointer transition-all duration-150 border-0"
            style={{
              background: tab === t.id ? TONE : 'transparent',
              color: tab === t.id ? '#fff' : 'rgba(0,0,0,.45)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {tab === 'profile' && (
        <div className="max-w-2xl bg-paper border border-line rounded-2xl overflow-hidden">
          <div className="px-5.5 py-4 border-b border-line flex items-center gap-2">
            <Camera size={15} className="text-ink2" />
            <div className="font-sans text-[16px] font-bold text-ink">Profile</div>
          </div>
          <div className="px-5.5 py-5">
            {/* Avatar + identity */}
            <div className="pb-5 mb-5 border-b border-line flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading}
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-line cursor-pointer bg-transparent p-0 relative group disabled:opacity-70 disabled:cursor-wait"
                  title="Change profile picture"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full grid place-items-center text-white text-xl font-bold"
                      style={{ background: `linear-gradient(135deg,${TONE},${TONE}aa)` }}
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
                <div className="text-[12.5px] text-dim mt-0.5">Admin · {user.email}</div>
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
                  style={{ color: TONE }}
                >
                  {avatarUploading ? 'Uploading…' : 'Change photo'}
                </button>
              </div>
            </div>

            {/* Editable form */}
            <form onSubmit={handleProfileSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">Full name</label>
                  <input
                    className={inp}
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">Phone</label>
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
                  <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">Email</label>
                  <input className={inp} value={user.email} disabled />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">Role</label>
                  <input className={inp} value="Admin" disabled />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white border-0 cursor-pointer transition-opacity disabled:opacity-60"
                  style={{ background: TONE }}
                >
                  <Save size={13} />
                  {profileSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Platform tab ── */}
      {tab === 'platform' && (
        <div className="max-w-2xl bg-paper border border-line rounded-2xl overflow-hidden">
          <div className="px-5.5 py-4 border-b border-line flex items-center gap-2">
            <Mail size={15} className="text-ink2" />
            <div className="font-sans text-[16px] font-bold text-ink">Lead notification email</div>
          </div>
          <form onSubmit={handleSaveNotifyEmail} className="px-5.5 py-5 flex flex-col gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-dim uppercase tracking-wide mb-1.5">
                Send new lead alerts to
              </label>
              <input
                type="email"
                multiple
                className={inp}
                value={notifyEmail}
                onChange={e => setNotifyEmail(e.target.value)}
                placeholder="e.g. first@example.com, second@example.com"
                maxLength={200}
              />
              <p className="text-[11.5px] text-dim mt-1.5">Separate multiple email addresses with commas. Leave empty to use the configured default.</p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingNotifyEmail}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white border-0 cursor-pointer transition-opacity disabled:opacity-60"
                style={{ background: TONE }}
              >
                <Save size={13} />
                {savingNotifyEmail ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Security tab ── */}
      {tab === 'security' && (
        <div className="max-w-2xl bg-paper border border-line rounded-2xl overflow-hidden">
          <div className="px-5.5 py-4 border-b border-line flex items-center gap-2">
            <Shield size={15} className="text-ink2" />
            <div className="font-sans text-[16px] font-bold text-ink">Account security</div>
          </div>

          <div className="px-5.5 py-5 flex flex-col divide-y divide-line">

            {/* Password row */}
            <div className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-ink">Password</div>
                  <div className="text-[11px] text-dim mt-0.5">
                    {hasPassword ? 'Update your current password.' : 'Add a password to sign in with email.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPwOpen(v => !v)}
                  className="ml-4 shrink-0 px-3 py-1.5 rounded-lg border border-line bg-white text-[12px] font-semibold text-ink hover:bg-surface transition-colors cursor-pointer"
                >
                  {pwOpen ? 'Cancel' : hasPassword ? 'Change' : 'Set Password'}
                </button>
              </div>

              {pwOpen && (
                <form onSubmit={handlePasswordSave} className="mt-3 flex flex-col gap-2.5">
                  {hasPassword && (
                    <div className="relative">
                      <input
                        className={inp + ' pr-10'}
                        type={showCurrent ? 'text' : 'password'}
                        value={current}
                        onChange={e => setCurrent(e.target.value)}
                        placeholder="Current password"
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent cursor-pointer text-dim hover:text-ink">
                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      className={inp + ' pr-10'}
                      type={showNext ? 'text' : 'password'}
                      value={next}
                      onChange={e => setNext(e.target.value)}
                      placeholder="New password (min. 8 characters)"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent cursor-pointer text-dim hover:text-ink">
                      {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <input
                    className={inp}
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                  <div className="flex justify-end gap-2 pt-0.5">
                    <button type="button" onClick={resetPwForm} className="px-3.5 py-1.5 rounded-lg border border-line bg-white text-[12px] font-semibold text-ink cursor-pointer hover:bg-surface transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingPw}
                      className="px-4 py-1.5 rounded-lg border-0 cursor-pointer text-[12px] font-bold text-white flex items-center gap-2 transition-opacity disabled:opacity-60"
                      style={{ background: TONE }}
                    >
                      {savingPw ? 'Saving…' : hasPassword ? 'Update' : 'Set Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Linked accounts */}
            <div className="pt-4">
              <div className="text-[13px] font-semibold text-ink mb-2.5">Linked accounts</div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-line bg-white">
                  <div className="w-7 h-7 rounded-lg border border-line bg-surface grid place-items-center shrink-0">
                    <Mail size={12} className="text-ink2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink">Email &amp; Password</div>
                    <div className="text-[10.5px] text-dim">{hasPassword ? 'Enabled' : 'Not configured'}</div>
                  </div>
                  <StatusBadge active={hasPassword} label={hasPassword ? 'Configured' : 'Not set up'} />
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-line bg-white">
                  <div className="w-7 h-7 rounded-lg border border-line bg-surface grid place-items-center shrink-0">
                    <GoogleIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink">Google</div>
                    <div className="text-[10.5px] text-dim">{hasGoogle ? 'Connected' : 'Not linked'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
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
                        <span className="group-hover:hidden">Connected</span>
                        <span className="hidden group-hover:inline">Unlink</span>
                      </button>
                    ) : hasGoogle ? (
                      <StatusBadge active={true} label="Connected" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startLinkGoogle()}
                        disabled={linking}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
                        style={{ background: '#f8faff', color: '#2563eb', borderColor: '#bfdbfe' }}
                      >
                        <Link2 size={10} />
                        {linking ? 'Linking…' : 'Link Google'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

