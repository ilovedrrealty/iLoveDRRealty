'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Download, Image } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { startFloorPlanDownload, type FloorPlanAsset } from '../../../../packages/listing-floor-plans'
import { getPublishedFloorPlan, readPublishedFloorPlan } from '../api/listingFloorPlans'

const button = 'inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-sea disabled:opacity-50'

export function ListingFloorPlan({ listingId }: { listingId: string }) {
  const { t } = useTranslation('property_detail', { keyPrefix: 'floor_plan' })
  const [asset, setAsset] = useState<FloorPlanAsset | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [failed, setFailed] = useState(false)
  const request = useRef<AbortController | null>(null)
  const transfer = useRef<(() => void) | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const previewId = useId()

  useEffect(() => {
    const controller = new AbortController()
    getPublishedFloorPlan(listingId, controller.signal).then(plan => {
      if (!controller.signal.aborted) setAsset(plan)
    }).catch(() => {})
    return () => {
      controller.abort()
      request.current?.abort()
      transfer.current?.()
    }
  }, [listingId])

  function closePreview(returnFocus = false) {
    transfer.current?.()
    transfer.current = null
    setPreview(null)
    if (returnFocus) trigger.current?.focus()
  }

  async function open(plan: FloorPlanAsset) {
    if (request.current) return
    if (preview) {
      closePreview()
      return
    }
    const controller = new AbortController()
    request.current = controller
    setWorking(true)
    setFailed(false)
    closePreview()
    try {
      const blob = await readPublishedFloorPlan(listingId, plan, controller.signal)
      if (controller.signal.aborted) return
      if (!blob) {
        setAsset(null)
        setFailed(true)
      } else if (plan.content_type === 'application/pdf') {
        transfer.current = startFloorPlanDownload(blob, plan, 'floor-plan')
      } else {
        const url = URL.createObjectURL(blob)
        transfer.current = () => URL.revokeObjectURL(url)
        setPreview(url)
      }
    } catch {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      if (!controller.signal.aborted) {
        request.current = null
        setWorking(false)
      }
    }
  }

  if (!asset && !failed) return null
  const pdf = asset?.content_type === 'application/pdf'

  return <section className="min-w-0 space-y-2" aria-label={t('title')}>
    {asset && <button ref={trigger} type="button" className={button} disabled={working}
      aria-controls={pdf ? undefined : previewId} aria-expanded={pdf ? undefined : Boolean(preview)}
      onClick={() => void open(asset)}>
      {pdf ? <Download size={16} aria-hidden="true" /> : <Image size={16} aria-hidden="true" />}
      {t(pdf ? 'download' : 'view')}
    </button>}
    {working && <p role="status" className="text-sm text-ink2">{t('loading')}</p>}
    {failed && <p role="status" className="text-sm text-ink2">{t('unavailable')}</p>}
    {asset && !pdf && <div id={previewId} hidden={!preview} className="min-w-0 space-y-2">
      {preview && <>
        <img className="max-h-[75vh] w-full rounded-lg border border-line bg-white object-contain" src={preview} alt={t('image')} />
        <button type="button" className={button} onClick={() => closePreview(true)}>{t('close')}</button>
      </>}
    </div>}
  </section>
}
