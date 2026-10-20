import type { LocalizedText, RealtorTool } from '../../../../packages/website-settings/src'
import { RECOMMENDED_DR_SOURCE_EVIDENCE } from '../../../../packages/website-settings/src/drResources'

export type ResearchTool = RealtorTool & {
  notes?: LocalizedText
  sourceUrl?: string
  organization?: string
  verifiedDate?: string
  configured?: boolean
}

// Verified against the named official sources on the recorded date. These are
// public links; account-specific configuration is loaded only after server auth.
export const BUILT_IN_RESEARCH_TOOLS: ResearchTool[] = [
  {
    "id": "ri-parcel-map",
    "title": {
      "en": "Official cadastral parcel map",
      "es": "Mapa oficial del parcelario catastral"
    },
    "description": {
      "en": "Research parcel geometry and cadastral references by map location, coordinates or positional cadastral number.",
      "es": "Consulta geometría y referencias catastrales por ubicación en el mapa, coordenadas o número posicional."
    },
    "category": {
      "en": "Parcel maps and location",
      "es": "Mapas y ubicación parcelaria"
    },
    "url": "https://servicios.ri.gob.do/ConsultaParcelario",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "Public entry point; security verification may be required. Supports historical, approved, cancelled and pre-2017 layers, plus KML/Excel downloads. Map results do not certify ownership or current encumbrances.",
      "es": "Acceso público; puede requerir verificación de seguridad. Incluye capas históricas, aprobadas, anuladas y previas a 2017, con descargas KML/Excel. El mapa no certifica titularidad ni cargas vigentes."
    },
    "sourceUrl": "https://ri.gob.do/wp-content/uploads/download/Instructivo%20para%20la%20nueva%20consulta%20del%20parcelario.pdf",
    "organization": "Registro Inmobiliario - Poder Judicial",
    "verifiedDate": "2026-10-17",
    "configured": false
  },
  {
    "id": "ri-positional-locator",
    "title": {
      "en": "Locate a property by cadastral reference",
      "es": "Localizar inmueble por referencia catastral"
    },
    "description": {
      "en": "Use a positional cadastral designation to research the property location.",
      "es": "Usa la designación catastral posicional para investigar la ubicación del inmueble."
    },
    "category": {
      "en": "Parcel maps and location",
      "es": "Mapas y ubicación parcelaria"
    },
    "url": "https://servicios.ri.gob.do/LocalizadorDeInmuebles",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "Public form requests the positional designation; displayed result fields include coordinates, area, province and municipality. A locator is not a legal-status certificate.",
      "es": "El formulario público solicita la designación posicional; muestra campos de coordenadas, área, provincia y municipio. No equivale a una certificación del estado jurídico."
    },
    "sourceUrl": "https://servicios.ri.gob.do/LocalizadorDeInmuebles",
    "organization": "Registro Inmobiliario - Poder Judicial",
    "verifiedDate": "2026-10-17",
    "configured": false
  },
  {
    "id": "ri-document-verification",
    "title": {
      "en": "Verify a Registry document",
      "es": "Verificar documento del Registro"
    },
    "description": {
      "en": "Check the authenticity of an issued Registry product using document details.",
      "es": "Consulta la autenticidad de un producto emitido por el Registro con los datos del documento."
    },
    "category": {
      "en": "Title documents and records",
      "es": "Documentos de títulos y registros"
    },
    "url": "https://servicios.ri.gob.do/consultadeproductos",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "Enter document type, serial and matrícula. Coverage is limited to the offices listed on the portal. Verifying a past document does not establish current ownership, liens or litigation.",
      "es": "Introduce tipo de documento, serial y matrícula. La cobertura depende de las oficinas indicadas en el portal. Validar un documento previo no acredita titularidad, cargas o litigios actuales."
    },
    "sourceUrl": "https://servicios.ri.gob.do/consultadeproductos",
    "organization": "Registro Inmobiliario - Poder Judicial",
    "verifiedDate": "2026-10-17",
    "configured": false
  },
  {
    "id": "ri-legal-status-certificate",
    "title": {
      "en": "Request a current legal-status certificate",
      "es": "Solicitar certificación del estado jurídico"
    },
    "description": {
      "en": "Request the official document reporting the property legal status and current entries as of its issue date.",
      "es": "Solicita el documento oficial que acredita el estado jurídico y los asientos vigentes del inmueble a su fecha de emisión."
    },
    "category": {
      "en": "Title documents and records",
      "es": "Documentos de títulos y registros"
    },
    "url": "https://servicios.ri.gob.do/OficinaVirtualRT",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "Requires a Registry account, a property-specific request, supporting documents and applicable fees. Confirm current requirements and processing times on the official portal. Complete the request there.",
      "es": "Requiere una cuenta del Registro, solicitud del inmueble, documentos de respaldo y tasas aplicables. Confirma requisitos y plazos vigentes en el portal oficial. Completa allí la solicitud."
    },
    "sourceUrl": "https://ri.gob.do/wp-content/uploads/Tramites/DNRT/CERTIFICACION_DEL_ESTADO_JURIDICO_DEL_INMUEBLE.pdf",
    "organization": "Registro Inmobiliario - Poder Judicial",
    "verifiedDate": "2026-10-17",
    "configured": false
  },
  {
    "id": "ri-public-records",
    "title": {
      "en": "Request access to public property records",
      "es": "Solicitar consulta de documentos públicos"
    },
    "description": {
      "en": "Follow Registry instructions to access documents available through its consultation service.",
      "es": "Consulta las instrucciones del Registro para acceder a documentos de su servicio de consultas."
    },
    "category": {
      "en": "Title documents and records",
      "es": "Documentos de títulos y registros"
    },
    "url": "https://ri.gob.do/?p=17011",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "RI guidance requires prior registration in its virtual Title Registry office. Current official navigation links a Microsoft-hosted request form; access conditions and quotas must be checked there. Guidance article describes an older pilot, not guaranteed current quotas.",
      "es": "La guía del RI requiere registro previo en su Oficina Virtual de Registro de Títulos. El menú oficial enlaza un formulario de Microsoft; las condiciones y cupos deben verificarse allí. El artículo describe un piloto anterior y no garantiza cupos actuales."
    },
    "sourceUrl": "https://ri.gob.do/?p=17011",
    "organization": "Registro Inmobiliario - Poder Judicial",
    "verifiedDate": "2026-10-17",
    "configured": false
  },
  {
    "id": "ign-maps",
    "title": {
      "en": "IGN official map viewer",
      "es": "Visor oficial de mapas del IGN"
    },
    "description": {
      "en": "Open the map application linked by the Dominican National Geographic Institute.",
      "es": "Abre la aplicación de mapas enlazada por el Instituto Geográfico Nacional dominicano."
    },
    "category": {
      "en": "Geographic context",
      "es": "Contexto geográfico"
    },
    "url": "https://mapas.ign.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "Public application shell responds successfully; JavaScript is required. It supplies geographic context rather than legal title certification. Individual map/data licensing must be checked before reuse.",
      "es": "La aplicación pública responde correctamente y requiere JavaScript. Ofrece contexto geográfico, no certificación de títulos. Deben comprobarse las licencias de cada mapa/dato antes de reutilizarlo."
    },
    "sourceUrl": "https://ign.gob.do/",
    "organization": "Instituto Geográfico Nacional / IDERD",
    "verifiedDate": "2026-10-17",
    "configured": false
  },
  {
    "id": "iderd-geoservices",
    "title": {
      "en": "IDERD official maps and geoservices",
      "es": "Mapas y geoservicios oficiales de la IDERD"
    },
    "description": {
      "en": "Discover official spatial-data services and links to the national geographic viewer and metadata catalog.",
      "es": "Descubre servicios oficiales de datos espaciales y enlaces al visor geográfico nacional y catálogo de metadatos."
    },
    "category": {
      "en": "Geographic context",
      "es": "Contexto geográfico"
    },
    "url": "https://iderd.gob.do/recursos/directorio-de-geoservicios/",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "Directory documents WMS, WMTS, WFS and CSW services. Portal terms restrict commercial reproduction without permission, subject to applicable dataset licenses. Check each layer license and attribution before integrating data.",
      "es": "El directorio documenta servicios WMS, WMTS, WFS y CSW. Los términos restringen la reproducción comercial sin autorización, salvo licencias aplicables de los datos. Comprueba licencia y atribución de cada capa antes de integrarla."
    },
    "sourceUrl": "https://iderd.gob.do/recursos/directorio-de-geoservicios/",
    "organization": "Instituto Geográfico Nacional / IDERD",
    "verifiedDate": "2026-10-17",
    "configured": false
  },
  {
    "id": "dgcn-property-location",
    "title": {
      "en": "Request a cadastral property-location document",
      "es": "Solicitar ubicación de inmueble por designación catastral"
    },
    "description": {
      "en": "Review the Catastro Nacional service connecting a cadastral reference, title and survey-plan location.",
      "es": "Consulta el servicio de Catastro Nacional que relaciona referencia catastral, título y plano de mensura."
    },
    "category": {
      "en": "Parcel maps and location",
      "es": "Mapas y ubicación parcelaria"
    },
    "url": "https://www.catastro.gob.do/index.php/servicios/item/448-ubicacion-de-inmueble-por-designacion-catastral",
    "enabled": true,
    "access": "public",
    "mode": "link",
    "notes": {
      "en": "Review the official request form, current fee and available service channels before requesting. This location document is separate from a Registry legal-status certificate.",
      "es": "Consulta el formulario oficial, la tasa vigente y los canales disponibles antes de solicitar. Este documento de ubicación es distinto de la certificación del estado jurídico del Registro."
    },
    "sourceUrl": "https://www.catastro.gob.do/index.php/servicios/item/448-ubicacion-de-inmueble-por-designacion-catastral",
    "organization": "Dirección General del Catastro Nacional",
    "verifiedDate": "2026-10-17",
    "configured": false
  }
]

export function safeResearchUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}

export function mergeResearchTools(configured: RealtorTool[]): ResearchTool[] {
  const builtins = new Map(BUILT_IN_RESEARCH_TOOLS.map(tool => [tool.id, tool]))
  const tools = new Map<string, ResearchTool>()
  for (const tool of configured) {
    if (!safeResearchUrl(tool.url)) continue
    const entry: RealtorTool = {
      id: tool.id, title: tool.title, description: tool.description, category: tool.category,
      url: tool.url, enabled: tool.enabled, access: tool.access, mode: tool.mode,
    }
    const original = builtins.get(tool.id)
    const reviewedSource = RECOMMENDED_DR_SOURCE_EVIDENCE[tool.id]
    const evidence = reviewedSource?.url === tool.url ? reviewedSource : {}
    tools.set(tool.id, original?.url === tool.url
      ? { ...original, ...entry, configured: true }
      : { ...entry, ...evidence, configured: true })
  }
  for (const tool of BUILT_IN_RESEARCH_TOOLS) if (!tools.has(tool.id)) tools.set(tool.id, tool)
  return [...tools.values()].filter(tool => tool.enabled && tool.mode === 'link' && safeResearchUrl(tool.url))
}

export type AreaUnit = 'm2' | 'sqft' | 'hectares'
const SQUARE_METRES_PER_UNIT: Record<AreaUnit, number> = { m2: 1, sqft: 0.09290304, hectares: 10000 }

export function convertArea(amount: number, from: AreaUnit, to: AreaUnit): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null
  const result = amount * SQUARE_METRES_PER_UNIT[from] / SQUARE_METRES_PER_UNIT[to]
  return Number.isFinite(result) ? result : null
}

export const CHECKLIST_ITEMS = [
  'reference', 'certificate', 'review', 'survey', 'permits', 'balances', 'rules', 'followup',
] as const
