import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-[16px] backdrop-blur-2xl px-4 py-3 text-xs font-medium shadow-[0_16px_40px_-8px_rgba(0,0,0,0.28)] border ${
            t.tone === 'error'
              ? 'bg-[#1D1D1F]/95 dark:bg-[#2C2C2E]/95 border-red-500/30 text-white'
              : 'bg-[#1D1D1F]/92 dark:bg-[#2C2C2E]/95 border-white/10 text-[#F5F5F7]'
          }`}
        >
          {t.tone === 'error' ? (
            <AlertCircle className="h-4 w-4 text-[#FF453A] shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-[#30D158] shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span className="flex-1 leading-relaxed">{t.text}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
