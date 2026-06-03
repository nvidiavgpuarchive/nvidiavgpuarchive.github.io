import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import i18next, { type TFunction } from 'i18next'
import { SitemapIndexStream, SitemapStream, streamToPromise } from 'sitemap'
import { normalizeDump } from '../src/data/normalize'
import type { DownloadRow, DumpFile } from '../src/data/types'
import { defaultLocale, locales, resources, type Locale } from '../src/i18n/resources'

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
  staticDetailSlug: string
}

type StaticPageUrl = {
  changefreq: 'daily' | 'weekly'
  lastmod?: string
  priority: number
  url: string
}

type LocaleSitemap = {
  ctx: StaticContext
  urls: StaticPageUrl[]
}

type TopicKind = 'category' | 'platform' | 'product-family'

type TopicPage = {
  description: string
  kind: TopicKind
  label: string
  rows: StaticDownloadRow[]
  slug: string
  title: string
}

const staticColumns: Array<{
  key: keyof DownloadRow
  labelKey: string
}> = [
  { key: 'category', labelKey: 'table.columns.category' },
  { key: 'name', labelKey: 'table.columns.name' },
  { key: 'description', labelKey: 'table.columns.description' },
  { key: 'productFamily', labelKey: 'table.columns.productFamily' },
  { key: 'productVersion', labelKey: 'table.columns.productVersion' },
  { key: 'platform', labelKey: 'table.columns.platform' },
  { key: 'platformVersion', labelKey: 'table.columns.platformVersion' },
  { key: 'releaseDate', labelKey: 'table.columns.releaseDate' },
  { key: 'type', labelKey: 'table.columns.type' },
]

type StaticContext = {
  locale: Locale
  prefix: '' | Locale
  t: TFunction
}

function logStage(message: string) {
  console.log(`[static] ${new Date().toISOString()} ${message}`)
}

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

function formatDate(date: string, locale: Locale) {
  if (!date) {
    return ''
  }

  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatGeneratedDate(locale: Locale) {
  return generatedAt.toLocaleDateString(locale, {
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

function seoTitleForRow(row: DownloadRow, t: TFunction) {
  const parts = [
    'NVIDIA',
    row.productFamily || row.name,
    row.productVersion,
    row.platform,
    row.platformVersion,
    row.type || t('details.type'),
    t('actions.download'),
  ].filter(Boolean)

  return parts.join(' ')
}

function localePath(prefix: StaticContext['prefix']) {
  return prefix ? `/${prefix}` : ''
}

function catalogHref(ctx: StaticContext, pageNumber: number) {
  const base = `/catalog${localePath(ctx.prefix)}`

  return pageNumber <= 1 ? `${base}/` : `${base}/page/${pageNumber}/`
}

function topicHref(ctx: StaticContext, kind: TopicKind, slug: string, pageNumber = 1) {
  const root = `/catalog${localePath(ctx.prefix)}/${kind}/${slug}/`

  return pageNumber <= 1 ? root : `${root}page/${pageNumber}/`
}

function detailHref(ctx: StaticContext, row: StaticDownloadRow) {
  return `/downloads${localePath(ctx.prefix)}/${row.staticDetailSlug}/`
}

function snapshotNotice(ctx: StaticContext, scope: string) {
  return `<p>${ctx.t('static.snapshotNotice', {
    dynamicSearchLink: `<a href="/">${escapeHtml(ctx.t('static.actions.dynamicSearchApp'))}</a>`,
    date: formatGeneratedDate(ctx.locale),
    interpolation: { escapeValue: false },
    scope,
  })}</p>`
}

function returnToCatalogueLink(ctx: StaticContext) {
  return `<p><a href="${catalogHref(ctx, 1)}">${escapeHtml(ctx.t('static.actions.returnToCatalogue'))}</a></p>`
}

function notFoundHelp(ctx: StaticContext) {
  return `<p>${ctx.t('static.detail.notFoundHelp', {
    catalogueLink: `<a href="${catalogHref(ctx, 1)}">${escapeHtml(ctx.t('static.footer.browseCatalogue'))}</a>`,
    dynamicSearchLink: `<a href="/">${escapeHtml(ctx.t('static.actions.dynamicSearchApp'))}</a>`,
    interpolation: { escapeValue: false },
  })}</p>`
}

function alternateLinks(pathForLocale: (ctx: StaticContext) => string, contexts: StaticContext[]) {
  const links = contexts
    .map((ctx) => {
      const href = absoluteUrl(pathForLocale(ctx))
      return href ? `<link rel="alternate" hreflang="${ctx.locale}" href="${escapeHtml(href)}">` : ''
    })
    .filter(Boolean)
  const defaultHref = absoluteUrl(pathForLocale(contexts[0]))

  if (defaultHref) {
    links.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(defaultHref)}">`)
  }

  return links.join('\n    ')
}

function languageFooter(ctx: StaticContext, contexts: StaticContext[], pathForLocale: (ctx: StaticContext) => string) {
  const links = contexts
    .map((alternateCtx) => {
      const label = ctx.t(`localeNames.${alternateCtx.locale}`)

      if (alternateCtx.locale === ctx.locale) {
        return `<span aria-current="true">${escapeHtml(label)}</span>`
      }

      return `<a href="${pathForLocale(alternateCtx)}">${escapeHtml(label)}</a>`
    })
    .join('\n        ')

  return `<footer class="language-footer" aria-label="${escapeHtml(ctx.t('static.footer.languageVariants'))}">
      <span class="language-footer__label">${escapeHtml(ctx.t('static.footer.languageVariants'))}</span>
      <nav class="language-footer__links">
        ${links}
      </nav>
    </footer>`
}

function pageDocument({
  body,
  canonicalHref,
  description,
  extraHead = '',
  footer = '',
  jsonLd,
  locale,
  title,
}: {
  body: string
  canonicalHref: string
  description: string
  extraHead?: string
  footer?: string
  jsonLd?: unknown
  locale: Locale
  title: string
}) {
  const canonicalUrl = absoluteUrl(canonicalHref)
  const socialUrl = canonicalUrl ?? canonicalHref
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)

  return `<!doctype html>
<html lang="${locale}">
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
      header, main, footer { margin: 0 auto; max-width: 1180px; padding: 24px; }
      header { border-bottom: 1px solid #ddd; }
      footer { border-top: 1px solid #ddd; color: #555; }
      a { color: #167000; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f4f4f4; font-weight: 700; }
      nav a { display: inline-block; margin: 0 4px 8px 0; padding: 4px 8px; }
      nav [aria-current='page'] { color: #111; font-weight: 700; text-decoration: none; }
      pre { background: #f7f7f7; overflow: auto; padding: 12px; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .language-footer { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; line-height: 1.2; }
      .language-footer__label { display: inline-flex; align-items: center; min-height: 32px; }
      .language-footer__links { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .language-footer a, .language-footer span[aria-current='true'] { display: inline-flex; align-items: center; min-height: 32px; margin: 0; padding: 0 8px; }
      .language-footer span[aria-current='true'] { color: #111; font-weight: 700; }
    </style>
  </head>
  <body>
    ${body}
    ${footer}
  </body>
</html>
`
}

function paginationNav(ctx: StaticContext, currentPage: number, pageCount: number, hrefForPage: (page: number) => string) {
  const links: PageLink[] = Array.from({ length: pageCount }, (_, index) => ({
    href: hrefForPage(index + 1),
    label: String(index + 1),
  }))

  const previous = currentPage > 1 ? `<a rel="prev" href="${hrefForPage(currentPage - 1)}">${escapeHtml(ctx.t('static.pagination.previous'))}</a>` : ''
  const next = currentPage < pageCount ? `<a rel="next" href="${hrefForPage(currentPage + 1)}">${escapeHtml(ctx.t('static.pagination.next'))}</a>` : ''
  const pages = links
    .map((link) =>
      currentPage === Number(link.label)
        ? `<a aria-current="page" href="${link.href}">${link.label}</a>`
        : `<a href="${link.href}">${link.label}</a>`,
    )
    .join('\n        ')

  return `<nav aria-label="${escapeHtml(ctx.t('static.pagination.label'))}">
        ${previous}
        ${pages}
        ${next}
      </nav>`
}

function rowsTable(ctx: StaticContext, pageRows: StaticDownloadRow[]) {
  const headerCells = staticColumns.map((column) => `<th scope="col">${escapeHtml(ctx.t(column.labelKey))}</th>`).join('\n              ')
  const rowsHtml = pageRows
    .map((row) => {
      const cells = staticColumns
        .map((column) => {
          const rawValue = column.key === 'releaseDate' ? formatDate(row.releaseDate, ctx.locale) : row[column.key]
          const value = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue

          if (column.key === 'description') {
            return `<td><a href="${detailHref(ctx, row)}">${escapeHtml(value || titleForRow(row))}</a></td>`
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

function topicSummaryLinks(ctx: StaticContext, topicPages: TopicPage[]) {
  const topicKinds: Array<[TopicKind, string]> = [
    ['category', 'static.catalogue.categories'],
    ['product-family', 'static.catalogue.productFamilies'],
    ['platform', 'table.columns.platform'],
  ]

  return topicKinds
    .map(([kind, heading]) => {
      const links = topicPages
        .filter((topic) => topic.kind === kind)
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((topic) => `<li><a href="${topicHref(ctx, topic.kind, topic.slug)}">${escapeHtml(topic.label)}</a> (${topic.rows.length})</li>`)
        .join('\n          ')

      if (!links) {
        return ''
      }

      return `<section>
        <h2>${escapeHtml(ctx.t(heading))}</h2>
        <ul>
          ${links}
        </ul>
      </section>`
    })
    .join('\n')
}

function topicTitle(ctx: StaticContext, topic: TopicPage) {
  if (topic.kind === 'category') {
    return ctx.t('static.topics.categoryTitle', { value: topic.label })
  }

  if (topic.kind === 'product-family') {
    return ctx.t('static.topics.productFamilyTitle', { value: topic.label })
  }

  return ctx.t('static.topics.platformTitle', { value: topic.label })
}

function topicDescription(ctx: StaticContext, topic: TopicPage) {
  return ctx.t(topic.kind === 'category' ? 'static.meta.topicDescriptionCategory' : 'static.meta.topicDescription', {
    count: topic.rows.length,
    value: topic.label,
  })
}

function catalogPage(
  ctx: StaticContext,
  contexts: StaticContext[],
  rows: StaticDownloadRow[],
  pageRows: StaticDownloadRow[],
  pageNumber: number,
  pageCount: number,
  topicPages: TopicPage[],
) {
  const title = pageNumber === 1 ? ctx.t('static.catalogue.title') : `${ctx.t('static.catalogue.title')} - ${pageNumber}`
  const previousHead = pageNumber > 1 ? `<link rel="prev" href="${catalogHref(ctx, pageNumber - 1)}">` : ''
  const nextHead = pageNumber < pageCount ? `<link rel="next" href="${catalogHref(ctx, pageNumber + 1)}">` : ''
  const alternates = alternateLinks((alternateCtx) => catalogHref(alternateCtx, pageNumber), contexts)

  return pageDocument({
    body: `<header>
      <h1>${escapeHtml(ctx.t('static.catalogue.title'))}</h1>
      <p>${escapeHtml(ctx.t('static.catalogue.downloadsIndexed', { count: rows.length }))}</p>
      ${snapshotNotice(ctx, ctx.t('static.scopes.catalogue'))}
    </header>
    <main>
      ${pageNumber === 1 ? topicSummaryLinks(ctx, topicPages) : ''}
      ${paginationNav(ctx, pageNumber, pageCount, (page) => catalogHref(ctx, page))}
      ${rowsTable(ctx, pageRows)}
      ${paginationNav(ctx, pageNumber, pageCount, (page) => catalogHref(ctx, page))}
    </main>`,
    canonicalHref: catalogHref(ctx, pageNumber),
    description: ctx.t('static.meta.catalogueDescription', { page: pageNumber, pageCount }),
    extraHead: `${previousHead}${nextHead}${alternates ? `\n    ${alternates}` : ''}`,
    footer: languageFooter(ctx, contexts, (alternateCtx) => catalogHref(alternateCtx, pageNumber)),
    locale: ctx.locale,
    title,
  })
}

function topicPage(ctx: StaticContext, contexts: StaticContext[], topic: TopicPage, pageRows: StaticDownloadRow[], pageNumber: number, pageCount: number) {
  const hrefForPage = (page: number) => topicHref(ctx, topic.kind, topic.slug, page)
  const previousHead = pageNumber > 1 ? `<link rel="prev" href="${hrefForPage(pageNumber - 1)}">` : ''
  const nextHead = pageNumber < pageCount ? `<link rel="next" href="${hrefForPage(pageNumber + 1)}">` : ''
  const title = topicTitle(ctx, topic)
  const description = topicDescription(ctx, topic)
  const pageTitle = pageNumber === 1 ? title : `${title} - ${pageNumber}`
  const alternates = alternateLinks((alternateCtx) => topicHref(alternateCtx, topic.kind, topic.slug, pageNumber), contexts)
  return pageDocument({
    body: `<header>
      ${returnToCatalogueLink(ctx)}
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      ${snapshotNotice(ctx, ctx.t('static.scopes.topicCataloguePage', { value: topic.label }))}
    </header>
    <main>
      ${paginationNav(ctx, pageNumber, pageCount, hrefForPage)}
      ${rowsTable(ctx, pageRows)}
      ${paginationNav(ctx, pageNumber, pageCount, hrefForPage)}
    </main>`,
    canonicalHref: hrefForPage(pageNumber),
    description,
    extraHead: `${previousHead}${nextHead}${alternates ? `\n    ${alternates}` : ''}`,
    footer: languageFooter(ctx, contexts, (alternateCtx) => topicHref(alternateCtx, topic.kind, topic.slug, pageNumber)),
    locale: ctx.locale,
    title: pageTitle,
  })
}

function detailRows(ctx: StaticContext, row: DownloadRow) {
  const details: Array<[string, unknown]> = [
    [ctx.t('details.fileName'), row.filename],
    [ctx.t('details.fileSize'), formatBytes(row.size)],
    [ctx.t('details.category'), row.category],
    [ctx.t('details.name'), row.name],
    [ctx.t('details.description'), row.description],
    [ctx.t('details.productFamily'), row.productFamily],
    [ctx.t('details.productVersion'), row.productVersion],
    [ctx.t('details.platformName'), row.platform],
    [ctx.t('details.platformVersion'), row.platformVersion],
    [ctx.t('details.releaseDate'), formatDate(row.releaseDate, ctx.locale)],
    [ctx.t('details.type'), row.type],
    [ctx.t('details.downloadId'), row.downloadId],
    [ctx.t('details.archiveIdentifier'), row.id],
  ]

  return details
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('\n          ')
}

function checksumsTable(ctx: StaticContext, row: DownloadRow) {
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
      <h2>${escapeHtml(ctx.t('actions.checksums'))}</h2>
      <table>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>`
}

function zipContentSection(ctx: StaticContext, row: DownloadRow) {
  if (row.zipContent.length === 0) {
    return ''
  }

  return `<section>
      <h2>${escapeHtml(ctx.t('actions.zipContent'))}</h2>
      <pre><code>${escapeHtml(row.zipContent.join('\n'))}</code></pre>
    </section>`
}

function detailJsonLd(ctx: StaticContext, row: StaticDownloadRow) {
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
    url: absoluteUrl(detailHref(ctx, row)) ?? detailHref(ctx, row),
  }
}

function detailPage(ctx: StaticContext, contexts: StaticContext[], row: StaticDownloadRow) {
  const title = titleForRow(row)
  const seoTitle = seoTitleForRow(row, ctx.t)
  const alternates = alternateLinks((alternateCtx) => detailHref(alternateCtx, row), contexts)

  return pageDocument({
    body: `<header>
      ${returnToCatalogueLink(ctx)}
      <h1>${escapeHtml(title)}</h1>
      ${snapshotNotice(ctx, ctx.t('static.detail.snapshotScope'))}
    </header>
    <main>
      <section>
        <h2>${escapeHtml(ctx.t('actions.details'))}</h2>
        <table>
          <tbody>
            ${detailRows(ctx, row)}
          </tbody>
        </table>
      </section>
      <section>
        <h2>${escapeHtml(ctx.t('details.downloads'))}</h2>
        <p class="actions">
          <a href="${row.httpUrl}" rel="noreferrer" target="_blank">${escapeHtml(ctx.t('static.actions.downloadHttpArchive'))}</a>
          <a href="${row.torrentUrl}" rel="noreferrer" target="_blank">${escapeHtml(ctx.t('static.actions.downloadTorrent'))}</a>
          <a href="${row.archiveUrl}" rel="noreferrer" target="_blank">${escapeHtml(ctx.t('actions.internetArchive'))}</a>
        </p>
      </section>
      ${checksumsTable(ctx, row)}
      ${zipContentSection(ctx, row)}
    </main>`,
    canonicalHref: detailHref(ctx, row),
    description: descriptionForRow(row),
    extraHead: alternates ? `\n    ${alternates}` : '',
    footer: languageFooter(ctx, contexts, (alternateCtx) => detailHref(alternateCtx, row)),
    jsonLd: detailJsonLd(ctx, row),
    locale: ctx.locale,
    title: `${seoTitle} | ${ctx.t('static.meta.titleSuffix')}`,
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

async function staticContext(locale: Locale, prefix: StaticContext['prefix']): Promise<StaticContext> {
  const instance = i18next.createInstance()

  await instance.init({
    fallbackLng: defaultLocale,
    interpolation: {
      escapeValue: false,
    },
    lng: locale,
    resources,
  })

  return {
    locale,
    prefix,
    t: instance.getFixedT(locale),
  }
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
        kind: config.kind,
        label: value,
        rows: groupRowsForValue,
        slug,
        title: config.title(value),
      }
    })
  })
}

async function writeTopicPages(ctx: StaticContext, contexts: StaticContext[], topicPages: TopicPage[]) {
  const sitemapUrls: StaticPageUrl[] = []

  for (const topic of topicPages) {
    const pageCount = Math.max(1, Math.ceil(topic.rows.length / catalogPageSize))

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const start = (pageNumber - 1) * catalogPageSize
      const href = topicHref(ctx, topic.kind, topic.slug, pageNumber)

      await writePage(href, topicPage(ctx, contexts, topic, topic.rows.slice(start, start + catalogPageSize), pageNumber, pageCount))
      sitemapUrls.push({
        changefreq: 'daily',
        priority: pageNumber === 1 ? 0.75 : 0.65,
        url: href,
      })
    }
  }

  return sitemapUrls
}

function sitemapFileName(ctx: StaticContext) {
  return `sitemap-${ctx.locale}.xml`
}

async function writeSitemapFile(filename: string, urls: StaticPageUrl[]) {
  const sitemap = new SitemapStream({ hostname: siteUrl })
  const sitemapXml = await streamToPromise(Readable.from(urls).pipe(sitemap))
  await writeFile(path.join(distDir, filename), sitemapXml)
}

async function writeSitemaps(sitemaps: LocaleSitemap[]) {
  if (!siteUrl) {
    return
  }

  const indexItems = []

  for (const sitemap of sitemaps) {
    const filename = sitemapFileName(sitemap.ctx)

    logStage(`[${sitemap.ctx.locale}] Writing ${filename} with ${sitemap.urls.length} URLs`)
    await writeSitemapFile(filename, sitemap.urls)
    indexItems.push({
      lastmod: generatedAtIso,
      url: absoluteUrl(`/${filename}`) ?? `/${filename}`,
    })
  }

  const sitemapIndex = new SitemapIndexStream()
  const sitemapIndexXml = await streamToPromise(Readable.from(indexItems).pipe(sitemapIndex))
  await writeFile(path.join(distDir, 'sitemap.xml'), sitemapIndexXml)
}

async function writeNotFoundPage(ctx: StaticContext) {
  await writeFile(
    path.join(distDir, '404.html'),
    pageDocument({
      body: `<header>
      <h1>${escapeHtml(ctx.t('static.detail.notFoundTitle'))}</h1>
      <p>${escapeHtml(ctx.t('static.detail.notFoundDescription'))}</p>
    </header>
    <main>
      ${notFoundHelp(ctx)}
    </main>`,
      canonicalHref: '/404.html',
      description: ctx.t('static.meta.notFoundDescription'),
      locale: ctx.locale,
      title: `${ctx.t('static.detail.notFoundTitle')} | ${ctx.t('static.meta.titleSuffix')}`,
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
  logStage('Checking Vite build output')
  await assertDistExists()

  logStage('Loading dump.json')
  const dump = await loadDump()
  logStage('Normalizing dump entries')
  const usedSlugs = new Map<string, number>()
  const rows = normalizeDump(dump)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .map((row) => ({
      ...row,
      staticDetailSlug: detailSlug(row, usedSlugs),
    }))
  const pageCount = Math.max(1, Math.ceil(rows.length / catalogPageSize))
  logStage(`Building topic groups for ${rows.length} rows`)
  const topicPages = buildTopicPages(rows)
  logStage('Initializing locale contexts')
  const contexts = [
    await staticContext(defaultLocale, ''),
    ...(await Promise.all(locales.filter((locale) => locale !== defaultLocale).map((locale) => staticContext(locale, locale)))),
  ]
  const topicPageCount = topicPages.reduce(
    (count, topic) => count + Math.max(1, Math.ceil(topic.rows.length / catalogPageSize)),
    0,
  )
  logStage(
    `Prepared ${rows.length} rows, ${pageCount} catalogue pages per locale, ${topicPageCount} topic pages per locale, ${contexts.length} locales`,
  )
  const sitemaps: LocaleSitemap[] = []

  for (const ctx of contexts) {
    const sitemapUrls: StaticPageUrl[] = ctx.locale === defaultLocale
      ? [{ changefreq: 'daily', priority: 1, url: '/' }]
      : []

    logStage(`[${ctx.locale}] Writing ${pageCount} catalogue pages`)
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const start = (pageNumber - 1) * catalogPageSize
      const pageRows = rows.slice(start, start + catalogPageSize)
      const href = catalogHref(ctx, pageNumber)

      await writePage(href, catalogPage(ctx, contexts, rows, pageRows, pageNumber, pageCount, topicPages))
      sitemapUrls.push({
        changefreq: 'daily',
        priority: pageNumber === 1 ? 0.9 : 0.8,
        url: href,
      })
    }
    logStage(`[${ctx.locale}] Catalogue pages complete`)

    logStage(`[${ctx.locale}] Writing topic pages`)
    const topicSitemapUrls = await writeTopicPages(ctx, contexts, topicPages)

    sitemapUrls.push(...topicSitemapUrls)
    logStage(`[${ctx.locale}] Topic pages complete: ${topicSitemapUrls.length} pages`)

    logStage(`[${ctx.locale}] Writing ${rows.length} download detail pages`)
    let detailCount = 0
    for (const row of rows) {
      const href = detailHref(ctx, row)

      await writePage(href, detailPage(ctx, contexts, row))
      detailCount += 1
      sitemapUrls.push({
        changefreq: 'weekly',
        lastmod: row.releaseDate || undefined,
        priority: 0.7,
        url: href,
      })
      if (detailCount % 500 === 0 || detailCount === rows.length) {
        logStage(`[${ctx.locale}] Detail progress: ${detailCount}/${rows.length}`)
      }
    }
    logStage(`[${ctx.locale}] Download detail pages complete`)
    sitemaps.push({ ctx, urls: sitemapUrls })
  }

  const sitemapUrlCount = sitemaps.reduce((count, sitemap) => count + sitemap.urls.length, 0)

  logStage(`Writing sitemap index with ${sitemaps.length} language sitemaps and ${sitemapUrlCount} URLs`)
  await writeSitemaps(sitemaps)
  logStage('Writing robots.txt')
  await writeRobots()
  logStage('Writing 404 page')
  await writeNotFoundPage(contexts[0])
  logStage('Injecting static catalogue links into dynamic app index')
  await injectCatalogLinkIntoAppIndex()

  logStage(
    `Generated ${pageCount * contexts.length} catalogue pages, ${topicPageCount * contexts.length} topic pages, and ${rows.length * contexts.length} download detail pages.`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
