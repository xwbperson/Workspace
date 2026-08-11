import { X } from 'lucide-react';
import { useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose(): void;
  footer?: ReactNode;
  className?: string;
}

export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  children,
  className = '',
}: ModalProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="modal__header">
        <div>
          <h2 id="modal-title">{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="modal__body">{children}</div>
      {footer ? <div className="modal__footer">{footer}</div> : null}
    </dialog>
  );
}
