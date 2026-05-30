export type EntryMeta = {
  checksumFormat?: string
  description?: string
  downloadId?: string
  downloadType?: string
  linkType?: string
  name?: string
  platformName?: string
  platformVersion?: string
  productFamilies?: string[]
  productName?: string
  releaseDate?: string
  version?: string
  category?: string
} & Record<string, unknown>

export type EntryFile = {
  size?: number
  filenames?: string[]
  md5?: string
  sha1?: string
  sha256?: string
  sha512?: string
  blake2b?: string
  zip_content?: string[] | string
} & Record<string, unknown>

export type ArchiveMeta = {
  description?: string
} & Record<string, unknown>

export type DumpEntry = {
  identifier?: string
  meta?: EntryMeta
  file?: EntryFile
  ia_meta?: ArchiveMeta
}

export type DumpFile = Record<string, DumpEntry>

export type DownloadRow = {
  id: string
  description: string
  productFamily: string
  productFamilies: string[]
  productVersion: string
  platform: string
  platformVersion: string
  releaseDate: string
  category: string
  name: string
  linkType: string
  downloadType: string
  type: string
  filename: string
  filenames: string[]
  size: number
  md5: string
  checksums: Array<{
    format: string
    value: string
  }>
  downloadId: string
  torrentUrl: string
  httpUrl: string
  archiveUrl: string
  meta: EntryMeta
  zipContent: string[]
}
