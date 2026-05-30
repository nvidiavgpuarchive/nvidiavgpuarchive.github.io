import { flexRender, type Row, type Table } from '@tanstack/react-table'
import { SearchX } from 'lucide-react'
import type { DownloadRow } from '../data/types'
import { Tooltip } from '../ui/tooltip'

type DownloadsTableViewportProps = {
  rows: Row<DownloadRow>[]
  table: Table<DownloadRow>
}

export function DownloadsTableViewport({
  rows,
  table,
}: DownloadsTableViewportProps) {
  return (
    <div className="table-scroll">
      <table className="downloads-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th data-column-id={header.column.id} key={header.id}>
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Tooltip content={`Sort by ${String(header.column.columnDef.header)}`}>
                      {(tooltipProps) => (
                        <button
                          {...tooltipProps}
                          className="column-sort"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          <span aria-hidden="true" className="sort-indicator">
                            {{
                              asc: '↑',
                              desc: '↓',
                            }[header.column.getIsSorted() as string] ?? '↕'}
                          </span>
                        </button>
                      )}
                    </Tooltip>
                  ) : (
                    <span className="column-label">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {rows.length > 0
            ? rows.map((row, rowIndex) => (
                <tr data-index={rowIndex} key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const tooltipContent = cell.column.id === 'actions' ? '' : String(cell.getValue() ?? '')

                    return (
                      <Tooltip content={tooltipContent} key={cell.id} placement="top-start">
                        {(tooltipProps) => (
                          <td {...tooltipProps} data-column-id={cell.column.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        )}
                      </Tooltip>
                    )
                  })}
                </tr>
              ))
            : null}
        </tbody>
      </table>

      {rows.length === 0 ? (
        <div aria-live="polite" className="table-empty-panel">
          <div className="empty-state">
            <SearchX aria-hidden="true" size={58} />
            <strong>No data available</strong>
          </div>
        </div>
      ) : null}
    </div>
  )
}
