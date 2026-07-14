import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastType = 'info' | 'success' | 'error';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = ++counter.current;
    const item: ToastItem = {
      id,
      message,
      type: options?.type || 'info',
      action: options?.action,
    };
    setToasts(prev => [...prev, item]);
    const duration = options?.duration ?? (options?.action ? 6000 : 3000);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-blue-500 shrink-0" />}
            <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 break-words">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 shrink-0"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="关闭通知"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
