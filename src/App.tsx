import { useCallback, useEffect, useState } from 'react'
import { defaultDumpUrl, loadDump, type LoadProgress } from './data/load-dump'
import type { DownloadRow } from './data/types'
import { LoadingDialog } from './loading-dialog'
import { DownloadsTable } from './table/downloads-table'

const initialProgress: LoadProgress = {
  loaded: 0,
  phase: 'requesting',
}

function App() {
  const [rows, setRows] = useState<DownloadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDialogDismissed, setLoadingDialogDismissed] = useState(false)
  const [progress, setProgress] = useState<LoadProgress>(initialProgress)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadingDialogDismissed(false)
    setProgress(initialProgress)
    setError(null)

    try {
      setRows(await loadDump(defaultDumpUrl, setProgress, { forceRefresh: true }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dump.json')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadInitialDump = async () => {
      try {
        const initialRows = await loadDump(defaultDumpUrl, (nextProgress) => {
          if (active) {
            setProgress(nextProgress)
          }
        })

        if (active) {
          setRows(initialRows)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load dump.json')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadInitialDump()

    return () => {
      active = false
    }
  }, [])

  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      {loading && progress.phase !== 'metadata' && !loadingDialogDismissed ? (
        <LoadingDialog onDismiss={() => setLoadingDialogDismissed(true)} progress={progress} />
      ) : null}
      <DownloadsTable
        loading={loading}
        onReload={reload}
        rows={rows}
      />
    </>
  )
}

export default App
