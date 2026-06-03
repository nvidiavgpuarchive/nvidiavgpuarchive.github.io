import { Columns3 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { GridColumnOption } from '../table/grid-columns'
import { Tooltip } from './tooltip'

type ColumnVisibilityMenuProps = {
  columns: GridColumnOption[]
  open: boolean
  visibleColumns: Record<string, boolean>
  onClose: () => void
  onToggle: () => void
  onVisibilityChange: (field: string, visible: boolean) => void
}

export function ColumnVisibilityMenu({
  columns,
  open,
  visibleColumns,
  onClose,
  onToggle,
  onVisibilityChange,
}: ColumnVisibilityMenuProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)

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
      <Tooltip content={t('actions.toggleColumns')}>
        {(tooltipProps) => (
          <button {...tooltipProps} className="icon-button" onClick={onToggle} type="button">
            <Columns3 aria-hidden="true" size={24} />
            <span>{t('actions.columns')}</span>
          </button>
        )}
      </Tooltip>

      {open ? (
        <div className="column-menu" role="menu">
          {columns.map((column) => (
            <label className="column-menu__option" key={column.field}>
              <input
                className="column-menu__checkbox"
                checked={visibleColumns[String(column.field)] ?? column.defaultVisible}
                onChange={(event) => onVisibilityChange(String(column.field), event.target.checked)}
                type="checkbox"
              />
              <span aria-hidden="true" className="column-menu__box" />
              <span className="column-menu__label">{column.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
