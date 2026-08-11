import type { Book, Course, CourseInput } from '@workspace/client-sdk';
import { useState } from 'react';

const readingStatusLabels = {
  'to-read': '待读',
  reading: '在读',
  read: '已读',
  abandoned: '放弃',
} as const;

export function CourseForm({
  course,
  books,
  submitting,
  onSubmit,
}: {
  course?: Course;
  books: Book[];
  submitting: boolean;
  onSubmit(input: CourseInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    name: course?.name ?? '',
    instructor: course?.instructor ?? '',
    courseCode: course?.courseCode ?? '',
    credits: String(course?.credits ?? 0),
    totalHours: String(course?.totalHours ?? 0),
    objectives: course?.objectives ?? '',
    description: course?.description ?? '',
    schedule: course?.schedule ?? '',
    referenceBookIds: course?.referenceBooks?.map((book) => book.id) ?? [],
  });

  const set = (name: keyof Omit<typeof form, 'referenceBookIds'>, value: string): void => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          name: form.name.trim(),
          instructor: form.instructor,
          courseCode: form.courseCode,
          credits: Number(form.credits) || 0,
          totalHours: Number(form.totalHours) || 0,
          objectives: form.objectives,
          description: form.description,
          schedule: form.schedule,
          referenceBookIds: form.referenceBookIds,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>课程名称 *</span>
          <input
            required
            autoFocus
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </label>
        <label className="field">
          <span>授课教师</span>
          <input
            value={form.instructor}
            onChange={(event) => set('instructor', event.target.value)}
          />
        </label>
        <label className="field">
          <span>课程编号</span>
          <input
            value={form.courseCode}
            onChange={(event) => set('courseCode', event.target.value)}
          />
        </label>
        <label className="field">
          <span>学分</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={form.credits}
            onChange={(event) => set('credits', event.target.value)}
          />
        </label>
        <label className="field">
          <span>学时</span>
          <input
            type="number"
            min="0"
            max="10000"
            value={form.totalHours}
            onChange={(event) => set('totalHours', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>上课时间</span>
          <textarea
            rows={3}
            placeholder="例如：周三 3-4 节，B 楼 201"
            value={form.schedule}
            onChange={(event) => set('schedule', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>教学目标</span>
          <textarea
            rows={4}
            value={form.objectives}
            onChange={(event) => set('objectives', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>课程简介</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </label>
      </div>
      <fieldset className="book-picker">
        <legend>参考书（从书籍管理导入）</legend>
        <p>课程中只读展示书籍信息，需要修改时请进入书籍管理。</p>
        {books.length ? (
          <div className="book-picker__list">
            {books.map((book) => (
              <label key={book.id}>
                <input
                  type="checkbox"
                  checked={form.referenceBookIds.includes(book.id)}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      referenceBookIds: event.target.checked
                        ? [...current.referenceBookIds, book.id]
                        : current.referenceBookIds.filter((id) => id !== book.id),
                    }))
                  }
                />
                <span>
                  <strong>{book.title}</strong>
                  <small>
                    {book.author || '未填写作者'} · {readingStatusLabels[book.readingStatus]}
                  </small>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="archive-hint">还没有可选书籍，请先在书籍管理中添加。</p>
        )}
      </fieldset>
      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : course ? '保存修改' : '添加课程'}
        </button>
      </div>
    </form>
  );
}
