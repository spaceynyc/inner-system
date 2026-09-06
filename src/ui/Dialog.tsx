import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({ open, onClose, title, children, className = '' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])
  return <dialog ref={ref} className={`dialog ${className}`} aria-label={title}
    onCancel={() => closeRef.current()} onClose={() => closeRef.current()}
    onClick={(event) => { if (event.target === ref.current) { const bounds = ref.current.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeRef.current() } }}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={`Close ${title}`}><X size={20} /></button></div>
    {children}
  </dialog>
}
