const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../apps/landing/src/data/spatialSearch.ts'), 'utf8')
const moduleState = { exports: {} }
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleState, exports: moduleState.exports })
const { parseSpatialSearch, serializeSpatialSearch } = moduleState.exports
const plain = value => JSON.parse(JSON.stringify(value))
const point = (lat, lng) => ({ lat, lng })
const polygon = (...vertices) => ({ kind: 'polygon', vertices })

test('radius round-trips, including all valid inclusive boundaries', () => {
  for (const [lat, lng, km] of [[19.751234, -70.411234, 25.125], [-85, -180, 0.1], [85, 180, 500], [0, 0, 1]]) {
    const circle = { kind: 'radius', center: point(lat, lng), km }
    const wire = `radius,${lat},${lng},${km}`
    assert.equal(serializeSpatialSearch(circle), wire)
    assert.deepEqual(plain(parseSpatialSearch(wire)), circle)
  }
  assert.equal(serializeSpatialSearch(parseSpatialSearch('radius,000.000,-0,00.100000')), 'radius,0,0,0.1')
  assert.equal(serializeSpatialSearch(parseSpatialSearch('radius,' + '0'.repeat(589) + ',0,1')), 'radius,0,0,1')
})

test('rejects malformed decimal tokens, incorrect arity, and out-of-range radius values', () => {
  for (const wire of [
    '', 'Radius,0,0,1', 'radius,0,0', 'radius,0,0,1,2', 'radius,,0,1', 'radius,0,0,1,',
    'radius,+1,0,1', 'radius,.1,0,1', 'radius,1.,0,1', 'radius,1e0,0,1', 'radius,1_0,0,1',
    'radius,1,0,Infinity', 'radius,1,NaN,1', 'radius,1,0,1.0000001', 'radius,85.000001,0,1',
    'radius,0,-180.000001,1', 'radius,0,0,0.099999', 'radius,0,0,500.000001',
    'radius,1, 0,1', 'radius,1,0,1\n', 'radius,1\r,0,1', 'radius,1,0,1\u2028',
    'radius,\u0661,0,1', 'radius,' + '0'.repeat(600) + ',0,1',
    'polygon,0,0,1,1', 'polygon,0,0,0,2,2,0,3', 'polygon,0,0,0,2,86,0',
  ]) assert.equal(parseSpatialSearch(wire), null, JSON.stringify(wire))
})

test('serialization rounds map coordinates to six decimal places and validates the result', () => {
  const center = point(19.75123466, -70.41123466)
  const rounded = serializeSpatialSearch({ kind: 'radius', center, km: 37.00000001 })
  assert.equal(rounded, 'radius,19.751235,-70.411235,37')
  assert.deepEqual(center, point(19.75123466, -70.41123466))
  assert.equal(serializeSpatialSearch({ kind: 'radius', center: point(-0, 0.0000001), km: 0.1 }), 'radius,0,0,0.1')
  assert.equal(serializeSpatialSearch({ kind: 'radius', center: point(Infinity, 0), km: 0.1 }), null)
  assert.equal(serializeSpatialSearch({ kind: 'radius', center: point(0, 0), km: NaN }), null)
  assert.equal(serializeSpatialSearch({ kind: 'radius', center: point(85.000003, 0), km: 1 }), null)
  assert.equal(serializeSpatialSearch(polygon(point(0, 0), point(0.0000002, 0), point(0, 2))), null)
  assert.equal(serializeSpatialSearch({ kind: 'polygon', vertices: [point(0, 0), , point(0, 1), point(1, 0)] }), null)
})

test('polygon round-trips preserve vertex order, concavity and permitted straight intermediate vertices', () => {
  const vertices = [
    point(0, 0), point(0, 2), point(0, 4), point(2, 4),
    point(2, 2), point(4, 2), point(4, 0),
  ]
  for (const order of [vertices, vertices.slice().reverse()]) {
    const shape = polygon(...order)
    const wire = 'polygon,' + order.flatMap(({ lat, lng }) => [lat, lng]).join(',')
    assert.equal(serializeSpatialSearch(shape), wire)
    assert.deepEqual(plain(parseSpatialSearch(wire)), shape)
  }
})

test('rejects repeated vertices, zero area, intersections, and overlapping or touching edges', () => {
  for (const wire of [
    'polygon,0,0,0,2,2,0,0,0',
    'polygon,0,0,0,2,0,000.000000,2,0',
    'polygon,0,0,0,1,0,2',
    'polygon,-20,0,0,1,20,2',
    'polygon,0,0,2,2,0,2,2,0',
    'polygon,0,0,0,4,4,4,0,2,4,0',
    'polygon,0,0,0,4,0,2,2,2,2,0',
  ]) assert.equal(parseSpatialSearch(wire), null, wire)
})

test('uses Mercator edges and keeps small valid polygons', () => {
  const nonlinearProjection = polygon(point(60, -71), point(65, -70), point(70, -69))
  const tiny = polygon(point(84.999999, -70), point(85, -70), point(85, -69.999999))
  for (const shape of [nonlinearProjection, tiny]) {
    const wire = serializeSpatialSearch(shape)
    assert.ok(wire)
    assert.deepEqual(plain(parseSpatialSearch(wire)), shape)
  }
})

test('requires 3 through 24 vertices and a longitude span strictly less than 180 degrees', () => {
  const side = Array.from({ length: 6 }, (_, i) => i)
  const perimeter = [
    ...side.map(i => point(0, i)), ...side.map(i => point(i, 6)),
    ...side.map(i => point(6, 6 - i)), ...side.map(i => point(6 - i, 0)),
  ]
  assert.equal(parseSpatialSearch(serializeSpatialSearch(polygon(...perimeter))).vertices.length, 24)
  assert.equal(serializeSpatialSearch(polygon(...perimeter, point(0.5, 0))), null)
  assert.equal(parseSpatialSearch('polygon,' + [...perimeter, point(0.5, 0)].flatMap(Object.values).join(',')), null)
  assert.equal(parseSpatialSearch('polygon,0,-90.123456,0,89.876544,1,0'), null)
  assert.ok(parseSpatialSearch('polygon,0,-90.123456,0,89.876543,1,0'))
  assert.equal(parseSpatialSearch('polygon,0,179,1,-179,2,179'), null)
})
