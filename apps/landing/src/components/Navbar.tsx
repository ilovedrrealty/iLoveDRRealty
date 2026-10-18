'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNav } from '../hooks/useNav'
import { NAV_ITEMS } from '../design'
import { useEffect, useId, useRef, useState } from 'react'
import { Menu, X, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react'
import { getMe, logout } from '../api/auth'
import { useTranslation } from 'react-i18next'
import { isStandalonePage } from '../lib/constants'

const _dashRaw = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://app.ilovedrrealty.com'
const DASHBOARD_URL = _dashRaw.startsWith('http') ? _dashRaw : `https://${_dashRaw}`

type Me = { display_name: string; email: string; avatar_url: string | null }

export function Logo({ size = 42 }: { size?: number }) {
  return (
    <Link href="/" className="p-0 leading-none block">
      <img
        src="/iLoveDRRealty_Dark.png"
        alt="I Love DR Realty"
        className="block w-auto"
        style={{ height: size }}
        width={152}
        height={74}
      />
    </Link>
  )
}

function Avatar({ me, size = 32 }: { me: Me; size?: number }) {
  const [imgError, setImgError] = useState(false)

  if (me.avatar_url && !imgError) {
    return (
      <img
        src={me.avatar_url}
        alt={me.display_name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full grid place-items-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.375, background: '#e10f1f' }}
    >
      {me.display_name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function LanguageToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language.startsWith('es') ? 'es' : 'en'

  function pick(lng: string) {
    i18n.changeLanguage(lng)
    localStorage.setItem('ildr_lang', lng)
  }

  return (
    <div className="flex rounded-lg border border-line overflow-hidden text-[11px] font-bold shrink-0">
      {(['en', 'es'] as const).map(lng => (
        <button
          key={lng}
          onClick={() => pick(lng)}
          className="px-2.5 py-1.5 transition-colors cursor-pointer"
          style={{
            background: current === lng ? '#00102e' : 'white',
            color:      current === lng ? 'white'   : '#64748b',
          }}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function UserDropdown({ me, onClose }: { me: Me; onClose: () => void }) {
  const { t } = useTranslation('common')

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    onClose()
    window.location.reload()
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-line rounded-2xl shadow-[0_8px_30px_-8px_rgba(0,16,46,.2)] z-50 overflow-hidden py-1">
      <div className="px-4 py-3 border-b border-line">
        <div className="font-sans text-[13px] font-semibold text-ink truncate">{me.display_name}</div>
        <div className="font-sans text-[11.5px] text-ink2 truncate">{me.email}</div>
      </div>
      <a
        href={DASHBOARD_URL}
        onClick={onClose}
        className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-paper2 transition-colors font-sans"
      >
        <LayoutDashboard size={15} className="text-ink2" />
        {t('auth.dashboard')}
      </a>
      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-coral hover:bg-paper2 transition-colors cursor-pointer bg-transparent border-none font-sans text-left"
      >
        <LogOut size={15} className="text-coral" />
        {t('auth.logout')}
      </button>
    </div>
  )
}

function ResourcesNavigation({ active, mobile = false, onNavigate }: {
  active: boolean
  mobile?: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open || mobile) return
    function closeOutside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open, mobile])

  const links = [
    { href: '/blog/', label: t('resources.articles') },
    { href: '/buying/', label: t('resources.buying_guide') },
    { href: '/calculator/', label: t('nav.calculator') },
  ]

  return (
    <div
      ref={wrapperRef}
      className={mobile ? 'w-full' : 'relative'}
      onBlur={event => {
        if (!mobile && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
          toggleRef.current?.focus()
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className={mobile
          ? `w-full flex items-center justify-between gap-1 font-sans text-sm cursor-pointer border-none py-3 px-3 rounded-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${active ? 'font-bold text-ink bg-paper2' : 'font-medium text-ink2 bg-transparent'}`
          : `flex items-center gap-1 font-sans text-3.25 cursor-pointer bg-transparent border-x-0 border-t-0 px-2.25 py-2 whitespace-nowrap transition-colors border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${active ? 'font-bold text-ink border-coral' : 'font-medium text-ink2 border-transparent'}`}
      >
        {t('nav.blog')}
        <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={panelId}
          className={mobile
            ? 'ml-3 mt-1 mb-2 border-l border-line pl-2 flex flex-col'
            : 'absolute top-full right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white border border-line rounded-2xl shadow-[0_8px_30px_-8px_rgba(0,16,46,.2)] p-2 z-50 flex flex-col'}
        >
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => { setOpen(false); onNavigate?.() }}
              className="font-sans text-[13px] font-semibold text-ink rounded-xl px-3 py-3 hover:bg-paper2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const go = useNav()
  const { t } = useTranslation('common')
  const current = !pathname || pathname === '/' ? 'landing' : pathname.replace(/^\/|\/$/g, '')
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getMe().then(setMe).catch(() => {})
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  async function handleMobileLogout() {
    try { await logout() } catch { /* ignore */ }
    setOpen(false)
    window.location.reload()
  }

  if (isStandalonePage(pathname)) return null

  return (
    <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-3.5 border-b border-line">
      <div className="max-w-335 mx-auto px-4 sm:px-7 h-24 flex items-center gap-3.5">

        <div className="flex-1 flex justify-start">
          <Logo size={48} />
        </div>

        {/* Desktop nav */}
        <nav aria-label={t('nav.main_navigation')} className="hidden min-[1280px]:flex flex-none gap-1 items-center">
          {NAV_ITEMS.map(([key]) => {
            const active = current === key
            if (key === 'blog') return <ResourcesNavigation key={key} active={active || current === 'calculator'} />
            return (
              <Link
                key={key}
                href={key === 'landing' ? '/' : `/${key}/`}
                aria-current={active ? 'page' : undefined}
                className={`font-sans text-3.25 cursor-pointer bg-transparent border-x-0 border-t-0 px-2.25 py-2 whitespace-nowrap transition-all duration-150 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                  active
                    ? 'font-bold text-ink border-coral'
                    : 'font-medium text-ink2 border-transparent'
                }`}
              >
                {t(`nav.${key}`)}
              </Link>
            )
          })}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden min-[1280px]:flex flex-1 gap-2 items-center justify-end">
          <LanguageToggle />
          {me ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0"
              >
                <Avatar me={me} size={32} />
                <span className="font-sans text-[13.5px] font-semibold text-ink truncate max-w-36">
                  {me.display_name.split(' ')[0]}
                </span>
              </button>
              {dropdownOpen && (
                <UserDropdown me={me} onClose={() => setDropdownOpen(false)} />
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => go('login')}
                className="font-sans text-[13.5px] font-semibold cursor-pointer text-ink bg-transparent border-none py-2.25 px-3.5"
              >
                {t('auth.login')}
              </button>
              <button
                onClick={() => go('signup')}
                className="font-sans text-[13.5px] font-semibold cursor-pointer text-white bg-coral border border-coral py-2.25 px-4.5 rounded-full transition-colors duration-150"
              >
                {t('auth.signup')}
              </button>
            </>
          )}
        </div>

        {/* Mobile: avatar/name or Sign up + hamburger */}
        <div className="flex min-[1280px]:hidden items-center gap-2">
          {me ? (
            <div className="flex items-center gap-1.5">
              <Avatar me={me} size={28} />
              <span className="font-sans text-[12.5px] font-semibold text-ink max-w-24 truncate">
                {me.display_name.split(' ')[0]}
              </span>
            </div>
          ) : (
            <button
              onClick={() => go('signup')}
              className="font-sans text-[13px] font-semibold cursor-pointer text-white bg-coral border border-coral py-2 px-4 rounded-full transition-colors duration-150"
            >
              {t('auth.signup')}
            </button>
          )}
          <button
            onClick={() => setOpen(v => !v)}
            aria-label={t(open ? 'nav.close_menu' : 'nav.open_menu')}
            aria-expanded={open}
            aria-controls="main-mobile-navigation"
            className="cursor-pointer bg-transparent border-none p-1.5 text-ink flex items-center"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav id="main-mobile-navigation" aria-label={t('nav.main_navigation')} className="min-[1280px]:hidden bg-white border-t border-line px-4 py-3 flex flex-col max-h-[calc(100dvh-6rem)] overflow-y-auto">
          {NAV_ITEMS.map(([key]) => {
            const active = current === key
            if (key === 'blog') return <ResourcesNavigation key={key} active={active || current === 'calculator'} mobile onNavigate={() => setOpen(false)} />
            return (
              <Link
                key={key}
                href={key === 'landing' ? '/' : `/${key}/`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`font-sans text-sm cursor-pointer bg-transparent border-none py-3 px-3 rounded-xl text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                  active ? 'font-bold text-ink bg-paper2' : 'font-medium text-ink2'
                }`}
              >
                {t(`nav.${key}`)}
              </Link>
            )
          })}
          <div className="h-px bg-line my-2" />
          {me ? (
            <>
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-paper2 mb-1">
                <Avatar me={me} size={32} />
                <div>
                  <div className="font-sans text-[13.5px] font-semibold text-ink leading-tight">{me.display_name}</div>
                  <div className="font-sans text-[11.5px] text-ink2">{me.email}</div>
                </div>
              </div>
              <a
                href={DASHBOARD_URL}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-ink hover:bg-paper2 transition-colors font-sans"
              >
                <LayoutDashboard size={15} className="text-ink2" />
                {t('auth.dashboard')}
              </a>
              <button
                onClick={handleMobileLogout}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-coral hover:bg-paper2 transition-colors cursor-pointer bg-transparent border-none font-sans text-left mb-1"
              >
                <LogOut size={15} className="text-coral" />
                {t('auth.logout')}
              </button>
            </>
          ) : (
            <button
              onClick={() => { go('login'); setOpen(false) }}
              className="font-sans text-sm font-semibold cursor-pointer text-ink bg-transparent border border-line py-3 px-4 rounded-xl text-left mb-2"
            >
              {t('auth.login')}
            </button>
          )}
          <div className="flex justify-start px-3 pb-1 pt-1">
            <LanguageToggle />
          </div>
        </nav>
      )}
    </div>
  )
}
