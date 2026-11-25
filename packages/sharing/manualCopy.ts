import type { ShareLocale } from './manual'

const en = {
  open: 'Share', heading: 'Review what you will share', preparing: 'Checking the public listing…', unavailable: 'Sharing is unavailable. Try checking the listing again.',
  public: 'Public link. The recipient can open this page without access to your account.',
  member: 'Sign-in is required. Each person sees their own authorized workspace; this link grants no access and includes no saved values.',
  research: 'An Admin or Realtor account is required. This link opens the authorized research hub and grants no access to private tools or projects.',
  copyLink: 'Copy link', copyCaption: 'Copy caption', email: 'Email', whatsapp: 'WhatsApp', sms: 'Text message', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', native: 'More sharing options',
  copied: 'Copied.', failed: 'Could not complete that action. You can use another sharing option.', canceled: 'Sharing canceled.', nativeClosed: 'The sharing window closed. Check the chosen app for the result.',
  manual: 'You choose the recipient or audience and confirm in the app. Nothing is posted or sent automatically; available apps and prefilled text depend on your device.',
  assets: 'Create a post or story image', post: 'Square post · 1080 × 1080', story: 'Story · 1080 × 1920', format: 'Image format',
  choosePhoto: 'Choose a published listing photo', noPhoto: 'Branded card without a photo', photo: 'Photo', selectedPhoto: 'Selected photo',
  prepareImage: 'Prepare image', rendering: 'Preparing image…', download: 'Download PNG', captionFile: 'Download caption', shareImage: 'Share prepared image',
  imageFailed: 'This image could not be prepared. Choose another published photo or use a card without a photo.', changed: 'The listing changed. Review the refreshed details before preparing an image again.',
  imageAlt: 'Prepared sharing image', instagram: 'Open Instagram', handoff: 'Download the image and copy the caption, then choose a Post or Story in Instagram or Facebook. Upload the file yourself and add the link using the options offered by that app. An image is not a clickable link.',
  brand: 'I LOVE DR REALTY', visit: 'Details and current availability', resource: 'Property resources', calculator: 'Real estate investment calculator', area: 'Property area converter', hub: 'Property tools', researchTitle: 'Member research tools',
  imageMember: 'Sign-in required · account permissions apply', imageResearch: 'Admin or Realtor sign-in required', retry: 'Check again',
  listing: 'Property listing', price: 'Sale price', monthly: 'Per month', daily: 'Per day', beds: 'Bedrooms', baths: 'Bathrooms', forSale: 'For sale', forRent: 'For rent', both: 'For sale or rent',
  types: { villa: 'Villa', apartment: 'Apartment', condo: 'Condo', land: 'Land', commercial: 'Commercial property' },
}
const es: typeof en = {
  open: 'Compartir', heading: 'Revisa lo que vas a compartir', preparing: 'Comprobando el anuncio público…', unavailable: 'No se puede compartir ahora. Intenta comprobar el anuncio de nuevo.',
  public: 'Enlace público. La persona puede abrir esta página sin acceso a tu cuenta.',
  member: 'Es necesario iniciar sesión. Cada persona ve su propio espacio autorizado; el enlace no concede acceso ni incluye valores guardados.',
  research: 'Se necesita una cuenta de Admin o agente. El enlace abre el centro de investigación autorizado y no concede acceso a herramientas o proyectos privados.',
  copyLink: 'Copiar enlace', copyCaption: 'Copiar texto', email: 'Correo', whatsapp: 'WhatsApp', sms: 'Mensaje de texto', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X', native: 'Más opciones para compartir',
  copied: 'Copiado.', failed: 'No se pudo completar la acción. Puedes usar otra opción.', canceled: 'Se canceló la acción.', nativeClosed: 'Se cerró la ventana para compartir. Comprueba el resultado en la aplicación elegida.',
  manual: 'Tú eliges la persona o el público y confirmas en la aplicación. No se publica ni envía nada automáticamente; las aplicaciones y el texto precargado dependen del dispositivo.',
  assets: 'Crear imagen para publicación o historia', post: 'Publicación cuadrada · 1080 × 1080', story: 'Historia · 1080 × 1920', format: 'Formato de imagen',
  choosePhoto: 'Elige una foto publicada del inmueble', noPhoto: 'Tarjeta de marca sin foto', photo: 'Foto', selectedPhoto: 'Foto seleccionada',
  prepareImage: 'Preparar imagen', rendering: 'Preparando imagen…', download: 'Descargar PNG', captionFile: 'Descargar texto', shareImage: 'Compartir imagen preparada',
  imageFailed: 'No se pudo preparar esta imagen. Elige otra foto publicada o usa una tarjeta sin foto.', changed: 'El anuncio cambió. Revisa los datos actualizados antes de preparar otra imagen.',
  imageAlt: 'Imagen preparada para compartir', instagram: 'Abrir Instagram', handoff: 'Descarga la imagen y copia el texto; después elige una publicación o historia en Instagram o Facebook. Sube el archivo tú y añade el enlace con las opciones de esa aplicación. La imagen no es un enlace pulsable.',
  brand: 'I LOVE DR REALTY', visit: 'Detalles y disponibilidad actual', resource: 'Recursos inmobiliarios', calculator: 'Calculadora de inversión inmobiliaria', area: 'Conversor de superficie', hub: 'Herramientas inmobiliarias', researchTitle: 'Herramientas de investigación para miembros',
  imageMember: 'Requiere inicio de sesión · se aplican los permisos de la cuenta', imageResearch: 'Requiere una cuenta de Admin o agente', retry: 'Comprobar de nuevo',
  listing: 'Anuncio inmobiliario', price: 'Precio de venta', monthly: 'Por mes', daily: 'Por día', beds: 'Habitaciones', baths: 'Baños', forSale: 'En venta', forRent: 'En alquiler', both: 'En venta o alquiler',
  types: { villa: 'Villa', apartment: 'Apartamento', condo: 'Condominio', land: 'Terreno', commercial: 'Inmueble comercial' },
}
export const manualCopy = (locale: ShareLocale) => locale === 'es' ? es : en
export type ManualCopy = typeof en
