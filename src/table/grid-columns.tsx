import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import type { DownloadRow } from '../data/types'
import { DownloadActions, type DownloadActionPanel } from '../ui/download-actions'

export type GridColumnOption = {
  field: keyof DownloadRow
  label: string
  labelKey: string
  defaultVisible: boolean
}

export const gridColumnOptions: GridColumnOption[] = [
  {
    defaultVisible: true,
    field: 'category',
    label: 'Category',
    labelKey: 'table.columns.category',
  },
  {
    defaultVisible: false,
    field: 'name',
    label: 'Name',
    labelKey: 'table.columns.name',
  },
  {
    defaultVisible: true,
    field: 'description',
    label: 'Description',
    labelKey: 'table.columns.description',
  },
  {
    defaultVisible: true,
    field: 'productFamily',
    label: 'Product Family',
    labelKey: 'table.columns.productFamily',
  },
  {
    defaultVisible: true,
    field: 'productVersion',
    label: 'Product Version',
    labelKey: 'table.columns.productVersion',
  },
  {
    defaultVisible: true,
    field: 'platform',
    label: 'Platform',
    labelKey: 'table.columns.platform',
  },
  {
    defaultVisible: true,
    field: 'platformVersion',
    label: 'Platform Version',
    labelKey: 'table.columns.platformVersion',
  },
  {
    defaultVisible: true,
    field: 'releaseDate',
    label: 'Release Date',
    labelKey: 'table.columns.releaseDate',
  },
  {
    defaultVisible: false,
    field: 'type',
    label: 'Type',
    labelKey: 'table.columns.type',
  },
]

const formatReleaseDate = (date: string, locale: string) => {
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

const actionsRenderer = (
  params: ICellRendererParams<DownloadRow>,
  onOpenPanel: (row: DownloadRow, panel: DownloadActionPanel) => void,
) => {
  if (!params.data) {
    return null
  }

  return <DownloadActions onOpenPanel={onOpenPanel} row={params.data} />
}

export const createGridColumns = (
  onOpenPanel: (row: DownloadRow, panel: DownloadActionPanel) => void,
  t: TFunction,
  locale: string,
): ColDef<DownloadRow>[] => [
  {
    field: 'category',
    flex: 2,
    headerName: t('table.columns.category'),
    hide: true,
    minWidth: 96,
    tooltipField: 'category',
  },
  {
    field: 'name',
    flex: 3,
    headerName: t('table.columns.name'),
    hide: true,
    minWidth: 220,
    tooltipField: 'name',
  },
  {
    field: 'description',
    flex: 5,
    headerName: t('table.columns.description'),
    minWidth: 360,
    tooltipField: 'description',
  },
  {
    field: 'productFamily',
    flex: 2,
    headerName: t('table.columns.productFamily'),
    minWidth: 120,
    tooltipField: 'productFamily',
  },
  {
    field: 'productVersion',
    flex: 2,
    headerName: t('table.columns.productVersion'),
    minWidth: 120,
    tooltipField: 'productVersion',
  },
  {
    field: 'platform',
    flex: 3,
    headerName: t('table.columns.platform'),
    minWidth: 180,
    tooltipField: 'platform',
  },
  {
    field: 'platformVersion',
    flex: 2,
    headerName: t('table.columns.platformVersion'),
    minWidth: 150,
    tooltipField: 'platformVersion',
  },
  {
    field: 'releaseDate',
    flex: 2,
    headerName: t('table.columns.releaseDate'),
    minWidth: 132,
    sort: 'desc',
    tooltipField: 'releaseDate',
    valueFormatter: ({ value }) => formatReleaseDate(String(value ?? ''), locale),
  },
  {
    field: 'type',
    flex: 2,
    headerName: t('table.columns.type'),
    hide: true,
    minWidth: 120,
    tooltipField: 'type',
  },
  {
    cellRenderer: (params: ICellRendererParams<DownloadRow>) =>
      actionsRenderer(params, onOpenPanel),
    colId: 'actions',
    flex: 2,
    filter: false,
    headerName: t('table.columns.actions'),
    minWidth: 150,
    sortable: false,
  },
]
