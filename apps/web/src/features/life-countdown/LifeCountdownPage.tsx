import type { LifeEvent, LifeEventInput, LifeProfileInput } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Clock3,
  Edit3,
  Hourglass,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { invalidateLifeData, lifeApi, lifeKeys } from './api.js';
import { LifeEventForm, LifeProfileForm } from './components/LifeForms.js';
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
function duration(target: string, now: Date): { label: string; overdue: boolean } {
  const difference = Date.parse(target) - now.getTime();
  const overdue = difference < 0;
  const absolute = Math.abs(difference);
  const days = Math.floor(absolute / 86_400_000);
  const hours = Math.floor((absolute % 86_400_000) / 3_600_000);
  const minutes = Math.floor((absolute % 3_600_000) / 60_000);
  return {
    label:
      days > 0
        ? `${days} 天 ${hours} 小时`
        : hours > 0
          ? `${hours} 小时 ${minutes} 分钟`
          : `${minutes} 分钟`,
    overdue,
  };
}
export function LifeCountdownPage(): React.JSX.Element {
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const now = useNow();
  const { show } = useToast();
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const dashboard = useQuery({
    queryKey: lifeKeys.dashboard(status),
    queryFn: () => lifeApi.dashboard(status),
  });
  const events = useMemo(() => dashboard.data?.events ?? [], [dashboard.data]);
  const selected = events.find((item) => item.id === eventId);
  const after = async (message: string): Promise<void> => {
    await invalidateLifeData();
    setProfileOpen(false);
    setCreateOpen(false);
    setEditOpen(false);
    setArchiveOpen(false);
    setDeleteOpen(false);
    show(message);
  };
  const profile = useMutation({
    mutationFn: (input: LifeProfileInput) => lifeApi.updateProfile(input),
    onSuccess: () => after('人生参数已更新'),
  });
  const create = useMutation({
    mutationFn: (input: LifeEventInput) => lifeApi.createEvent(input),
    onSuccess: async (item) => {
      await after('人生事件已添加');
      void navigate(`/features/life-countdown/${item.id}`);
    },
  });
  const update = useMutation({
    mutationFn: ({ item, input }: { item: LifeEvent; input: LifeEventInput }) =>
      lifeApi.updateEvent(item.id, { ...input, version: item.version }),
    onSuccess: () => after('人生事件已更新'),
  });
  const archive = useMutation({
    mutationFn: (item: LifeEvent) => lifeApi.archiveEvent(item.id, item.version),
    onSuccess: async () => {
      await after('人生事件已归档');
      void navigate('/features/life-countdown');
    },
  });
  const restore = useMutation({
    mutationFn: (item: LifeEvent) => lifeApi.restoreEvent(item.id, item.version),
    onSuccess: async (item) => {
      await after('人生事件已恢复');
      setStatus('active');
      void navigate(`/features/life-countdown/${item.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: (item: LifeEvent) => lifeApi.deleteEvent(item.id, item.version),
    onSuccess: async () => {
      await after('人生事件已永久删除');
      void navigate('/features/life-countdown');
    },
  });
  const error =
    dashboard.error ??
    profile.error ??
    create.error ??
    update.error ??
    archive.error ??
    restore.error ??
    remove.error;
  return (
    <div className="feature-shell-page feature-shell-page--life">
      <header className="feature-hero feature-hero--life">
        <div>
          <p className="eyebrow">时间与提醒</p>
          <h2>人生倒计时</h2>
        </div>
        <div className="life-hero-actions">
          <button className="button button--quiet" onClick={() => setProfileOpen(true)}>
            <Settings2 size={17} />
            人生参数
          </button>
          <button className="button button--primary" onClick={() => setCreateOpen(true)}>
            <Plus size={17} />
            添加事件
          </button>
        </div>
      </header>
      {error ? <SectionError title="数据没有更新" message={humanizeApiError(error)} /> : null}
      {dashboard.data ? (
        <LifeMetrics
          profile={dashboard.data.profile}
          now={now}
          onSetup={() => setProfileOpen(true)}
        />
      ) : (
        <div className="skeleton skeleton--detail" />
      )}
      <div className="lifecycle-tabs" aria-label="人生事件状态">
        {(['active', 'archived'] as const).map((item) => (
          <button
            key={item}
            className={status === item ? 'active' : ''}
            onClick={() => {
              setStatus(item);
              void navigate('/features/life-countdown');
            }}
          >
            {item === 'active' ? '进行中' : '已归档'}
          </button>
        ))}
        <span>{events.length}项</span>
      </div>
      <div
        className={`entity-workspace life-event-workspace ${selected ? 'entity-workspace--detail' : ''}`}
      >
        <section className="entity-list-panel">
          {events.length ? (
            <div className="life-event-list">
              {events.map((item) => {
                const remaining = duration(item.targetAt, now);
                return (
                  <Link
                    key={item.id}
                    className={`life-event-card ${item.id === eventId ? 'active' : ''}`}
                    to={`/features/life-countdown/${item.id}`}
                  >
                    <span>
                      <Sparkles />
                    </span>
                    <div>
                      <small>{new Date(item.targetAt).toLocaleString('zh-CN')}</small>
                      <strong>{item.title}</strong>
                      <p>
                        {remaining.overdue ? '已过去' : '还剩'} {remaining.label}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={status === 'active' ? '还没有人生事件' : '还没有已归档事件'}
              description="毕业、旅行、纪念日或任何你想看见的未来节点都可以放在这里。"
              action={
                status === 'active' ? (
                  <button className="button button--quiet" onClick={() => setCreateOpen(true)}>
                    添加第一项
                  </button>
                ) : undefined
              }
            />
          )}
        </section>
        <section className="entity-detail-panel">
          {selected ? (
            <LifeEventDetail
              item={selected}
              now={now}
              onBack={() => void navigate('/features/life-countdown')}
              onEdit={() => setEditOpen(true)}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : (
            <div className="entity-detail-placeholder">
              <Hourglass size={46} />
              <h3>选择一个人生事件</h3>
              <p>这里会以秒为单位持续更新剩余时间。</p>
            </div>
          )}
        </section>
      </div>
      <Modal
        open={profileOpen}
        title="设置人生参数"
        description="这只是个人时间视图，不是寿命预测。"
        onClose={() => setProfileOpen(false)}
      >
        {dashboard.data ? (
          <LifeProfileForm
            key={dashboard.data.profile.version}
            profile={dashboard.data.profile}
            submitting={profile.isPending}
            onSubmit={async (input) => {
              await profile.mutateAsync(input);
            }}
          />
        ) : null}
      </Modal>
      <Modal open={createOpen} title="添加人生事件" onClose={() => setCreateOpen(false)}>
        <LifeEventForm
          submitting={create.isPending}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </Modal>
      <Modal open={editOpen} title="编辑人生事件" onClose={() => setEditOpen(false)}>
        {selected ? (
          <LifeEventForm
            key={`${selected.id}:${selected.version}`}
            lifeEvent={selected}
            submitting={update.isPending}
            onSubmit={async (input) => {
              await update.mutateAsync({ item: selected, input });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={archiveOpen}
        title="归档人生事件"
        onClose={() => setArchiveOpen(false)}
        footer={
          <>
            <button className="button button--quiet" onClick={() => setArchiveOpen(false)}>
              取消
            </button>
            <button
              className="button button--danger"
              onClick={() => selected && archive.mutate(selected)}
            >
              确认归档
            </button>
          </>
        }
      >
        <p>事件会停止出现在总览提醒中，但仍可以恢复。</p>
      </Modal>
      <Modal
        open={deleteOpen}
        title="永久删除人生事件"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button className="button button--quiet" onClick={() => setDeleteOpen(false)}>
              取消
            </button>
            <button
              className="button button--danger"
              onClick={() => selected && remove.mutate(selected)}
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
function LifeMetrics({
  profile,
  now,
  onSetup,
}: {
  profile: Awaited<ReturnType<typeof lifeApi.dashboard>>['profile'];
  now: Date;
  onSetup(): void;
}): React.JSX.Element {
  if (!profile.birthDate || !profile.expectedEndDate)
    return (
      <section className="life-setup-card">
        <Hourglass />
        <div>
          <p className="eyebrow">等待设置</p>
          <h3>先填写出生日期和预期寿命</h3>
          <p>完成后，这里会显示已走过比例、剩余天数和今天/今年的进度。</p>
        </div>
        <button className="button button--primary" onClick={onSetup}>
          现在设置
        </button>
      </section>
    );
  const birth = Date.parse(`${profile.birthDate}T00:00:00`);
  const end = Date.parse(`${profile.expectedEndDate}T00:00:00`);
  const total = end - birth;
  const elapsed = Math.max(0, Math.min(total, now.getTime() - birth));
  const remaining = Math.max(0, end - now.getTime());
  const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const yearPercent = ((now.getTime() - startOfYear) / (endOfYear - startOfYear)) * 100;
  const dayPercent =
    ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * 100;
  return (
    <section className="life-metrics">
      <div
        className="life-progress-ring"
        style={{ '--life-progress': `${percentage * 3.6}deg` } as React.CSSProperties}
      >
        <span>
          <strong>{percentage.toFixed(2)}%</strong>
          <small>已走过</small>
        </span>
      </div>
      <div className="life-stat-grid">
        <div>
          <small>预期剩余</small>
          <strong>{Math.floor(remaining / 86_400_000).toLocaleString()} 天</strong>
          <span>
            {Math.floor(remaining / 604_800_000).toLocaleString()} 周 ·{' '}
            {Math.floor(remaining / 2_629_746_000).toLocaleString()} 月
          </span>
        </div>
        <div>
          <small>{now.getFullYear()} 年进度</small>
          <strong>{yearPercent.toFixed(2)}%</strong>
          <progress max="100" value={yearPercent} />
        </div>
        <div>
          <small>今天进度</small>
          <strong>{dayPercent.toFixed(2)}%</strong>
          <progress max="100" value={dayPercent} />
        </div>
      </div>
    </section>
  );
}
function LifeEventDetail({
  item,
  now,
  onBack,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  item: LifeEvent;
  now: Date;
  onBack(): void;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
}): React.JSX.Element {
  const remaining = duration(item.targetAt, now);
  return (
    <article className="entity-detail life-event-detail">
      <button className="mobile-back" onClick={onBack}>
        <ArrowLeft size={17} />
        返回事件
      </button>
      <header className="entity-detail__header">
        <div>
          <span
            className={`source-pill ${item.status === 'archived' ? 'source-pill--archived' : ''}`}
          >
            {item.status === 'archived' ? '已归档' : remaining.overdue ? '已到达' : '进行中'}
          </span>
          <p className="eyebrow">人生事件</p>
          <h2>{item.title}</h2>
        </div>
        <div className="entity-detail__actions">
          {item.status === 'archived' ? (
            <>
              <button className="button button--quiet" onClick={onRestore}>
                <RotateCcw />
                恢复
              </button>
              <button className="button button--danger" onClick={onDelete}>
                <Trash2 />
                永久删除
              </button>
            </>
          ) : (
            <>
              <button className="button button--quiet" onClick={onEdit}>
                <Edit3 />
                编辑
              </button>
              <button className="button button--quiet" onClick={onArchive}>
                <Archive />
                归档
              </button>
            </>
          )}
        </div>
      </header>
      <div className="event-countdown-display">
        <Clock3 />
        <small>{remaining.overdue ? '已经过去' : '距离事件还有'}</small>
        <strong>{remaining.label}</strong>
        <time>{new Date(item.targetAt).toLocaleString('zh-CN')}</time>
      </div>
      {item.note ? (
        <section className="detail-note">
          <p>{item.note}</p>
        </section>
      ) : null}
    </article>
  );
}
