import { normalizeDump } from './normalize'
import type { DownloadRow, DumpFile } from './types'

export type LoadProgress = {
  loaded: number
  phase: 'metadata' | 'requesting' | 'downloading' | 'parsing'
  total?: number
}

type LoadDumpOptions = {
  forceRefresh?: boolean
  ttlMs?: number
}

type DumpCacheMeta = {
  cachedAt: number
  size?: number
}

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()
const dumpCacheName = 'nvidia-dump-cache-v1'
const dumpIndexTimestampKey = 'nvidia-dump-index-timestmp'
const defaultDumpCacheTtlMs = 30 * 24 * 60 * 60 * 1000

export const defaultDumpUrl =
  import.meta.env.VITE_DUMP_URL ||
  'https://raw.githubusercontent.com/nvidiavgpuarchive/index/refs/heads/main/dump.json'

export const defaultDumpMetadataUrl =
  import.meta.env.VITE_DUMP_METADATA_URL ||
  'https://api.github.com/repos/nvidiavgpuarchive/index/contents/dump.json?ref=main'

export const defaultDumpIndexTimestampUrl =
  import.meta.env.VITE_DUMP_INDEX_TIMESTAMP_URL ||
  'https://raw.githubusercontent.com/nvidiavgpuarchive/index/refs/heads/main/.docgen'

const cacheBustedUrl = (url: string) => {
  const requestUrl = new URL(url, window.location.href)

  requestUrl.searchParams.set('_', Date.now().toString())

  return requestUrl.toString()
}

const dumpCacheMetaKey = 'nvidia-dump-cache-meta'

const dumpCacheAvailable = () => 'caches' in window && 'localStorage' in window

const localStorageAvailable = () => 'localStorage' in window

export const shouldRefreshDumpForBuild = (buildTimestamp: number) => {
  const cachedAt = readDumpCacheTimestamp()

  return !cachedAt || buildTimestamp > cachedAt
}

export const readDumpIndexTimestamp = () => {
  if (!localStorageAvailable()) {
    return undefined
  }

  try {
    const value = Number(window.localStorage.getItem(dumpIndexTimestampKey))

    return Number.isFinite(value) && value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

const writeDumpIndexTimestamp = (timestamp: number | undefined) => {
  if (!timestamp || !localStorageAvailable()) {
    return
  }

  try {
    window.localStorage.setItem(dumpIndexTimestampKey, String(timestamp))
  } catch {
    // The index timestamp only avoids unnecessary large dump downloads.
  }
}

const readDumpCacheMeta = () => {
  try {
    const value = window.localStorage.getItem(dumpCacheMetaKey)

    return value ? (JSON.parse(value) as DumpCacheMeta) : undefined
  } catch {
    return undefined
  }
}

const writeDumpCacheMeta = (meta: DumpCacheMeta) => {
  try {
    window.localStorage.setItem(dumpCacheMetaKey, JSON.stringify(meta))
  } catch {
    // Cache metadata is an optimization; loading should still work without it.
  }
}

export const readDumpCacheTimestamp = () => readDumpCacheMeta()?.cachedAt

const touchDumpCacheMeta = () => {
  const meta = readDumpCacheMeta()

  if (!meta) {
    return
  }

  writeDumpCacheMeta({
    ...meta,
    cachedAt: Date.now(),
  })
}

const deleteCachedDump = async (url: string) => {
  if (!dumpCacheAvailable()) {
    return
  }

  try {
    window.localStorage.removeItem(dumpCacheMetaKey)
    const cache = await window.caches.open(dumpCacheName)
    await cache.delete(url)
  } catch {
    // Ignore cache cleanup failures and fall back to a network request.
  }
}

const readCachedDump = async (url: string, ttlMs: number, options: { ignoreTtl?: boolean } = {}) => {
  if (!dumpCacheAvailable()) {
    return undefined
  }

  const meta = readDumpCacheMeta()

  if (!meta || (!options.ignoreTtl && Date.now() - meta.cachedAt > ttlMs)) {
    await deleteCachedDump(url)
    return undefined
  }

  try {
    const cache = await window.caches.open(dumpCacheName)
    const response = await cache.match(url)

    if (!response) {
      await deleteCachedDump(url)
      return undefined
    }

    return {
      meta,
      text: await response.text(),
    }
  } catch {
    return undefined
  }
}

const writeCachedDump = async (url: string, text: string, size?: number) => {
  if (!dumpCacheAvailable()) {
    return
  }

  try {
    const cache = await window.caches.open(dumpCacheName)

    await cache.put(
      url,
      new Response(text, {
        headers: {
          'content-type': 'application/json',
        },
      }),
    )
    writeDumpCacheMeta({
      cachedAt: Date.now(),
      size: size ?? textEncoder.encode(text).byteLength,
    })
  } catch {
    // Cache writes are best effort; the freshly fetched data is still usable.
  }
}

const loadMetadataSize = async (url: string) => {
  try {
    const response = await fetch(cacheBustedUrl(url), {
      cache: 'no-store',
    })

    if (!response.ok) {
      return undefined
    }

    const payload = (await response.json()) as { size?: unknown }

    return typeof payload.size === 'number' && payload.size > 0 ? payload.size : undefined
  } catch {
    return undefined
  }
}

const loadDumpIndexTimestamp = async () => {
  try {
    const response = await fetch(cacheBustedUrl(defaultDumpIndexTimestampUrl), {
      cache: 'no-store',
    })

    if (!response.ok) {
      return undefined
    }

    const value = Number((await response.text()).trim())

    return Number.isFinite(value) && value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

const parseCachedDump = (cachedDump: { meta: DumpCacheMeta; text: string }) => {
  return normalizeDump(JSON.parse(cachedDump.text) as DumpFile)
}

const contentLength = (response: Response, fallbackTotal?: number) => {
  if (fallbackTotal) {
    return fallbackTotal
  }

  const encoding = response.headers.get('content-encoding')

  if (encoding && encoding.toLowerCase() !== 'identity') {
    return undefined
  }

  const value = Number(response.headers.get('content-length'))

  return Number.isFinite(value) && value > 0 ? value : undefined
}

const readResponseText = async (
  response: Response,
  expectedTotal?: number,
  onProgress?: (progress: LoadProgress) => void,
) => {
  const total = contentLength(response, expectedTotal)

  if (!response.body) {
    const text = await response.text()

    onProgress?.({
      loaded: text.length,
      phase: 'downloading',
      total,
    })

    return text
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    chunks.push(value)
    loaded += value.byteLength
    const progressTotal = total && loaded <= total ? total : undefined

    onProgress?.({
      loaded,
      phase: 'downloading',
      total: progressTotal,
    })
  }

  const body = new Uint8Array(loaded)
  let offset = 0

  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return textDecoder.decode(body)
}

export const loadDump = async (
  url: string,
  onProgress?: (progress: LoadProgress) => void,
  options: LoadDumpOptions = {},
): Promise<DownloadRow[]> => {
  const ttlMs = options.ttlMs ?? defaultDumpCacheTtlMs

  onProgress?.({
    loaded: 0,
    phase: 'metadata',
  })

  const existingIndexTimestamp = readDumpIndexTimestamp()
  const fetchedIndexTimestamp = await loadDumpIndexTimestamp()
  const indexUnchanged =
    existingIndexTimestamp !== undefined &&
    fetchedIndexTimestamp !== undefined &&
    fetchedIndexTimestamp <= existingIndexTimestamp
  const indexUpdated =
    fetchedIndexTimestamp !== undefined &&
    (existingIndexTimestamp === undefined || fetchedIndexTimestamp > existingIndexTimestamp)

  if (indexUnchanged) {
    const cachedDump = await readCachedDump(url, ttlMs, { ignoreTtl: true })

    if (cachedDump) {
      touchDumpCacheMeta()
      onProgress?.({
        loaded: cachedDump.meta.size ?? cachedDump.text.length,
        phase: 'parsing',
        total: cachedDump.meta.size ?? cachedDump.text.length,
      })

      return parseCachedDump(cachedDump)
    }
  }

  if (options.forceRefresh || indexUpdated) {
    await deleteCachedDump(url)
  } else {
    const cachedDump = await readCachedDump(url, ttlMs)

    if (cachedDump) {
      onProgress?.({
        loaded: cachedDump.meta.size ?? cachedDump.text.length,
        phase: 'parsing',
        total: cachedDump.meta.size ?? cachedDump.text.length,
      })

      return parseCachedDump(cachedDump)
    }
  }

  const expectedTotal = await loadMetadataSize(defaultDumpMetadataUrl)

  onProgress?.({
    loaded: 0,
    phase: 'requesting',
    total: expectedTotal,
  })

  const response = await fetch(cacheBustedUrl(url), {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to load dump.json: ${response.status} ${response.statusText}`)
  }

  const text = await readResponseText(response, expectedTotal, onProgress)
  const dump = JSON.parse(text) as DumpFile

  await writeCachedDump(url, text, expectedTotal)
  writeDumpIndexTimestamp(fetchedIndexTimestamp)

  onProgress?.({
    loaded: expectedTotal ?? text.length,
    phase: 'parsing',
    total: expectedTotal ?? text.length,
  })

  return normalizeDump(dump)
}
