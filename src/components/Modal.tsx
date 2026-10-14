import { useEffect, useRef, type ReactNode } from "react";

/** Native modal semantics provide focus containment, Escape, and focus restoration. */
export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return <dialog ref={dialog} aria-label={label} onCancel={(event) => { event.preventDefault(); onClose(); }}
    className="m-auto w-[min(92vw,620px)] max-h-[85vh] overflow-y-auto rounded-xl border border-(--border-color) bg-(--bg-surface) p-5 text-(--text-main) shadow-2xl backdrop:bg-black/70">
    {children}
  </dialog>;
}
