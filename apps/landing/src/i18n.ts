import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import esCommon from './locales/es/common.json'
import enLanding from './locales/en/landing.json'
import esLanding from './locales/es/landing.json'
import enAuth from './locales/en/auth.json'
import esAuth from './locales/es/auth.json'
import enFooter from './locales/en/footer.json'
import esFooter from './locales/es/footer.json'
import enSearch from './locales/en/search.json'
import esSearch from './locales/es/search.json'
import enBuying from './locales/en/buying.json'
import esBuying from './locales/es/buying.json'
import enSelling from './locales/en/selling.json'
import esSelling from './locales/es/selling.json'
import enContact from './locales/en/contact.json'
import esContact from './locales/es/contact.json'
import enBlog from './locales/en/blog.json'
import esBlog from './locales/es/blog.json'
import enTeam from './locales/en/team.json'
import esTeam from './locales/es/team.json'
import enCalculator from './locales/en/calculator.json'
import esCalculator from './locales/es/calculator.json'
import enNotFound from './locales/en/not_found.json'
import esNotFound from './locales/es/not_found.json'
import enVerify from './locales/en/verify.json'
import esVerify from './locales/es/verify.json'
import enPropertyDetail from './locales/en/property_detail.json'
import esPropertyDetail from './locales/es/property_detail.json'
import enLeadCapture from './locales/en/lead_capture.json'
import esLeadCapture from './locales/es/lead_capture.json'
import enRentals from './locales/en/rentals.json'
import esRentals from './locales/es/rentals.json'

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      landing: enLanding,
      auth: enAuth,
      footer: enFooter,
      search: enSearch,
      buying: enBuying,
      selling: enSelling,
      contact: enContact,
      blog: enBlog,
      team: enTeam,
      calculator: enCalculator,
      not_found: enNotFound,
      verify: enVerify,
      property_detail: enPropertyDetail,
      lead_capture: enLeadCapture,
      rentals: enRentals,
    },
    es: {
      common: esCommon,
      landing: esLanding,
      auth: esAuth,
      footer: esFooter,
      search: esSearch,
      buying: esBuying,
      selling: esSelling,
      contact: esContact,
      blog: esBlog,
      team: esTeam,
      calculator: esCalculator,
      not_found: esNotFound,
      verify: esVerify,
      property_detail: esPropertyDetail,
      lead_capture: esLeadCapture,
      rentals: esRentals,
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'landing', 'auth', 'footer', 'search', 'buying', 'selling', 'contact', 'blog', 'team', 'calculator', 'not_found', 'verify', 'property_detail', 'lead_capture', 'rentals'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
