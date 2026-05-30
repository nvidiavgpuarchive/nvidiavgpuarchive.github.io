import Papa from 'papaparse'
import type { DownloadRow } from '../data/types'

const formatDate = (date: string) => {
  if (!date) {
    return ''
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

const csvRows = (rows: DownloadRow[]) => {
  return rows.map((row) => ({
    linkType: row.linkType,
    name: typeof row.meta.name === 'string' ? row.meta.name : '',
    description: row.description,
    category: row.category,
    productFamilies: row.productFamily,
    version: row.productVersion,
    platformName: row.platform,
    platformVersion: row.platformVersion,
    releaseDate: formatDate(row.releaseDate),
  }))
}

export const exportRowsToCsv = (rows: DownloadRow[], filename: string) => {
  const csv = Papa.unparse(csvRows(rows), {
    columns: [
      'linkType',
      'name',
      'description',
      'category',
      'productFamilies',
      'version',
      'platformName',
      'platformVersion',
      'releaseDate',
    ],
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
