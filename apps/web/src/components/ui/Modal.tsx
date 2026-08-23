import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose(): void;
  footer?: ReactNode;
  className?: string;
  busy?: boolean;
  error?: ReactNode;
  confirmDiscard?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function formSnapshot(dialog: HTMLDialogElement): string {
  return JSON.stringify(
    Array.from(
      dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea',
      ),
    ).map((control, index) => ({
      index,
      type: control instanceof HTMLInputElement ? control.type : control.tagName,
      value:
        control instanceof HTMLInputElement && control.type === 'file'
          ? Array.from(control.files ?? []).map((file) => `${file.name}:${file.size}`)
          : control.value,
      checked: control instanceof HTMLInputElement ? control.checked : undefined,
    })),
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  children,
  className = '',
  busy = false,
  error,
  confirmDiscard = true,
}: ModalProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const initialFormSnapshotRef = useRef('');
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const discardTitleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDiscardPromptOpen(false);
      dialog.showModal();
      initialFormSnapshotRef.current = formSnapshot(dialog);
      const focusTarget = window.matchMedia?.('(max-width: 839px)').matches
        ? dialog
        : (dialog.querySelector<HTMLElement>(
            '.modal__body [autofocus], .modal__body input:not([type="hidden"]):not([disabled]), .modal__body select:not([disabled]), .modal__body textarea:not([disabled]), .modal__body button:not([disabled]), .modal__body a[href]',
          ) ?? dialog);
      window.requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const requestClose = (): void => {
    const dialog = ref.current;
    if (!dialog || busy) return;
    if (discardPromptOpen) {
      setDiscardPromptOpen(false);
      return;
    }
    const dirty = formSnapshot(dialog) !== initialFormSnapshotRef.current;
    if (confirmDiscard && dirty) {
      setDiscardPromptOpen(true);
      window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>('.modal__discard-cancel')?.focus();
      });
      return;
    }
    onClose();
  };

  const keepFocusInside = (event: React.KeyboardEvent<HTMLDialogElement>): void => {
    if (event.key !== 'Tab') return;
    const dialog = ref.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) =>
        !element.hasAttribute('disabled') &&
        element.getAttribute('aria-hidden') !== 'true' &&
        !element.closest('[inert]'),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={keepFocusInside}
    >
      <div className="modal__header" inert={discardPromptOpen}>
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="关闭"
          disabled={busy}
          onClick={requestClose}
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="modal__body" inert={discardPromptOpen}>
        {open && error ? (
          <div className="modal__error" role="alert">
            {error}
          </div>
        ) : null}
        {open ? children : null}
      </div>
      {open && footer ? (
        <div className="modal__footer" inert={discardPromptOpen}>
          {footer}
        </div>
      ) : null}
      {open && discardPromptOpen ? (
        <div
          className="modal__discard-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={discardTitleId}
        >
          <div>
            <h3 id={discardTitleId}>放弃未保存内容？</h3>
            <p>当前填写内容尚未保存，关闭后无法恢复。</p>
            <div>
              <button
                type="button"
                className="button button--quiet modal__discard-cancel"
                onClick={() => setDiscardPromptOpen(false)}
              >
                继续编辑
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => {
                  setDiscardPromptOpen(false);
                  onClose();
                }}
              >
                放弃并关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
