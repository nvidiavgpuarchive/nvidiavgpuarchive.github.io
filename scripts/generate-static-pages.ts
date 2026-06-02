import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { SitemapStream, streamToPromise } from 'sitemap'
import { normalizeDump } from '../src/data/normalize'
import type { DownloadRow, DumpFile } from '../src/data/types'

const defaultDumpUrl = 'https://raw.githubusercontent.com/nvidiavgpuarchive/index/refs/heads/main/dump.json'
const defaultSiteUrl = 'https://nvidiavgpuarchive.github.io'
const distDir = path.resolve('dist')
const catalogPageSize = Number(process.env.STATIC_CATALOG_PAGE_SIZE ?? 50)
const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? process.env.VITE_SITE_URL ?? defaultSiteUrl)

type PageLink = {
  href: string
  label: string
}

type StaticDownloadRow = DownloadRow & {
  staticDetailHref: string
}

const staticColumns: Array<{
  key: keyof DownloadRow
  label: string
}> = [
  { key: 'category', label: 'Category' },
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'productFamily', label: 'Product Family' },
  { key: 'productVersion', label: 'Product Version' },
  { key: 'platform', label: 'Platform' },
  { key: 'platformVersion', label: 'Platform Version' },
  { key: 'releaseDate', label: 'Release Date' },
  { key: 'type', label: 'Type' },
]

function normalizeSiteUrl(value: string | undefined) {
  if (!value) {
    return undefined
  }

  return value.replace(/\/+$/, '')
}

function absoluteUrl(href: string) {
  return siteUrl ? `${siteUrl}${href}` : undefined
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return ''
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDate(date: string) {
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

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function detailSlug(row: DownloadRow, usedSlugs: Map<string, number>) {
  const base = slugPart(row.id || row.filename || row.description || 'download') || 'download'
  const count = usedSlugs.get(base) ?? 0

  usedSlugs.set(base, count + 1)

  return count === 0 ? base : `${base}-${count + 1}`
}

function titleForRow(row: DownloadRow) {
  return row.description || row.name || row.filename || row.id
}

function descriptionForRow(row: DownloadRow) {
  return [
    row.description,
    row.productFamily,
    row.productVersion,
    row.platform,
    row.platformVersion,
    row.releaseDate,
  ]
    .filter(Boolean)
    .join(' - ')
}

function catalogHref(pageNumber: number) {
  return pageNumber <= 1 ? '/catalog/' : `/catalog/page/${pageNumber}/`
}

function pageDocument({
  body,
  canonicalHref,
  description,
  extraHead = '',
  title,
}: {
  body: string
  canonicalHref: string
  description: string
  extraHead?: string
  title: string
}) {
  const canonicalUrl = absoluteUrl(canonicalHref)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    ${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ''}
    <link rel="contents" href="/catalog/">
    ${extraHead}
    <style>
      body { color: #1a1a1a; font: 14px/1.5 Arial, Helvetica, sans-serif; margin: 0; }
      header, main, footer { margin: 0 auto; max-width: 1180px; padding: 24px; }
      header { border-bottom: 1px solid #ddd; }
      footer { border-top: 1px solid #ddd; color: #666; }
      a { color: #167000; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f4f4f4; font-weight: 700; }
      nav a { display: inline-block; margin: 0 4px 8px 0; padding: 4px 8px; }
      nav [aria-current='page'] { color: #111; font-weight: 700; text-decoration: none; }
      pre { background: #f7f7f7; overflow: auto; padding: 12px; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>
`
}

function paginationNav(currentPage: number, pageCount: number) {
  const links: PageLink[] = Array.from({ length: pageCount }, (_, index) => ({
    href: catalogHref(index + 1),
    label: String(index + 1),
  }))

  const previous = currentPage > 1 ? `<a rel="prev" href="${catalogHref(currentPage - 1)}">Previous</a>` : ''
  const next = currentPage < pageCount ? `<a rel="next" href="${catalogHref(currentPage + 1)}">Next</a>` : ''
  const pages = links
    .map((link) =>
      currentPage === Number(link.label)
        ? `<a aria-current="page" href="${link.href}">${link.label}</a>`
        : `<a href="${link.href}">${link.label}</a>`,
    )
    .join('\n        ')

  return `<nav aria-label="Catalogue pages">
        ${previous}
        ${pages}
        ${next}
      </nav>`
}

function catalogPage(rows: StaticDownloadRow[], pageRows: StaticDownloadRow[], pageNumber: number, pageCount: number) {
  const title = pageNumber === 1 ? 'NVIDIA GPU Driver Archive Catalogue' : `NVIDIA GPU Driver Archive Catalogue - Page ${pageNumber}`
  const previousHead = pageNumber > 1 ? `<link rel="prev" href="${catalogHref(pageNumber - 1)}">` : ''
  const nextHead = pageNumber < pageCount ? `<link rel="next" href="${catalogHref(pageNumber + 1)}">` : ''
  const headerCells = staticColumns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join('\n              ')
  const rowsHtml = pageRows
    .map((row) => {
      const cells = staticColumns
        .map((column) => {
          const rawValue = column.key === 'releaseDate' ? formatDate(row.releaseDate) : row[column.key]
          const value = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue

          if (column.key === 'description') {
            return `<td><a href="${row.staticDetailHref}">${escapeHtml(value || titleForRow(row))}</a></td>`
          }

          return `<td>${escapeHtml(value)}</td>`
        })
        .join('\n              ')

      return `<tr>
              ${cells}
            </tr>`
    })
    .join('\n')

  return pageDocument({
    body: `<header>
      <p><a href="/">Dynamic download search</a></p>
      <h1>NVIDIA GPU Driver Archive Catalogue</h1>
      <p>${rows.length} downloads indexed. This static catalogue links to crawlable detail pages; the dynamic app remains available at the site root.</p>
    </header>
    <main>
      ${paginationNav(pageNumber, pageCount)}
      <table>
        <thead>
          <tr>
              ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${paginationNav(pageNumber, pageCount)}
    </main>
    <footer>
      <a href="/">Return to dynamic search</a>
    </footer>`,
    canonicalHref: catalogHref(pageNumber),
    description: `Static catalogue page ${pageNumber} of ${pageCount} for NVIDIA GPU driver archive downloads.`,
    extraHead: `${previousHead}${nextHead}`,
    title,
  })
}

function detailRows(row: DownloadRow) {
  const details: Array<[string, unknown]> = [
    ['File Name', row.filename],
    ['File Size', formatBytes(row.size)],
    ['Category', row.category],
    ['Name', row.name],
    ['Description', row.description],
    ['Product Family', row.productFamily],
    ['Product Version', row.productVersion],
    ['Platform', row.platform],
    ['Platform Version', row.platformVersion],
    ['Release Date', formatDate(row.releaseDate)],
    ['Type', row.type],
    ['Download ID', row.downloadId],
    ['Archive Identifier', row.id],
  ]

  return details
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('\n          ')
}

function checksumsTable(row: DownloadRow) {
  if (row.checksums.length === 0) {
    return ''
  }

  const rows = row.checksums
    .map(
      (checksum) =>
        `<tr><th scope="row">${escapeHtml(checksum.format)}</th><td><code>${escapeHtml(checksum.value)}</code></td></tr>`,
    )
    .join('\n          ')

  return `<section>
      <h2>Checksums</h2>
      <table>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>`
}

function zipContentSection(row: DownloadRow) {
  if (row.zipContent.length === 0) {
    return ''
  }

  return `<section>
      <h2>Zip Content</h2>
      <pre><code>${escapeHtml(row.zipContent.join('\n'))}</code></pre>
    </section>`
}

function detailPage(row: StaticDownloadRow) {
  const title = titleForRow(row)

  return pageDocument({
    body: `<header>
      <p><a href="/catalog/">Catalogue</a> / <a href="/">Dynamic download search</a></p>
      <h1>${escapeHtml(title)}</h1>
    </header>
    <main>
      <section>
        <h2>Details</h2>
        <table>
          <tbody>
            ${detailRows(row)}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Downloads</h2>
        <p class="actions">
          <a href="${row.httpUrl}" rel="noreferrer" target="_blank">Download HTTP Archive</a>
          <a href="${row.torrentUrl}" rel="noreferrer" target="_blank">Download Torrent</a>
          <a href="${row.archiveUrl}" rel="noreferrer" target="_blank">Internet Archive</a>
        </p>
      </section>
      ${checksumsTable(row)}
      ${zipContentSection(row)}
    </main>
    <footer>
      <a href="/catalog/">Browse catalogue</a>
    </footer>`,
    canonicalHref: row.staticDetailHref,
    description: descriptionForRow(row),
    title: `${title} | NVIDIA GPU Driver Archive`,
  })
}

async function loadDump() {
  const dumpFile = process.env.STATIC_DUMP_FILE

  if (dumpFile) {
    return JSON.parse(await readFile(path.resolve(dumpFile), 'utf8')) as DumpFile
  }

  const dumpUrl = process.env.STATIC_DUMP_URL ?? defaultDumpUrl
  const response = await fetch(dumpUrl, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch dump.json for static generation: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as DumpFile
}

async function writePage(href: string, html: string) {
  const directory = path.join(distDir, href)

  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'index.html'), html)
}

async function writeSitemap(rows: StaticDownloadRow[], pageCount: number) {
  if (!siteUrl) {
    return
  }

  const sitemap = new SitemapStream({ hostname: siteUrl })
  const links = [
    { changefreq: 'daily', priority: 1, url: '/' },
    { changefreq: 'daily', priority: 0.9, url: '/catalog/' },
    ...Array.from({ length: pageCount - 1 }, (_, index) => ({
      changefreq: 'daily',
      priority: 0.8,
      url: catalogHref(index + 2),
    })),
    ...rows.map((row) => ({
      changefreq: 'weekly',
      lastmod: row.releaseDate || undefined,
      priority: 0.7,
      url: row.staticDetailHref,
    })),
  ]

  const sitemapXml = await streamToPromise(Readable.from(links).pipe(sitemap))
  await writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml)
}

async function writeRobots() {
  const sitemapLine = siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''

  await writeFile(
    path.join(distDir, 'robots.txt'),
    `User-agent: *
Allow: /
${sitemapLine}`,
  )
}

async function injectCatalogLinkIntoAppIndex() {
  const indexPath = path.join(distDir, 'index.html')
  const html = await readFile(indexPath, 'utf8')
  let nextHtml = html

  if (!nextHtml.includes('rel="contents" href="/catalog/"')) {
    nextHtml = nextHtml.replace(
      '</head>',
      '    <link rel="contents" href="/catalog/">\n    <link rel="alternate" type="text/html" href="/catalog/" title="Static download catalogue">\n  </head>',
    )
  }

  if (!nextHtml.includes('Browse static download catalogue')) {
    nextHtml = nextHtml.replace(
      '<div id="root"></div>',
      '<noscript><p><a href="/catalog/">Browse static download catalogue</a></p></noscript>\n    <div id="root"></div>',
    )
  }

  if (nextHtml !== html) {
    await writeFile(indexPath, nextHtml)
  }
}

async function assertDistExists() {
  await readFile(path.join(distDir, 'index.html'), 'utf8')
}

async function main() {
  await assertDistExists()

  const dump = await loadDump()
  const usedSlugs = new Map<string, number>()
  const rows = normalizeDump(dump)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .map((row) => ({
      ...row,
      staticDetailHref: `/downloads/${detailSlug(row, usedSlugs)}/`,
    }))
  const pageCount = Math.max(1, Math.ceil(rows.length / catalogPageSize))

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const start = (pageNumber - 1) * catalogPageSize
    const pageRows = rows.slice(start, start + catalogPageSize)

    await writePage(catalogHref(pageNumber), catalogPage(rows, pageRows, pageNumber, pageCount))
  }

  for (const row of rows) {
    await writePage(row.staticDetailHref, detailPage(row))
  }

  await writeSitemap(rows, pageCount)
  await writeRobots()
  await injectCatalogLinkIntoAppIndex()

  console.log(`Generated ${pageCount} catalogue pages and ${rows.length} download detail pages.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
