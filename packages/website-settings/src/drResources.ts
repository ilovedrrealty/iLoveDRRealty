import type { RealtorTool, WebsiteResource, WebsiteSettings } from './index'

/** Curated from the owner's DR directory; original links checked 2026-10-18, additions below 2026-10-20. */
export const RECOMMENDED_DR_TOOLS: RealtorTool[] = [
  {
    "id": "dr-dgii-transfer-tax",
    "title": {
      "en": "DGII transfer-tax calculator",
      "es": "Calculadora de transferencia de la DGII"
    },
    "description": {
      "en": "Estimate property transfer tax using the official DGII calculator. Confirm the assessed value and any applicable exemption with your adviser.",
      "es": "Estima el impuesto de transferencia con la calculadora oficial de la DGII. Confirma el valor fiscal y cualquier exención aplicable con tu asesor."
    },
    "category": {
      "en": "Taxes & closing",
      "es": "Impuestos y cierre"
    },
    "url": "https://www.dgii.gov.do/app/WebApps/Calculadoras/transferenciaInmobiliaria/CalculoTransferencia.aspx",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-dgii-ipi",
    "title": {
      "en": "DGII property tax (IPI)",
      "es": "Impuesto al Patrimonio Inmobiliario (IPI)"
    },
    "description": {
      "en": "Read current DGII guidance on annual property tax, exemptions and payment requirements.",
      "es": "Consulta la orientación vigente de la DGII sobre el impuesto inmobiliario anual, las exenciones y los requisitos de pago."
    },
    "category": {
      "en": "Taxes & closing",
      "es": "Impuestos y cierre"
    },
    "url": "https://ws945695e.dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/impuestoPatrimonioInmobiliario.aspx",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-dgii-rnc",
    "title": {
      "en": "Verify a business RNC",
      "es": "Consultar el RNC de un negocio"
    },
    "description": {
      "en": "Look up a business tax registration with DGII before engaging a contractor or service provider.",
      "es": "Consulta el registro tributario de un negocio en la DGII antes de contratar un proveedor de servicios."
    },
    "category": {
      "en": "Professional credentials",
      "es": "Credenciales profesionales"
    },
    "url": "https://dgii.gov.do/app/WebApps/ConsultasWeb2/ConsultasWeb/consultas/rnc.aspx",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-sb-lenders",
    "title": {
      "en": "Banks and supervised lenders",
      "es": "Bancos y entidades supervisadas"
    },
    "description": {
      "en": "Use the banking regulator's directory to identify financial institutions. Ask each lender directly about mortgages, residency, income documentation, currency, rates and fees.",
      "es": "Usa el directorio del regulador bancario para identificar entidades financieras. Consulta con cada entidad sobre hipotecas, residencia, ingresos, moneda, tasas y gastos."
    },
    "category": {
      "en": "Financing & insurance",
      "es": "Financiamiento y seguros"
    },
    "url": "https://sb.gob.do/supervisados/entidades-de-intermediacion-financiera/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-insurance-regulator",
    "title": {
      "en": "Insurance regulator",
      "es": "Superintendencia de Seguros"
    },
    "description": {
      "en": "Find official insurance information and verification channels before requesting property, liability or rental coverage.",
      "es": "Encuentra información oficial y canales de verificación antes de solicitar seguros de propiedad, responsabilidad civil o alquiler."
    },
    "category": {
      "en": "Financing & insurance",
      "es": "Financiamiento y seguros"
    },
    "url": "https://sis.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-central-bank-fx",
    "title": {
      "en": "USD/DOP exchange-rate reference",
      "es": "Referencia cambiaria USD/DOP"
    },
    "description": {
      "en": "Check Banco Central exchange-rate references for planning. Your bank or wire provider may quote a different transaction rate.",
      "es": "Consulta las referencias cambiarias del Banco Central para planificar. Tu banco o proveedor de transferencias puede cotizar una tasa diferente."
    },
    "category": {
      "en": "Financing & insurance",
      "es": "Financiamiento y seguros"
    },
    "url": "https://www.bancentral.gov.do/a/d/2538-mercado-cambiario",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-confotur",
    "title": {
      "en": "CONFOTUR project information",
      "es": "Información de proyectos CONFOTUR"
    },
    "description": {
      "en": "Review the tourism incentive authority's information. Confirm the exact project, resolution, covered property and remaining benefit period before relying on an exemption.",
      "es": "Revisa la información de la autoridad de incentivos turísticos. Confirma el proyecto, la resolución, el inmueble cubierto y la vigencia antes de contar con una exención."
    },
    "category": {
      "en": "Taxes & closing",
      "es": "Impuestos y cierre"
    },
    "url": "https://confotur.mitur.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-construction-vuc",
    "title": {
      "en": "Construction permits: VUC",
      "es": "Permisos de construcción: VUC"
    },
    "description": {
      "en": "Open the official construction portal for application requirements and available filing or tracking services.",
      "es": "Abre el portal oficial de construcción para consultar requisitos y los servicios disponibles de solicitud o seguimiento."
    },
    "category": {
      "en": "Permits & environment",
      "es": "Permisos y medio ambiente"
    },
    "url": "https://www.vuc.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-environment-services",
    "title": {
      "en": "Environmental permits and services",
      "es": "Permisos y servicios ambientales"
    },
    "description": {
      "en": "Review the Ministry of Environment service catalog for project authorizations and environmental requirements.",
      "es": "Consulta el catálogo del Ministerio de Medio Ambiente para autorizaciones de proyectos y requisitos ambientales."
    },
    "category": {
      "en": "Permits & environment",
      "es": "Permisos y medio ambiente"
    },
    "url": "https://ambiente.gob.do/catalogo-servicios/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-municipal-directory",
    "title": {
      "en": "Find your municipal authority",
      "es": "Encuentra tu autoridad municipal"
    },
    "description": {
      "en": "Identify municipal authorities through SISMAP Municipal, then contact the relevant planning office about local land use and permits.",
      "es": "Identifica las autoridades en SISMAP Municipal y consulta con la oficina de planeamiento correspondiente sobre uso de suelo y permisos."
    },
    "category": {
      "en": "Permits & environment",
      "es": "Permisos y medio ambiente"
    },
    "url": "https://www.sismap.gob.do/municipal/ranking/rankingview?tipoOrganismoID=17",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-lawyer-membership",
    "title": {
      "en": "Check lawyer membership: CARD",
      "es": "Consultar membresía de abogados: CARD"
    },
    "description": {
      "en": "Use the Colegio de Abogados member lookup as one step when checking a lawyer's credentials.",
      "es": "Usa la consulta de miembros del Colegio de Abogados como un paso al revisar las credenciales de un abogado."
    },
    "category": {
      "en": "Professional credentials",
      "es": "Credenciales profesionales"
    },
    "url": "https://colegiodeabogados.org.do/consultar-miembros/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-appraiser-membership",
    "title": {
      "en": "Check appraiser membership: ITADO",
      "es": "Consultar miembros tasadores: ITADO"
    },
    "description": {
      "en": "Search the Instituto de Tasadores Dominicanos membership service when choosing an independent appraiser.",
      "es": "Consulta el servicio de miembros del Instituto de Tasadores Dominicanos al elegir un tasador independiente."
    },
    "category": {
      "en": "Professional credentials",
      "es": "Credenciales profesionales"
    },
    "url": "https://itado.com.do/consulta-de-miembros/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-edenorte",
    "title": {
      "en": "EDENORTE electricity",
      "es": "Electricidad: EDENORTE"
    },
    "description": {
      "en": "Open EDENORTE for electricity services in its service area. Confirm coverage, account requirements and any balance before a transfer.",
      "es": "Abre EDENORTE para servicios eléctricos en su zona. Confirma cobertura, requisitos de cuenta y saldos antes de un traspaso."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://edenorte.com.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-edesur",
    "title": {
      "en": "EDESUR electricity",
      "es": "Electricidad: EDESUR"
    },
    "description": {
      "en": "Open EDESUR for electricity services in its service area. Confirm the provider for the property's exact address.",
      "es": "Abre EDESUR para servicios eléctricos en su zona. Confirma el proveedor de la dirección exacta del inmueble."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://www.edesur.com.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-edeeste",
    "title": {
      "en": "EDEESTE electricity",
      "es": "Electricidad: EDEESTE"
    },
    "description": {
      "en": "Open EDEESTE for electricity services in its service area. Confirm account, meter and transfer requirements directly.",
      "es": "Abre EDEESTE para servicios eléctricos en su zona. Confirma directamente los requisitos de cuenta, medidor y traspaso."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://edeeste.com.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-cepm",
    "title": {
      "en": "CEPM electricity",
      "es": "Electricidad: CEPM"
    },
    "description": {
      "en": "Check CEPM services and confirm whether the property is within its coverage before applying.",
      "es": "Consulta los servicios de CEPM y confirma que el inmueble esté dentro de su cobertura antes de solicitar servicio."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://cepm.com.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-coraapplata",
    "title": {
      "en": "CORAAPPLATA water services",
      "es": "Agua: CORAAPPLATA"
    },
    "description": {
      "en": "Open CORAAPPLATA for water-service information in the Puerto Plata area. Confirm availability at the property's address.",
      "es": "Abre CORAAPPLATA para información de agua en la zona de Puerto Plata. Confirma disponibilidad en la dirección del inmueble."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://coraapplata.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-inapa",
    "title": {
      "en": "INAPA water services",
      "es": "Agua: INAPA"
    },
    "description": {
      "en": "Use INAPA's official portal to find water-service information and contact channels. Confirm the utility responsible for the property's location.",
      "es": "Usa el portal oficial de INAPA para información y contactos de agua. Confirma la entidad responsable de la ubicación del inmueble."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://inapa.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-caasd",
    "title": {
      "en": "CAASD water services",
      "es": "Agua: CAASD"
    },
    "description": {
      "en": "Open CAASD for water and sewerage service information in its service area.",
      "es": "Abre CAASD para información de servicios de agua y alcantarillado en su zona de cobertura."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://portal.caasd.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-coraasan",
    "title": {
      "en": "CORAASAN water services",
      "es": "Agua: CORAASAN"
    },
    "description": {
      "en": "Open CORAASAN for water and sewerage service information in the Santiago area.",
      "es": "Abre CORAASAN para información de agua y alcantarillado en la zona de Santiago."
    },
    "category": {
      "en": "Utilities & ownership",
      "es": "Servicios y mantenimiento"
    },
    "url": "https://coraasan.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-catastro-office",
    "title": {
      "en": "Catastro virtual office",
      "es": "Oficina Virtual de Catastro"
    },
    "description": {
      "en": "Request or track cadastral services and review available certification tools through Catastro Nacional. Cadastral information is separate from legal title status.",
      "es": "Solicita o da seguimiento a servicios catastrales y consulta las herramientas de certificación de Catastro Nacional. La información catastral es distinta del estado jurídico del título."
    },
    "category": {
      "en": "Property records",
      "es": "Registros inmobiliarios"
    },
    "url": "https://servicios.catastro.gob.do/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-housing-services",
    "title": {
      "en": "Housing and building services",
      "es": "Servicios de vivienda y edificaciones"
    },
    "description": {
      "en": "Review the housing and building ministry's official services and requirements for your proposed work.",
      "es": "Consulta los servicios y requisitos oficiales del ministerio de vivienda y edificaciones para la obra propuesta."
    },
    "category": {
      "en": "Permits & environment",
      "es": "Permisos y medio ambiente"
    },
    "url": "https://mivhed.gob.do/servicios/",
    "enabled": true,
    "access": "public",
    "mode": "link"
  },
  {
    "id": "dr-catastro-geoportal",
    "title": {
      "en": "Catastro national geoportal",
      "es": "Geoportal de Catastro Nacional"
    },
    "description": {
      "en": "Explore cadastral mapping and available layers for preliminary location research. Confirm boundaries and legal status through the surveyor and Registry.",
      "es": "Explora mapas catastrales y capas disponibles para investigar una ubicación. Confirma linderos y estado jurídico con el agrimensor y el Registro."
    },
    "category": {
      "en": "GIS & site research",
      "es": "SIG e investigación del terreno"
    },
    "url": "https://geoportal-catastronacional.hub.arcgis.com/",
    "enabled": true,
    "access": "realtor",
    "mode": "link"
  },
  {
    "id": "dr-catastro-cartography",
    "title": {
      "en": "Catastro cartography: DIVICARTO",
      "es": "Cartografía catastral: DIVICARTO"
    },
    "description": {
      "en": "Find cadastral cartography and available geographic datasets. Check each layer's date, source and reuse conditions.",
      "es": "Encuentra cartografía catastral y datos geográficos disponibles. Revisa fecha, fuente y condiciones de reutilización de cada capa."
    },
    "category": {
      "en": "GIS & site research",
      "es": "SIG e investigación del terreno"
    },
    "url": "https://geoportaldgcn-divicarto.hub.arcgis.com/",
    "enabled": true,
    "access": "realtor",
    "mode": "link"
  },
  {
    "id": "dr-indrhi-water",
    "title": {
      "en": "Water-resource research: INDRHI",
      "es": "Investigación hídrica: INDRHI"
    },
    "description": {
      "en": "Review official hydrology, water-resource and technical service channels for site research and specialist follow-up.",
      "es": "Consulta los canales oficiales de hidrología, recursos hídricos y servicios técnicos para investigar el terreno y coordinar revisión especializada."
    },
    "category": {
      "en": "GIS & site research",
      "es": "SIG e investigación del terreno"
    },
    "url": "https://indrhi.gob.do/servicios/",
    "enabled": true,
    "access": "realtor",
    "mode": "link"
  },
  {
    "id": "dr-sgn-maps",
    "title": {
      "en": "Geological maps: SGN",
      "es": "Mapas geológicos: SGN"
    },
    "description": {
      "en": "Find official geological mapping services for site context. A map does not replace a property-specific engineering or geotechnical report.",
      "es": "Encuentra servicios oficiales de cartografía geológica para conocer el terreno. Un mapa no sustituye un estudio de ingeniería o geotecnia del inmueble."
    },
    "category": {
      "en": "GIS & site research",
      "es": "SIG e investigación del terreno"
    },
    "url": "https://www.sgn.gob.do/index.php/servicios/item/246-cartografias-o-mapas",
    "enabled": true,
    "access": "realtor",
    "mode": "link"
  },
  {
    "id": "dr-ign-services",
    "title": {
      "en": "Surveying and geographic services: IGN",
      "es": "Servicios geográficos y geodésicos: IGN"
    },
    "description": {
      "en": "Review official mapping and geodetic service requirements when a property project needs specialist geographic support.",
      "es": "Revisa los requisitos de servicios oficiales de cartografía y geodesia cuando un proyecto necesite apoyo geográfico especializado."
    },
    "category": {
      "en": "GIS & site research",
      "es": "SIG e investigación del terreno"
    },
    "url": "https://ign.gob.do/servicios/",
    "enabled": true,
    "access": "realtor",
    "mode": "link"
  },
  {
    id: 'dr-codia-professional-services',
    title: { en: 'CODIA professional certifications', es: 'Certificaciones profesionales del CODIA' },
    description: { en: 'Request current professional membership and certification guidance for engineers, architects and surveyors directly from CODIA.', es: 'Consulta directamente al CODIA los servicios de certificación y colegiatura de ingenieros, arquitectos y agrimensores.' },
    category: { en: 'Professional credentials', es: 'Credenciales profesionales' },
    url: 'https://codia.org.do/', enabled: true, access: 'public', mode: 'link',
  },
  {
    id: 'dr-sie-electrician-license',
    title: { en: 'Check an electrician’s SIE licence', es: 'Consultar licencia SIE de un electricista' },
    description: { en: 'Use SIE’s official instructions to check a technician’s licence before hiring.', es: 'Sigue las instrucciones oficiales de la SIE para consultar la licencia del técnico antes de contratar.' },
    category: { en: 'Professional credentials', es: 'Credenciales profesionales' },
    url: 'https://sie.gob.do/servicio/consulta-de-licencias-para-tecnicos-electricistas/', enabled: true, access: 'public', mode: 'link',
  },
  {
    id: 'dr-proconsumidor-claims',
    title: { en: 'Consumer complaints and claims', es: 'Denuncias y reclamaciones de consumo' },
    description: { en: 'Read the official process and submit qualifying consumer-service complaints directly to Pro Consumidor.', es: 'Consulta el proceso oficial y presenta directamente a Pro Consumidor las reclamaciones de consumo que correspondan.' },
    category: { en: 'Ownership and services', es: 'Propiedad y servicios' },
    url: 'https://proconsumidor.gob.do/formulario-de-denuncias-y-reclamaciones/', enabled: true, access: 'public', mode: 'link',
  },
  {
    id: 'dr-sie-electricity-help',
    title: { en: 'Electricity service and PROTECOM help', es: 'Servicios eléctricos y ayuda de PROTECOM' },
    description: { en: 'Find official electricity-service guidance and the PROTECOM claim portal.', es: 'Consulta la orientación oficial sobre servicios eléctricos y el portal de reclamaciones de PROTECOM.' },
    category: { en: 'Ownership and services', es: 'Propiedad y servicios' },
    url: 'https://sie.gob.do/informacion-basica-sobre-servicios-al-publicos/', enabled: true, access: 'public', mode: 'link',
  },
]

/** Evidence belongs to the reviewed URL, never an Admin's replacement destination. */
export const RECOMMENDED_DR_SOURCE_EVIDENCE: Record<string, { url: string; sourceUrl: string; organization: string; verifiedDate: string }> = Object.fromEntries(
  RECOMMENDED_DR_TOOLS.filter(tool => ['dr-codia-professional-services', 'dr-sie-electrician-license', 'dr-proconsumidor-claims', 'dr-sie-electricity-help'].includes(tool.id))
    .map(tool => [tool.id, { url: tool.url, sourceUrl: tool.url, organization: tool.id.startsWith('dr-codia') ? 'CODIA' : tool.id.startsWith('dr-sie') ? 'Superintendencia de Electricidad' : 'Pro Consumidor', verifiedDate: '2026-10-20' }]),
)

export function safePublicResourceUrl(value: string): boolean {
  try {
    if (value.length > 2048 || /[\\\s\u0000-\u001f\u007f]/.test(value)) return false
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) || /\.(localhost|local|internal|test|invalid)$/.test(host)) return false
    if (/[\u0000-\u001f\u007f]/.test(decodeURIComponent(value))) return false
    const sensitive = new Set(['password', 'passwd', 'secret', 'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'key', 'authorization', 'auth', 'signature', 'client_secret', 'session', 'sessionid', 'jwt', 'code'])
    return ![...url.searchParams.keys()].some(key => sensitive.has(key.toLowerCase()))
  } catch { return false }
}

function urlKey(value: string): string {
  const url = new URL(value)
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

/** Preserve existing edits, disabled rows and access choices when importing again. */
export function recommendedDRToolsToAdd(existing: WebsiteResource[]): RealtorTool[] {
  const ids = new Set(existing.map(item => item.id))
  const urls = new Set(existing.filter(item => safePublicResourceUrl(item.url)).map(item => urlKey(item.url)))
  return RECOMMENDED_DR_TOOLS.filter(item => !ids.has(item.id) && !urls.has(urlKey(item.url)))
}

/** Public library never includes tools restricted to Realtors/Admins. */
export function publicWebsiteResources(settings: Partial<WebsiteSettings>): WebsiteResource[] {
  const configured = [
    ...(settings.resources ?? []),
    ...(settings.realtorTools ?? []).filter(item => item.access === 'public' && item.mode === 'link'),
  ]
  const ids = new Set<string>()
  const urls = new Set<string>()
  return configured.filter(item => {
    if (!item.enabled || !safePublicResourceUrl(item.url) || ids.has(item.id)) return false
    const key = urlKey(item.url)
    if (urls.has(key)) return false
    ids.add(item.id); urls.add(key)
    return true
  })
}
