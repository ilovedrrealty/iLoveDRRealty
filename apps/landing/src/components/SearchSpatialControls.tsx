'use client'

import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleF, MarkerF, PolygonF, PolylineF } from '@react-google-maps/api'
import type { SpatialPoint, SpatialSearch } from '../data/spatialSearch'

export type SpatialDraft =
  | { kind: 'polygon'; vertices: SpatialPoint[] }
  | { kind: 'radius'; center: SpatialPoint | null; km: string }

const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral'
const toolButton = `${button} border-line bg-white text-ink`
const primaryButton = `${button} border-ink bg-ink text-white`

type SpatialControlsProps = {
  draft: SpatialDraft | null
  committed: SpatialSearch | null
  ready: boolean
  canApply: boolean
  onStart: (kind: SpatialSearch['kind']) => void
  onPoint: () => void
  onUndo: () => void
  onRadius: (value: string) => void
  onCancel: () => void
  onApply: () => void
  onClear: () => void
}

export function SearchSpatialControls({
  draft, committed, ready, canApply, onStart, onPoint, onUndo, onRadius, onCancel, onApply, onClear,
}: SpatialControlsProps) {
  const { t } = useTranslation('search')
  const polygon = useRef<HTMLButtonElement>(null)
  const radius = useRef<HTMLButtonElement>(null)
  const point = useRef<HTMLButtonElement>(null)
  const previous = useRef<SpatialSearch['kind'] | null>(null)
  const instructions = useId()
  const distanceHint = useId()
  const kind = draft?.kind ?? null

  useEffect(() => {
    if (kind) point.current?.focus({ preventScroll: true })
    else if (previous.current) (previous.current === 'polygon' ? polygon : radius).current?.focus({ preventScroll: true })
    previous.current = kind
  }, [kind])

  return <section aria-label={t('spatial.controls')} className="min-w-0 shrink-0 space-y-2 border-y border-line-soft bg-paper px-3 py-2 sm:px-4">
    {draft ? <>
      <p className="text-xs leading-relaxed text-ink2" id={instructions}>{t(draft.kind === 'polygon' ? 'spatial.draw_hint' : 'spatial.radius_hint')}</p>
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        <button type="button" ref={point} className={toolButton} disabled={!ready || (draft.kind === 'polygon' && draft.vertices.length >= 24)}
          aria-describedby={instructions} onClick={onPoint}>{t(draft.kind === 'polygon' ? 'spatial.add_center' : 'spatial.use_center')}</button>
        {draft.kind === 'polygon' ? <button type="button" className={toolButton} onClick={onUndo} disabled={!draft.vertices.length}>
          {t('spatial.undo')}
        </button> : <><label className="block min-w-0 max-w-full text-xs font-semibold text-ink2">
          <span className="mb-1 block">{t('spatial.distance')}</span>
          <input className="h-11 w-28 max-w-full rounded-lg border border-line bg-white px-2 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
            type="number" inputMode="decimal" min="0.1" max="500" step="any" aria-describedby={distanceHint}
            value={draft.km} onChange={event => onRadius(event.target.value)} />
        </label><span id={distanceHint} className="sr-only">{t('spatial.distance_hint')}</span></>}
        <button type="button" className={primaryButton} disabled={!ready || !canApply}
          onClick={onApply}>{t(draft.kind === 'polygon' ? 'spatial.apply_area' : 'spatial.apply_radius')}</button>
        <button type="button" className={toolButton} onClick={onCancel}>{t('spatial.cancel')}</button>
      </div>
      <p role="status" className="text-xs leading-relaxed text-ink2">
        {draft.kind === 'polygon'
          ? t('spatial.points', { count: draft.vertices.length, limit: 24 })
          : t(draft.center ? 'spatial.center_set' : 'spatial.center_needed')}
        {draft.kind === 'polygon' && draft.vertices.length >= 3 && !canApply ? ` ${t('spatial.invalid_area')}` : ''}
        {draft.kind === 'radius' && (draft.km === '' || Number(draft.km) < 0.1 || Number(draft.km) > 500) ? ` ${t('spatial.distance_hint')}` : ''}
      </p>
    </> : <div className="flex flex-wrap items-center gap-2">
      <button type="button" ref={polygon} className={toolButton} disabled={!ready}
        onClick={() => onStart('polygon')}>{t('spatial.draw')}</button>
      <button type="button" ref={radius} className={toolButton} disabled={!ready}
        onClick={() => onStart('radius')}>{t('spatial.radius')}</button>
      {committed && <>
        <p className="max-w-full text-xs leading-relaxed text-ink2">
          {committed.kind === 'radius' ? t('spatial.active_radius', { km: committed.km }) : t('spatial.active_polygon')}
        </p>
        <button type="button" className={toolButton} onClick={() => {
          polygon.current?.focus({ preventScroll: true })
          onClear()
        }}>{t('spatial.clear')}</button>
      </>}
    </div>}
  </section>
}

const outline = { clickable: false, strokeColor: '#005d77', strokeOpacity: 1, strokeWeight: 3 }
const filled = { ...outline, fillColor: '#0089a9', fillOpacity: 0.17 }

export function SpatialMapOverlay({ draft, committed }: { draft: SpatialDraft | null; committed: SpatialSearch | null }) {
  const shape = draft ?? committed
  if (!shape) return null
  if (shape.kind === 'radius') {
    const km = Number(shape.km)
    return shape.center && <>
      <MarkerF position={shape.center} options={{ clickable: false, icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#005d77', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 5 } }} />
      {km >= 0.1 && km <= 500 && <CircleF center={shape.center} radius={km * 1000} options={filled} />}
    </>
  }
  return <>
    {shape.vertices.length === 2 && <PolylineF path={shape.vertices} options={outline} />}
    {shape.vertices.length > 2 && <PolygonF paths={shape.vertices} options={filled} />}
    {draft?.kind === 'polygon' && draft.vertices.map((position, index) => <MarkerF key={index} position={position}
      options={{ clickable: false, icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#005d77', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 5 } }} />)}
  </>
}
