import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'

type TooltipTriggerProps = HTMLAttributes<HTMLElement> & {
  'aria-label'?: string
  ref: (node: HTMLElement | null) => void
}

type TooltipProps = {
  children: (props: TooltipTriggerProps) => ReactNode
  content: ReactNode
  placement?: Placement
}

export function Tooltip({ children, content, placement = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const hasContent = typeof content === 'string' ? content.trim() !== '' : content !== null && content !== undefined
  const { context, floatingStyles, refs } = useFloating({
    middleware: [offset(7), flip(), shift({ padding: 8 })],
    onOpenChange: setOpen,
    open,
    placement,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  })
  const hover = useHover(context, {
    delay: {
      close: 0,
      open: 0,
    },
    enabled: hasContent,
    move: false,
  })
  const focus = useFocus(context, {
    enabled: hasContent,
  })
  const dismiss = useDismiss(context)
  const role = useRole(context, {
    role: 'tooltip',
  })
  const { getFloatingProps, getReferenceProps } = useInteractions([hover, focus, dismiss, role])
  const setReference = useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node)
      setPortalRoot(node?.closest('dialog') as HTMLElement | null)
    },
    [refs],
  )

  useEffect(() => {
    const closeTooltip = () => setOpen(false)

    document.addEventListener('app:close-tooltips', closeTooltip)

    return () => {
      document.removeEventListener('app:close-tooltips', closeTooltip)
    }
  }, [])
  const triggerProps = getReferenceProps({
    'aria-label': typeof content === 'string' ? content : undefined,
    onPointerDown: () => setOpen(false),
    ref: setReference,
  }) as unknown as TooltipTriggerProps

  return (
    <>
      {children(triggerProps)}
      {open && hasContent ? (
        <FloatingPortal root={portalRoot ?? undefined}>
          <div
            className="app-tooltip"
            {...getFloatingProps({
              ref: refs.setFloating,
              style: floatingStyles,
            })}
          >
            {content}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  )
}
