// Shared design tokens — use these everywhere to keep all pages consistent.
// Mirrors the tailwind.config.js custom colors and font stacks.

export const c = {
  ink:       '#00102e',
  ink2:      '#33425f',
  muted:     '#7884a0',
  paper:     '#ffffff',
  paper2:    '#f3f1ea',
  card:      '#ffffff',
  line:      '#e4ddcf',
  lineSoft:  '#eee9dd',
  coral:     '#e10f1f',
  coralDeep: '#b80a17',
  sea:       '#0b63ab',
  seaDeep:   '#003a73',
  gold:      '#f0a800',
  goldDeep:  '#c98700',
  green:     '#1f7a3d',
} as const

export const fontSerif = '"Fraunces", "Playfair Display", Georgia, serif'
export const fontSans  = '"Mona Sans", "Inter", -apple-system, system-ui, sans-serif'

// Nav items — used by Navbar and App router.
// [routeKey, label]
export const NAV_ITEMS: [string, string][] = [
  ['search',     'Search'],
  ['rentals',    'Rentals'],
  ['buying',     'Buying'],
  ['selling',    'Selling'],
  ['blog',       'Resources'],
  ['team',       'Our Team'],
  ['contact',    'Contact'],
  ['calculator', 'ROI Calculator'],
]
