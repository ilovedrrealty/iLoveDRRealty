'use client'
import { useWebsiteSettings } from '../components/WebsiteSettingsProvider'
import { localizedValue } from '../../../../packages/website-settings/src'
import { useNav } from '../hooks/useNav'
import { useTranslation } from 'react-i18next'
import { PRINCIPALS, REALTORS, TEAM_STATS } from '../data/teamData'


export default function Team() {
  const go = useNav()
  const { t, i18n } = useTranslation('team')
  const { teamMembers } = useWebsiteSettings()
  const statsLabels = t('stats', { returnObjects: true }) as string[]
  const bios = t('principals.bios', { returnObjects: true }) as Array<{ role: string; bio: string }>
  const realtorBios = t('realtors.bios', { returnObjects: true }) as Array<{ role: string; bio: string; region: string }>
  const custom = teamMembers.length > 0
  const principalItems = custom
    ? teamMembers.filter(member => member.enabled && member.section === 'leadership').map(member => ({
        id: member.id, name: member.name, img: member.photo, bgPos: PRINCIPALS.find(person => person.id === member.id)?.bgPos ?? 'center top',
        role: localizedValue(member.role, i18n.language), bio: localizedValue(member.description, i18n.language),
      }))
    : PRINCIPALS.map((member, index) => ({ ...member, role: bios[index]?.role ?? member.role, bio: bios[index]?.bio ?? member.bio }))
  const realtorItems = custom
    ? teamMembers.filter(member => member.enabled && member.section === 'realtor').map(member => ({
        id: member.id, name: member.name, img: member.photo, bgPos: REALTORS.find(person => person.id === member.id)?.bgPos ?? 'center top',
        langs: REALTORS.find(person => person.id === member.id)?.langs ?? '',
        region: realtorBios[REALTORS.findIndex(person => person.id === member.id)]?.region ?? '',
        role: localizedValue(member.role, i18n.language), bio: localizedValue(member.description, i18n.language),
      }))
    : REALTORS.map((member, index) => ({ ...member, role: realtorBios[index]?.role ?? member.role,
        bio: realtorBios[index]?.bio ?? member.bio, region: realtorBios[index]?.region ?? member.region }))


  return (
    <div>
      {/* ── HERO ── */}
      <div className="bg-ink pt-14 px-4 sm:px-6 pb-12.5 relative overflow-hidden">
        <div className="absolute -top-30 -right-20 w-90 h-90 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(240,168,0,.15) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-25 -left-20 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(225,15,31,.10) 0%, transparent 70%)' }} />
        <div className="max-w-275 mx-auto text-center relative">
          <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-gold">{t('hero.eyebrow')}</div>
          <h1 className="font-sans text-[clamp(30px,4.5vw,48px)] font-bold text-paper mt-3 mb-2.5 tracking-[-.02em]">
            {t('hero.heading_pre')}{' '}
            <span className="italic text-gold">{t('hero.heading_em')}</span>
          </h1>
          <p className="font-sans text-4 text-white/70 leading-[1.6] max-w-155 mx-auto">
            {t('hero.sub')}
          </p>
          <div className="mt-5.5 flex justify-center gap-7 flex-wrap">
            {TEAM_STATS.map(([n, , color], i) => (
              <div key={i}>
                <div className="font-sans text-6.5 font-bold" style={{ color }}>{i === 0 ? principalItems.length : n}</div>
                <div className="font-sans text-2.75 text-white/55 tracking-[.06em] uppercase mt-0.5">{statsLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRINCIPALS ── */}
      <div hidden={!principalItems.length} className="max-w-295 mx-auto pt-12.5 px-4 sm:px-6 pb-5">
        <div className="mb-6">
          <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-coral">{t('principals.eyebrow')}</div>
          <h2 className="font-sans text-6.5 font-semibold text-ink mt-2 mb-1.5">{t('principals.heading')}</h2>
          <p className="font-sans text-sm text-dim max-w-145 leading-[1.55]">
            {t('principals.sub')}
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(245px,1fr))] gap-5">
          {principalItems.map((p, i) => (
            <div key={i} className="bg-paper border border-line-soft rounded-2xl overflow-hidden shadow-[rgba(0,16,46,.25)_0px_8px_24px_-18px]">
              <div className="relative h-55" style={{ backgroundImage: `url(${p.img})`, backgroundSize: 'cover', backgroundPosition: p.bgPos ?? 'center top' }}>
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(0deg,rgba(0,16,46,.4),transparent 55%)' }} />
                <div className="absolute top-3 left-3 bg-gold text-ink py-1 px-2.5 rounded-full text-2.5 font-extrabold tracking-[.12em] uppercase">
                  {t('principals.badge')}
                </div>
              </div>
              <div className="py-4.5 px-5 font-sans">
                <h3 className="font-sans text-4.75 font-bold text-ink leading-[1.15]">{p.name}</h3>
                <div className="text-2.75 font-bold tracking-[.08em] uppercase text-coral mt-1">{p.role}</div>
                <p className="text-3.25 text-ink2 leading-[1.55] mt-3">{p.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── REALTOR AGENTS ── */}
      <div hidden={!realtorItems.length} className="max-w-295 mx-auto pt-10 px-4 sm:px-6 pb-5">
        <div className="mb-6">
          <div className="font-sans text-2.75 font-bold tracking-[.22em] uppercase text-coral">{t('realtors.eyebrow')}</div>
          <h2 className="font-sans text-6.5 font-semibold text-ink mt-2 mb-1.5">{t('realtors.heading')}</h2>
          <p className="font-sans text-sm text-dim max-w-145 leading-[1.55]">
            {t('realtors.sub')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {realtorItems.map((r, i) => (
            <div key={r.id} className="bg-paper border border-line-soft rounded-2xl overflow-hidden shadow-[rgba(0,16,46,.25)_0px_8px_24px_-18px]">
              <div className="relative h-55" style={{ backgroundImage: `url(${r.img})`, backgroundSize: 'cover', backgroundPosition: r.bgPos ?? 'center top' }}>
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(0deg,rgba(0,16,46,.4),transparent 55%)' }} />
                <div className="absolute top-3 left-3 bg-coral text-white py-1 px-2.5 rounded-full text-2.5 font-extrabold tracking-[.12em] uppercase">
                  {t('realtors.badge')}
                </div>
              </div>
              <div className="py-4.5 px-5 font-sans">
                <h3 className="font-sans text-4.75 font-bold text-ink leading-[1.15]">{r.name}</h3>
                <div className="text-2.75 font-bold tracking-[.08em] uppercase text-coral mt-1">{r.role}</div>
                <p className="text-3.25 text-ink2 leading-[1.55] mt-3">{r.bio}</p>
                {(r.langs || r.region) && <div className="text-2.75 text-dim mt-3.5 pt-3 border-t border-line-soft">{[r.langs, r.region].filter(Boolean).join(' · ')}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* ── BOTTOM CTA ── */}
      <div className="max-w-275 mx-auto py-14 px-4 sm:px-6">
        <div className="bg-ink rounded-3xl py-9 px-6 sm:py-11 sm:px-12 flex items-center justify-between flex-wrap gap-6 relative overflow-hidden">
          <div className="absolute -top-15 -right-15 w-60 h-60 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(240,168,0,.12) 0%, transparent 70%)' }} />
          <div className="relative">
            <div className="font-sans text-6.5 font-semibold text-paper leading-[1.2] mb-2">
              {t('cta.heading')}
            </div>
            <p className="font-sans text-sm text-white/65 leading-[1.55] max-w-115">
              {t('cta.sub')}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap relative">
            <button onClick={() => go('contact')}
              className="font-sans text-sm font-semibold cursor-pointer py-3 px-5.5 rounded-full bg-coral text-white border-none">
              {t('cta.talk')}
            </button>
            <button onClick={() => go('search')}
              className="font-sans text-sm font-semibold cursor-pointer py-3 px-5.5 rounded-full bg-white/8 text-paper border border-white/18">
              {t('cta.browse')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
