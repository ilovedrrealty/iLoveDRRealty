const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const sourcePath = 'apps/dashboard/src/utils/ownerArrivalActivity.ts'
const source = fs.readFileSync(path.join(root, sourcePath), 'utf8')
function loadUtility() {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, Intl, Date })
  return module.exports
}
const utility = loadUtility()
const clone = value => JSON.parse(JSON.stringify(value))
const booking = (check_in, status = 'confirmed', total_price = 100) => ({ check_in, status, total_price })

test('DR calendar date and six-month window stay in October while UTC is already November', () => {
  const now = new Date('2026-11-01T02:59:59Z')
  const result = utility.buildOwnerArrivalActivity([
    booking('2026-10-31'), booking('2026-11-01'), booking('2026-05-01'), booking('2026-04-30'),
  ], now)
  assert.equal(result.timezone, 'America/Santo_Domingo')
  assert.equal(result.today, '2026-10-31')
  assert.deepEqual(clone(result.months.map(month => [month.key, month.count])), [
    ['2026-05', 1], ['2026-06', 0], ['2026-07', 0], ['2026-08', 0], ['2026-09', 0], ['2026-10', 1],
  ])
  assert.equal(result.thisMonthCount, 1)
})

test('DR midnight advances the window and keeps scheduled date-only check-ins in their own month', () => {
  const result = utility.buildOwnerArrivalActivity([
    booking('2026-10-31'), booking('2026-11-01'), booking('2026-11-02'), booking('2026-05-31'),
    booking('2026-10-31T23:00:00-04:00'),
  ], new Date('2026-11-01T04:00:00Z'))
  assert.equal(result.today, '2026-11-01')
  assert.deepEqual(clone(result.months.map(month => month.key)), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
  assert.equal(result.months[4].count, 1)
  assert.equal(result.thisMonthCount, 1)
})

test('strict calendar validation handles leap centuries and excludes overflow or timestamp coercion', () => {
  for (const valid of ['2024-02-29', '2000-02-29', '2026-04-30', '0001-01-01']) assert.equal(utility.isBookingCalendarDate(valid), true, valid)
  for (const invalid of ['2023-02-29', '1900-02-29', '2026-04-31', '2026-02-30', '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-2-01', ' 2026-02-01', '2026-02-01T00:00:00Z', null, undefined, 20260201, 'invalid']) {
    assert.equal(utility.isBookingCalendarDate(invalid), false, String(invalid))
  }
  const result = utility.buildOwnerArrivalActivity([
    booking('2024-02-29'), booking('2024-02-30'), booking('2024-02-31'), booking('2024-03-01'),
  ], new Date('2024-02-29T15:00:00Z'))
  assert.equal(result.thisMonthCount, 1)
})

test('counts only confirmed scheduled dates through today and never reads a price or payment field', () => {
  const data = [booking('2026-10-01', 'confirmed', 0), booking('2026-10-02', 'confirmed', null), booking('2026-10-03', 'confirmed', -999), booking('2026-10-04', 'pending', 999999), booking('2026-10-05', 'cancelled', 999999), booking('2026-10-06', 'unknown', 999999), booking('2026-10-27'), booking('2025-10-01')]
  data.push(new Proxy({ check_in: '2026-10-26', status: 'confirmed' }, {
    get(target, key) {
      assert.ok(['check_in', 'status'].includes(key), `Unexpected financial/data access: ${String(key)}`)
      return target[key]
    },
  }))
  const result = utility.buildOwnerArrivalActivity(data, new Date('2026-10-26T15:00:00Z'))
  assert.equal(result.thisMonthCount, 4)
  assert.equal(result.months.reduce((sum, month) => sum + month.count, 0), 4)
})

test('year rollover carries six unique calendar-month keys and year-bearing English/Spanish labels', () => {
  const now = new Date('2027-01-01T05:00:00Z')
  const data = [booking('2026-08-01'), booking('2026-12-31'), booking('2027-01-01'), booking('2026-07-31')]
  const en = utility.buildOwnerArrivalActivity(data, now, 'en-US')
  const es = utility.buildOwnerArrivalActivity(data, now, 'es-DO')
  assert.deepEqual(clone(en.months.map(month => month.key)), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
  assert.match(en.months[5].label, /Jan.*2027/)
  assert.match(es.months[5].label, /ene.*2027/i)
  assert.match(en.months[4].label, /Dec.*2026/)
  assert.match(es.months[4].label, /dic.*2026/i)
  assert.deepEqual(clone(en.months.map(month => month.count)), [1, 0, 0, 0, 1, 1])
})

test('valid empty data produces genuine zero counts and invalid reference time is refused', () => {
  const result = utility.buildOwnerArrivalActivity([], new Date('2026-10-26T15:00:00Z'))
  assert.equal(result.months.length, 6)
  assert.equal(result.thisMonthCount, 0)
  assert.ok(result.months.every(month => month.count === 0))
  assert.throws(() => utility.buildOwnerArrivalActivity([], new Date('invalid')), /Activity date is unavailable/)
})

test('owner booking API passes the cancellation signal to the existing read endpoint', async () => {
  const apiSource = fs.readFileSync(path.join(root, 'apps/dashboard/src/api/bookings.ts'), 'utf8')
  const calls = []
  const api = { get: async (...args) => { calls.push(args); return { data: [] } } }
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(apiSource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: name => { assert.equal(name, './axios'); return { __esModule: true, default: api } } })
  const signal = new AbortController().signal
  assert.deepEqual(clone(await module.exports.getOwnerBookings(signal)), [])
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/bookings/for-owner')
  assert.equal(calls[0][1].signal, signal)
})

test('OwnerHome wires count-only activity, real owner bookings, explicit errors and identity cancellation', () => {
  const home = fs.readFileSync(path.join(root, 'apps/dashboard/src/components/dashboard/OwnerHome.tsx'), 'utf8')
  assert.ok(!/total_price|buildRevenueBar|revenueBar|revenue_month|DollarSign|go\('earnings'\)/.test(home))
  assert.match(home, /buildOwnerArrivalActivity\(bookings, new Date\(\), i18n\.language\)/)
  assert.ok(!home.includes('Confirmed Arrivals'))
  assert.ok(!home.includes('timezone: arrivalActivity.timezone'))
  assert.match(home, /go\('owner-bookings'\)/)
  assert.match(home, /const currentBookingFeed = bookingFeed\.identity === bookingIdentity/)
  assert.match(home, /currentBookingFeed && bookingFeed\.status === 'ready' \? bookingFeed\.items : \[\]/)
  assert.match(home, /getOwnerBookings\(controller\.signal\)/)
  assert.match(home, /return \(\) => controller\.abort\(\)/)
  assert.match(home, /\[bookingIdentity, bookingRefresh\]/)
  assert.match(home, /if \(!controller\.signal\.aborted\) setBookingFeed\(\{ identity: bookingIdentity, status: 'error', items: \[\] \}\)/)
  assert.match(home, /bookingError \? '—' : String\(arrivalActivity\.thisMonthCount\)/)
  assert.match(home, /setBookingRefresh\(value => value \+ 1\)/)
})

test('EN/ES activity definitions and feed states match without changing the separate Earnings page', () => {
  const locale = lang => JSON.parse(fs.readFileSync(path.join(root, `apps/dashboard/src/locale/${lang}/owner.json`), 'utf8'))
  const en = locale('en'), es = locale('es')
  assert.deepEqual(Object.keys(en.arrival_activity).sort(), Object.keys(es.arrival_activity).sort())
  assert.equal(en.kpis.arrivals_month, 'Confirmed Bookings This Month')
  assert.equal(es.kpis.arrivals_month, 'Reservas confirmadas este mes')
  assert.equal(en.arrival_activity.title, 'Confirmed Booking Activity')
  assert.equal(es.arrival_activity.title, 'Actividad de reservas confirmadas')
  assert.ok(en.arrival_activity.sub.includes('Dominican Republic time'))
  assert.ok(es.arrival_activity.sub.includes('hora de República Dominicana'))
  assert.ok(!en.arrival_activity.sub.includes('{{timezone}}'))
  assert.ok(!es.arrival_activity.sub.includes('{{timezone}}'))
  for (const key of ['loading', 'load_error', 'retry']) { assert.equal(typeof en.bookings[key], 'string'); assert.equal(typeof es.bookings[key], 'string') }
  assert.ok(en.arrival_activity.definition.includes('scheduled check-in date'))
  assert.ok(en.arrival_activity.definition.includes('does not confirm guest arrival or payment'))
  assert.ok(es.arrival_activity.definition.includes('fecha de entrada programada'))
  assert.ok(es.arrival_activity.definition.includes('No confirma la llegada del huésped ni el pago'))
  assert.equal(en.earnings_page.chart_title, 'Monthly Revenue')
  assert.equal(es.earnings_page.chart_title, 'Ingresos mensuales')
})
