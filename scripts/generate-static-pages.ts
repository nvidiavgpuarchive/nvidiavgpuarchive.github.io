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
const generatedAt = new Date()
const generatedAtIso = generatedAt.toISOString()

type PageLink = {
  href: string
  label: string
}

type StaticDownloadRow = DownloadRow & {
  staticDetailHref: string
}

type StaticPageUrl = {
  changefreq: 'daily' | 'weekly'
  lastmod?: string
  priority: number
  url: string
}

type TopicKind = 'category' | 'platform' | 'product-family'

type TopicPage = {
  description: string
  href: string
  kind: TopicKind
  label: string
  rows: StaticDownloadRow[]
  title: string
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

function jsonScript(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
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

function formatGeneratedDate() {
  return generatedAt.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
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

function seoTitleForRow(row: DownloadRow) {
  const parts = [
    'NVIDIA',
    row.productFamily || row.name,
    row.productVersion,
    row.platform,
    row.platformVersion,
    row.type || 'Driver',
    'Download',
  ].filter(Boolean)

  return parts.join(' ')
}

function catalogHref(pageNumber: number) {
  return pageNumber <= 1 ? '/catalog/' : `/catalog/page/${pageNumber}/`
}

function topicHref(kind: TopicKind, slug: string, pageNumber = 1) {
  const root = `/catalog/${kind}/${slug}/`

  return pageNumber <= 1 ? root : `${root}page/${pageNumber}/`
}

function snapshotNotice(scope: string) {
  return `<p>This ${scope} is a static snapshot generated from dump.json on ${formatGeneratedDate()}. For the newest data, live filtering, sorting, and CSV export, use the <a href="/">dynamic search app</a>.</p>`
}

function returnToCatalogueLink() {
  return `<p><a href="/catalog/">Return to catalogue</a></p>`
}

function pageDocument({
  body,
  canonicalHref,
  description,
  extraHead = '',
  jsonLd,
  title,
}: {
  body: string
  canonicalHref: string
  description: string
  extraHead?: string
  jsonLd?: unknown
  title: string
}) {
  const canonicalUrl = absoluteUrl(canonicalHref)
  const socialUrl = canonicalUrl ?? canonicalHref
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle}</title>
    <meta name="description" content="${escapedDescription}">
    <meta name="last-modified" content="${generatedAtIso}">
    <meta property="og:title" content="${escapedTitle}">
    <meta property="og:description" content="${escapedDescription}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(socialUrl)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapedTitle}">
    <meta name="twitter:description" content="${escapedDescription}">
    ${canonicalUrl ? `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">` : ''}
    <link rel="contents" href="/catalog/">
    ${extraHead}
    ${jsonLd ? `<script type="application/ld+json">${jsonScript(jsonLd)}</script>` : ''}
    <style>
      body { color: #1a1a1a; font: 14px/1.5 Arial, Helvetica, sans-serif; margin: 0; }
      header, main { margin: 0 auto; max-width: 1180px; padding: 24px; }
      header { border-bottom: 1px solid #ddd; }
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

function paginationNav(currentPage: number, pageCount: number, hrefForPage = catalogHref) {
  const links: PageLink[] = Array.from({ length: pageCount }, (_, index) => ({
    href: hrefForPage(index + 1),
    label: String(index + 1),
  }))

  const previous = currentPage > 1 ? `<a rel="prev" href="${hrefForPage(currentPage - 1)}">Previous</a>` : ''
  const next = currentPage < pageCount ? `<a rel="next" href="${hrefForPage(currentPage + 1)}">Next</a>` : ''
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

function rowsTable(pageRows: StaticDownloadRow[]) {
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

  return `<table>
        <thead>
          <tr>
              ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>`
}

function topicSummaryLinks(topicPages: TopicPage[]) {
  const topicKinds: Array<[TopicKind, string]> = [
    ['category', 'Categories'],
    ['product-family', 'Product Families'],
    ['platform', 'Platforms'],
  ]

  return topicKinds
    .map(([kind, heading]) => {
      const links = topicPages
        .filter((topic) => topic.kind === kind)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((topic) => `<li><a href="${topic.href}">${escapeHtml(topic.label)}</a> (${topic.rows.length})</li>`)
        .join('\n          ')

      if (!links) {
        return ''
      }

      return `<section>
        <h2>${escapeHtml(heading)}</h2>
        <ul>
          ${links}
        </ul>
      </section>`
    })
    .join('\n')
}

function catalogPage(
  rows: StaticDownloadRow[],
  pageRows: StaticDownloadRow[],
  pageNumber: number,
  pageCount: number,
  topicPages: TopicPage[],
) {
  const title = pageNumber === 1 ? 'NVIDIA GPU Driver Archive Catalogue' : `NVIDIA GPU Driver Archive Catalogue - Page ${pageNumber}`
  const previousHead = pageNumber > 1 ? `<link rel="prev" href="${catalogHref(pageNumber - 1)}">` : ''
  const nextHead = pageNumber < pageCount ? `<link rel="next" href="${catalogHref(pageNumber + 1)}">` : ''

  return pageDocument({
    body: `<header>
      <h1>NVIDIA GPU Driver Archive Catalogue</h1>
      <p>${rows.length} downloads indexed.</p>
      ${snapshotNotice('catalogue')}
    </header>
    <main>
      ${pageNumber === 1 ? topicSummaryLinks(topicPages) : ''}
      ${paginationNav(pageNumber, pageCount)}
      ${rowsTable(pageRows)}
      ${paginationNav(pageNumber, pageCount)}
    </main>`,
    canonicalHref: catalogHref(pageNumber),
    description: `Static catalogue page ${pageNumber} of ${pageCount} for NVIDIA GPU driver archive downloads.`,
    extraHead: `${previousHead}${nextHead}`,
    title,
  })
}

function topicPage(topic: TopicPage, pageRows: StaticDownloadRow[], pageNumber: number, pageCount: number) {
  const slug = topic.href.split('/').filter(Boolean).at(-1) ?? ''
  const hrefForPage = (page: number) => topicHref(topic.kind, slug, page)
  const previousHead = pageNumber > 1 ? `<link rel="prev" href="${hrefForPage(pageNumber - 1)}">` : ''
  const nextHead = pageNumber < pageCount ? `<link rel="next" href="${hrefForPage(pageNumber + 1)}">` : ''
  const pageTitle = pageNumber === 1 ? topic.title : `${topic.title} - Page ${pageNumber}`
  return pageDocument({
    body: `<header>
      ${returnToCatalogueLink()}
      <h1>${escapeHtml(topic.title)}</h1>
      <p>${escapeHtml(topic.description)}</p>
      ${snapshotNotice(`${topic.label} catalogue page`)}
    </header>
    <main>
      ${paginationNav(pageNumber, pageCount, hrefForPage)}
      ${rowsTable(pageRows)}
      ${paginationNav(pageNumber, pageCount, hrefForPage)}
    </main>`,
    canonicalHref: hrefForPage(pageNumber),
    description: topic.description,
    extraHead: `${previousHead}${nextHead}`,
    title: pageTitle,
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

function detailJsonLd(row: StaticDownloadRow) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    applicationCategory: row.category || undefined,
    datePublished: row.releaseDate || undefined,
    description: descriptionForRow(row),
    downloadUrl: row.httpUrl || undefined,
    fileSize: row.size ? formatBytes(row.size) : undefined,
    identifier: row.downloadId || row.id,
    name: titleForRow(row),
    operatingSystem: [row.platform, row.platformVersion].filter(Boolean).join(' ') || undefined,
    sameAs: row.archiveUrl || undefined,
    softwareVersion: row.productVersion || undefined,
    url: absoluteUrl(row.staticDetailHref) ?? row.staticDetailHref,
  }
}

function detailPage(row: StaticDownloadRow) {
  const title = titleForRow(row)
  const seoTitle = seoTitleForRow(row)

  return pageDocument({
    body: `<header>
      ${returnToCatalogueLink()}
      <h1>${escapeHtml(title)}</h1>
      ${snapshotNotice('download detail page')}
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
    </main>`,
    canonicalHref: row.staticDetailHref,
    description: descriptionForRow(row),
    jsonLd: detailJsonLd(row),
    title: `${seoTitle} | NVIDIA GPU Driver Archive`,
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

function groupRows(rows: StaticDownloadRow[], valueForRow: (row: StaticDownloadRow) => string[]) {
  const groups = new Map<string, StaticDownloadRow[]>()

  for (const row of rows) {
    for (const value of valueForRow(row).map((item) => item.trim()).filter(Boolean)) {
      const group = groups.get(value) ?? []

      group.push(row)
      groups.set(value, group)
    }
  }

  return groups
}

function buildTopicPages(rows: StaticDownloadRow[]) {
  const topicConfigs: Array<{
    description: (value: string, count: number) => string
    kind: TopicKind
    title: (value: string) => string
    values: (row: StaticDownloadRow) => string[]
  }> = [
    {
      description: (value, count) => `${count} NVIDIA GPU archive downloads in the ${value} category.`,
      kind: 'category',
      title: (value) => `NVIDIA GPU ${value} Downloads`,
      values: (row) => [row.category],
    },
    {
      description: (value, count) => `${count} NVIDIA GPU archive downloads for ${value}.`,
      kind: 'product-family',
      title: (value) => `NVIDIA ${value} Downloads`,
      values: (row) => row.productFamilies.length > 0 ? row.productFamilies : [row.productFamily],
    },
    {
      description: (value, count) => `${count} NVIDIA GPU archive downloads for ${value}.`,
      kind: 'platform',
      title: (value) => `NVIDIA GPU Downloads for ${value}`,
      values: (row) => [row.platform],
    },
  ]

  return topicConfigs.flatMap((config) => {
    return Array.from(groupRows(rows, config.values).entries()).map(([value, groupRowsForValue]) => {
      const slug = slugPart(value)

      return {
        description: config.description(value, groupRowsForValue.length),
        href: topicHref(config.kind, slug),
        kind: config.kind,
        label: value,
        rows: groupRowsForValue,
        title: config.title(value),
      }
    })
  })
}

async function writeTopicPages(topicPages: TopicPage[]) {
  const sitemapUrls: StaticPageUrl[] = []

  for (const topic of topicPages) {
    const slug = topic.href.split('/').filter(Boolean).at(-1) ?? ''
    const pageCount = Math.max(1, Math.ceil(topic.rows.length / catalogPageSize))

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const start = (pageNumber - 1) * catalogPageSize
      const href = topicHref(topic.kind, slug, pageNumber)

      await writePage(href, topicPage(topic, topic.rows.slice(start, start + catalogPageSize), pageNumber, pageCount))
      sitemapUrls.push({
        changefreq: 'daily',
        priority: pageNumber === 1 ? 0.75 : 0.65,
        url: href,
      })
    }
  }

  return sitemapUrls
}

async function writeSitemap(urls: StaticPageUrl[]) {
  if (!siteUrl) {
    return
  }

  const sitemap = new SitemapStream({ hostname: siteUrl })
  const sitemapXml = await streamToPromise(Readable.from(urls).pipe(sitemap))
  await writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml)
}

async function writeNotFoundPage() {
  await writeFile(
    path.join(distDir, '404.html'),
    pageDocument({
      body: `<header>
      ${returnToCatalogueLink()}
      <h1>Page Not Found</h1>
      <p>The requested archive page was not found.</p>
    </header>
    <main>
      <p><a href="/catalog/">Browse the static download catalogue</a> or return to the <a href="/">dynamic search app</a>.</p>
    </main>`,
      canonicalHref: '/404.html',
      description: 'Page not found. Browse the NVIDIA GPU Driver Archive catalogue or return to the dynamic search app.',
      title: 'Page Not Found | NVIDIA GPU Driver Archive',
    }),
  )
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
  const topicPages = buildTopicPages(rows)
  const sitemapUrls: StaticPageUrl[] = [
    { changefreq: 'daily', priority: 1, url: '/' },
  ]

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const start = (pageNumber - 1) * catalogPageSize
    const pageRows = rows.slice(start, start + catalogPageSize)
    const href = catalogHref(pageNumber)

    await writePage(href, catalogPage(rows, pageRows, pageNumber, pageCount, topicPages))
    sitemapUrls.push({
      changefreq: 'daily',
      priority: pageNumber === 1 ? 0.9 : 0.8,
      url: href,
    })
  }

  const topicSitemapUrls = await writeTopicPages(topicPages)

  sitemapUrls.push(...topicSitemapUrls)

  for (const row of rows) {
    await writePage(row.staticDetailHref, detailPage(row))
    sitemapUrls.push({
      changefreq: 'weekly',
      lastmod: row.releaseDate || undefined,
      priority: 0.7,
      url: row.staticDetailHref,
    })
  }

  await writeSitemap(sitemapUrls)
  await writeRobots()
  await writeNotFoundPage()
  await injectCatalogLinkIntoAppIndex()

  console.log(
    `Generated ${pageCount} catalogue pages, ${topicPages.length} topic groups, and ${rows.length} download detail pages.`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
