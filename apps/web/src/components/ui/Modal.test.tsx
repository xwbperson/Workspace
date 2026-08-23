import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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

  it('asks before closing a form whose values changed', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="新建" onClose={onClose}>
        <DraftField />
      </Modal>,
    );
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '尚未保存' } });

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(screen.getByRole('alertdialog', { name: '放弃未保存内容？' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('标题')).toHaveValue('尚未保存');

    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('标题')).toHaveValue('尚未保存');
  });

  it('closes a dirty form after the user confirms discarding it', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="新建" onClose={onClose}>
        <DraftField />
      </Modal>,
    );
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '尚未保存' } });

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('button', { name: '放弃并关闭' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps keyboard focus inside an open dialog', () => {
    render(
      <Modal open title="新建" onClose={() => undefined}>
        <DraftField />
        <button type="button">最后操作</button>
      </Modal>,
    );
    const close = screen.getByRole('button', { name: '关闭' });
    close.focus();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });

    expect(screen.getByRole('button', { name: '最后操作' })).toHaveFocus();
  });
});
