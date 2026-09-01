import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { IS_PUBLIC_DEMO } from '../demo-mode';
import { broadcastPublicDemoReset, resetPublicDemoStorage } from '../demo-reset';
import { isErr } from '../domain/result';
import { LocalStorageDriver } from '../storage/driver';

interface PublicDemoResetProps {
  buttonClassName?: string;
}

const DEFAULT_BUTTON_CLASS = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition-colors hover:border-red-400 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70';

export default function PublicDemoReset({ buttonClassName = DEFAULT_BUTTON_CLASS }: PublicDemoResetProps) {
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

  const handleReset = () => {
    const result = resetPublicDemoStorage(new LocalStorageDriver());
    if (isErr(result)) {
      setErrorMessage('Reset failed on this browser. Please try again or clear this site\'s data in browser settings. / 此浏览器无法重置，请重试。');
      return;
    }

    broadcastPublicDemoReset();
    window.location.hash = '';
    window.location.reload();
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
        Reset Demo / 恢复示范资料
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
                  Restore this device? / 恢复这台设备？
                </h2>
                <p id="public-demo-reset-description" className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  This removes this browser's test menu changes, orders, cart and uploaded QR, then restores the original demo. Tabs in this browser reset together; other devices, the published demo and unrelated websites are not affected.
                  <span className="mt-2 block">会删除这个浏览器的测试菜单、订单、购物车和上传的二维码，并恢复原本示范资料。同浏览器标签会一起恢复；不会影响其他设备、公开原版或其他网站。</span>
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
                Cancel / 取消
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-extrabold text-white transition-colors hover:bg-red-700"
              >
                <RotateCcw aria-hidden="true" className="h-5 w-5" />
                Reset this device / 确认恢复
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
