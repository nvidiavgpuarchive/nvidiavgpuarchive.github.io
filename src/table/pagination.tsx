import type { Table } from "@tanstack/react-table";
import type { DownloadRow } from "../data/types";

type PaginationProps = {
  table: Table<DownloadRow>;
};

export function Pagination({ table }: PaginationProps) {
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const currentPage = pageIndex + 1;
  const rowCount = table.getPrePaginationRowModel().rows.length;
  const visiblePages = Array.from(
    { length: Math.min(5, pageCount || 1) },
    (_, index) => {
      const maxStart = Math.max(1, (pageCount || 1) - 4);
      const start = Math.min(Math.max(1, currentPage - 2), maxStart);

      return start + index;
    },
  );

  return (
    <nav aria-label="Pagination" className="pagination-bar">
      <div className="pagination-left">
        <label className="page-size-control">
          Show{" "}
          <select
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            value={pageSize}
          >
            {[15, 20, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>{" "}
          Items
        </label>

        <span className="item-count">{rowCount} item(s)</span>
      </div>

      <div className="page-controls">
        <button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.firstPage()}
          type="button"
        >
          « First
        </button>
        <button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          type="button"
        >
          ‹
        </button>
        {visiblePages.map((page) => (
          <button
            aria-current={page === currentPage ? "page" : undefined}
            className={page === currentPage ? "current-page" : undefined}
            key={page}
            onClick={() => table.setPageIndex(page - 1)}
            type="button"
          >
            {page}
          </button>
        ))}
        <button
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          type="button"
        >
          ›
        </button>
        <button
          disabled={!table.getCanNextPage()}
          onClick={() => table.lastPage()}
          type="button"
        >
          Last »
        </button>
      </div>

      <label className="go-to-control">
        Go to{" "}
        <input
          min={1}
          max={pageCount || 1}
          onChange={(event) => {
            const value = Number(event.target.value);
            table.setPageIndex(
              Number.isFinite(value) && value > 0 ? value - 1 : 0,
            );
          }}
          type="number"
          value={pageIndex + 1}
        />
        <span>of {pageCount || 1}</span>
      </label>
    </nav>
  );
}
