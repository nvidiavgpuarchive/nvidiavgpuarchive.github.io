import type { CSSProperties } from 'react'
import {
  filterConfigs,
  textFilterConfigs,
  toggleFilterValue,
  type FilterKey,
  type MultiFiltersState,
  type SearchScopeKey,
} from '../table/filters'

const menuFields: Array<{
  filterKey?: FilterKey
  searchKey?: SearchScopeKey
  label: string
}> = [
  { label: 'All fields', searchKey: 'global' },
  { filterKey: 'category', label: 'Category' },
  ...textFilterConfigs
    .filter((config) => config.key === 'description' || config.key === 'name')
    .map((config) => ({
      label: config.label,
      searchKey: config.key,
    })),
  { label: 'Platform', searchKey: 'platform' },
  { label: 'Platform Version', searchKey: 'platformVersion' },
  { filterKey: 'productFamilies', label: 'Product Family' },
  { label: 'Product Version', searchKey: 'productVersion' },
  { label: 'Release Date', searchKey: 'releaseDate' },
  { filterKey: 'linkType', label: 'Type' },
]

type FiltersPanelProps = {
  activeFilterKey: FilterKey | null
  activeSearchScope: SearchScopeKey
  filters: MultiFiltersState
  open: boolean
  options: Record<FilterKey, string[]>
  onChange: (filters: MultiFiltersState) => void
  onHoverField: (key: FilterKey | null) => void
  onSelectSearchScope: (key: SearchScopeKey) => void
}

export function FiltersPanel({
  activeFilterKey,
  activeSearchScope,
  filters,
  open,
  options,
  onChange,
  onHoverField,
  onSelectSearchScope,
}: FiltersPanelProps) {
  const activeConfig = filterConfigs.find((config) => config.key === activeFilterKey)
  const activeFieldIndex = activeConfig
    ? Math.max(0, menuFields.findIndex((field) => field.filterKey === activeConfig.key))
    : 0

  return (
    <section aria-label="Filters" className="filter-menu" hidden={!open}>
      <div className="filter-menu__fields" role="menu">
        {menuFields.map((field) => {
          const active =
            field.filterKey !== undefined
              ? field.filterKey === activeFilterKey
              : activeFilterKey === null && field.searchKey === activeSearchScope

          return (
            <button
              className={[
                'filter-menu__field',
                field.label === 'All fields' ? 'filter-menu__field--global' : '',
                active ? 'filter-menu__field--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={field.label}
              onClick={() => {
                if (field.searchKey) {
                  onSelectSearchScope(field.searchKey)
                } else {
                  onHoverField(field.filterKey ?? null)
                }
              }}
              onMouseEnter={() => onHoverField(field.filterKey ?? null)}
              type="button"
            >
              <span>{field.label}</span>
              {field.filterKey ? <span aria-hidden="true">›</span> : null}
            </button>
          )
        })}
      </div>

      {activeConfig ? (
        <div
          className="filter-menu__values"
          role="menu"
          style={{ '--filter-menu-active-index': activeFieldIndex } as CSSProperties}
        >
          {options[activeConfig.key].map((value) => (
            <label className="filter-option" key={value}>
              <input
                className="filter-option__input"
                checked={filters[activeConfig.key].includes(value)}
                onChange={() => onChange(toggleFilterValue(filters, activeConfig.key, value))}
                type="checkbox"
              />
              <span aria-hidden="true" className="filter-option__box" />
              <span className="filter-option__label">{value}</span>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  )
}
