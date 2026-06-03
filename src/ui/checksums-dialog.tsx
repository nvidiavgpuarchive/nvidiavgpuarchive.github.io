import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DownloadRow } from '../data/types'
import { Tooltip } from './tooltip'

type ChecksumsDialogProps = {
  row: DownloadRow
  onClose: () => void
}

const copyText = async (value: string) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

export function ChecksumsDialog({ row, onClose }: ChecksumsDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  const copyChecksum = async (format: string, value: string) => {
    await copyText(value)
    setCopiedFormat(format)
  }

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

  useEffect(() => {
    if (!copiedFormat) {
      return
    }

    const timeout = window.setTimeout(() => setCopiedFormat(null), 1200)

    return () => window.clearTimeout(timeout)
  }, [copiedFormat])

  return (
    <dialog
      aria-labelledby="checksums-title"
      className="details-dialog details-dialog--compact"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      ref={dialogRef}
    >
      <article className="details-panel details-panel--compact">
        <header className="details-header">
          <h2 id="checksums-title">{t('actions.checksums')}</h2>
          <Tooltip content={t('actions.closeChecksums')}>
            {(tooltipProps) => (
              <button {...tooltipProps} className="dialog-close" onClick={onClose} type="button">
                <X aria-hidden="true" size={30} />
              </button>
            )}
          </Tooltip>
        </header>

        <section className="details-section details-section--first">
          {row.checksums.length > 0 ? (
            <table>
              <tbody>
                {row.checksums.map((checksum) => (
                  <tr key={checksum.format}>
                    <th>{checksum.format}</th>
                    <td>
                      <button
                        className={[
                          'checksum-copy',
                          copiedFormat === checksum.format ? 'checksum-copy--copied' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => void copyChecksum(checksum.format, checksum.value)}
                        type="button"
                      >
                        <code>{checksum.value}</code>
                        <span>{copiedFormat === checksum.format ? t('actions.copied') : t('actions.copy')}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{t('checksums.none')}</p>
          )}
        </section>
      </article>
    </dialog>
  )
}
