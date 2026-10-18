export interface Listing {
  id: string
  title: string
  region: string
  price: number
  bd: number
  ba: number
  m2: number
  roi: number
  tags: [string, string][]
  type: string
  purpose: 'sale' | 'rent'
  features: string[]
  v: number
  img: string
  latitude?: number | null
  longitude?: number | null
  is_deal?: boolean
  deal_discount_value?: number | null
  deal_discount_type?: string
  created_at?: string | null
  currency?: string
  pricePeriod?: 'month' | 'day'
}

export const LISTINGS: Listing[] = [
  { id: '1', title: 'Oceanfront Villa with Infinity Pool',  region: 'Cap Cana, La Altagracia',   price: 2450000, bd: 6, ba: 7, m2: 640,  roi: 8.4, tags: [['Luxury',     'gold']],  type: 'Villa',      purpose: 'sale', features: [], v: 0, img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80&auto=format&fit=crop' },
  { id: '2', title: 'Penthouse Condo — Piantini',           region: 'Piantini, Santo Domingo',   price:  389000, bd: 3, ba: 3, m2: 185,  roi: 6.8, tags: [['New',        'sea']],   type: 'Condo',      purpose: 'sale', features: [], v: 1, img: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80&auto=format&fit=crop' },
  { id: '3', title: 'Tropical Golf Community Villa',        region: 'Punta Cana, La Altagracia', price:  875000, bd: 5, ba: 5, m2: 420,  roi: 9.1, tags: [['Investment', 'coral']], type: 'Villa',      purpose: 'sale', features: [], v: 2, img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80&auto=format&fit=crop' },
  { id: '4', title: 'Modern Beachfront Residence',          region: 'Las Terrenas, Samaná',      price: 1200000, bd: 4, ba: 4, m2: 350,  roi: 7.6, tags: [['Luxury',     'gold']],  type: 'Villa',      purpose: 'sale', features: [], v: 3, img: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=600&q=80&auto=format&fit=crop' },
  { id: '5', title: 'Furnished Luxury Apartment',           region: 'Naco, Santo Domingo',       price:    3800, bd: 2, ba: 2, m2: 120,  roi: 0,   tags: [['For Rent',   'green']], type: 'Condo',      purpose: 'rent', features: [], v: 1, img: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80&auto=format&fit=crop' },
  { id: '6', title: 'Class-A Commercial Building',          region: 'Santo Domingo Este',        price:  540000, bd: 0, ba: 0, m2: 2400, roi: 9.8, tags: [['Commercial', 'sea']],   type: 'Commercial', purpose: 'sale', features: [], v: 2, img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80&auto=format&fit=crop' },
  { id: '7', title: 'Cliffside Designer Villa',             region: 'Sosúa, Puerto Plata',       price: 1650000, bd: 5, ba: 6, m2: 510,  roi: 8.9, tags: [['Luxury',     'gold']],  type: 'Villa',      purpose: 'sale', features: [], v: 0, img: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=600&q=80&auto=format&fit=crop' },
  { id: '8', title: 'Garden Condo near Marina',             region: 'Cabarete, Puerto Plata',    price:  245000, bd: 2, ba: 2, m2:  96,  roi: 7.2, tags: [['Investment', 'coral']], type: 'Condo',      purpose: 'sale', features: [], v: 3, img: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&q=80&auto=format&fit=crop' },
]

export const fmt = (n: number) =>
  n >= 1_000_000_000_000 ? `$${(n / 1_000_000_000_000).toFixed(2)}T` :
  n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(2)}B` :
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`

export const fmtDOP = (n: number) =>
  n >= 1_000_000_000_000 ? `RD$${(n / 1_000_000_000_000).toFixed(2)}T` :
  n >= 1_000_000_000 ? `RD$${(n / 1_000_000_000).toFixed(2)}B` :
  n >= 1_000_000 ? `RD$${(n / 1_000_000).toFixed(1)}M` :
  `RD$${Math.round(n / 1_000)}K`
