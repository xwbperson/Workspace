import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show(message: string, tone?: ToastTone): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.round(Math.random() * 1_000);
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4_000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon =
            toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? CircleAlert : Info;
          return (
            <div className={`toast toast--${toast.tone}`} key={toast.id} role="status">
              <Icon aria-hidden="true" size={18} />
              <span>{toast.message}</span>
              <button
                type="button"
                className="icon-button icon-button--small"
                aria-label="关闭提示"
                onClick={() =>
                  setToasts((current) => current.filter((item) => item.id !== toast.id))
                }
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast 必须在 ToastProvider 内使用。');
  return value;
}
