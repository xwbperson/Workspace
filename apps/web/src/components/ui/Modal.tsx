import { X } from 'lucide-react';
import { useEffect, useId, useRef, type PropsWithChildren, type ReactNode } from 'react';

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
  const titleId = useId();
  const descriptionId = useId();

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
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="modal__header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="modal__body">{open ? children : null}</div>
      {open && footer ? <div className="modal__footer">{footer}</div> : null}
    </dialog>
  );
}
