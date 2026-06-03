import { useCallback, useEffect, useState } from 'react'
import {
  defaultDumpUrl,
  loadDump,
  readDumpIndexTimestamp,
  shouldRefreshDumpForBuild,
  type LoadProgress,
} from './data/load-dump'
import type { DownloadRow } from './data/types'
import { DownloadsTable } from './table/downloads-table'
import { LoadingDialog } from './ui/loading-dialog'

const initialProgress: LoadProgress = {
  loaded: 0,
  phase: 'requesting',
}

const readLastUpdatedAt = () => {
  const timestampSeconds = readDumpIndexTimestamp()

  return timestampSeconds ? timestampSeconds * 1000 : undefined
}

function App() {
  const [rows, setRows] = useState<DownloadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDialogDismissed, setLoadingDialogDismissed] = useState(false)
  const [progress, setProgress] = useState<LoadProgress>(initialProgress)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | undefined>(readLastUpdatedAt)

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadingDialogDismissed(false)
    setProgress(initialProgress)
    setError(null)

    try {
      setRows(await loadDump(defaultDumpUrl, setProgress, { forceRefresh: true }))
      setLastUpdatedAt(readLastUpdatedAt())
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
        const forceRefresh = shouldRefreshDumpForBuild(__APP_BUILD_TIMESTAMP__)
        const initialRows = await loadDump(defaultDumpUrl, (nextProgress) => {
          if (active) {
            setProgress(nextProgress)
          }
        }, { forceRefresh })

        if (active) {
          setRows(initialRows)
          setLastUpdatedAt(readLastUpdatedAt())
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
      {loading && !loadingDialogDismissed ? (
        <LoadingDialog onDismiss={() => setLoadingDialogDismissed(true)} progress={progress} />
      ) : null}
      <DownloadsTable
        loading={loading}
        lastUpdatedAt={lastUpdatedAt}
        onReload={reload}
        rows={rows}
      />
    </>
  )
}

export default App
