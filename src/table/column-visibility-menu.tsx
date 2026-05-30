import { Columns3 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Table } from '@tanstack/react-table'
import type { DownloadRow } from '../data/types'
import { Tooltip } from '../ui/tooltip'

const columnLabels: Record<string, string> = {
  category: 'Category',
  name: 'Name',
  platform: 'Platform',
  platformVersion: 'Platform Version',
  productFamily: 'Product Family',
  productVersion: 'Product Version',
  releaseDate: 'Release Date',
  type: 'Type',
}

type ColumnVisibilityMenuProps = {
  onClose: () => void
  onToggle: () => void
  open: boolean
  table: Table<DownloadRow>
}

export function ColumnVisibilityMenu({ onClose, onToggle, open, table }: ColumnVisibilityMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const columns = table
    .getAllLeafColumns()
    .filter((column) => columnLabels[column.id])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current

      if (!root || root.contains(event.target as Node)) {
        return
      }

      onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onClose, open])

  return (
    <div className="column-menu-root" ref={rootRef}>
      <Tooltip content="Toggle columns">
        {(tooltipProps) => (
          <button {...tooltipProps} className="icon-button" onClick={onToggle} type="button">
            <Columns3 aria-hidden="true" size={24} />
            <span>Columns</span>
          </button>
        )}
      </Tooltip>

      {open ? (
        <div className="column-menu" role="menu">
          {columns.map((column) => (
            <label className="column-menu__option" key={column.id}>
              <input
                className="column-menu__checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
                type="checkbox"
              />
              <span>{columnLabels[column.id]}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
