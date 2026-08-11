import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Modal } from './Modal.js';

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

afterAll(() => {
  if (originalShowModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  }
  if (originalClose) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  } else {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  }
});

function DraftField(): React.JSX.Element {
  const [value, setValue] = useState('');
  return (
    <label>
      标题
      <input value={value} onChange={(event) => setValue(event.target.value)} />
    </label>
  );
}

describe('Modal', () => {
  it('uses unique accessible labels for multiple mounted dialogs', () => {
    render(
      <>
        <Modal open={false} title="新增书籍" description="填写书籍资料" onClose={() => undefined}>
          书籍表单
        </Modal>
        <Modal open={false} title="归档书籍" onClose={() => undefined}>
          归档确认
        </Modal>
      </>,
    );

    const dialogs = screen.getAllByRole('dialog', { hidden: true });
    const titleIds = dialogs.map((dialog) => dialog.getAttribute('aria-labelledby'));
    expect(new Set(titleIds).size).toBe(2);
    expect(document.getElementById(titleIds[0]!)).toHaveTextContent('新增书籍');
    expect(document.getElementById(titleIds[1]!)).toHaveTextContent('归档书籍');
    expect(
      document.getElementById(dialogs[0]!.getAttribute('aria-describedby')!),
    ).toHaveTextContent('填写书籍资料');
    expect(dialogs[1]).not.toHaveAttribute('aria-describedby');
  });

  it('discards child form state after closing and reopening', () => {
    const { rerender } = render(
      <Modal open title="新建" onClose={() => undefined}>
        <DraftField />
      </Modal>,
    );
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '上一次输入' } });

    rerender(
      <Modal open={false} title="新建" onClose={() => undefined}>
        <DraftField />
      </Modal>,
    );
    rerender(
      <Modal open title="新建" onClose={() => undefined}>
        <DraftField />
      </Modal>,
    );

    expect(screen.getByLabelText('标题')).toHaveValue('');
  });
});
