import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enNav      from './locale/en/nav.json'
import esNav      from './locale/es/nav.json'
import enCommon   from './locale/en/common.json'
import esCommon   from './locale/es/common.json'
import enAdmin    from './locale/en/admin.json'
import esAdmin    from './locale/es/admin.json'
import enBuyer    from './locale/en/buyer.json'
import esBuyer    from './locale/es/buyer.json'
import enOwner    from './locale/en/owner.json'
import esOwner    from './locale/es/owner.json'
import enRealtor  from './locale/en/realtor.json'
import esRealtor  from './locale/es/realtor.json'
import enSettings from './locale/en/settings.json'
import esSettings from './locale/es/settings.json'

import enWebsiteEditor from './locale/en/website_editor.json'
import esWebsiteEditor from './locale/es/website_editor.json'
import enResearchTools from './locale/en/research_tools.json'
import esResearchTools from './locale/es/research_tools.json'
import enProfessionals from './locale/en/professionals.json'
import esProfessionals from './locale/es/professionals.json'

const savedLang = (localStorage.getItem('ildr_lang') as 'en' | 'es') ?? 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: {
      nav:      enNav,
      common:   enCommon,
      admin:    enAdmin,
      buyer:    enBuyer,
      owner:    enOwner,
      realtor:  enRealtor,
      settings: enSettings,
      website_editor: enWebsiteEditor,
      research_tools: enResearchTools,
      professionals: enProfessionals,
    },
    es: {
      nav:      esNav,
      common:   esCommon,
      admin:    esAdmin,
      buyer:    esBuyer,
      owner:    esOwner,
      realtor:  esRealtor,
      settings: esSettings,
      website_editor: esWebsiteEditor,
      research_tools: esResearchTools,
      professionals: esProfessionals,
    },
  },
  lng: savedLang,
  fallbackLng: 'en',
  ns: ['nav', 'common', 'admin', 'buyer', 'owner', 'realtor', 'settings', 'website_editor', 'research_tools', 'professionals'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
