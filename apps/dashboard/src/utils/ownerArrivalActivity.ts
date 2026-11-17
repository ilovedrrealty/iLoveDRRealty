export const OWNER_ACTIVITY_TIME_ZONE = 'America/Santo_Domingo'

interface ArrivalBooking {
  status: string
  check_in: string
}

export interface OwnerArrivalMonth {
  key: string
  label: string
  count: number
}

/** Booking check-in is a calendar date, not a UTC timestamp. Never normalize invalid dates. */
export function isBookingCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= days[month - 1]
}

export function dominicanCalendarDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Activity date is unavailable')
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OWNER_ACTIVITY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)!.value
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
}

/** Count confirmed records by their scheduled check-in date, through today; never read prices. */
export function buildOwnerArrivalActivity(bookings: readonly ArrivalBooking[], now = new Date(), language = 'en') {
  const today = dominicanCalendarDate(now)
  const currentMonth = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1
  const labelFormat = new Intl.DateTimeFormat(language.startsWith('es') ? 'es-DO' : 'en-US', {
    timeZone: 'UTC', month: 'short', year: 'numeric',
  })
  const months: OwnerArrivalMonth[] = Array.from({ length: 6 }, (_, index) => {
    const serialMonth = currentMonth - 5 + index
    const year = Math.floor(serialMonth / 12)
    const month = serialMonth - year * 12
    const date = new Date(0)
    date.setUTCFullYear(year, month, 15)
    return {
      key: `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`,
      label: labelFormat.format(date),
      count: 0,
    }
  })
  for (const booking of bookings) {
    if (booking?.status !== 'confirmed' || !isBookingCalendarDate(booking.check_in) || booking.check_in > today) continue
    const month = months.find(value => value.key === booking.check_in.slice(0, 7))
    if (month) month.count += 1
  }
  return { today, timezone: OWNER_ACTIVITY_TIME_ZONE, months, thisMonthCount: months[5].count }
}
