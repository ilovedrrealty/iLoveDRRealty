'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { HOMEPAGE_CATEGORIES, homepagePhoto } from '../data/homepageHighlights'
import styles from './HomepageHighlights.module.css'
import { useWebsiteSettings } from './WebsiteSettingsProvider'

export default function HomepagePhotoCards() {
  const { t } = useTranslation('home_showcase')
  const { images } = useWebsiteSettings()

  return (
    <section className={`${styles.categories} ${styles.wrap}`} aria-labelledby="homepage-categories-title">
      <div className={`${styles.sectionHead} ${styles.categoryHeading}`}>
        <div>
          <p className={styles.eyebrow}>{t('categories.eyebrow')}</p>
          <h2 id="homepage-categories-title">{t('categories.heading')}</h2>
        </div>
      </div>
      <div className={styles.categoryGrid}>
        {HOMEPAGE_CATEGORIES.map(category => {
          const title = t(`categories.items.${category.key}`)
          return (
            <Link key={category.key} href={`/search/${category.query}`} className={styles.categoryCard} aria-label={t('categories.explore_label', { title })}>
              {/* Native images preserve the existing public Storage URLs without a new image host configuration. */}
              <img src={images[`category_${category.key.replace(/-/g, '_')}`] || homepagePhoto(category.photo)} alt="" loading="lazy" decoding="async" width={640} height={400} />
              <h3>{title}</h3>
              <span>{t('categories.explore')} <span aria-hidden="true">→</span></span>
            </Link>
          )
        })}
      </div>
      <p className={styles.imageNote}>
        {t('categories.image_note')}
      </p>
    </section>
  )
}
