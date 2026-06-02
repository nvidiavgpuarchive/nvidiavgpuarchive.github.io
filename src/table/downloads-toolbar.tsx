import type { RefObject } from 'react'
import { Download, RefreshCw, SlidersHorizontal, X } from 'lucide-react'
import { Tooltip } from '../ui/tooltip'
import { ColumnVisibilityMenu } from './column-visibility-menu'
import {
  type FilterChip,
  type FilterKey,
  type MultiFiltersState,
  type SearchScopeKey,
  type TextFilter,
} from './filters'
import { FiltersPanel } from './filters-panel'
import type { GridColumnOption } from './grid-columns'

type DownloadsToolbarProps = {
  activeFilterChips: FilterChip[]
  activeFilterKey: FilterKey | null
  columnMenuOpen: boolean
  columnOptions: GridColumnOption[]
  filterMenuOpen: boolean
  filters: MultiFiltersState
  filterOptions: Record<FilterKey, string[]>
  globalSearch: string
  hasClearableSearch: boolean
  loading: boolean
  searchControlRef: RefObject<HTMLFormElement | null>
  searchInput: string
  searchScope: SearchScopeKey
  searchScopeLabel: string
  textFilters: TextFilter[]
  visibleColumns: Record<string, boolean>
  onClearAll: () => void
  onClearFilterKey: (key: FilterKey) => void
  onClearGlobalSearch: () => void
  onClearTextFilter: (key: TextFilter['key']) => void
  onColumnMenuClose: () => void
  onColumnMenuToggle: () => void
  onColumnVisibilityChange: (field: string, visible: boolean) => void
  onCommitSearch: () => void
  onExport: () => void
  onFilterChange: (filters: MultiFiltersState) => void
  onFilterMenuToggle: () => void
  onReload: () => void
  onSearchInputChange: (value: string) => void
  onSearchScopeSelect: (key: SearchScopeKey) => void
  onSetActiveFilterKey: (key: FilterKey | null) => void
}

export function DownloadsToolbar({
  activeFilterChips,
  activeFilterKey,
  columnMenuOpen,
  columnOptions,
  filterMenuOpen,
  filters,
  filterOptions,
  globalSearch,
  hasClearableSearch,
  loading,
  searchControlRef,
  searchInput,
  searchScope,
  searchScopeLabel,
  textFilters,
  visibleColumns,
  onClearAll,
  onClearFilterKey,
  onClearGlobalSearch,
  onClearTextFilter,
  onColumnMenuClose,
  onColumnMenuToggle,
  onColumnVisibilityChange,
  onCommitSearch,
  onExport,
  onFilterChange,
  onFilterMenuToggle,
  onReload,
  onSearchInputChange,
  onSearchScopeSelect,
  onSetActiveFilterKey,
}: DownloadsToolbarProps) {
  return (
    <section aria-label="Toolbar" className="table-toolbar">
      <form
        className={[
          'search-control',
          filterMenuOpen || hasClearableSearch || searchScope !== 'global' ? 'search-control--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        ref={searchControlRef}
        onSubmit={(event) => {
          event.preventDefault()
          onCommitSearch()
        }}
      >
        <Tooltip content="Open filters">
          {(tooltipProps) => (
            <button
              {...tooltipProps}
              className="search-control__filter-trigger"
              onClick={onFilterMenuToggle}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" className="search-control__filter-icon" size={26} />
            </button>
          )}
        </Tooltip>

        <FiltersPanel
          activeFilterKey={activeFilterKey}
          activeSearchScope={searchScope}
          filters={filters}
          onChange={onFilterChange}
          onHoverField={onSetActiveFilterKey}
          onSelectSearchScope={onSearchScopeSelect}
          open={filterMenuOpen}
          options={filterOptions}
        />

        {activeFilterChips.map((chip) => (
          <button className="search-chip" key={chip.key} onClick={() => onClearFilterKey(chip.key)} type="button">
            <span>{chip.label}</span>
            <X aria-hidden="true" size={16} />
          </button>
        ))}

        {globalSearch ? (
          <button className="search-chip search-chip--global" onClick={onClearGlobalSearch} type="button">
            <span>Global: {globalSearch}</span>
            <X aria-hidden="true" size={16} />
          </button>
        ) : null}

        {textFilters.map((filter) => (
          <button
            className="search-chip"
            key={filter.key}
            onClick={() => onClearTextFilter(filter.key)}
            type="button"
          >
            <span>
              {filter.label}: {filter.value}
            </span>
            <X aria-hidden="true" size={16} />
          </button>
        ))}

        <input
          className="search-control__input"
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder={searchScope === 'global' ? 'Search' : `Filter by ${searchScopeLabel}`}
          type="search"
          value={searchInput}
        />

        {hasClearableSearch ? (
          <Tooltip content="Clear filters">
            {(tooltipProps) => (
              <button {...tooltipProps} className="search-control__clear" onClick={onClearAll} type="button">
                <X aria-hidden="true" size={32} />
              </button>
            )}
          </Tooltip>
        ) : null}
      </form>

      <div className="toolbar-actions">
        <Tooltip content="Refresh data">
          {(tooltipProps) => (
            <button {...tooltipProps} className="icon-button" disabled={loading} onClick={onReload} type="button">
              <RefreshCw aria-hidden="true" size={16} />
              <span>Reload</span>
            </button>
          )}
        </Tooltip>

        <Tooltip content="Export CSV">
          {(tooltipProps) => (
            <button {...tooltipProps} className="icon-button" onClick={onExport} type="button">
              <Download aria-hidden="true" size={16} />
              <span>Export CSV</span>
            </button>
          )}
        </Tooltip>

        <ColumnVisibilityMenu
          columns={columnOptions}
          onClose={onColumnMenuClose}
          onToggle={onColumnMenuToggle}
          onVisibilityChange={onColumnVisibilityChange}
          open={columnMenuOpen}
          visibleColumns={visibleColumns}
        />
      </div>
    </section>
  )
}
