import { useEffect, useState } from 'react'
import { Heart, MapPin, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardLink, StatusPill, fmtPrice } from '../../components/dashboard/shared'
import { getMySavedHomes, unsaveHome, type SavedHome } from '../../api/savedHomes'

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'https://ilovedrrealty.com'

export function SavedHomes({ openShortlists }: { openShortlists?: () => void } = {}) {
  const { t } = useTranslation('buyer')
  const { t: tNav } = useTranslation('nav')
  const [homes, setHomes] = useState<SavedHome[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    getMySavedHomes()
      .then(setHomes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleUnsave = async (listingId: string) => {
    setRemoving(listingId)
    try {
      await unsaveHome(listingId)
      setHomes(prev => prev.filter(h => h.listing_id !== listingId))
    } catch {
      /* ignore */
    } finally {
      setRemoving(null)
    }
  }

  return (
    <>
    {openShortlists && <button type="button" className="mb-3 min-h-11 rounded-lg border border-line bg-paper px-3 py-2 text-sm font-semibold text-sea"
      onClick={openShortlists}>{tNav('shortlists')}</button>}
    <Card
      title={<><Heart size={14} />{t('saved_homes_page.title', { count: homes.length })}</>}
      action={<CardLink>{t('saved_homes_page.browse_more')}</CardLink>}
      padded={false}
    >
      {loading ? (
        <div className="px-5 py-8 text-[13px] text-dim text-center">Loading…</div>
      ) : homes.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#e10f1f18' }}>
            <Heart size={20} style={{ color: '#e10f1f' }} />
          </div>
          <div className="text-center">
            <div className="text-[13.5px] font-semibold text-ink mb-0.5">{t('saved_homes_page.empty_title')}</div>
            <div className="text-[11.5px] text-dim">{t('saved_homes_page.empty_sub')}</div>
          </div>
          <a
            href={`${LANDING_URL}/search`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 py-1.75 px-4 rounded-full text-[12.5px] font-bold cursor-pointer border-0 text-white"
            style={{ background: '#e10f1f' }}
          >
            <Search size={13} strokeWidth={2.5} /> {t('saved_homes.browse')}
          </a>
        </div>
      ) : (
        <div className="px-3 sm:px-5">
          {homes.map((h, i) => {
            const thumb = h.listing_images[0]
            return (
              <div key={h.id} className={`flex items-center gap-3 py-3 ${i < homes.length - 1 ? 'border-b border-line' : ''}`}>
                {thumb ? (
                  <div className="w-13 h-10 rounded-lg shrink-0 bg-cover bg-center" style={{ backgroundImage: `url(${thumb})` }} />
                ) : (
                  <div className="w-13 h-10 rounded-lg shrink-0 bg-paper2 border border-line" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-ink truncate">
                    {h.listing_title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                  </div>
                  <div className="text-[11px] text-dim mt-0.5 flex items-center gap-1">
                    <MapPin size={10} className="shrink-0" />
                    {h.listing_location}
                    {h.listing_bedrooms != null && ` · ${h.listing_bedrooms}bd`}
                    {h.listing_bathrooms != null && ` · ${h.listing_bathrooms}ba`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-[13px] font-bold text-ink">{fmtPrice(h.listing_price)}</div>
                  <StatusPill label={h.listing_transaction === 'rent' ? t('saved_homes_page.for_rent') : t('saved_homes_page.for_sale')} />
                </div>
                <button
                  onClick={() => handleUnsave(h.listing_id)}
                  disabled={removing === h.listing_id}
                  className="ml-1 p-1.5 rounded-full text-dim hover:text-coral hover:bg-coral/10 transition-colors cursor-pointer bg-transparent border-0 disabled:opacity-40"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
    </>
  )
}
