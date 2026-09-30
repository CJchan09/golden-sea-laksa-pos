import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { IS_PUBLIC_DEMO } from '../demo-mode';
import { useStore } from '../store';
import { tr } from '../i18n';

interface PublicDemoResetProps {
  buttonClassName?: string;
}

const DEFAULT_BUTTON_CLASS = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition-colors hover:border-red-400 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70';

export default function PublicDemoReset({ buttonClassName = DEFAULT_BUTTON_CLASS }: PublicDemoResetProps) {
  const { resetDemo, language } = useStore();
  const [busy, setBusy] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!IS_PUBLIC_DEMO) return null;

  const closeDialog = () => {
    setIsOpen(false);
    setErrorMessage('');
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled)'),
    ) as HTMLElement[];
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleReset = async () => {
    if (busy) return;
    setBusy(true);
    if (!await resetDemo()) {
      setErrorMessage(tr(language,'Reset could not be saved. Please retry.','重置未能保存，请重试。','Tetapan semula tidak dapat disimpan. Cuba lagi.'));
      setBusy(false);
      return;
    }

    window.location.hash = '';
    closeDialog();
    setBusy(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-controls="public-demo-reset-dialog"
        onClick={() => setIsOpen(true)}
        className={buttonClassName}
      >
        <RotateCcw aria-hidden="true" className="h-5 w-5 shrink-0" />
        {tr(language,'Reset demo','恢复示范资料','Tetapkan semula demo')}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            id="public-demo-reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-demo-reset-title"
            aria-describedby="public-demo-reset-description"
            onKeyDown={handleDialogKeyDown}
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-950 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-white sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300">
                <TriangleAlert aria-hidden="true" className="h-6 w-6" />
              </span>
              <div>
                <h2 id="public-demo-reset-title" className="text-lg font-extrabold">
                  {tr(language,'Restore demo on this device?','恢复这台设备的示范资料？','Pulihkan demo pada peranti ini?')}
                </h2>
                <p id="public-demo-reset-description" className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {tr(language,'This replaces the menu, orders, cart and photos on this browser with the original demo. Save a full backup first if you need these records.','这会将本浏览器的菜单、订单、购物车和照片恢复为原本示范资料。如需保留记录，请先保存完整备份。','Ini menggantikan menu, pesanan, troli dan foto pelayar ini dengan demo asal. Simpan sandaran penuh dahulu jika anda memerlukan rekod ini.')}
                </p>
              </div>
            </div>

            {errorMessage && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
                {errorMessage}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                onClick={closeDialog}
                className="min-h-12 rounded-xl border border-zinc-300 px-5 py-3 font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {tr(language,'Cancel','取消','Batal')}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-extrabold text-white transition-colors hover:bg-red-700"
              >
                <RotateCcw aria-hidden="true" className="h-5 w-5" />
                {tr(language,'Confirm reset','确认恢复','Sahkan tetapan semula')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
