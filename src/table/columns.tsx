import type { ColumnDef } from '@tanstack/react-table'
import type { DownloadRow } from '../data/types'
import { Tooltip } from '../ui/tooltip'

const formatReleaseDate = (date: string) => {
  if (!date) {
    return ''
  }

  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const createColumns = (onDetails: (row: DownloadRow) => void): ColumnDef<DownloadRow>[] => [
  {
    accessorKey: 'category',
    header: 'Category',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'productFamily',
    header: 'Product Family',
  },
  {
    accessorKey: 'productVersion',
    header: 'Product Version',
  },
  {
    accessorKey: 'platform',
    header: 'Platform',
  },
  {
    accessorKey: 'platformVersion',
    header: 'Platform Version',
  },
  {
    accessorKey: 'releaseDate',
    cell: ({ row }) => formatReleaseDate(row.original.releaseDate),
    header: 'Release Date',
  },
  {
    accessorKey: 'type',
    header: 'Type',
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <Tooltip content="View download details">
        {(tooltipProps) => (
          <button {...tooltipProps} onClick={() => onDetails(row.original)} type="button">
            Details
          </button>
        )}
      </Tooltip>
    ),
    enableSorting: false,
    header: 'Actions',
  },
]
