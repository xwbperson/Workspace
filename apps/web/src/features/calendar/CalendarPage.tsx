import type { CalendarEntry, CalendarEntryInput, CalendarEntryStatus } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { formatDateTime } from '../../platform/time/format.js';
import { calendarApi, calendarKeys, invalidateCalendarData } from './api.js';
import { CalendarEntryForm, calendarTypeLabels } from './components/CalendarEntryForm.js';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function moveMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}
function monthDays(cursor: Date): Date[] {
  const first = monthStart(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function CalendarPage(): React.JSX.Element {
  const { entryId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(monthStart(today));
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [status, setStatus] = useState<CalendarEntryStatus>('active');
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const from = dateKey(monthStart(cursor));
  const to = dateKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
  const list = useQuery({
    queryKey: calendarKeys.range(from, to, status),
    queryFn: () => calendarApi.list(from, to, status),
  });
  const detail = useQuery({
    queryKey: calendarKeys.detail(entryId ?? ''),
    queryFn: () => calendarApi.get(entryId!),
    enabled: Boolean(entryId),
  });
  const entries = useMemo(() => list.data?.items ?? [], [list.data]);
  const selected = detail.data ?? entries.find((item) => item.id === entryId);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries)
      map.set(entry.entryDate, [...(map.get(entry.entryDate) ?? []), entry]);
    return map;
  }, [entries]);
  const days = useMemo(() => monthDays(cursor), [cursor]);
  const dayEntries = grouped.get(selectedDate) ?? [];

  useEffect(() => {
    if (!detail.data) return;
    const date = new Date(`${detail.data.entryDate}T12:00:00`);
    setCursor(monthStart(date));
    setSelectedDate(detail.data.entryDate);
    setStatus(detail.data.status);
  }, [detail.data]);

  const create = useMutation({
    mutationFn: (input: CalendarEntryInput) => calendarApi.create(input),
    onSuccess: async (entry) => {
      await invalidateCalendarData();
      setCreateOpen(false);
      setSelectedDate(entry.entryDate);
      show(`${calendarTypeLabels[entry.type]}已添加`);
      void navigate(`/features/calendar/${entry.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ entry, input }: { entry: CalendarEntry; input: CalendarEntryInput }) =>
      calendarApi.update(entry.id, { ...input, version: entry.version }),
    onSuccess: async (entry) => {
      await invalidateCalendarData();
      setEditOpen(false);
      setSelectedDate(entry.entryDate);
      show('日历记录已更新');
      void navigate(`/features/calendar/${entry.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: (entry: CalendarEntry) => calendarApi.archive(entry.id, entry.version),
    onSuccess: async () => {
      await invalidateCalendarData();
      setArchiveOpen(false);
      show('日历记录已归档');
      void navigate('/features/calendar', { replace: true });
    },
  });
  const restore = useMutation({
    mutationFn: (entry: CalendarEntry) => calendarApi.restore(entry.id, entry.version),
    onSuccess: async (entry) => {
      await invalidateCalendarData();
      setStatus('active');
      show('日历记录已恢复');
      void navigate(`/features/calendar/${entry.id}`, { replace: true });
    },
  });
  const permanentDelete = useMutation({
    mutationFn: (entry: CalendarEntry) => calendarApi.deletePermanently(entry.id, entry.version),
    onSuccess: async () => {
      await invalidateCalendarData();
      setDeleteOpen(false);
      show('日历记录已永久删除');
      void navigate('/features/calendar', { replace: true });
    },
  });
  const error =
    create.error ?? update.error ?? archive.error ?? restore.error ?? permanentDelete.error;

  return (
    <div className="feature-shell-page feature-shell-page--calendar">
      <header className="feature-hero feature-hero--calendar">
        <div>
          <p className="eyebrow">时间与提醒</p>
          <h2>日程管理</h2>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} /> 添加记录
        </button>
      </header>
      {error ? <SectionError title="操作没有完成" message={humanizeApiError(error)} /> : null}
      <div className="calendar-toolbar">
        <div className="calendar-toolbar__move">
          <button
            type="button"
            className="icon-button"
            aria-label="上个月"
            onClick={() => setCursor(moveMonth(cursor, -1))}
          >
            <ChevronLeft />
          </button>
          <strong>
            {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
          </strong>
          <button
            type="button"
            className="icon-button"
            aria-label="下个月"
            onClick={() => setCursor(moveMonth(cursor, 1))}
          >
            <ChevronRight />
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => {
              setCursor(monthStart(today));
              setSelectedDate(dateKey(today));
            }}
          >
            今天
          </button>
        </div>
        <div className="lifecycle-tabs lifecycle-tabs--compact">
          <button
            type="button"
            className={status === 'active' ? 'active' : ''}
            onClick={() => {
              setStatus('active');
              void navigate('/features/calendar');
            }}
          >
            日历
          </button>
          <button
            type="button"
            className={status === 'archived' ? 'active' : ''}
            onClick={() => {
              setStatus('archived');
              void navigate('/features/calendar');
            }}
          >
            已归档
          </button>
        </div>
      </div>
      <div className="calendar-workspace">
        <section
          className="month-calendar"
          aria-label={`${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`}
        >
          <div className="month-calendar__weekdays">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="month-calendar__grid">
            {days.map((day) => {
              const key = dateKey(day);
              const items = grouped.get(key) ?? [];
              const outside = day.getMonth() !== cursor.getMonth();
              return (
                <button
                  type="button"
                  key={key}
                  className={`calendar-day ${outside ? 'outside' : ''} ${selectedDate === key ? 'selected' : ''} ${key === dateKey(today) ? 'today' : ''}`}
                  onClick={() => {
                    setSelectedDate(key);
                    void navigate('/features/calendar');
                  }}
                >
                  <span className="calendar-day__number">{day.getDate()}</span>
                  <span className="calendar-day__items">
                    {items.slice(0, 3).map((item) => (
                      <span className={`calendar-chip type-${item.type}`} key={item.id}>
                        {item.title}
                      </span>
                    ))}
                    {items.length > 3 ? <small>还有 {items.length - 3} 项</small> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="day-agenda">
          <div className="day-agenda__heading">
            <div>
              <p className="eyebrow">
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('zh-CN', {
                  weekday: 'long',
                })}
              </p>
              <h3>{selectedDate}</h3>
            </div>
            {status === 'active' ? (
              <button
                type="button"
                className="icon-button"
                aria-label="为这一天添加记录"
                onClick={() => setCreateOpen(true)}
              >
                <Plus />
              </button>
            ) : null}
          </div>
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : dayEntries.length ? (
            <div className="agenda-list">
              {dayEntries.map((entry) => (
                <Link
                  className={`agenda-card type-${entry.type} ${entry.id === entryId ? 'active' : ''}`}
                  to={`/features/calendar/${entry.id}`}
                  key={entry.id}
                >
                  <span>{calendarTypeLabels[entry.type]}</span>
                  <strong>{entry.title}</strong>
                  <small>
                    {entry.startsAt
                      ? formatDateTime(entry.startsAt)
                      : entry.type === 'journal'
                        ? '全天日记'
                        : '当日总结'}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="这一天还没有记录" description="可以添加行程、日记或总结。" />
          )}
          {selected ? (
            <article className="agenda-detail">
              <div className="agenda-detail__heading">
                <span
                  className={`source-pill ${selected.status === 'archived' ? 'source-pill--archived' : ''}`}
                >
                  {calendarTypeLabels[selected.type]}
                </span>
                <div>
                  {selected.status === 'archived' ? (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="恢复"
                        onClick={() => restore.mutate(selected)}
                      >
                        <ArchiveRestore />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger-action"
                        aria-label="永久删除"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="编辑"
                        onClick={() => setEditOpen(true)}
                      >
                        <Edit3 />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="归档"
                        onClick={() => setArchiveOpen(true)}
                      >
                        <Archive />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <h3>{selected.title}</h3>
              {selected.startsAt ? (
                <p>
                  {formatDateTime(selected.startsAt)}
                  {selected.endsAt ? ` — ${formatDateTime(selected.endsAt)}` : ''}
                </p>
              ) : null}
              <div className="agenda-detail__content">{selected.content || '没有补充内容。'}</div>
            </article>
          ) : null}
        </aside>
      </div>
      <Modal
        open={createOpen}
        title="添加日历记录"
        description={`记录到 ${selectedDate}`}
        onClose={() => setCreateOpen(false)}
        className="modal--wide"
      >
        <CalendarEntryForm
          defaultDate={selectedDate}
          submitting={create.isPending}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑日历记录"
        onClose={() => setEditOpen(false)}
        className="modal--wide"
      >
        {selected ? (
          <CalendarEntryForm
            entry={selected}
            defaultDate={selected.entryDate}
            submitting={update.isPending}
            onSubmit={async (input) => {
              await update.mutateAsync({ entry: selected, input });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={archiveOpen}
        title="归档日历记录"
        onClose={() => setArchiveOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setArchiveOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={!selected || archive.isPending}
              onClick={() => selected && archive.mutate(selected)}
            >
              确认归档
            </button>
          </>
        }
      >
        <p>记录会离开日历，但仍可以在已归档中恢复。</p>
      </Modal>
      <Modal
        open={deleteOpen}
        title="永久删除日历记录"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={!selected || permanentDelete.isPending}
              onClick={() => selected && permanentDelete.mutate(selected)}
            >
              永久删除
            </button>
          </>
        }
      >
        <p>这个操作无法撤销。</p>
      </Modal>
    </div>
  );
}
