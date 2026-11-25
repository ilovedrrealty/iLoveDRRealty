"use client";
import { Suspense, useState, useMemo, useEffect, useRef, type FormEvent } from "react";
import DOMPurify from "dompurify";
import { useSearchParams } from "next/navigation";
import { GoogleMap, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import {
  ArrowLeft,
  BedDouble,
  Bath,
  Maximize2,
  MapPin,
  Star,
  MessageCircle,
  ExternalLink,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Video,
  Box,
} from "lucide-react";
import { useNav } from "../hooks/useNav";
import { fmt } from "../data/listings";
import { listingGallery, TONE_MAP } from "../data/propertyDetailData";
import { parseListingRoomTour } from "../data/listingRoomTour";
import { ListingRoomTour } from "../components/ListingRoomTour";
import { ListingBrochureDownload } from "../components/ListingBrochureDownload";
import { ListingShare } from "../components/ListingShare";
import { ListingFloorPlan } from "../components/ListingFloorPlan";
import { DevelopmentInventory } from "../components/DevelopmentInventory";
import { fetchListingById, recordListingView } from "../api/listings";
import type { ApiListingDetail } from "../api/listings";
import { isInquiryPropertyContext, observeInquiryProperty, preparePropertyInquiry, submitInquiry, type LeadSubmissionAttempt } from "../api/inquiries";
import type { LeadReceipt } from "../lib/gtag";
import { PhoneInput } from 'react-international-phone'
import { isValidPhoneNumber } from 'libphonenumber-js'
import 'react-international-phone/style.css'
import { createBooking, createPaymentAuth, getUnavailableDates, type BookedRange } from "../api/bookings";
import { getMe } from "../api/auth";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { PAYPAL_ENABLED } from "../lib/features";
import { viewingRequestUrl } from "../lib/viewingLink";

// Empty while PAYPAL_ENABLED is off, which collapses every PayPal branch below
// and falls the booking form back to a no-payment "Request to book".
const PAYPAL_CLIENT_ID = PAYPAL_ENABLED ? (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '') : ''
import { useTranslation } from 'react-i18next'

function Slider({
  label,
  value,
  set,
  min,
  max,
  step,
  fmtV,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
  min: number;
  max: number;
  step: number;
  fmtV: (v: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const startEdit = () => {
    setInputVal(String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    const n = parseFloat(inputVal);
    if (!isNaN(n)) set(Math.min(max, Math.max(min, n)));
    setEditing(false);
  };

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[11.5px] font-semibold text-ink2 tracking-wide uppercase">
          {label}
        </span>
        {editing ? (
          <input
            type="number"
            value={inputVal}
            min={min}
            max={max}
            step={step}
            autoFocus
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-28 text-[13px] font-bold text-ink text-right border-b border-coral bg-transparent outline-none font-sans"
          />
        ) : (
          <span
            className="text-[13px] font-bold text-ink font-sans cursor-text hover:text-coral transition-colors"
            onClick={startEdit}
            title="Click to type a value"
          >
            {fmtV(value)}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(+e.target.value)}
        className="w-full accent-sea"
      />
    </div>
  );
}

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#f0ede8" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#e4dfd8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe0f0" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f7f5f2" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d8d3cc" }] },
]

function PropertyMap({ locationName, latitude, longitude, label }: {
  locationName: string
  latitude: number | null
  longitude: number | null
  label: string
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""
  const coords: { lat: number; lng: number } | null =
    latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
      && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? { lat: latitude, lng: longitude }
      : null

  if (!apiKey || !coords) {
    // A Maps URL may describe a viewport. Only API-supplied coordinates define
    // a property point; otherwise this is an approximate recorded-area map.
    const destination = coords ? `${coords.lat},${coords.lng}` : locationName + ", Dominican Republic"
    const embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(destination)}&output=embed`
    return (
      <iframe
        title={label}
        src={embedSrc}
        width="100%"
        height="100%"
        style={{ border: 0, display: "block" }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin"
      />
    )
  }

  return <PropertyPointMap coords={coords} apiKey={apiKey} label={label} />
}

function PropertyPointMap({ coords, apiKey, label }: { coords: { lat: number; lng: number }; apiKey: string; label: string }) {
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, id: "google-map-script" })
  if (loadError) {
    return <iframe title={label} src={`https://maps.google.com/maps?q=${encodeURIComponent(`${coords.lat},${coords.lng}`)}&output=embed`}
      width="100%" height="100%" style={{ border: 0, display: 'block' }} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" />
  }
  if (!isLoaded) {
    return <div className="w-full h-full bg-paper2 animate-pulse rounded-2xl" />
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={coords}
      zoom={15}
      options={{ styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true, streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
    >
      <OverlayView
        position={coords}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h })}
      >
        <div style={{ overflow: "visible", whiteSpace: "nowrap" }}>
          <div style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "default",
            userSelect: "none",
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50% 50% 50% 0",
              transform: "rotate(-45deg)",
              background: "#00102e",
              boxShadow: "0 3px 12px rgba(0,16,46,0.45)",
              border: "2.5px solid white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{ transform: "rotate(45deg)", width: 10, height: 10, borderRadius: "50%", background: "white" }} />
            </div>
            <div style={{ width: 2, height: 6, background: "#00102e", borderRadius: 2, marginTop: -1 }} />
          </div>
        </div>
      </OverlayView>
    </GoogleMap>
  )
}

const TAG_TONES: Record<string, string> = {
  Luxury: "gold",
  Investment: "coral",
  "For Rent": "green",
  Commercial: "sea",
  New: "sea",
};

function safeUrl(u: string): string | null {
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
  } catch {
    return null;
  }
}

function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let vid: string | null = null;
    if (u.hostname === "youtu.be") {
      vid = u.pathname.slice(1).split("/")[0];
    } else if (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") {
      if (u.pathname === "/watch") {
        vid = u.searchParams.get("v");
      } else if (u.pathname.startsWith("/embed/")) {
        vid = u.pathname.slice(7).split("/")[0];
      } else if (u.pathname.startsWith("/shorts/")) {
        vid = u.pathname.slice(8).split("/")[0];
      }
    }
    return vid ? `https://www.youtube.com/embed/${vid}` : null;
  } catch {
    return null;
  }
}

function PropertyDetailInner({ id: idProp }: { id?: string }) {
  const params = useSearchParams();
  const go = useNav();
  const { t, i18n } = useTranslation('property_detail')
  const id = idProp ?? params.get("id") ?? "";
  const [listing, setListing] = useState<ApiListingDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [requestedLightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [dopRate, setDopRate] = useState(59.5);
  const [currency, setCurrency] = useState<'USD' | 'DOP'>('DOP');
  const [aPrice, setAPrice] = useState(0);
  const [aDown, setADown] = useState(30);
  const [aRate, setARate] = useState(7);
  const [aTerm, setATerm] = useState(25);

  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [inquiryPhoneDialCode, setInquiryPhoneDialCode] = useState('1');
  const [inquirySending, setInquirySending] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryConsent, setInquiryConsent] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquiryReceipt, setInquiryReceipt] = useState<LeadReceipt | null>(null);
  const [inquiryFollowUp, setInquiryFollowUp] = useState<'phone' | 'email'>('phone');
  const inquirySubmitting = useRef(false);
  const inquiryAttempt = useRef<LeadSubmissionAttempt>({});
  const inquiryVersion = useRef(0);
  const inquiryStatus = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const version = ++inquiryVersion.current;
    inquirySubmitting.current = false;
    inquiryAttempt.current = {};
    setInquiryOpen(false); setInquirySending(false); setInquirySent(false);
    setInquiryConsent(false); setInquiryError(null); setInquiryReceipt(null);
    setInquiryForm({ name: '', email: '', phone: '', message: '' });
    setInquiryPhoneDialCode('1');
    return () => { if (inquiryVersion.current === version) inquiryVersion.current += 1; };
  }, [id]);
  useEffect(() => { if (inquiryError) inquiryStatus.current?.focus(); }, [inquiryError]);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', email: '', phone: '', checkIn: '', checkOut: '', guests: 1, notes: '' });
  const [bookingSending, setBookingSending] = useState(false);
  const [bookingSent, setBookingSent] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingDateError, setBookingDateError] = useState('');
  const [rentalType, setRentalType] = useState<'daily' | 'monthly'>('daily');
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth());
  const [bookedRanges, setBookedRanges] = useState<BookedRange[]>([]);
  const [me, setMe] = useState<{ display_name: string; email: string; phone: string | null; avatar_url: string | null } | null>(null);
  const [galleryTab, setGalleryTab] = useState<'photos' | '3dtour'>('photos');

  useEffect(() => {
    getMe().then(data => setMe(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (listing?.transaction === 'rent' && listing.id) {
      getUnavailableDates(listing.id).then(setBookedRanges).catch(() => {})
    }
  }, [listing?.id, listing?.transaction])

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => { if (d.rates?.DOP) setDopRate(d.rates.DOP) })
      .catch(() => {})
  }, []);

  useEffect(() => {
    setListing(null);
    setLoadError(false);
    setAPrice(0);
    setLightboxIdx(null);
    return observeInquiryProperty(id, fetchListingById,
      (data) => {
        setListing(data);
        setAPrice(Number(data.price));
      }, () => setLoadError(true), recordListingView);
  }, [id]);

  const fmtM = (v: number) => currency === 'DOP'
    ? `RD$${Math.round(v * dopRate).toLocaleString("en-US")}`
    : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const mortgage = useMemo(() => {
    const loan = aPrice * (1 - aDown / 100);
    const down = aPrice * (aDown / 100);
    const mr = aRate / 100 / 12;
    const n = aTerm * 12;
    const monthly = mr > 0 ? (loan * (mr * Math.pow(1 + mr, n))) / (Math.pow(1 + mr, n) - 1) : loan / n;
    const totalPaid = monthly * n;
    const totalInterest = totalPaid - loan;
    return { loan, down, monthly, totalPaid, totalInterest };
  }, [aPrice, aDown, aRate, aTerm]);
  const todayStr = new Date().toISOString().split('T')[0]
  const isDateBooked = (ds: string) => bookedRanges.some(r => ds >= r.check_in && ds < r.check_out)
  // Stays are half-open [check_in, check_out): checking in on someone else's check-out day is fine
  const rangeBooked = (ci: string, co: string) => bookedRanges.some(r => ci < r.check_out && co > r.check_in)
  // A check-out is only invalid if the stay it ends would run into a booked one
  const isCheckoutBlocked = (co: string, ci: string) =>
    ci ? rangeBooked(ci, co) : bookedRanges.some(r => co > r.check_in && co <= r.check_out)
  const bookingErrorFor = (err: any) =>
    err?.response?.status === 409 ? t('booking.error_date_unavailable') : t('booking.error_generic')

  const handleInquiry = async (e: FormEvent) => {
    e.preventDefault()
    if (inquirySubmitting.current || inquirySent) return
    const prepared = preparePropertyInquiry({ ...inquiryForm, contactConsent: inquiryConsent }, inquiryPhoneDialCode, isValidPhoneNumber)
    if (prepared.issue) { setInquiryError(prepared.issue); return }
    if (!listing || !isInquiryPropertyContext(id, listing.id)) { setInquiryError('unavailable'); return }
    const version = inquiryVersion.current
    inquirySubmitting.current = true
    setInquiryError(null)
    setInquirySending(true)
    try {
      const receipt = await submitInquiry({
        listing_id: listing.id, name: prepared.name, email: prepared.email, phone: prepared.phone, message: prepared.message,
        contactConsent: inquiryConsent, locale: i18n.language.startsWith('es') ? 'es' : 'en',
        conversionIntent: listing.transaction === 'sale' ? 'buy' : listing.transaction === 'rent' ? 'rent' : 'general',
        attempt: inquiryAttempt.current,
      })
      if (inquiryVersion.current === version) {
        setInquiryReceipt(receipt); setInquiryFollowUp(prepared.phone ? 'phone' : 'email'); setInquirySent(true)
      }
    } catch (reason) {
      if (inquiryVersion.current === version) {
        const status = (reason as { response?: { status?: number } } | null)?.response?.status
        setInquiryError(status === 404 ? 'unavailable' : status === 409 ? 'conflict' : status === 429 ? 'rate' : status === 422 ? 'validation' : 'send')
      }
    } finally {
      if (inquiryVersion.current === version) { inquirySubmitting.current = false; setInquirySending(false) }
    }
  }

  const handleBooking = async (e: FormEvent) => {
    e.preventDefault()
    if (bookingForm.checkIn && bookingForm.checkOut && rangeBooked(bookingForm.checkIn, bookingForm.checkOut)) {
      setBookingError(t('booking.error_date_unavailable'))
      return
    }
    setBookingSending(true)
    setBookingError('')
    try {
      await createBooking({
        listing_id: id,
        check_in: bookingForm.checkIn,
        check_out: bookingForm.checkOut,
        guests: bookingForm.guests,
        notes: bookingForm.notes || undefined,
        name: bookingForm.name,
        email: bookingForm.email,
        phone: bookingForm.phone || undefined,
      })
      setBookingSent(true)
    } catch (err: any) {
      setBookingError(bookingErrorFor(err))
    } finally { setBookingSending(false) }
  }

  const gallery = useMemo(() => listingGallery(listing?.images ?? []), [listing?.images]);
  const imgs = gallery.photos;
  const lightboxIdx = requestedLightboxIdx !== null && imgs[requestedLightboxIdx] ? requestedLightboxIdx : null;
  const roomTour = useMemo(() => listing?.id === id ? parseListingRoomTour(listing.room_photo_tour, listing.images) : null, [id, listing]);

  useEffect(() => {
    document.body.style.overflow = lightboxIdx !== null ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxIdx]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowLeft") setLightboxIdx((i) => i !== null ? Math.max(0, i - 1) : null);
      if (e.key === "ArrowRight") setLightboxIdx((i) => i !== null ? Math.min(imgs.length - 1, i + 1) : null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, imgs.length]);

  if (loadError)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-muted font-sans">
        <p className="text-[15px]">{t('not_found')}</p>
        <button
          onClick={() => go("search")}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-ink2 text-[13px] font-sans"
        >
          <ArrowLeft size={15} /> {t('back')}
        </button>
      </div>
    );

  if (!listing)
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted font-sans text-[14px]">
        {t('loading')}
      </div>
    );

  const safeTourUrl = listing.tour_3d_url ? safeUrl(listing.tour_3d_url) : null;
  const activeTourUrl = galleryTab === '3dtour' ? safeTourUrl : null;
  const viewingUrl = isInquiryPropertyContext(id, listing.id)
    ? viewingRequestUrl(process.env.NEXT_PUBLIC_DASHBOARD_URL, listing.id) : null;

  return (
    <div className="max-w-310 mx-auto px-4 sm:px-6 py-5 pb-20">
      {/* Back */}
      <button
        onClick={() => go("search")}
        className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-ink2 text-[13px] mb-4 font-sans"
      >
        <ArrowLeft size={15} />
        {t('back')}
      </button>

      {/* Header */}
      <div className="mb-3.5">
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {(listing.tags?.length ? listing.tags : listing.tag ? [listing.tag] : []).map(tag => {
            const tone = TAG_TONES[tag] ?? "sand";
            return (
              <span key={tag} className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${TONE_MAP[tone] ?? TONE_MAP.sand}`}>
                {tag}
              </span>
            );
          })}
          <div className="ml-auto min-w-0 w-full"><ListingShare listingId={id} /></div>
        </div>
        <h1 className="font-sans text-[clamp(26px,4vw,40px)] font-bold text-ink leading-[1.07] tracking-tight [overflow-wrap:anywhere]">
          {listing.title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
        </h1>
        <div className="flex flex-wrap items-center gap-3.5 text-ink2 text-[14px] mt-2">
          <span className="flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
            <MapPin size={15} />
            {listing.location}
          </span>
        </div>
      </div>

      {/* Gallery */}
      <div className="mb-7">
        {safeTourUrl && (
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setGalleryTab('photos')}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${galleryTab === 'photos' ? 'bg-ink text-white' : 'bg-paper2 text-ink2 hover:bg-paper'}`}
            >
              {t('photos')}
            </button>
            <button
              onClick={() => setGalleryTab('3dtour')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${galleryTab === '3dtour' ? 'bg-ink text-white' : 'bg-paper2 text-ink2 hover:bg-paper'}`}
            >
              <Box size={13} />
              {t('tour_3d')}
            </button>
          </div>
        )}
        {activeTourUrl ? (
          <div className="rounded-2xl overflow-hidden aspect-video">
            <iframe
              src={activeTourUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="3D Tour"
            />
          </div>
        ) : gallery.tiles.length > 0 && (
          <div className={`grid gap-2 ${gallery.grid}`}>
            {gallery.tiles.map(({ src, index, placement, remainingCount }) => (
              <button key={index} type="button"
                className={`${index === 0 ? 'rounded-2xl' : 'rounded-xl'} ${placement} relative overflow-hidden border-0 bg-cover bg-center p-0 cursor-pointer`}
                aria-label={t('open_gallery_photo', { number: index + 1, total: imgs.length })}
                style={{ backgroundImage: `url(${src})` }}
                onClick={() => setLightboxIdx(index)}>
                {remainingCount > 0 && (
                  <span className="absolute inset-0 grid place-items-center text-white text-[13px] font-semibold font-sans bg-ink/52">
                    {remainingCount !== 1 ? t('photo_more_plural', { count: remainingCount }) : t('photo_more', { count: remainingCount })}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {!activeTourUrl && roomTour && <ListingRoomTour key={listing.id} tour={roomTour} />}
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 items-start">
        {/* ── LEFT ── */}
        <div className="min-w-0">
          {/* Quick stats */}
          <div className="flex flex-wrap gap-6 py-5.5 border-b border-line-soft text-ink text-[15px]">
            {(listing.bedrooms ?? 0) > 0 && (
              <span className="flex items-center gap-1.5">
                <BedDouble size={18} />
                {listing.bedrooms} {t('beds')}
              </span>
            )}
            {(listing.bathrooms ?? 0) > 0 && (
              <span className="flex items-center gap-1.5">
                <Bath size={18} />
                {listing.bathrooms} {t('baths')}
              </span>
            )}
            {listing.area_sqft && (
              <span className="flex items-center gap-1.5">
                <Maximize2 size={18} />
                {listing.area_sqft.toLocaleString()} ft²
              </span>
            )}
            {listing.type && (
              <span className="flex items-center gap-1.5">
                <Building2 size={18} />
                {listing.type.charAt(0).toUpperCase() + listing.type.slice(1)}
              </span>
            )}
            {listing.year_built && (
              <span className="flex items-center gap-1.5">
                <Calendar size={18} />
                {t('built', { year: listing.year_built })}
              </span>
            )}
          </div>

          {/* Description */}
          {(() => {
            const fallback = `<p>Nestled along the pristine shores of ${listing.location.split(",")[0]}, this property is an architectural masterpiece that redefines Caribbean luxury — an extraordinary residence offering an unparalleled fusion of indoor-outdoor living in one of the DR's most sought-after destinations.</p>`
            const localized = i18n.language === 'es' ? (listing.description_es || listing.description) : listing.description
            const raw = localized ?? fallback
            const html = raw.trimStart().startsWith('<') ? raw : `<p>${raw}</p>`
            const safe = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
            return (
              <div
                className="listing-prose font-sans py-4 border-b border-line-soft"
                dangerouslySetInnerHTML={{ __html: safe }}
              />
            )
          })()}

          {listing.id === id && (listing.transaction === 'sale' || listing.transaction === 'both') && (
            <DevelopmentInventory key={listing.id} listingId={listing.id} />
          )}

          {/* Property details */}
          <h3 className="font-sans text-[22px] font-semibold text-ink mt-7 mb-4">
            {t('sections.details')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              listing.lot_size_sqft && {
                icon: <Layers size={18} />,
                label: t('details.lot_size'),
                value: `${listing.lot_size_sqft.toLocaleString()} ft²`,
              },
              listing.construction_status && {
                icon: <Building2 size={18} />,
                label: t('details.construction'),
                value: listing.construction_status
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase()),
              },
              listing.hoa_fee && {
                icon: <MapPin size={18} />,
                label: t('details.hoa_fee'),
                value: currency === 'DOP'
                  ? `RD$${Math.round(Number(listing.hoa_fee) * dopRate).toLocaleString('en-US')} ${t('unit.per_mo')}`
                  : `$${Number(listing.hoa_fee).toLocaleString()} ${t('unit.per_mo')}`,
              },
              listing.roi && {
                icon: <Star size={18} />,
                label: t('details.est_roi'),
                value: `${listing.roi}% ${t('unit.per_yr')}`,
              },
              listing.seller_financing && {
                icon: <CheckCircle2 size={18} />,
                label: t('details.seller_financing'),
                value: t('details.seller_financing_val'),
              },
              listing.tax_exempt && {
                icon: <CheckCircle2 size={18} />,
                label: t('details.tax_exempt'),
                value: t('details.tax_exempt_val'),
              },
              listing.gated_community && {
                icon: <CheckCircle2 size={18} />,
                label: t('details.gated'),
                value: t('details.gated_val'),
              },
              listing.hoa && {
                icon: <CheckCircle2 size={18} />,
                label: t('details.hoa_community'),
                value: t('details.hoa_community_val'),
              },
            ]
              .filter(Boolean)
              .map((d: any, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 bg-paper2 border border-line-soft rounded-2xl"
                >
                  <span className="text-ink2 mt-0.5 shrink-0">{d.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold text-ink2 uppercase tracking-wide mb-0.5">
                      {d.label}
                    </div>
                    <div className="font-semibold text-[14px] text-ink">
                      {d.value}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Features & amenities */}
          {listing.features.length > 0 && (
            <div className="mt-7">
              <h3 className="font-sans text-[22px] font-semibold text-ink mb-4">
                {t('sections.features')}
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {listing.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-ink shrink-0" />
                    <span className="text-[14px] text-ink2">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources: video links */}
          {(listing.video_links?.length ?? 0) > 0 && (
            <div className="mt-7">
              <h3 className="font-sans text-[22px] font-semibold text-ink mb-4">{t('sections.resources')}</h3>
              <div className="space-y-2.5">
                {listing.video_links?.map((url, i) => {
                  const safe = safeUrl(url);
                  if (!safe) return null;
                  const embedUrl = youtubeEmbedUrl(safe);
                  if (embedUrl) {
                    return (
                      <div key={i} className="rounded-xl overflow-hidden aspect-video">
                        <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={`Video ${i + 1}`}
                        />
                      </div>
                    );
                  }
                  return (
                    <a
                      key={i}
                      href={safe}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line-soft bg-paper2 hover:bg-paper transition-colors text-[13.5px] font-semibold text-ink group"
                    >
                      <Video size={16} className="text-ink2 shrink-0 group-hover:text-ink transition-colors" />
                      <span className="flex-1 truncate">{safe}</span>
                      <ExternalLink size={13} className="text-ink2 shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Utilities */}
          {listing.utilities && (
            <div className="mt-7">
              <h3 className="font-sans text-[22px] font-semibold text-ink mb-3">{t('sections.utilities')}</h3>
              {(() => {
                const raw = listing.utilities!
                const html = raw.trimStart().startsWith('<') ? raw : `<p>${raw}</p>`
                const safe = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
                return <div className="listing-prose font-sans" dangerouslySetInnerHTML={{ __html: safe }} />
              })()}
            </div>
          )}

          {/* What is Included (rent only) */}
          {listing.transaction === "rent" && (listing.included_utilities?.length ?? 0) > 0 && (
            <div className="mt-7">
              <h3 className="font-sans text-[22px] font-semibold text-ink mb-4">{t('sections.included')}</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {listing.included_utilities!.map(u => (
                  <div key={u} className="flex items-center gap-2.5">
                    <CheckCircle2 size={18} className="text-ink shrink-0" />
                    <span className="text-[14px] text-ink2">{u}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deposit (rent only) */}
          {listing.transaction === "rent" && listing.deposit_policy && listing.deposit_policy !== "none" && (
            <div className="mt-7 flex items-start gap-4 px-5 py-4 rounded-2xl border border-line-soft bg-paper2">
              <Calendar size={18} className="text-ink2 mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-ink2 uppercase tracking-wide mb-0.5">{t('deposit.label')}</div>
                <div className="text-[14px] font-semibold text-ink">{t('deposit.' + listing.deposit_policy, { defaultValue: listing.deposit_policy })}</div>
              </div>
            </div>
          )}

          {/* Mortgage calculator (sale only) */}
          {listing.transaction !== "rent" && (
            <div className="mt-7 border border-line-soft rounded-2xl overflow-hidden bg-white shadow-[0_10px_30px_-18px_rgba(0,16,46,.18)]">
              {/* Header */}
              <div className="px-6 py-4 bg-[linear-gradient(135deg,var(--color-coral)_0%,#a8000d_100%)] text-white">
                <div className="text-[11px] font-bold tracking-[.14em] uppercase">{t('mortgage.title')}</div>
                <div className="text-[12px] mt-0.5 text-white/70">{t('mortgage.subtitle', { currency: currency === 'DOP' ? 'DOP' : 'USD' })}</div>
              </div>

              <div className="px-6 pt-5 pb-6">
                {/* Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Slider label={t('mortgage.purchase_price')} value={aPrice} set={setAPrice} min={50000} max={5000000} step={25000} fmtV={(v) => fmt(v)} />
                  <Slider label={t('mortgage.down_payment')} value={aDown} set={setADown} min={5} max={80} step={5} fmtV={(v) => `${v}%`} />
                  <Slider label={t('mortgage.interest_rate')} value={aRate} set={setARate} min={0} max={14} step={0.25} fmtV={(v) => `${v}%`} />
                  <Slider label={t('mortgage.loan_term')} value={aTerm} set={setATerm} min={5} max={30} step={5} fmtV={(v) => `${v} yrs`} />
                </div>

                {/* Results */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  {[
                    [t('mortgage.monthly'), `${fmtM(mortgage.monthly)} ${t('unit.per_mo')}`],
                    [t('mortgage.loan_amount'), fmtM(mortgage.loan)],
                    [t('mortgage.down_amount'), fmtM(mortgage.down)],
                    [t('mortgage.total_interest'), fmtM(mortgage.totalInterest)],
                  ].map(([label, value], i) => (
                    <div key={i} className={`border rounded-xl p-4 ${i === 0 ? "bg-coral/10 border-coral/30" : "bg-paper2 border-line-soft"}`}>
                      <div className="text-[10.5px] font-bold text-ink2 uppercase tracking-wide mb-1">{label}</div>
                      <div className={`text-[18px] font-bold [overflow-wrap:anywhere] ${i === 0 ? "text-coral" : "text-ink"}`}>{value}</div>
                    </div>
                  ))}
                </div>

                <p className="text-[11.5px] text-muted mt-4 leading-[1.55]">
                  {t('mortgage.disclaimer')}
                </p>
              </div>
            </div>
          )}

          {/* Location */}
          <div className="mt-7">
            <h2 className="font-sans text-[22px] font-semibold text-ink mb-3.5">
              {t('sections.location')}
            </h2>
            {listing.location_precision === 'hidden' ? <p className="text-sm text-ink2">{t('location.hidden')}</p> : <>
              <div className="rounded-2xl overflow-hidden border border-line" style={{ height: 300 }}>
                <PropertyMap locationName={listing.location} latitude={listing.latitude ?? null} longitude={listing.longitude ?? null} label={t('sections.location')} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[12.5px] text-ink2 leading-[1.55]">
                  {t(listing.latitude != null && listing.longitude != null ? listing.location_verified ? 'location.reviewed' : 'location.saved' : 'location.approximate')}
                </p>
                {listing.maps_url && <a href={listing.maps_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sea hover:underline">
                  {t('location.open_maps')} <ExternalLink size={12} />
                </a>}
              </div>
            </>}
          </div>

        </div>

        {/* ── Lightbox ── */}
        {lightboxIdx !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxIdx(null)}
          >
            {/* Close */}
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-colors z-10"
            >
              <X size={20} />
            </button>

            {/* Counter */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-[13px] font-sans select-none">
              {lightboxIdx + 1} / {imgs.length}
            </div>

            {/* Prev */}
            {lightboxIdx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
                className="absolute left-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
              >
                <ChevronLeft size={26} />
              </button>
            )}

            {/* Image */}
            <img
              src={imgs[lightboxIdx]}
              alt=""
              onClick={(e) => e.stopPropagation()}
              className="max-w-[90vw] max-h-[88vh] object-contain rounded-xl shadow-2xl select-none"
            />

            {/* Next */}
            {lightboxIdx < imgs.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
                className="absolute right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors"
              >
                <ChevronRight size={26} />
              </button>
            )}

            {/* Thumbnail strip */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-2 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {imgs.map((src: string, i: number) => (
                <div
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  className={`shrink-0 w-14 h-10 rounded-md bg-cover bg-center cursor-pointer transition-all ${i === lightboxIdx ? "ring-2 ring-white opacity-100" : "opacity-40 hover:opacity-70"}`}
                  style={{ backgroundImage: `url(${src})` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── RIGHT sticky sidebar ──
            max-h/overflow keeps the card's bottom (the inquiry form's Send button)
            from ever sitting under the fixed Tidio chat bubble on short viewports —
            it scrolls internally instead of extending past the reserved bottom zone. */}
        <div className="lg:sticky lg:top-22.5 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:overscroll-contain border border-line rounded-2xl p-5.5 bg-white shadow-[0_18px_44px_-30px_rgba(0,16,46,.4)]">
          {/* Transaction type label + currency toggle */}
          <div className="flex items-center justify-between mb-4">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-[11.5px] font-bold border ${listing.transaction === "rent" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
            >
              {listing.transaction === "rent" ? t('sidebar.for_rent') : t('sidebar.for_sale')}
            </span>
            <div className="flex rounded-lg border border-line overflow-hidden text-[11px] font-bold">
              {(['DOP', 'USD'] as const).map(c => (
                <button key={c} type="button" onClick={() => setCurrency(c)}
                  className="px-2.5 py-1 transition-colors cursor-pointer"
                  style={{ background: currency === c ? '#00102e' : 'white', color: currency === c ? 'white' : '#64748b' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {listing.transaction !== "rent" ? (
            <>
              {(() => {
                const discounted = listing.is_deal && listing.deal_discount_value
                  ? (listing.deal_discount_type === 'fixed'
                      ? Math.round(Number(listing.price) - Number(listing.deal_discount_value))
                      : Math.round(Number(listing.price) * (1 - Number(listing.deal_discount_value) / 100)))
                  : null
                const effectivePrice = discounted ?? Number(listing.price)
                return (
                  <>
                    {discounted && (
                      <div className="inline-flex items-center gap-1.5 bg-coral/10 border border-coral/20 text-coral text-[11px] font-bold px-2.5 py-1 rounded-full mb-2">
                        {t('sidebar.deal_badge')} &nbsp;·&nbsp;
                        {listing.deal_discount_type === 'fixed'
                          ? t('sidebar.off_fixed', { amount: Number(listing.deal_discount_value).toLocaleString() })
                          : t('sidebar.off_pct', { pct: listing.deal_discount_value })}
                      </div>
                    )}
                    <div className="text-[32px] font-bold text-ink">
                      {currency === 'DOP'
                        ? `RD$${Math.round(effectivePrice * dopRate).toLocaleString("en-US")}`
                        : fmt(effectivePrice)}{" "}
                      <span className="text-[13px] text-ink2 mt-1">
                        {currency === 'DOP' ? 'DOP' : 'USD'}
                      </span>
                    </div>
                    {discounted ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[12.5px] text-dim line-through">
                          {currency === 'DOP'
                            ? `RD$${Math.round(Number(listing.price) * dopRate).toLocaleString("en-US")}`
                            : fmt(listing.price)}
                        </span>
                        <span className="text-[12px] text-ink2">{t('sidebar.original_price')}</span>
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-ink2 mt-0.5">
                        {currency === 'DOP'
                          ? `≈ ${fmt(listing.price)} USD`
                          : `≈ RD$${Math.round(Number(listing.price) * dopRate).toLocaleString("en-US")} DOP`}
                      </div>
                    )}
                  </>
                )
              })()}

              {[
                listing.roi && [t('sidebar.est_roi'), `${listing.roi}% ${t('unit.per_yr')}`],
                listing.hoa_fee && [
                  t('sidebar.hoa_fee'),
                  currency === 'DOP'
                    ? `RD$${Math.round(Number(listing.hoa_fee) * dopRate).toLocaleString('en-US')} ${t('unit.per_mo')}`
                    : `$${Number(listing.hoa_fee).toLocaleString()} ${t('unit.per_mo')}`,
                ],
                listing.tax_exempt && [t('sidebar.tax_label'), t('sidebar.tax_val')],
              ]
                .filter(Boolean)
                .map(([l, v]: any, i) => (
                  <div
                    key={i}
                    className="flex justify-between py-3.5 border-b border-line-soft text-[13.5px]"
                  >
                    <span className="text-ink2">{l}</span>
                    <span className="text-ink font-semibold">{v}</span>
                  </div>
                ))}
              <button
                onClick={() => go("calculator")}
                className="w-full flex justify-center items-center py-3 mt-4 rounded-full border-none cursor-pointer text-white font-sans text-[13.5px] font-bold bg-coral"
              >
                {t('sidebar.analyze')}
              </button>
            </>
          ) : (
            <>
              <div className="font-sans text-[30px] font-semibold text-ink">
                {currency === 'DOP'
                  ? `RD$${Math.round(Number(listing.price) * dopRate).toLocaleString("en-US")}`
                  : fmt(listing.price)}{" "}
                <span className="text-[16px] text-ink2 font-sans font-normal">
                  {currency === 'DOP' ? t('sidebar.per_mo_dop') : t('sidebar.per_mo_usd')}
                </span>
              </div>
              <div className="text-[12.5px] text-ink2 mt-0.5">
                {currency === 'DOP'
                  ? `≈ ${fmt(listing.price)} USD ${t('unit.per_mo')}`
                  : `≈ RD$${Math.round(Number(listing.price) * dopRate).toLocaleString("en-US")} DOP ${t('unit.per_mo')}`}
              </div>
              {[
                listing.price_per_day && [
                  t('sidebar.daily_rate'),
                  currency === 'DOP'
                    ? `RD$${Math.round(Number(listing.price_per_day) * dopRate).toLocaleString('en-US')} ${t('unit.per_day')}`
                    : `$${Number(listing.price_per_day).toLocaleString()} ${t('unit.per_day')}`,
                ],
                listing.price_per_month && [
                  t('sidebar.monthly_rate'),
                  currency === 'DOP'
                    ? `RD$${Math.round(Number(listing.price_per_month) * dopRate).toLocaleString('en-US')} ${t('unit.per_mo')}`
                    : `$${Number(listing.price_per_month).toLocaleString()} ${t('unit.per_mo')}`,
                ],
                listing.hoa_fee && [
                  t('sidebar.hoa_fee'),
                  currency === 'DOP'
                    ? `RD$${Math.round(Number(listing.hoa_fee) * dopRate).toLocaleString('en-US')} ${t('unit.per_mo')}`
                    : `$${Number(listing.hoa_fee).toLocaleString()} ${t('unit.per_mo')}`,
                ],
                listing.association_fee && [
                  t('sidebar.assoc_fee'),
                  currency === 'DOP'
                    ? `RD$${Math.round(Number(listing.association_fee) * dopRate).toLocaleString('en-US')} ${t('unit.per_mo')}`
                    : `$${Number(listing.association_fee).toLocaleString()} ${t('unit.per_mo')}`,
                ],
                listing.deposit_policy && listing.deposit_policy !== 'none' && [
                  t('sidebar.deposit'),
                  t('deposit.' + listing.deposit_policy, { defaultValue: listing.deposit_policy }),
                ],
              ]
                .filter(Boolean)
                .map(([l, v]: any, i) => (
                  <div
                    key={i}
                    className="flex justify-between py-3.5 border-b border-line-soft text-[13.5px]"
                  >
                    <span className="text-ink2">{l}</span>
                    <span className="text-ink font-semibold">{v}</span>
                  </div>
                ))}
              {bookingSent ? (
                <div className="mt-4 py-3 text-center text-[13px] text-emerald-700 font-semibold">
                  <CheckCircle2 size={15} className="inline mr-1.5" />{t('sidebar.booking_sent')}
                </div>
              ) : bookingOpen ? (
                <form onSubmit={handleBooking} className="mt-4 flex flex-col gap-2">
                  {bookingError && <div className="text-[12px] text-coral font-semibold text-center">{bookingError}</div>}
                  {listing?.price_per_day && listing?.price_per_month && (
                    <div>
                      <div className="text-[10.5px] font-bold text-ink2 uppercase tracking-wide mb-1">{t('booking.rental_type')}</div>
                      <div className="flex gap-1.5">
                        {(['daily', 'monthly'] as const).map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setRentalType(type)}
                            className={`flex-1 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer transition-colors font-sans ${
                              rentalType === type
                                ? 'bg-coral text-white border-coral'
                                : 'bg-transparent text-ink2 border-line'
                            }`}
                          >
                            {t(`booking.${type}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <input required placeholder={t('booking.name')} value={bookingForm.name}
                    onChange={e => setBookingForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 font-sans outline-none" />
                  <input required type="email" placeholder={t('booking.email')} value={bookingForm.email}
                    onChange={e => setBookingForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 font-sans outline-none" />
                  <PhoneInput
                    defaultCountry="us"
                    placeholder={t('booking.phone')}
                    value={bookingForm.phone}
                    onChange={phone => setBookingForm(f => ({ ...f, phone }))}
                    inputStyle={{ flex: 1, width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e4ddcf', borderLeft: 'none', borderRadius: '0 0.5rem 0.5rem 0', backgroundColor: '#ffffff', fontFamily: 'inherit', fontSize: '0.8125rem', color: '#00102e', outline: 'none' }}
                    countrySelectorStyleProps={{ buttonStyle: { border: '1px solid #e4ddcf', borderRight: 'none', borderRadius: '0.5rem 0 0 0.5rem', backgroundColor: '#f3f1ea', padding: '0 0.5rem', cursor: 'pointer', height: '100%' } }}
                  />
                  {rentalType === 'daily' && (
                    <div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10.5px] font-bold text-ink2 uppercase tracking-wide mb-1">{t('booking.check_in')}</div>
                          <input required type="date" value={bookingForm.checkIn}
                            min={todayStr}
                            onChange={e => {
                              const val = e.target.value
                              if (isDateBooked(val)) {
                                setBookingDateError(t('booking.error_date_unavailable'))
                                setBookingForm(f => ({ ...f, checkIn: '' }))
                              } else {
                                const spansBooked = !!bookingForm.checkOut && rangeBooked(val, bookingForm.checkOut)
                                setBookingDateError(spansBooked ? t('booking.error_date_unavailable') : '')
                                setBookingForm(f => ({ ...f, checkIn: val, checkOut: f.checkOut && (f.checkOut <= val || spansBooked) ? '' : f.checkOut }))
                              }
                            }}
                            className="w-full text-[12px] border border-line rounded-lg px-2 py-1.5 font-sans outline-none" />
                        </div>
                        <div>
                          <div className="text-[10.5px] font-bold text-ink2 uppercase tracking-wide mb-1">{t('booking.check_out')}</div>
                          <input required type="date" value={bookingForm.checkOut}
                            min={bookingForm.checkIn || todayStr}
                            onChange={e => {
                              const val = e.target.value
                              if (isCheckoutBlocked(val, bookingForm.checkIn)) {
                                setBookingDateError(t('booking.error_date_unavailable'))
                                setBookingForm(f => ({ ...f, checkOut: '' }))
                              } else {
                                setBookingDateError('')
                                setBookingForm(f => ({ ...f, checkOut: val }))
                              }
                            }}
                            className="w-full text-[12px] border border-line rounded-lg px-2 py-1.5 font-sans outline-none" />
                        </div>
                      </div>
                      {bookingDateError && <div className="text-[11.5px] text-coral mt-1">{bookingDateError}</div>}
                    </div>
                  )}
                  <div>
                    <div className="text-[10.5px] font-bold text-ink2 uppercase tracking-wide mb-1">{t('booking.guests')}</div>
                    <input type="number" min={1} max={20} value={bookingForm.guests}
                      onChange={e => setBookingForm(f => ({ ...f, guests: parseInt(e.target.value) || 1 }))}
                      className="w-full text-[13px] border border-line rounded-lg px-3 py-1.5 font-sans outline-none" />
                  </div>
                  <textarea rows={2} placeholder={t('booking.notes')} value={bookingForm.notes}
                    onChange={e => setBookingForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 font-sans outline-none resize-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setBookingOpen(false); setBookingError('') }}
                      className="flex-1 py-2 rounded-full border border-line text-[13px] font-semibold text-ink2 cursor-pointer bg-transparent font-sans">
                      {t('sidebar.cancel')}
                    </button>
                    {(!PAYPAL_CLIENT_ID || listing?.transaction !== 'rent' || !listing?.price_per_day || rentalType === 'monthly') && (
                      <button type="submit" disabled={bookingSending}
                        className="flex-1 py-2 rounded-full bg-coral text-white text-[13px] font-bold border-none cursor-pointer font-sans disabled:opacity-60">
                        {bookingSending ? t('sidebar.sending') : t('sidebar.request')}
                      </button>
                    )}
                  </div>
                  {PAYPAL_CLIENT_ID && listing?.transaction === 'rent' && listing?.price_per_day && rentalType === 'daily' && (
                    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, intent: 'authorize', currency: 'USD' }}>
                      <div className="mt-1">
                        <PayPalButtons
                          style={{ layout: 'vertical', shape: 'pill', label: 'pay', height: 40 }}
                          createOrder={async () => {
                            if (!bookingForm.checkIn || !bookingForm.checkOut) {
                              setBookingError(t('booking.error_dates'))
                              throw new Error('dates required')
                            }
                            if (!me && (!bookingForm.name.trim() || !bookingForm.email.trim())) {
                              setBookingError(t('booking.error_contact'))
                              throw new Error('contact required')
                            }
                            if (rangeBooked(bookingForm.checkIn, bookingForm.checkOut)) {
                              setBookingError(t('booking.error_date_unavailable'))
                              throw new Error('dates unavailable')
                            }
                            setBookingError('')
                            const result = await createPaymentAuth({ listing_id: id, check_in: bookingForm.checkIn, check_out: bookingForm.checkOut })
                            return result.paypal_order_id
                          }}
                          onApprove={async (data) => {
                            setBookingSending(true)
                            try {
                              await createBooking({
                                listing_id: id,
                                check_in: bookingForm.checkIn,
                                check_out: bookingForm.checkOut,
                                guests: bookingForm.guests,
                                notes: bookingForm.notes || undefined,
                                name: me ? undefined : bookingForm.name,
                                email: me ? undefined : bookingForm.email,
                                phone: me ? undefined : (bookingForm.phone || undefined),
                                paypal_order_id: data.orderID,
                              })
                              setBookingSent(true)
                            } catch (err: any) {
                              setBookingError(bookingErrorFor(err))
                            } finally {
                              setBookingSending(false)
                            }
                          }}
                          onError={() => setBookingError(t('booking.error_generic'))}
                        />
                      </div>
                    </PayPalScriptProvider>
                  )}
                  {/* Non-refundable payment terms — only meaningful when we actually collect payment */}
                  {PAYPAL_ENABLED && (
                    <p className="text-[11px] text-ink3 leading-relaxed mt-2">
                      {t('booking.deposit_disclaimer')}
                    </p>
                  )}
                </form>
              ) : (
                <button onClick={() => {
                  setBookingForm(f => ({
                    ...f,
                    name: me?.display_name || f.name,
                    email: me?.email || f.email,
                    phone: me?.phone || f.phone,
                  }))
                  setBookingOpen(true)
                }}
                  className="w-full flex justify-center items-center py-3 mt-4 rounded-full border-none cursor-pointer text-white font-sans text-[13.5px] font-bold bg-coral">
                  {t('sidebar.request_book')}
                </button>
              )}
              {/* Availability Calendar */}
              {!bookingSent && (() => {
                const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
                const firstDay = new Date(calYear, calMonth, 1).getDay()
                const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
                const todayMs = new Date(new Date().toDateString()).getTime()
                const prevMo = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
                const nextMo = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }
                const cells: React.ReactNode[] = []
                for (let i = 0; i < firstDay; i++) cells.push(<div key={`b${i}`} />)
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateMs = new Date(calYear, calMonth, d).getTime()
                  const isPast = dateMs < todayMs
                  const isToday = dateMs === todayMs
                  const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const isBooked = bookedRanges.some(r => ds >= r.check_in && ds < r.check_out)
                  const disabled = isPast || isBooked
                  cells.push(
                    <button key={d} type="button" disabled={disabled}
                      onClick={() => { setBookingForm(f => ({ ...f, name: me?.display_name || f.name, email: me?.email || f.email, phone: me?.phone || f.phone, checkIn: ds })); setBookingOpen(true) }}
                      className={`aspect-square w-full flex items-center justify-center rounded-full text-[11.5px] border-0 transition-colors font-sans ${isPast ? 'text-dim/40 bg-transparent cursor-default' : isBooked ? 'text-dim/40 bg-red-50 line-through cursor-default' : isToday ? 'bg-ink text-white font-bold cursor-pointer' : 'text-ink bg-transparent cursor-pointer hover:bg-blue-50 hover:text-blue-700 font-medium'}`}>
                      {d}
                    </button>
                  )
                }
                return (
                  <div className="mt-5 pt-4 border-t border-line-soft">
                    <div className="text-[10.5px] font-bold text-ink2 uppercase tracking-wide mb-3">Availability</div>
                    <div className="flex items-center justify-between mb-2">
                      <button type="button" onClick={prevMo} className="w-7 h-7 rounded-full border border-line bg-white text-ink2 flex items-center justify-center cursor-pointer hover:bg-paper2 transition-colors text-[14px]">‹</button>
                      <span className="text-[12.5px] font-semibold text-ink">{MONTHS[calMonth]} {calYear}</span>
                      <button type="button" onClick={nextMo} className="w-7 h-7 rounded-full border border-line bg-white text-ink2 flex items-center justify-center cursor-pointer hover:bg-paper2 transition-colors text-[14px]">›</button>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {['S','M','T','W','T','F','S'].map((d, i) => (
                        <div key={i} className="text-center text-[10px] font-bold text-dim">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">{cells}</div>
                    <p className="text-[11px] text-dim mt-2 text-center">Select a date to start booking</p>
                  </div>
                )
              })()}
            </>
          )}

          {/* Submitter / Agent contact */}
          {viewingUrl && <a href={viewingUrl}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-semibold text-sea no-underline hover:bg-paper2">
            <Calendar size={15} aria-hidden="true" /> {t('sidebar.request_viewing')}
          </a>}
          {listing.status === 'active' && isInquiryPropertyContext(id, listing.id) && (
            <>
              <ListingBrochureDownload key={listing.id} listingId={listing.id} />
              <ListingFloorPlan key={'floor-plan-' + listing.id} listingId={listing.id} />
            </>
          )}
          {listing.submitted_by_name && (
            <div className="mt-5 pt-4 border-t border-line-soft">
              <div className="text-[10.5px] font-bold text-ink2 uppercase tracking-wide mb-3">
                {t('sidebar.listed_by')}
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-full grid place-items-center font-bold font-sans shrink-0 text-white text-[14px]"
                  style={{ background: "var(--color-sea)" }}
                >
                  {listing.submitted_by_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-[14px] text-ink leading-tight">
                    {listing.submitted_by_name}
                  </div>
                  {listing.submitted_by_email && (
                    <div className="text-[12px] text-ink2 mt-0.5">
                      {listing.submitted_by_email}
                    </div>
                  )}
                </div>
              </div>
              {inquirySent ? (
                <div role="status" className="py-3 text-center text-[13px] text-emerald-700 font-semibold">
                  <CheckCircle2 size={15} aria-hidden="true" className="inline mr-1.5" />{t('sidebar.inquiry_sent')}
                  <p className="mt-2 text-ink2 font-normal">{t(`inquiry.follow_up_${inquiryFollowUp}`)}</p>
                  {inquiryReceipt ? <p className="mt-2 break-all text-xs font-normal text-dim">{t('inquiry.reference', { id: inquiryReceipt.id })}</p> : null}
                </div>
              ) : inquiryOpen ? (
                <form onSubmit={handleInquiry} noValidate aria-busy={inquirySending} className="flex flex-col gap-3">
                  <p id="property-inquiry-contact-help" className="text-xs leading-relaxed text-ink2">{t('inquiry.contact_help')}</p>
                  {inquiryError ? <p ref={inquiryStatus} tabIndex={-1} role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-900 outline-none">{t(`inquiry.errors.${inquiryError}`)}</p> : null}
                  <fieldset disabled={inquirySending} className="flex min-w-0 flex-col gap-3 disabled:opacity-70">
                  <label htmlFor="property-inquiry-name" className="text-xs font-semibold text-ink2">{t('inquiry.name')} *</label>
                  <input id="property-inquiry-name" name="name" required autoComplete="name" maxLength={200} value={inquiryForm.name}
                    onChange={e => setInquiryForm(f => ({ ...f, name: e.target.value }))}
                    aria-invalid={inquiryError === 'name'}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 font-sans outline-none" />
                  <label htmlFor="property-inquiry-phone" className="text-xs font-semibold text-ink2">{t('inquiry.phone')}</label>
                  <PhoneInput
                    defaultCountry="us"
                    placeholder={t('inquiry.phone')}
                    value={inquiryForm.phone}
                    disabled={inquirySending}
                    inputProps={{ id: 'property-inquiry-phone', name: 'phone', autoComplete: 'tel', maxLength: 50, 'aria-describedby': 'property-inquiry-contact-help', 'aria-invalid': inquiryError === 'phone' || inquiryError === 'contact' }}
                    onChange={(phone, metadata) => {
                      setInquiryPhoneDialCode(metadata.country.dialCode)
                      setInquiryForm(f => ({ ...f, phone }))
                    }}
                    inputStyle={{ flex: 1, width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e4ddcf', borderLeft: 'none', borderRadius: '0 0.5rem 0.5rem 0', backgroundColor: '#ffffff', fontFamily: 'inherit', fontSize: '0.8125rem', color: '#00102e', outline: 'none' }}
                    countrySelectorStyleProps={{ buttonStyle: { border: '1px solid #e4ddcf', borderRight: 'none', borderRadius: '0.5rem 0 0 0.5rem', backgroundColor: '#f3f1ea', padding: '0 0.5rem', cursor: 'pointer', height: '100%' } }}
                  />
                  <label htmlFor="property-inquiry-email" className="text-xs font-semibold text-ink2">{t('inquiry.email')}</label>
                  <input id="property-inquiry-email" name="email" type="email" autoComplete="email" maxLength={254} value={inquiryForm.email}
                    onChange={e => setInquiryForm(f => ({ ...f, email: e.target.value }))}
                    aria-describedby="property-inquiry-contact-help" aria-invalid={inquiryError === 'email' || inquiryError === 'contact'}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 font-sans outline-none" />
                  <label htmlFor="property-inquiry-comments" className="text-xs font-semibold text-ink2">{t('inquiry.message')}</label>
                  <textarea id="property-inquiry-comments" name="message" rows={3} maxLength={2000} value={inquiryForm.message}
                    onChange={e => setInquiryForm(f => ({ ...f, message: e.target.value }))}
                    aria-invalid={inquiryError === 'message'}
                    className="w-full text-[13px] border border-line rounded-lg px-3 py-2 font-sans outline-none resize-none" />
                  <label className="flex items-start gap-2 text-xs leading-relaxed text-ink2"><input type="checkbox" name="contact_consent" checked={inquiryConsent} onChange={e => setInquiryConsent(e.target.checked)} required aria-invalid={inquiryError === 'consent'} className="mt-0.5 h-4 w-4 shrink-0 accent-sea" /><span>{t('inquiry.contact_consent')}</span></label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setInquiryOpen(false)}
                      className="flex-1 py-2 rounded-full border border-line text-[13px] font-semibold text-ink2 cursor-pointer bg-transparent font-sans">
                      {t('sidebar.cancel')}
                    </button>
                    <button type="submit" disabled={inquirySending}
                      className="flex-1 py-2 rounded-full bg-sea text-white text-[13px] font-bold border-none cursor-pointer font-sans disabled:opacity-60">
                      {inquirySending ? t('sidebar.sending') : t('sidebar.send')}
                    </button>
                  </div>
                  </fieldset>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setInquiryForm(f => ({
                      ...f,
                      name: me?.display_name || f.name,
                      email: me?.email || f.email,
                      phone: me?.phone || f.phone,
                    }))
                    setInquiryOpen(true)
                  }}
                  className="w-full flex justify-center items-center gap-1.5 bg-transparent border border-line text-ink px-3 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer font-sans hover:bg-paper2 transition-colors">
                  <MessageCircle size={14} /> {t('sidebar.message_agent')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PropertyDetail({ id }: { id?: string } = {}) {
  const { t } = useTranslation('property_detail')
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-muted font-sans text-[14px]">
          {t('loading')}
        </div>
      }
    >
      <PropertyDetailInner id={id} />
    </Suspense>
  );
}
