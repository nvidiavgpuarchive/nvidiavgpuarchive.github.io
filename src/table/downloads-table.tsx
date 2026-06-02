import type { DoesExternalFilterPass, GridApi, GridReadyEvent, IsExternalFilterPresent } from 'ag-grid-community'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DownloadRow } from '../data/types'
import { ChecksumsDialog } from '../ui/checksums-dialog'
import { DetailsDialog } from '../ui/details-dialog'
import type { DownloadActionPanel } from '../ui/download-actions'
import { ZipContentDialog } from '../ui/zip-content-dialog'
import { DownloadsGrid } from './downloads-grid'
import { DownloadsToolbar } from './downloads-toolbar'
import {
  appendTextFilter,
  appendSearchTerm,
  buildFilterChips,
  buildFilterOptions,
  emptyFilters,
  rowMatchesTableFilterModel,
  tableFilterModelHasFilters,
  textFilterConfigs,
  type FilterKey,
  type MultiFiltersState,
  type SearchScopeKey,
  type TableFilterModel,
  type TextFilter,
} from './filters'
import { createGridColumns, gridColumnOptions } from './grid-columns'

type DownloadsTableProps = {
  rows: DownloadRow[]
  loading: boolean
  onReload: () => void
}

type ActiveDialog = {
  panel: DownloadActionPanel
  row: DownloadRow
}

const defaultVisibleColumns = Object.fromEntries(
  gridColumnOptions.map((column) => [String(column.field), column.defaultVisible]),
) as Record<string, boolean>

const csvColumnKeys = [
  'type',
  'name',
  'description',
  'category',
  'productFamily',
  'productVersion',
  'platform',
  'platformVersion',
  'releaseDate',
]

const csvHeaders: Record<string, string> = {
  category: 'category',
  description: 'description',
  name: 'name',
  platform: 'platformName',
  platformVersion: 'platformVersion',
  productFamily: 'productFamilies',
  productVersion: 'version',
  releaseDate: 'releaseDate',
  type: 'linkType',
}

const formatCsvReleaseDate = (date: string) => {
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

export function DownloadsTable({ rows, loading, onReload }: DownloadsTableProps) {
  const gridApiRef = useRef<GridApi<DownloadRow> | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScopeKey>('global')
  const [textFilters, setTextFilters] = useState<TextFilter[]>([])
  const [filters, setFilters] = useState<MultiFiltersState>(emptyFilters)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [activeFilterKey, setActiveFilterKey] = useState<FilterKey | null>(null)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVisibleColumns)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null)
  const searchControlRef = useRef<HTMLFormElement>(null)

  const openActionPanel = useCallback((row: DownloadRow, panel: DownloadActionPanel) => {
    setActiveDialog({ panel, row })
  }, [])
  const columnDefs = useMemo(() => createGridColumns(openActionPanel), [openActionPanel])
  const filterOptions = useMemo(() => buildFilterOptions(rows), [rows])
  const tableFilterModel = useMemo<TableFilterModel>(
    () => ({
      filters,
      globalSearch,
      liveSearch: searchInput.trim(),
      searchScope,
      textFilters,
    }),
    [filters, globalSearch, searchInput, searchScope, textFilters],
  )
  const filterModelRef = useRef(tableFilterModel)

  const activeFilterChips = useMemo(() => buildFilterChips(filters), [filters])
  const hasActiveFilters = activeFilterChips.length > 0 || globalSearch !== '' || textFilters.length > 0
  const hasClearableSearch = hasActiveFilters || searchInput !== ''
  const searchScopeLabel =
    searchScope === 'global'
      ? 'Global'
      : textFilterConfigs.find((config) => config.key === searchScope)?.label ?? 'Global'

  const clearFilters = () => {
    setSearchInput('')
    setGlobalSearch('')
    setSearchScope('global')
    setActiveFilterKey(null)
    setTextFilters([])
    setFilters(emptyFilters)
  }

  const clearFilterKey = (key: FilterKey) => {
    setFilters((current) => ({
      ...current,
      [key]: [],
    }))
  }

  const clearTextFilter = (key: TextFilter['key']) => {
    setTextFilters((current) => current.filter((filter) => filter.key !== key))
  }

  const commitSearch = () => {
    const value = searchInput.trim()

    if (!value) {
      return
    }

    if (searchScope === 'global') {
      setGlobalSearch((current) => appendSearchTerm(current, value))
      setSearchInput('')
      setActiveFilterKey(null)
      return
    }

    const config = textFilterConfigs.find((item) => item.key === searchScope)

    if (!config) {
      return
    }

    setTextFilters((current) => appendTextFilter(current, config, value))
    setSearchInput('')
    setSearchScope('global')
    setActiveFilterKey(null)
  }

  const changeFilters = (nextFilters: MultiFiltersState) => {
    setFilters(nextFilters)
    setSearchScope('global')
  }

  const selectSearchScope = (key: SearchScopeKey) => {
    setSearchScope(key)
    setActiveFilterKey(null)
    setFilterMenuOpen(false)
  }

  const handleGridReady = (event: GridReadyEvent<DownloadRow>) => {
    gridApiRef.current = event.api

    for (const column of gridColumnOptions) {
      event.api.setColumnsVisible([String(column.field)], visibleColumns[String(column.field)] ?? column.defaultVisible)
    }

    event.api.onFilterChanged()
  }

  const isExternalFilterPresent = useCallback<IsExternalFilterPresent<DownloadRow>>(
    () => tableFilterModelHasFilters(filterModelRef.current),
    [],
  )

  const doesExternalFilterPass = useCallback<DoesExternalFilterPass<DownloadRow>>((node) => {
    if (!node.data) {
      return false
    }

    return rowMatchesTableFilterModel(node.data, filterModelRef.current)
  }, [])

  const handleColumnVisibilityChange = (field: string, visible: boolean) => {
    setVisibleColumns((current) => ({
      ...current,
      [field]: visible,
    }))
    gridApiRef.current?.setColumnsVisible([field], visible)
  }

  const exportCsv = () => {
    gridApiRef.current?.exportDataAsCsv({
      columnKeys: csvColumnKeys,
      fileName: 'downloads.csv',
      processCellCallback: ({ column, node, value }) => {
        const row = node?.data
        const columnId = column.getColId()

        if (!row) {
          return String(value ?? '')
        }

        if (columnId === 'type') {
          return row.linkType
        }

        if (columnId === 'name') {
          return typeof row.meta.name === 'string' ? row.meta.name : ''
        }

        if (columnId === 'releaseDate') {
          return formatCsvReleaseDate(row.releaseDate)
        }

        return String(value ?? '')
      },
      processHeaderCallback: ({ column }) => csvHeaders[column.getColId()] ?? column.getColDef().headerName ?? '',
      skipColumnHeaders: false,
    })
  }

  useEffect(() => {
    filterModelRef.current = tableFilterModel
    gridApiRef.current?.onFilterChanged()
    gridApiRef.current?.paginationGoToFirstPage()
  }, [tableFilterModel])

  useEffect(() => {
    if (!filterMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const searchControl = searchControlRef.current

      if (!searchControl || searchControl.contains(event.target as Node)) {
        return
      }

      setFilterMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [filterMenuOpen])

  return (
    <main className="downloads-page">
      <DownloadsToolbar
        activeFilterChips={activeFilterChips}
        activeFilterKey={activeFilterKey}
        columnMenuOpen={columnMenuOpen}
        columnOptions={gridColumnOptions}
        filterMenuOpen={filterMenuOpen}
        filterOptions={filterOptions}
        filters={filters}
        globalSearch={globalSearch}
        hasClearableSearch={hasClearableSearch}
        loading={loading}
        onClearAll={clearFilters}
        onClearFilterKey={clearFilterKey}
        onClearGlobalSearch={() => setGlobalSearch('')}
        onClearTextFilter={clearTextFilter}
        onColumnMenuClose={() => setColumnMenuOpen(false)}
        onColumnMenuToggle={() => setColumnMenuOpen((open) => !open)}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        onCommitSearch={commitSearch}
        onExport={exportCsv}
        onFilterChange={changeFilters}
        onFilterMenuToggle={() => setFilterMenuOpen((open) => !open)}
        onReload={onReload}
        onSearchInputChange={setSearchInput}
        onSearchScopeSelect={selectSearchScope}
        onSetActiveFilterKey={setActiveFilterKey}
        searchControlRef={searchControlRef}
        searchInput={searchInput}
        searchScope={searchScope}
        searchScopeLabel={searchScopeLabel}
        textFilters={textFilters}
        visibleColumns={visibleColumns}
      />

      <DownloadsGrid
        columnDefs={columnDefs}
        doesExternalFilterPass={doesExternalFilterPass}
        isExternalFilterPresent={isExternalFilterPresent}
        onGridReady={handleGridReady}
        rows={rows}
      />

      {activeDialog?.panel === 'details' ? (
        <DetailsDialog onClose={() => setActiveDialog(null)} row={activeDialog.row} />
      ) : null}
      {activeDialog?.panel === 'checksums' ? (
        <ChecksumsDialog onClose={() => setActiveDialog(null)} row={activeDialog.row} />
      ) : null}
      {activeDialog?.panel === 'zipContent' ? (
        <ZipContentDialog onClose={() => setActiveDialog(null)} row={activeDialog.row} />
      ) : null}
    </main>
  )
}
