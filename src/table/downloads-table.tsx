import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DownloadRow } from '../data/types'
import { exportRowsToCsv } from '../export/csv'
import { createColumns } from './columns'
import { DetailsDialog } from './details-dialog'
import { DownloadsTableViewport } from './downloads-table-viewport'
import { DownloadsToolbar } from './downloads-toolbar'
import {
  appendTextFilter,
  buildFilterChips,
  buildFilterOptions,
  emptyFilters,
  rowMatchesTableFilters,
  textFilterConfigs,
  type FilterKey,
  type MultiFiltersState,
  type SearchScopeKey,
  type TextFilter,
} from './filters'
import { Pagination } from './pagination'

type DownloadsTableProps = {
  rows: DownloadRow[]
  loading: boolean
  onReload: () => void
}

const defaultColumnVisibility: VisibilityState = {
  category: false,
  name: false,
  type: false,
}
const defaultSorting: SortingState = [
  {
    desc: true,
    id: 'releaseDate',
  },
]

const appendAndTerm = (current: string, next: string) => (current ? `${current},${next}` : next)

export function DownloadsTable({ rows, loading, onReload }: DownloadsTableProps) {
  const [searchInput, setSearchInput] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScopeKey>('global')
  const [textFilters, setTextFilters] = useState<TextFilter[]>([])
  const [filters, setFilters] = useState<MultiFiltersState>(emptyFilters)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [activeFilterKey, setActiveFilterKey] = useState<FilterKey | null>(null)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility)
  const [sorting, setSorting] = useState<SortingState>(defaultSorting)
  const [detailsRow, setDetailsRow] = useState<DownloadRow | null>(null)
  const searchControlRef = useRef<HTMLFormElement>(null)

  const columns = useMemo(() => createColumns(setDetailsRow), [])
  const filterOptions = useMemo(() => buildFilterOptions(rows), [rows])
  const filteredRows = useMemo(() => {
    const liveSearch = searchInput.trim()

    return rows.filter((row) =>
      rowMatchesTableFilters(row, {
        filters,
        globalSearch,
        liveSearch,
        searchScope,
        textFilters,
      }),
    )
  }, [filters, globalSearch, rows, searchInput, searchScope, textFilters])

  const activeFilterChips = useMemo(() => buildFilterChips(filters), [filters])
  const hasActiveFilters = activeFilterChips.length > 0 || globalSearch !== '' || textFilters.length > 0
  const hasClearableSearch = hasActiveFilters || searchInput !== ''
  const searchScopeLabel =
    searchScope === 'global'
      ? 'Global'
      : textFilterConfigs.find((config) => config.key === searchScope)?.label ?? 'Global'

  // TanStack Table intentionally returns table helpers that React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: filteredRows,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: {
      columnVisibility,
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  })
  const tableRows = table.getRowModel().rows
  const exportRows = table.getPrePaginationRowModel().rows

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
      setGlobalSearch((current) => appendAndTerm(current, value))
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

  useEffect(() => {
    table.setPageIndex(0)
  }, [filters, globalSearch, searchInput, searchScope, sorting, table, textFilters])

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
        onCommitSearch={commitSearch}
        onExport={() => exportRowsToCsv(exportRows.map((row) => row.original), 'downloads.csv')}
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
        table={table}
        textFilters={textFilters}
      />

      <DownloadsTableViewport rows={tableRows} table={table} />

      <Pagination table={table} />

      {detailsRow ? <DetailsDialog onClose={() => setDetailsRow(null)} row={detailsRow} /> : null}
    </main>
  )
}
