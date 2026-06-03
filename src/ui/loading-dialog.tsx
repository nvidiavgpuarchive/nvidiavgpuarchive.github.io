import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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

const progressLabel = (progress: LoadProgress, t: (key: string, options?: Record<string, string>) => string) => {
  if (progress.phase === 'metadata') {
    return t('loading.loadingDump')
  }

  if (progress.phase === 'requesting') {
    return t('loading.requestingDump')
  }

  if (progress.phase === 'parsing') {
    return t('loading.parsingDump')
  }

  if (progress.total) {
    return t('loading.loadingDumpBytes', {
      loaded: formatBytes(progress.loaded),
      total: formatBytes(progress.total),
    })
  }

  return t('loading.loadingDumpLoaded', {
    loaded: formatBytes(progress.loaded),
  })
}

export function LoadingDialog({ onDismiss, progress }: LoadingDialogProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const label = progressLabel(progress, t)
  const percentage = progress.total
    ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
    : undefined

  useLayoutEffect(() => {
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
        <h2 id="loading-title">{t('loading.dataTitle')}</h2>
        <div className="loading-dialog__meta">
          <p>{label}</p>
          {percentage === undefined ? null : <span>{percentage}%</span>}
        </div>
        {percentage === undefined ? (
          <div
            aria-label={label}
            className="loading-dialog__progress loading-dialog__progress--indeterminate"
            role="progressbar"
          >
            <span />
          </div>
        ) : (
          <progress className="loading-dialog__progress" max={100} value={percentage}>
            {percentage}%
          </progress>
        )}
      </article>
    </dialog>
  )
}
