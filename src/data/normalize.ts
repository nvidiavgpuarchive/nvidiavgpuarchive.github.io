import type { DownloadRow, DumpEntry, DumpFile } from './types'

const torrentUrl = (identifier: string) => {
  if (!identifier) {
    return ''
  }

  return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(identifier)}_archive.torrent`
}

const archivePageUrl = (identifier: string) => {
  if (!identifier) {
    return ''
  }

  return `https://archive.org/details/${encodeURIComponent(identifier)}`
}

const archiveHttpUrl = (identifier: string) => {
  if (!identifier) {
    return ''
  }

  return `https://archive.org/compress/${encodeURIComponent(identifier)}`
}

const zipContentFromDescription = (description: string | undefined) => {
  if (!description?.includes('<pre><code>')) {
    return []
  }

  const codeBlock = description.split('<pre><code>').at(-1)?.split('</code></pre>')[0] ?? ''

  return codeBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const zipContentFromFile = (zipContent: unknown) => {
  if (Array.isArray(zipContent)) {
    return zipContent.map(String).filter(Boolean)
  }

  if (typeof zipContent === 'string') {
    return zipContent
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  return []
}

const checksumEntries = (file: DumpEntry['file']) => {
  const checksumKeys = ['md5', 'sha1', 'sha256', 'sha512', 'blake2b'] as const

  return checksumKeys.flatMap((key) => {
    const value = file?.[key]

    return typeof value === 'string' && value
      ? [
          {
            format: key.toUpperCase(),
            value,
          },
        ]
      : []
  })
}

const normalizeEntry = (fallbackId: string, entry: DumpEntry): DownloadRow => {
  const meta = entry.meta ?? {}
  const file = entry.file ?? {}
  const id = entry.identifier || meta.downloadId || fallbackId
  const filenames = file.filenames ?? []
  const filename = filenames[0] ?? ''
  const productFamilies = meta.productFamilies ?? []
  const descriptionZipContent = zipContentFromDescription(entry.ia_meta?.description)
  const fileZipContent = zipContentFromFile(file.zip_content)

  return {
    id,
    description: meta.description ?? '',
    productFamily: productFamilies.join(', '),
    productFamilies,
    productVersion: meta.version ?? '',
    platform: meta.platformName ?? '',
    platformVersion: meta.platformVersion ?? '',
    releaseDate: meta.releaseDate ?? '',
    category: meta.category ?? '',
    name: meta.name ?? '',
    linkType: meta.linkType ?? '',
    downloadType: meta.downloadType ?? '',
    type: meta.downloadType ?? '',
    filename,
    filenames,
    size: file.size ?? 0,
    md5: file.md5 ?? '',
    checksums: checksumEntries(file),
    downloadId: meta.downloadId ?? '',
    torrentUrl: torrentUrl(id),
    httpUrl: archiveHttpUrl(id),
    archiveUrl: archivePageUrl(id),
    meta,
    zipContent: descriptionZipContent.length > 0 ? descriptionZipContent : fileZipContent,
  }
}

export const normalizeDump = (dump: DumpFile): DownloadRow[] => {
  return Object.entries(dump).map(([key, entry]) => normalizeEntry(key, entry))
}
