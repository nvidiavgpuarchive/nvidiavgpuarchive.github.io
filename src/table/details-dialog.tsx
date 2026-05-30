import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { DownloadRow } from '../data/types'
import { Tooltip } from '../ui/tooltip'

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

const formatKey = (key: string) => {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const metaValue = (value: unknown) => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return <code>{JSON.stringify(value)}</code>
}

const textValue = (value: unknown, fallback = 'N/A') => {
  if (typeof value === 'string' && value) {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return fallback
}

const formatReleaseDate = (date: string) => {
  if (!date) {
    return 'N/A'
  }

  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function DetailsDialog({ row, onClose }: DetailsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const otherFilenames = row.filenames.slice(1)
  const metaEntries = Object.entries(row.meta).filter(
    ([key]) => key !== 'description' && key !== 'downloadId',
  )

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
          <h2 id="details-title">Download Details</h2>
          <Tooltip content="Close details">
            {(tooltipProps) => (
              <button {...tooltipProps} className="dialog-close" onClick={onClose} type="button">
                <X aria-hidden="true" size={30} />
              </button>
            )}
          </Tooltip>
        </header>

        <section className="details-summary" aria-label="Download metadata">
          <div className="details-primary">
            <div className="detail-field detail-field-wide">
              <span>Description:</span>
              <strong>{row.description || row.filename || 'N/A'}</strong>
            </div>
            <div className="detail-field detail-field-wide">
              <span>Download ID:</span>
              <strong>{row.downloadId || 'N/A'}</strong>
            </div>
            <div className="detail-field detail-field-wide">
              <span>Name:</span>
              <strong>{textValue(row.meta.name)}</strong>
            </div>
            <div className="details-pair">
              <div className="detail-field">
                <span>Product Name:</span>
                <strong>{textValue(row.meta.productName)}</strong>
              </div>
              <div className="detail-field">
                <span>Version:</span>
                <strong>{row.productVersion || 'N/A'}</strong>
              </div>
            </div>
            <div className="details-pair">
              <div className="detail-field">
                <span>Platform Name:</span>
                <strong>{row.platform || 'N/A'}</strong>
              </div>
              <div className="detail-field">
                <span>Platform Version:</span>
                <strong>{row.platformVersion || 'N/A'}</strong>
              </div>
            </div>
            {'nondrivercategory' in row.meta ? (
              <div className="detail-field detail-inline">
                <span>NonDriverCategory:</span>
                <strong>{textValue(row.meta.nondrivercategory)}</strong>
              </div>
            ) : null}
            <div className="detail-field detail-inline">
              <span>ChecksumFormat:</span>
              <strong>{textValue(row.meta.checksumFormat)}</strong>
            </div>
            <div className="detail-field detail-inline">
              <span>ProductFamilies:</span>
              <strong>{row.productFamily || 'N/A'}</strong>
            </div>
          </div>

          <aside className="details-side">
            <div className="detail-field">
              <span>Release Date:</span>
              <strong>{formatReleaseDate(row.releaseDate)}</strong>
            </div>
            <div className="detail-field">
              <span>Category:</span>
              <strong>{row.category || 'N/A'}</strong>
            </div>
            <div className="detail-field">
              <span>Link Type:</span>
              <strong>{row.linkType || 'N/A'}</strong>
            </div>
            <div className="detail-field">
              <span>Download Type:</span>
              <strong>{row.downloadType || 'N/A'}</strong>
            </div>
          </aside>
        </section>

        <section className="details-section">
          <h3>File</h3>
          <table className="details-link-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>File Size</th>
                <th>Torrent</th>
                <th>HTTP Link</th>
                <th>Internet Archive</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{row.filename || 'No Title'}</td>
                <td>{formatBytes(row.size)}</td>
                <td>
                  <a href={row.torrentUrl} rel="noreferrer" target="_blank">Download</a>
                </td>
                <td>
                  <a href={row.httpUrl} rel="noreferrer" target="_blank">Download</a>
                </td>
                <td>
                  <a href={row.archiveUrl} rel="noreferrer" target="_blank">View Page</a>
                </td>
              </tr>
            </tbody>
          </table>

          {otherFilenames.length > 0 ? (
            <blockquote className="additional-files">
              {otherFilenames.map((filename) => (
                <p key={filename}>{filename}</p>
              ))}
            </blockquote>
          ) : null}
        </section>

        <section className="details-section">
          <h3>Checksums</h3>
          {row.checksums.length > 0 ? (
            <table className="details-checksum-table">
              <tbody>
                {row.checksums.map((checksum) => (
                  <tr key={checksum.format}>
                    <th>{checksum.format}</th>
                    <td>
                      <code>{checksum.value}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No checksums listed.</p>
          )}
        </section>

        <section className="details-section">
          <h3>Raw Meta</h3>
          <table className="details-meta-table">
            <tbody>
              {metaEntries.map(([key, value]) => (
                <tr key={key}>
                  <th>{formatKey(key)}</th>
                  <td>{metaValue(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="details-section">
          <h3>Zip Content</h3>
          {row.zipContent.length > 0 ? (
            <pre>
              <code>{row.zipContent.join('\n')}</code>
            </pre>
          ) : (
            <p>No zip content listed.</p>
          )}
        </section>
      </article>
    </dialog>
  )
}
