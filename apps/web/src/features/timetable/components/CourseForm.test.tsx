import type { TimetableSemester } from '@workspace/client-sdk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CourseForm } from './CourseForm.js';

const semester: TimetableSemester = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '2026—2027 学年秋季学期',
  shortName: '研一上',
  firstWeekMonday: '2026-09-07',
  totalWeeks: 4,
  isCurrent: true,
  showWeekend: false,
  status: 'active',
  timeBlocks: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      semesterId: '11111111-1111-4111-8111-111111111111',
      label: '课 1',
      sourceLabel: '第 1—2 节',
      startTime: '08:30',
      endTime: '10:05',
      position: 1,
      version: 1,
    },
  ],
  version: 1,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

describe('CourseForm', () => {
  it('submits teacher, classroom and explicitly selected teaching weeks', async () => {
    const onSubmit = vi.fn(async () => undefined);
    const { container } = render(
      <CourseForm formId="course-form" semester={semester} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText('课程名称'), {
      target: { value: '网络空间安全数学原理' },
    });
    fireEvent.change(screen.getByLabelText('默认教师'), { target: { value: '张老师' } });
    fireEvent.change(screen.getByLabelText('教室'), { target: { value: '南校区 G-101' } });
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '网络空间安全数学原理',
        instructors: ['张老师'],
        meetings: [expect.objectContaining({ room: '南校区 G-101', weekNumbers: [1, 3, 4] })],
      }),
    );
  });

  it('keeps the form open when an arrangement has no teaching week', () => {
    const onSubmit = vi.fn(async () => undefined);
    const { container } = render(
      <CourseForm formId="course-form" semester={semester} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText('课程名称'), { target: { value: '无线网络安全' } });
    fireEvent.click(screen.getByRole('button', { name: '清空' }));
    fireEvent.submit(container.querySelector('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('至少选择一个教学周');
  });
});
