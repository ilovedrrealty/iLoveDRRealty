'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { readFileSync } = require('node:fs')

const src = resolve(__dirname, '../apps/landing/src')
const contractUrl = pathToFileURL(resolve(src, 'data/listingRoomTour.ts')).href
const objectBase = 'https://synthetic-project.supabase.co/storage/v1/object/public/listing-images/synthetic-listing/'
const cover = objectBase + 'cover.jpg'
const kitchen = objectBase + 'kitchen.jpg'
const detail = objectBase + 'kitchen-detail.webp'
const bedroom = objectBase + 'bedroom.png'
const images = Object.freeze([cover, bedroom, kitchen, detail])
const tour = {
  groups: [
    { id: 'kitchen', label_en: 'Kitchen', label_es: 'Cocina', photos: [
      { url: kitchen, caption_en: 'Kitchen counter', caption_es: 'Encimera de la cocina' },
      { url: detail },
    ] },
    { id: 'bedroom', label_en: 'Bedroom', label_es: 'Dormitorio', photos: [{ url: bedroom }] },
  ],
}

async function parseTour(value, approved = images) {
  const { parseListingRoomTour } = await import(contractUrl)
  return parseListingRoomTour(value, approved)
}

test('preserves explicit room and photo order without altering the full gallery or cover', async () => {
  const parsed = await parseTour(tour)
  assert.deepEqual(parsed, tour)
  assert.notEqual(parsed.groups, tour.groups)
  assert.deepEqual(images, [cover, bedroom, kitchen, detail])
  assert.equal(parsed.groups[0].photos[0].caption_es, 'Encimera de la cocina')
})

test('missing, empty, malformed, or non-bilingual optional data leaves the legacy gallery available', async () => {
  for (const value of [undefined, null, { groups: [] }, {}, { groups: tour.groups, draft: true },
    { groups: [{ ...tour.groups[0], label_es: '' }] }, { groups: [{ ...tour.groups[0], label_es: ' Cocina' }] },
    { groups: [{ ...tour.groups[0], photos: [] }] },
    { groups: [{ ...tour.groups[0], photos: [{ url: kitchen, caption_en: 'Single language' }] }] },
    { groups: [{ ...tour.groups[0], photos: [{ url: kitchen, object_key: 'do not expose' }] }] },
  ]) assert.equal(await parseTour(value), null)
  assert.equal(await parseTour(tour, { images }), null)
})

test('can group an already-published gallery with 36 photos without changing the upload limit', async () => {
  const existing = Array.from({ length: 36 }, (_, index) => objectBase + `photo-${index}.jpg`)
  const groups = Array.from({ length: 9 }, (_, index) => ({
    id: `room-${index + 1}`,
    label_en: `Room ${index + 1}`,
    label_es: `Ambiente ${index + 1}`,
    photos: existing.slice(index * 4, (index + 1) * 4).map(url => ({ url })),
  }))
  assert.deepEqual(await parseTour({ groups }, existing), { groups })
})

test('rejects a stale photo reference or a duplicate photo or group across the entire tour', async () => {
  assert.equal(await parseTour(tour, [cover, bedroom, kitchen]), null)
  const [first, second] = tour.groups
  assert.equal(await parseTour({ groups: [first, { ...second, photos: [{ url: kitchen }] }] }), null)
  assert.equal(await parseTour({ groups: [first, { ...second, id: first.id }] }), null)
})

test('refuses private, signed, foreign, credentialed and noncanonical references even if in the images input', async () => {
  for (const url of [
    kitchen.replace('/object/public/listing-images/', '/object/authenticated/property-network-private/'),
    kitchen.replace('/object/public/listing-images/', '/object/sign/property-network-private/') + '?token=synthetic',
    kitchen.replace('/listing-images/', '/property-network-private/'),
    kitchen.replace('synthetic-project.supabase.co', 'external.example'),
    kitchen.replace('https://', 'https://synthetic-user@'),
    kitchen.replace('/synthetic-listing/', '/synthetic-listing/../'),
    kitchen.replace('kitchen.jpg', 'private%2fphoto.jpg'),
    kitchen + '?token=synthetic',
    kitchen + '#photo',
    '/property-network/media/synthetic',
  ]) {
    const payload = { groups: [{ ...tour.groups[0], photos: [{ url }] }] }
    assert.equal(await parseTour(payload, [url]), null)
  }
})

test('room viewer controls have independent English and Spanish copy and numbered placeholders', () => {
  const roomTour = lang => JSON.parse(readFileSync(resolve(src, `locales/${lang}/property_detail.json`), 'utf8')).room_tour
  const english = roomTour('en'), spanish = roomTour('es')
  assert.deepEqual(Object.keys(english), Object.keys(spanish))
  for (const key of Object.keys(english)) {
    assert.ok(english[key] && spanish[key])
    assert.notEqual(english[key], spanish[key])
    const placeholders = value => (value.match(/{{\w+}}/g) ?? []).sort()
    assert.deepEqual(placeholders(english[key]), placeholders(spanish[key]))
  }
})
