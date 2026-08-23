export type WorkbenchShortcut = 'search' | 'create';

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
  );
}

export function resolveWorkbenchShortcut(
  event: KeyboardEvent,
  target: EventTarget | null,
  modalOpen: boolean,
): WorkbenchShortcut | undefined {
  if (event.defaultPrevented || modalOpen || isEditableTarget(target)) {
    return undefined;
  }

  const key = event.key.toLowerCase();

  if ((event.ctrlKey || event.metaKey) && !event.altKey && key === 'k') {
    return 'search';
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && key === 'n') {
    return 'create';
  }

  return undefined;
}
