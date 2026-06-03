import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { DownloadRow } from '../data/types'
import { Tooltip } from './tooltip'

type DetailsDialogProps = {
  row: DownloadRow
  onClose: () => void
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return ''
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const textValue = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value) {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return fallback
}

const formatReleaseDate = (date: string, locale: string, fallback: string) => {
  if (!date) {
    return fallback
  }

  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function DetailsDialog({ row, onClose }: DetailsDialogProps) {
  const { i18n, t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const na = t('common.na')

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (!dialog.open) {
      document.dispatchEvent(new Event('app:close-tooltips'))
      dialog.showModal()
    }

    return () => {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [])

  return (
    <dialog
      aria-labelledby="details-title"
      className="details-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      ref={dialogRef}
    >
      <article className="details-panel">
        <header className="details-header">
          <h2 id="details-title">{t('details.title')}</h2>
          <Tooltip content={t('actions.closeDetails')}>
            {(tooltipProps) => (
              <button {...tooltipProps} className="dialog-close" onClick={onClose} type="button">
                <X aria-hidden="true" size={30} />
              </button>
            )}
          </Tooltip>
        </header>

        <section className="details-summary" aria-label={t('details.downloadMetadata')}>
          <div className="details-primary">
            <div className="detail-field detail-field-wide">
              <span>{t('details.description')}:</span>
              <strong>{row.description || row.filename || na}</strong>
            </div>
            <div className="detail-field detail-field-wide">
              <span>{t('details.downloadId')}:</span>
              <strong>{row.downloadId || na}</strong>
            </div>
            <div className="detail-field detail-field-wide">
              <span>{t('details.name')}:</span>
              <strong>{textValue(row.meta.name, na)}</strong>
            </div>
            <div className="detail-field detail-field-wide">
              <span>{t('details.fileName')}:</span>
              <strong>{row.filename || t('common.noTitle')}</strong>
            </div>
            <div className="details-pair">
              <div className="detail-field">
                <span>{t('details.productName')}:</span>
                <strong>{textValue(row.meta.productName, na)}</strong>
              </div>
              <div className="detail-field">
                <span>{t('details.fileSize')}:</span>
                <strong>{formatBytes(row.size) || na}</strong>
              </div>
            </div>
            <div className="details-pair">
              <div className="detail-field">
                <span>{t('details.version')}:</span>
                <strong>{row.productVersion || na}</strong>
              </div>
              <div className="detail-field">
                <span>{t('details.platformName')}:</span>
                <strong>{row.platform || na}</strong>
              </div>
            </div>
            <div className="details-pair">
              <div className="detail-field">
                <span>{t('details.platformVersion')}:</span>
                <strong>{row.platformVersion || na}</strong>
              </div>
              <div className="detail-field">
                <span>{t('details.productFamilies')}:</span>
                <strong>{row.productFamily || na}</strong>
              </div>
            </div>
            {'nondrivercategory' in row.meta ? (
              <div className="detail-field detail-inline">
                <span>{t('details.nonDriverCategory')}:</span>
                <strong>{textValue(row.meta.nondrivercategory, na)}</strong>
              </div>
            ) : null}
            <div className="detail-field detail-inline">
              <span>{t('details.checksumFormat')}:</span>
              <strong>{textValue(row.meta.checksumFormat, na)}</strong>
            </div>
          </div>

          <aside className="details-side">
            <div className="detail-field">
              <span>{t('details.releaseDate')}:</span>
              <strong>{formatReleaseDate(row.releaseDate, i18n.language, na)}</strong>
            </div>
            <div className="detail-field">
              <span>{t('details.category')}:</span>
              <strong>{row.category || na}</strong>
            </div>
            <div className="detail-field">
              <span>{t('details.linkType')}:</span>
              <strong>{row.linkType || na}</strong>
            </div>
            <div className="detail-field">
              <span>{t('details.downloadType')}:</span>
              <strong>{row.downloadType || na}</strong>
            </div>
          </aside>
        </section>
      </article>
    </dialog>
  )
}
