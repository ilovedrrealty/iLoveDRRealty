'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchDealListings, fetchListingById, type ApiListingDetail } from '../api/listings'
import { HOMEPAGE_PROPERTIES, homepagePhoto } from '../data/homepageHighlights'
import styles from './HomepageHighlights.module.css'

type GalleryProperty = ApiListingDetail & { photo: string }
type GalleryData = { properties: GalleryProperty[]; deals: boolean; loaded: boolean }

function galleryProperty(property: ApiListingDetail, preferredPhoto?: string): GalleryProperty | null {
  if (property.status !== 'active' || !property.images?.length) return null
  const approvedPhoto = preferredPhoto && homepagePhoto(preferredPhoto)
  const photo = approvedPhoto && property.images.includes(approvedPhoto) ? approvedPhoto : property.images[0]
  return { ...property, photo }
}

function positionFor(index: number, current: number, count: number) {
  let offset = (index - current + count) % count
  if (offset > Math.floor(count / 2)) offset -= count
  return offset
}

export default function PropertyGallery() {
  const { t, i18n } = useTranslation('home_showcase')
  const [data, setData] = useState<GalleryData>({ properties: [], deals: false, loaded: false })
  const [current, setCurrent] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(false)
  const [visible, setVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [gesturing, setGesturing] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const carousel = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null)
  const suppressClickUntil = useRef(0)
  const { properties } = data
  const count = properties.length
  const number = new Intl.NumberFormat(i18n.language.startsWith('es') ? 'es-DO' : 'en-US')

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Fetch the real deals feed and the approved fallback collection in parallel.
      const [deals, regularResults] = await Promise.all([
        fetchDealListings(),
        Promise.allSettled(HOMEPAGE_PROPERTIES.map(async property => {
          const detail = await fetchListingById(property.id)
          return galleryProperty(detail, property.photo)
        })),
      ])
      const regular = regularResults.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
      let dealProperties: GalleryProperty[] = []
      if (deals.length) {
        const results = await Promise.allSettled(deals.filter(deal => deal.is_deal).slice(0, 5).map(async deal => {
          const detail = await fetchListingById(deal.id)
          return detail.is_deal ? galleryProperty(detail) : null
        }))
        dealProperties = results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
      }
      if (!cancelled) setData({ properties: dealProperties.length ? dealProperties : regular, deals: dealProperties.length > 0, loaded: true })
    }
    load().catch(() => { if (!cancelled) setData({ properties: [], deals: false, loaded: true }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => {
      setReducedMotion(media.matches)
      if (media.matches) setUserPaused(true)
    }
    const syncVisibility = () => setVisible(!document.hidden)
    syncMotion()
    syncVisibility()
    media.addEventListener('change', syncMotion)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      media.removeEventListener('change', syncMotion)
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  }, [])

  useEffect(() => {
    const element = carousel.current
    if (!element) return
    if (!('IntersectionObserver' in window)) { setInView(true); return }
    const observer = new IntersectionObserver(entries => setInView(entries[0].isIntersecting), { threshold: 0.35 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [count])

  useEffect(() => {
    const cancelGesture = () => { gesture.current = null; setGesturing(false) }
    window.addEventListener('pointerup', cancelGesture)
    window.addEventListener('pointercancel', cancelGesture)
    return () => {
      window.removeEventListener('pointerup', cancelGesture)
      window.removeEventListener('pointercancel', cancelGesture)
    }
  }, [])

  const canRotate = count > 1 && !userPaused && !reducedMotion && !hovered && !focused && !gesturing && visible && inView
  useEffect(() => {
    if (!canRotate) return
    const timer = window.setTimeout(() => setCurrent(index => (index + 1) % count), 6000)
    return () => window.clearTimeout(timer)
  }, [canRotate, count, current])

  function priceFor(property: GalleryProperty) {
    if (property.transaction === 'rent') {
      if (Number(property.price_per_month) > 0) return { amount: Number(property.price_per_month), unit: t('gallery.per_month') }
      if (Number(property.price_per_day) > 0) return { amount: Number(property.price_per_day), unit: t('gallery.per_day') }
      // The generic rental price has no reliable period; do not call a nightly rate monthly.
      return { amount: 0, unit: '' }
    }
    const base = Number(property.price)
    const discount = property.is_deal ? Number(property.deal_discount_value) : 0
    const amount = discount > 0
      ? Math.max(0, property.deal_discount_type === 'fixed' ? base - discount : base * (1 - discount / 100))
      : base
    return { amount: Math.round(amount), unit: t('gallery.currency') }
  }

  function show(index: number) {
    if (!count) return
    // Move focus before the outgoing property link becomes hidden.
    if (carousel.current?.querySelector('[data-position="0"]')?.contains(document.activeElement)) {
      carousel.current.focus({ preventScroll: true })
    }
    const next = (index + count) % count
    const property = properties[next]
    const price = priceFor(property)
    setCurrent(next)
    setUserPaused(true)
    setAnnouncement(t('gallery.announcement', {
      number: next + 1, total: count, title: property.title,
      price: price.amount > 0 ? `US$${number.format(price.amount)}` : t('gallery.request_price'), unit: price.unit,
    }))
  }

  const pointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    setGesturing(true)
  }, [])

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!gesture.current || gesture.current.id !== event.pointerId) return
    const dx = event.clientX - gesture.current.x
    const dy = event.clientY - gesture.current.y
    gesture.current = null
    setGesturing(false)
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      suppressClickUntil.current = performance.now() + 450
      show(current + (dx < 0 ? 1 : -1))
    }
  }

  if (data.loaded && !count) return null
  const title = t(data.deals ? 'gallery.deals_heading' : 'gallery.featured_heading')
  const paused = userPaused || reducedMotion

  return (
    <section className={styles.featured} aria-labelledby="homepage-gallery-title">
      <div className={styles.wrap}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>{t('gallery.eyebrow')}</p>
            <h2 id="homepage-gallery-title">{title}</h2>
            <p>{t(data.deals ? 'gallery.deals_sub' : 'gallery.featured_sub')}</p>
          </div>
          <Link className={styles.textLink} href="/search/">{t('gallery.view_all')} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      {!data.loaded ? <div className={`${styles.loading} ${styles.wrap}`} role="status">{t('gallery.loading')}</div> : (
        <div ref={carousel} className={styles.carousel} id="homepage-property-carousel" role="region" aria-roledescription={t('gallery.carousel')} aria-label={title} aria-describedby="homepage-gallery-motion" tabIndex={0}
          onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }}
          onPointerLeave={event => { if (event.pointerType === 'mouse') setHovered(false) }}
          onFocus={() => setFocused(true)}
          onBlur={event => setFocused(event.currentTarget.contains(event.relatedTarget as Node | null))}
          onKeyDown={event => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); show(current + (event.key === 'ArrowRight' ? 1 : -1)) }
          }}>
          <div className={styles.galleryStage} onPointerDown={pointerDown} onPointerUp={pointerUp}
            onDragStart={event => event.preventDefault()}
            onClickCapture={event => { if (performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation() } }}>
            {properties.map((property, index) => {
              const offset = positionFor(index, current, count)
              const active = offset === 0
              const price = priceFor(property)
              const priceText = price.amount > 0 ? `US$${number.format(price.amount)}` : t('gallery.request_price')
              return (
                <article key={property.id} className={styles.propertySlide} data-position={offset} role="group" aria-roledescription={t('gallery.slide')} aria-label={t('gallery.slide_label', { number: index + 1, total: count, title: property.title })} aria-hidden={!active}>
                  <Link href={`/listing/${property.id}/`} className={styles.propertyLink} tabIndex={active ? 0 : -1} aria-label={t('gallery.view_label', { title: property.title, location: property.location, price: priceText, unit: price.unit })} draggable={false}>
                    <img src={property.photo} alt={`${property.title} — ${property.location}`} width={1200} height={660} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
                    <span className={styles.listingType}>{t(property.transaction === 'rent' ? 'gallery.rent' : 'gallery.sale')}</span>
                    <div className={styles.propertyCopy}>
                      <div>
                        <p className={styles.propertyLocation}>{property.location}</p>
                        <h3 className={styles.propertyTitle}>{property.title}</h3>
                        <div className={styles.propertyFacts}>
                          {Number(property.bedrooms) > 0 ? <span>{t('gallery.beds', { count: Number(property.bedrooms) })}</span> : null}
                          {Number(property.bathrooms) > 0 ? <span>{t('gallery.baths', { count: Number(property.bathrooms) })}</span> : null}
                          {Number(property.area_sqft) > 0 ? <span>{t('gallery.area', { area: number.format(Number(property.area_sqft)) })}</span> : null}
                        </div>
                      </div>
                      <div className={styles.propertyPrice}>
                        <strong>{priceText}</strong><small>{price.unit}</small>
                        <span className={styles.viewProperty}>{t('gallery.view')} <span aria-hidden="true">↗</span></span>
                      </div>
                    </div>
                  </Link>
                  {Math.abs(offset) === 1 ? <button className={styles.bringFront} type="button" tabIndex={-1} aria-hidden="true" onClick={() => show(index)} /> : null}
                </article>
              )
            })}
          </div>
          <div className={styles.galleryBottom}>
            <div className={styles.galleryIndex}><strong>{String(current + 1).padStart(2, '0')}</strong><span aria-hidden="true">/</span> {String(count).padStart(2, '0')} <span className={styles.srOnly}>{t('gallery.properties')}</span></div>
            {count > 1 ? <>
              <div className={styles.galleryDots} role="group" aria-label={t('gallery.choose')}>
                {properties.map((property, index) => <button key={property.id} type="button" className={styles.galleryDot} aria-label={t('gallery.show', { number: index + 1, title: property.title })} aria-current={index === current} onClick={() => show(index)} />)}
              </div>
              <div className={styles.galleryControls}>
                <button className={styles.pauseButton} type="button" disabled={reducedMotion} aria-pressed={paused} aria-label={t(reducedMotion ? 'gallery.reduced_label' : userPaused ? 'gallery.play_label' : 'gallery.pause_label')} onClick={() => setUserPaused(value => !value)}>
                  <span aria-hidden="true">{reducedMotion ? '◌' : userPaused ? '▶' : 'Ⅱ'}</span>{t(reducedMotion ? 'gallery.motion_off' : userPaused ? 'gallery.play' : 'gallery.pause')}
                </button>
                <button className={styles.iconButton} type="button" aria-label={t('gallery.previous')} onClick={() => show(current - 1)}><span aria-hidden="true">←</span></button>
                <button className={styles.iconButton} type="button" aria-label={t('gallery.next')} onClick={() => show(current + 1)}><span aria-hidden="true">→</span></button>
              </div>
            </> : null}
          </div>
          <p className={styles.srOnly} aria-live="polite" aria-atomic="true">{announcement}</p>
          <p className={styles.srOnly} id="homepage-gallery-motion">{t(reducedMotion ? 'gallery.reduced_status' : userPaused ? 'gallery.paused_status' : 'gallery.interaction_status')}</p>
        </div>
      )}
      <p className={`${styles.imageNote} ${styles.wrap}`}>{t('gallery.disclaimer')}</p>
    </section>
  )
}
