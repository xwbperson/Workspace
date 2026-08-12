import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SemesterForm } from './SemesterForm.js';

describe('SemesterForm', () => {
  it('shows Saturday and Sunday by default for a new semester', () => {
    render(<SemesterForm formId="semester-form" onSubmit={vi.fn(async () => undefined)} />);

    expect(screen.getByRole('checkbox', { name: '显示周六和周日' })).toBeChecked();
  });
});
