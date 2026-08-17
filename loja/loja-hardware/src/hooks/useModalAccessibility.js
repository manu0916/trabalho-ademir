import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const backgroundStates = new WeakMap();
let bodyLockCount = 0;
let bodyOverflowBeforeLock = '';

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    bodyOverflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
}

function makeBackgroundInert(element) {
  const existing = backgroundStates.get(element);
  if (existing) {
    existing.count += 1;
    return;
  }

  backgroundStates.set(element, {
    count: 1,
    inert: element.inert,
    ariaHidden: element.getAttribute('aria-hidden'),
  });
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
}

function restoreBackground(element) {
  const state = backgroundStates.get(element);
  if (!state) return;
  state.count -= 1;
  if (state.count > 0) return;

  element.inert = state.inert;
  if (state.ariaHidden === null) element.removeAttribute('aria-hidden');
  else element.setAttribute('aria-hidden', state.ariaHidden);
  backgroundStates.delete(element);
}

function focusableElements(dialog) {
  return Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => (
    element instanceof HTMLElement
    && element.getClientRects().length > 0
    && !element.closest('[inert]')
    && element.getAttribute('aria-hidden') !== 'true'
  ));
}

/**
 * Keeps keyboard and assistive-technology focus inside an open modal. The modal
 * root must carry data-modal-root so its page siblings can be made inert.
 */
export default function useModalAccessibility({
  isOpen,
  dialogRef,
  initialFocusRef,
  onClose,
  canClose = true,
}) {
  const closeHandlerRef = useRef(onClose);
  const canCloseRef = useRef(canClose);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    closeHandlerRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    canCloseRef.current = canClose;
  }, [canClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const activeBeforeSetup = document.activeElement;
    if (
      activeBeforeSetup instanceof HTMLElement
      && activeBeforeSetup !== document.body
      && !dialog.contains(activeBeforeSetup)
      && activeBeforeSetup.isConnected
      && !activeBeforeSetup.closest('[inert]')
    ) {
      returnFocusRef.current = activeBeforeSetup;
    }
    const modalRoot = dialog.closest('[data-modal-root="true"]') || dialog;
    const background = modalRoot.parentElement
      ? Array.from(modalRoot.parentElement.children).filter((element) => element !== modalRoot)
      : [];

    const focusInside = (preferLast = false) => {
      const focusable = focusableElements(dialog);
      const preferred = initialFocusRef?.current;
      const target = !preferLast
        && preferred instanceof HTMLElement
        && dialog.contains(preferred)
        && !preferred.disabled
        ? preferred
        : preferLast ? focusable.at(-1) : focusable[0];
      (target || dialog).focus({ preventScroll: true });
    };

    lockBodyScroll();
    focusInside();
    background.forEach(makeBackgroundInert);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (canCloseRef.current && closeHandlerRef.current) {
          event.preventDefault();
          closeHandlerRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = focusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event) => {
      if (!dialog.contains(event.target)) focusInside();
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      background.forEach(restoreBackground);
      unlockBodyScroll();

      window.requestAnimationFrame(() => {
        // StrictMode runs an immediate setup/cleanup/setup cycle while keeping the
        // same DOM node mounted. Only the real close should restore page focus.
        if (dialog.isConnected) return;
        const returnTarget = returnFocusRef.current;
        returnFocusRef.current = null;
        if (
          returnTarget instanceof HTMLElement
          && returnTarget.isConnected
          && !returnTarget.closest('[inert]')
        ) {
          returnTarget.focus({ preventScroll: true });
        }
      });
    };
  }, [dialogRef, initialFocusRef, isOpen]);
}
