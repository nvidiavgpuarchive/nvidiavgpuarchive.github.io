import type { DownloadRow } from '../data/types'

export type FilterKey = 'category' | 'productFamilies' | 'linkType'
export type TextFilterKey =
  | 'description'
  | 'name'
  | 'platform'
  | 'platformVersion'
  | 'productVersion'
  | 'releaseDate'
export type SearchScopeKey = 'global' | TextFilterKey
export type TextFilter = {
  key: TextFilterKey
  value: string
}
export type FilterChip = {
  key: FilterKey
  selectedCount: number
  selectedValue: string
}

export type MultiFiltersState = Record<FilterKey, string[]>
export type TableFilterModel = {
  filters: MultiFiltersState
  globalSearch: string
  liveSearch: string
  searchScope: SearchScopeKey
  textFilters: TextFilter[]
}

type FilterConfig = {
  key: FilterKey
  label: string
  labelKey: string
  getValues: (row: DownloadRow) => string[]
}

export const filterConfigs: FilterConfig[] = [
  {
    key: 'category',
    label: 'Category',
    labelKey: 'table.columns.category',
    getValues: (row) => [row.category],
  },
  {
    key: 'productFamilies',
    label: 'Product Family',
    labelKey: 'table.columns.productFamily',
    getValues: (row) => row.productFamilies,
  },
  {
    key: 'linkType',
    label: 'Type',
    labelKey: 'table.columns.type',
    getValues: (row) => [row.linkType],
  },
]

export const textFilterConfigs: Array<{
  key: TextFilterKey
  label: string
  labelKey: string
  getValue: (row: DownloadRow) => string
}> = [
  {
    key: 'description',
    label: 'Description',
    labelKey: 'table.columns.description',
    getValue: (row) => row.description,
  },
  {
    key: 'name',
    label: 'Name',
    labelKey: 'table.columns.name',
    getValue: (row) => row.name,
  },
  {
    key: 'platform',
    label: 'Platform',
    labelKey: 'table.columns.platform',
    getValue: (row) => row.platform,
  },
  {
    key: 'platformVersion',
    label: 'Platform Version',
    labelKey: 'table.columns.platformVersion',
    getValue: (row) => row.platformVersion,
  },
  {
    key: 'productVersion',
    label: 'Product Version',
    labelKey: 'table.columns.productVersion',
    getValue: (row) => row.productVersion,
  },
  {
    key: 'releaseDate',
    label: 'Release Date',
    labelKey: 'table.columns.releaseDate',
    getValue: (row) => row.releaseDate,
  },
]

export const emptyFilters: MultiFiltersState = {
  category: [],
  productFamilies: [],
  linkType: [],
}

export const buildFilterOptions = (rows: DownloadRow[]) => {
  return Object.fromEntries(
    filterConfigs.map((config) => {
      const values = new Set<string>()

      for (const row of rows) {
        for (const value of config.getValues(row)) {
          if (value) {
            values.add(value)
          }
        }
      }

      return [config.key, [...values].sort((a, b) => a.localeCompare(b))]
    }),
  ) as Record<FilterKey, string[]>
}

export const buildFilterChips = (filters: MultiFiltersState): FilterChip[] => {
  return filterConfigs.flatMap((config) => {
    const selected = filters[config.key]

    if (selected.length === 0) {
      return []
    }

    return [
      {
        key: config.key,
        selectedCount: selected.length,
        selectedValue: selected.length === 1 ? selected[0] : '',
      },
    ]
  })
}

export const appendSearchTerm = (current: string, next: string) => (current ? `${current},${next}` : next)

const searchTerms = (search: string) => {
  const value = search.trim().toLowerCase()

  if (!value) {
    return []
  }

  if (!value.includes(',')) {
    return [value]
  }

  return value
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean)
}

export const valueMatchesSearch = (value: string, search: string) => {
  const terms = searchTerms(search)

  if (terms.length === 0) {
    return true
  }

  const normalizedValue = value.toLowerCase()

  return terms.every((term) => normalizedValue.includes(term))
}

export const rowMatchesSearch = (row: DownloadRow, search: string) => {
  return valueMatchesSearch(
    [
      row.description,
      row.name,
      row.productFamily,
      row.productVersion,
      row.platform,
      row.platformVersion,
      row.releaseDate,
      row.category,
      row.type,
      row.linkType,
      row.filename,
      row.downloadId,
    ].join(' '),
    search,
  )
}

export const rowMatchesFilters = (row: DownloadRow, filters: MultiFiltersState) => {
  return filterConfigs.every((config) => {
    const selected = filters[config.key]

    if (selected.length === 0) {
      return true
    }

    const rowValues = config.getValues(row)
    return selected.some((value) => rowValues.includes(value))
  })
}

export const rowMatchesTextFilters = (row: DownloadRow, filters: TextFilter[]) => {
  return filters.every((filter) => {
    const config = textFilterConfigs.find((item) => item.key === filter.key)

    if (!config) {
      return true
    }

    return valueMatchesSearch(config.getValue(row), filter.value)
  })
}

export const tableFilterModelHasFilters = ({
  filters,
  globalSearch,
  liveSearch,
  textFilters,
}: TableFilterModel) => {
  return (
    globalSearch.trim() !== '' ||
    liveSearch.trim() !== '' ||
    textFilters.length > 0 ||
    Object.values(filters).some((values) => values.length > 0)
  )
}

export const rowMatchesTableFilterModel = (
  row: DownloadRow,
  {
    filters,
    globalSearch,
    liveSearch,
    searchScope,
    textFilters,
  }: TableFilterModel,
) => {
  if (!rowMatchesSearch(row, globalSearch)) {
    return false
  }

  if (!rowMatchesFilters(row, filters)) {
    return false
  }

  if (!rowMatchesTextFilters(row, textFilters)) {
    return false
  }

  if (!liveSearch) {
    return true
  }

  if (searchScope === 'global') {
    return rowMatchesSearch(row, liveSearch)
  }

  const config = textFilterConfigs.find((item) => item.key === searchScope)

  return valueMatchesSearch(config?.getValue(row) ?? '', liveSearch)
}

export const appendTextFilter = (
  filters: TextFilter[],
  config: {
    key: TextFilterKey
  },
  value: string,
) => {
  const existing = filters.find((filter) => filter.key === config.key)

  if (!existing) {
    return [
      ...filters,
      {
        key: config.key,
        value,
      },
    ]
  }

  return filters.map((filter) =>
    filter.key === config.key
      ? {
          ...filter,
          value: `${filter.value},${value}`,
        }
      : filter,
  )
}

export const toggleFilterValue = (
  filters: MultiFiltersState,
  key: FilterKey,
  value: string,
): MultiFiltersState => {
  const selected = filters[key]

  return {
    ...filters,
    [key]: selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value],
  }
}
