import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
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
  labelKey: string
}> = [
  { labelKey: 'filters.allFields', searchKey: 'global' },
  { filterKey: 'category', labelKey: 'table.columns.category' },
  ...textFilterConfigs
    .filter((config) => config.key === 'description' || config.key === 'name')
    .map((config) => ({
      labelKey: config.labelKey,
      searchKey: config.key,
    })),
  { labelKey: 'table.columns.platform', searchKey: 'platform' },
  { labelKey: 'table.columns.platformVersion', searchKey: 'platformVersion' },
  { filterKey: 'productFamilies', labelKey: 'table.columns.productFamily' },
  { labelKey: 'table.columns.productVersion', searchKey: 'productVersion' },
  { labelKey: 'table.columns.releaseDate', searchKey: 'releaseDate' },
  { filterKey: 'linkType', labelKey: 'table.columns.type' },
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
  const { t } = useTranslation()
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
                field.searchKey === 'global' ? 'filter-menu__field--global' : '',
                active ? 'filter-menu__field--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={field.labelKey}
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
              <span>{t(field.labelKey)}</span>
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
