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
const defaultDumpCacheTtlMs = 30 * 24 * 60 * 60 * 1000

export const defaultDumpUrl =
  import.meta.env.VITE_DUMP_URL ||
  'https://raw.githubusercontent.com/nvidiavgpuarchive/index/refs/heads/main/dump.json'

export const defaultDumpMetadataUrl =
  import.meta.env.VITE_DUMP_METADATA_URL ||
  'https://api.github.com/repos/nvidiavgpuarchive/index/contents/dump.json?ref=main'

const cacheBustedUrl = (url: string) => {
  const requestUrl = new URL(url, window.location.href)

  requestUrl.searchParams.set('_', Date.now().toString())

  return requestUrl.toString()
}

const dumpCacheMetaKey = (url: string) => `nvidia-dump-cache-meta:${url}`

const dumpCacheAvailable = () => 'caches' in window && 'localStorage' in window

const readDumpCacheMeta = (url: string) => {
  try {
    const value = window.localStorage.getItem(dumpCacheMetaKey(url))

    return value ? (JSON.parse(value) as DumpCacheMeta) : undefined
  } catch {
    return undefined
  }
}

const writeDumpCacheMeta = (url: string, meta: DumpCacheMeta) => {
  try {
    window.localStorage.setItem(dumpCacheMetaKey(url), JSON.stringify(meta))
  } catch {
    // Cache metadata is an optimization; loading should still work without it.
  }
}

const deleteCachedDump = async (url: string) => {
  if (!dumpCacheAvailable()) {
    return
  }

  try {
    window.localStorage.removeItem(dumpCacheMetaKey(url))
    const cache = await window.caches.open(dumpCacheName)
    await cache.delete(url)
  } catch {
    // Ignore cache cleanup failures and fall back to a network request.
  }
}

const readCachedDump = async (url: string, ttlMs: number) => {
  if (!dumpCacheAvailable()) {
    return undefined
  }

  const meta = readDumpCacheMeta(url)

  if (!meta || Date.now() - meta.cachedAt > ttlMs) {
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
    writeDumpCacheMeta(url, {
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

  if (options.forceRefresh) {
    await deleteCachedDump(url)
  } else {
    const cachedDump = await readCachedDump(url, ttlMs)

    if (cachedDump) {
      onProgress?.({
        loaded: cachedDump.meta.size ?? cachedDump.text.length,
        phase: 'parsing',
        total: cachedDump.meta.size ?? cachedDump.text.length,
      })

      return normalizeDump(JSON.parse(cachedDump.text) as DumpFile)
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
  await writeCachedDump(url, text, expectedTotal)

  onProgress?.({
    loaded: expectedTotal ?? text.length,
    phase: 'parsing',
    total: expectedTotal ?? text.length,
  })

  const dump = JSON.parse(text) as DumpFile
  return normalizeDump(dump)
}
