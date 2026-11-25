import { useTranslation } from 'react-i18next'
import { canonicalShareUrl, profileSharePath, type PrivateShareTarget } from '../../../../../packages/sharing'
import { ShareLinkActions, type ShareLinkLabels } from '../../../../../packages/sharing/ShareLinkActions'

export function ProfileShareActions({ kind, identifier }: { kind: PrivateShareTarget; identifier: string | number }) {
  const { t } = useTranslation('contact_share')
  const url = canonicalShareUrl(import.meta.env.VITE_DASHBOARD_URL, profileSharePath(kind, identifier), 'https://app.ilovedrrealty.com')
  const labels: ShareLinkLabels = { open: t(kind === 'contact' ? 'link_contact_open' : 'link_profile_open'),
    title: t(kind === 'contact' ? 'link_contact_title' : 'link_profile_title'), note: t(kind === 'contact' ? 'link_admin_note' : 'link_profile_note'),
    copy: t('link_copy'), email: t('compose_email'), whatsapp: t('compose_whatsapp'), native: t('link_native'),
    copied: t('link_copied'), failed: t('link_failed'), nativeClosed: t('link_native_closed'), canceled: t('link_canceled'), noDelivery: t('no_delivery_claim') }
  return <ShareLinkActions key={url} url={url} labels={labels} />
}
