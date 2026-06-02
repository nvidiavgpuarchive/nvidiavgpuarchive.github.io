import { useEffect, useRef } from 'react'
import type { LoadProgress } from '../data/load-dump'

type LoadingDialogProps = {
  onDismiss: () => void
  progress: LoadProgress
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

const progressLabel = (progress: LoadProgress) => {
  if (progress.phase === 'requesting') {
    return 'Requesting dump.json...'
  }

  if (progress.phase === 'parsing') {
    return 'Parsing dump.json...'
  }

  if (progress.total) {
    return `Loading dump.json... ${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}`
  }

  return `Loading dump.json... ${formatBytes(progress.loaded)}`
}

export function LoadingDialog({ onDismiss, progress }: LoadingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const percentage = progress.total
    ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
    : undefined

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
      aria-labelledby="loading-title"
      className="loading-dialog"
      onCancel={onDismiss}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss()
        }
      }}
      ref={dialogRef}
    >
      <article>
        <h2 id="loading-title">Loading Data</h2>
        <div className="loading-dialog__meta">
          <p>{progressLabel(progress)}</p>
          {percentage === undefined ? null : <span>{percentage}%</span>}
        </div>
        {percentage === undefined ? (
          <progress />
        ) : (
          <progress max={100} value={percentage}>
            {percentage}%
          </progress>
        )}
      </article>
    </dialog>
  )
}
