const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

test('downloadable template includes required and optional location columns without invented property rows', () => {
  const lines = fs.readFileSync(path.join(root, 'apps/dashboard/public/templates/listing-import.csv'), 'utf8').trim().split(/\r?\n/)
  assert.equal(lines.length, 1)
  const fields = lines[0].split(',')
  assert.equal(new Set(fields).size, fields.length)
  for (const field of ['title', 'property_type', 'purpose', 'region', 'currency', 'price', 'description_en', 'co_listing_enabled', 'assigned_agent_id', 'source_ref', 'photo_urls', 'maps_url', 'latitude', 'longitude']) assert.ok(fields.includes(field), field)
})

test('both languages explain paired verified coordinates, optional old CSV compatibility and no overwrite', () => {
  for (const language of ['en', 'es']) {
    const copy = JSON.parse(fs.readFileSync(path.join(root, `apps/dashboard/src/locale/${language}/admin.json`), 'utf8')).bulk_import_page
    for (const key of ['download_template', 'template_help', 'location_help', 'location_limits']) assert.ok(copy[key]?.length > 20, `${language}.${key}`)
    for (const field of ['maps_url', 'latitude', 'longitude']) assert.ok(copy.location_help.includes(field))
    assert.match(copy.location_limits, /source_ref/)
  }
  const component = fs.readFileSync(path.join(root, 'apps/dashboard/src/pages/admin/BulkImportListings.tsx'), 'utf8')
  assert.match(component, /href="\/templates\/listing-import\.csv" download/)
})
