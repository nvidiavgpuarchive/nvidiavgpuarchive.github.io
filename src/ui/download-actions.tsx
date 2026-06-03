import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { EllipsisVertical } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DownloadRow } from '../data/types'
import { Tooltip } from './tooltip'

export type DownloadActionPanel = 'checksums' | 'details' | 'zipContent'

type DownloadActionsProps = {
  row: DownloadRow
  onOpenPanel: (row: DownloadRow, panel: DownloadActionPanel) => void
}

export function DownloadActions({ row, onOpenPanel }: DownloadActionsProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { context, floatingStyles, refs } = useFloating({
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    onOpenChange: setOpen,
    open,
    placement: 'bottom-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  })
  const click = useClick(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, {
    role: 'menu',
  })
  const { getFloatingProps, getReferenceProps } = useInteractions([click, dismiss, role])

  return (
    <div className="grid-actions">
      <Tooltip content={t('actions.moreActions')}>
        {(tooltipProps) => (
          <button
            {...tooltipProps}
            {...getReferenceProps({
              onPointerDown: (event) => {
                event.stopPropagation()
              },
              ref: (node: HTMLElement | null) => {
                refs.setReference(node)
                tooltipProps.ref(node)
              },
            })}
            aria-expanded={open}
            className="grid-action-menu-button"
            type="button"
          >
            <EllipsisVertical aria-hidden="true" size={18} />
          </button>
        )}
      </Tooltip>

      <Tooltip content={t('actions.downloadHttpArchive')}>
        {(tooltipProps) => (
          <a
            {...tooltipProps}
            className="grid-download-button"
            href={row.httpUrl}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            {t('actions.download')}
          </a>
        )}
      </Tooltip>

      {open ? (
        <FloatingPortal>
          <div
            className="grid-action-menu"
            {...getFloatingProps({
              ref: refs.setFloating,
              style: floatingStyles,
            })}
          >
            <button
              className="grid-action-menu__item"
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                onOpenPanel(row, 'details')
              }}
              type="button"
            >
              {t('actions.details')}
            </button>
            <button
              className="grid-action-menu__item"
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                onOpenPanel(row, 'checksums')
              }}
              type="button"
            >
              {t('actions.checksums')}
            </button>
            {row.zipContent.length > 0 ? (
              <button
                className="grid-action-menu__item"
                onClick={(event) => {
                  event.stopPropagation()
                  setOpen(false)
                  onOpenPanel(row, 'zipContent')
                }}
                type="button"
              >
                {t('actions.zipContent')}
              </button>
            ) : null}
            <a
              className="grid-action-menu__item"
              href={row.torrentUrl}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
              }}
              rel="noreferrer"
              target="_blank"
            >
              {t('actions.downloadTorrent')}
            </a>
            <a
              className="grid-action-menu__item"
              href={row.archiveUrl}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
              }}
              rel="noreferrer"
              target="_blank"
            >
              {t('actions.internetArchive')}
            </a>
          </div>
        </FloatingPortal>
      ) : null}
    </div>
  )
}
