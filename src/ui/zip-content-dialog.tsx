import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { DownloadRow } from '../data/types'
import { Tooltip } from './tooltip'

type ZipContentDialogProps = {
  row: DownloadRow
  onClose: () => void
}

export function ZipContentDialog({ row, onClose }: ZipContentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
      aria-labelledby="zip-content-title"
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
          <h2 id="zip-content-title">Zip Content</h2>
          <Tooltip content="Close zip content">
            {(tooltipProps) => (
              <button {...tooltipProps} className="dialog-close" onClick={onClose} type="button">
                <X aria-hidden="true" size={30} />
              </button>
            )}
          </Tooltip>
        </header>

        <section className="details-section details-section--first">
          <pre>
            <code>{row.zipContent.join('\n')}</code>
          </pre>
        </section>
      </article>
    </dialog>
  )
}
