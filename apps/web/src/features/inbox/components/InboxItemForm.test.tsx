import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InboxItemForm } from './InboxItemForm.js';

describe('InboxItemForm', () => {
  it('submits a link with its URL into the unprocessed inbox', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<InboxItemForm submitting={false} onUpload={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('内容类型'), { target: { value: 'link' } });
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'PostgreSQL 文档' } });
    fireEvent.change(screen.getByLabelText('网址'), {
      target: { value: 'https://www.postgresql.org/docs/' },
    });
    fireEvent.click(screen.getByRole('button', { name: '收入收集箱' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'link',
        status: 'inbox',
        url: 'https://www.postgresql.org/docs/',
      }),
    );
  });
});
