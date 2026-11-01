import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, HelpCircle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface ActiveConfirmRequest extends ConfirmDialogOptions {
  resolve: (value: boolean) => void;
}

const RPM_CONFIRM_EVENT = 'rpm-action-confirm-dialog';

/**
 * In-app async confirmation modal that replaces native window.confirm.
 * 100% immune to ad blockers, popup blockers, and browser dialog limiters.
 */
export function confirmAction(options: ConfirmDialogOptions | string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(true);

  const opts: ConfirmDialogOptions =
    typeof options === 'string'
      ? { message: options, title: 'Confirm Action', variant: 'warning' }
      : options;

  return new Promise((resolve) => {
    const event = new CustomEvent(RPM_CONFIRM_EVENT, {
      detail: {
        ...opts,
        resolve,
      },
    });
    window.dispatchEvent(event);
  });
}

export const ConfirmDialog: React.FC = () => {
  const [activeRequest, setActiveRequest] = useState<ActiveConfirmRequest | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(
    (accepted: boolean) => {
      if (activeRequest) {
        activeRequest.resolve(accepted);
        setActiveRequest(null);
      }
    },
    [activeRequest]
  );

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ActiveConfirmRequest>;
      if (customEvent.detail) {
        setActiveRequest(customEvent.detail);
      }
    };

    window.addEventListener(RPM_CONFIRM_EVENT, handleEvent);
    return () => window.removeEventListener(RPM_CONFIRM_EVENT, handleEvent);
  }, []);

  // Keyboard navigation: Escape to cancel, Enter to confirm
  useEffect(() => {
    if (!activeRequest) return;

    const timer = setTimeout(() => confirmButtonRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeRequest, handleClose]);

  if (!activeRequest) return null;

  const variant = activeRequest.variant || 'warning';
  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';
  const isSuccess = variant === 'success';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose(false);
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d121c] text-white p-6 shadow-2xl overflow-hidden">
        {/* Subtle background glow */}
        <div
          className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isDanger
              ? 'bg-rose-500'
              : isWarning
              ? 'bg-amber-500'
              : isSuccess
              ? 'bg-emerald-500'
              : 'bg-blue-500'
          }`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={() => handleClose(false)}
          aria-label="Close"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isDanger
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : isWarning
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : isSuccess
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            }`}
          >
            {isDanger ? (
              <ShieldAlert size={20} />
            ) : isWarning ? (
              <AlertTriangle size={20} />
            ) : isSuccess ? (
              <CheckCircle2 size={20} />
            ) : (
              <HelpCircle size={20} />
            )}
          </div>
          <div className="pr-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
              {isDanger ? 'Critical Action' : isWarning ? 'Confirmation Required' : 'Action Notice'}
            </span>
            <h3 className="font-bold text-white text-base leading-snug">
              {activeRequest.title || 'Are you sure?'}
            </h3>
          </div>
        </div>

        {/* Message body */}
        <div className="py-1 mb-5">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {activeRequest.message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-semibold transition active:scale-95 cursor-pointer"
          >
            {activeRequest.cancelText || 'Cancel'}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => handleClose(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-lg ${
              isDanger
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950/40'
                : isWarning
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 shadow-amber-950/40'
                : isSuccess
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                : 'bg-white text-slate-950 hover:bg-slate-100 shadow-white/10'
            }`}
          >
            <span>{activeRequest.confirmText || 'Confirm'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
