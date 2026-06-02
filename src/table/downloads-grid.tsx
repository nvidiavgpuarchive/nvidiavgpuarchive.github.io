import type { ColDef, DoesExternalFilterPass, GridReadyEvent, IsExternalFilterPresent } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import type { DownloadRow } from '../data/types'

type DownloadsGridProps = {
  columnDefs: ColDef<DownloadRow>[]
  rows: DownloadRow[]
  doesExternalFilterPass: DoesExternalFilterPass<DownloadRow>
  isExternalFilterPresent: IsExternalFilterPresent<DownloadRow>
  onGridReady: (event: GridReadyEvent<DownloadRow>) => void
}

const defaultColDef: ColDef<DownloadRow> = {
  filter: false,
  resizable: true,
  sortable: true,
  suppressHeaderMenuButton: true,
}

export function DownloadsGrid({
  columnDefs,
  doesExternalFilterPass,
  isExternalFilterPresent,
  onGridReady,
  rows,
}: DownloadsGridProps) {
  return (
    <section aria-label="Downloads table" className="downloads-grid-shell">
      <AgGridReact<DownloadRow>
        animateRows={false}
        className="ag-theme-quartz downloads-grid"
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        ensureDomOrder
        getRowId={({ data }) => data.id}
        headerHeight={38}
        doesExternalFilterPass={doesExternalFilterPass}
        isExternalFilterPresent={isExternalFilterPresent}
        localeText={{
          pageSizeSelectorLabel: 'Show',
        }}
        onGridReady={onGridReady}
        pagination
        paginationPageSize={20}
        paginationPageSizeSelector={[15, 20, 25, 50, 100]}
        rowData={rows}
        rowHeight={34}
        suppressCellFocus
        suppressDragLeaveHidesColumns
        theme="legacy"
        tooltipHideDelay={10000}
        tooltipInteraction
        tooltipShowDelay={0}
        tooltipSwitchShowDelay={0}
        tooltipTrigger="hover"
      />
    </section>
  )
}
