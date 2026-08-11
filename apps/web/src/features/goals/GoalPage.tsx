import type { Goal, GoalInput, GoalStatus } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { goalApi, goalKeys, invalidateGoalData } from './api.js';
import { GoalForm } from './components/GoalForm.js';
import { GoalTrendChart } from './components/GoalTrendChart.js';

const statusLabels: Record<GoalStatus, string> = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
};

const periodLabels = { annual: '年度', quarterly: '季度', monthly: '月度' } as const;

export function GoalPage(): React.JSX.Element {
  const { goalId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [filter, setFilter] = useState<GoalStatus>('active');
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [measurement, setMeasurement] = useState({ value: '', note: '' });

  const list = useQuery({
    queryKey: goalKeys.list(filter),
    queryFn: () => goalApi.list(filter),
  });
  const detail = useQuery({
    queryKey: goalKeys.detail(goalId ?? ''),
    queryFn: () => goalApi.get(goalId!),
    enabled: Boolean(goalId),
  });
  const selected = detail.data ?? list.data?.items.find((item) => item.id === goalId);
  const goals = useMemo(() => list.data?.items ?? [], [list.data]);

  const create = useMutation({
    mutationFn: (input: GoalInput) => goalApi.create(input),
    onSuccess: async (goal) => {
      await invalidateGoalData();
      setCreateOpen(false);
      setFilter(goal.status);
      show('目标已创建');
      void navigate(`/features/goals/${goal.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ goal, input }: { goal: Goal; input: GoalInput }) =>
      goalApi.update(goal.id, { ...input, version: goal.version }),
    onSuccess: async (goal) => {
      await invalidateGoalData();
      setEditOpen(false);
      setFilter(goal.status);
      show('目标已更新');
      void navigate(`/features/goals/${goal.id}`);
    },
  });
  const addMeasurement = useMutation({
    mutationFn: (goal: Goal) =>
      goalApi.addMeasurement(goal.id, {
        value: Number(measurement.value),
        note: measurement.note,
        version: goal.version,
      }),
    onSuccess: async () => {
      await invalidateGoalData();
      setMeasurement({ value: '', note: '' });
      show('当前数值已记录');
    },
  });
  const archive = useMutation({
    mutationFn: (goal: Goal) => goalApi.archive(goal.id, goal.version),
    onSuccess: async () => {
      await invalidateGoalData();
      setArchiveOpen(false);
      show('目标已归档');
      void navigate('/features/goals', { replace: true });
    },
  });
  const restore = useMutation({
    mutationFn: (goal: Goal) => goalApi.restore(goal.id, goal.version),
    onSuccess: async (goal) => {
      await invalidateGoalData();
      setFilter(goal.status);
      show('目标已恢复');
      void navigate(`/features/goals/${goal.id}`, { replace: true });
    },
  });
  const permanentDelete = useMutation({
    mutationFn: (goal: Goal) => goalApi.deletePermanently(goal.id, goal.version),
    onSuccess: async () => {
      await invalidateGoalData();
      setDeleteOpen(false);
      show('目标已永久删除');
      void navigate('/features/goals', { replace: true });
    },
  });

  const mutationError =
    create.error ??
    update.error ??
    addMeasurement.error ??
    archive.error ??
    restore.error ??
    permanentDelete.error;

  const changeFilter = (status: GoalStatus): void => {
    setFilter(status);
    void navigate('/features/goals');
  };

  return (
    <div className="feature-shell-page feature-shell-page--goals">
      <header className="feature-hero feature-hero--goals">
        <div>
          <p className="eyebrow">目标与复盘</p>
          <h2>目标管理</h2>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} /> 添加目标
        </button>
      </header>

      {mutationError ? (
        <SectionError title="操作没有完成" message={humanizeApiError(mutationError)} />
      ) : null}

      <div className="lifecycle-tabs" aria-label="目标状态">
        {(['active', 'completed', 'archived'] as const).map((status) => (
          <button
            type="button"
            key={status}
            className={filter === status ? 'active' : ''}
            onClick={() => changeFilter(status)}
          >
            {statusLabels[status]}
          </button>
        ))}
        <span>{goals.length} 项</span>
      </div>

      <div className={`entity-workspace ${selected ? 'entity-workspace--detail' : ''}`}>
        <section className="entity-list-panel" aria-label="目标列表">
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : list.isLoading ? (
            <div className="skeleton-list">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : goals.length ? (
            <div className="entity-card-list">
              {goals.map((goal) => (
                <Link
                  className={`entity-card ${goal.id === goalId ? 'active' : ''}`}
                  to={`/features/goals/${goal.id}`}
                  key={goal.id}
                >
                  <span className="entity-card__icon">
                    <Target size={20} />
                  </span>
                  <span className="entity-card__main">
                    <span className="entity-card__kicker">
                      {periodLabels[goal.periodType]} · {goal.periodLabel}
                    </span>
                    <strong>{goal.title}</strong>
                    <span className="progress-track">
                      <span style={{ width: `${goal.progress}%` }} />
                    </span>
                  </span>
                  <b>{goal.progress}%</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={`还没有${statusLabels[filter]}的目标`}
              description={
                filter === 'archived'
                  ? '不再跟进的目标可以归档保留。'
                  : '从一个明确周期和可验证结果开始。'
              }
              action={
                filter !== 'archived' ? (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => setCreateOpen(true)}
                  >
                    创建目标
                  </button>
                ) : undefined
              }
            />
          )}
        </section>

        <section className="entity-detail-panel" aria-label="目标详情">
          {detail.isError ? (
            <SectionError
              message={humanizeApiError(detail.error)}
              onRetry={() => void detail.refetch()}
            />
          ) : selected ? (
            <GoalDetail
              goal={selected}
              measurement={measurement}
              measuring={addMeasurement.isPending}
              onMeasurementChange={setMeasurement}
              onMeasure={() => addMeasurement.mutate(selected)}
              onBack={() => void navigate('/features/goals')}
              onEdit={() => setEditOpen(true)}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : (
            <div className="entity-detail-placeholder">
              <Target size={46} />
              <h3>选择一个目标</h3>
              <p>进度、关键结果和数值轨迹会显示在这里。</p>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={createOpen}
        title="添加目标"
        description="先定义周期和完成证据，后续都可以修改。"
        onClose={() => setCreateOpen(false)}
        className="modal--wide"
      >
        <GoalForm
          submitting={create.isPending}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑目标"
        onClose={() => setEditOpen(false)}
        className="modal--wide"
      >
        {selected ? (
          <GoalForm
            goal={selected}
            submitting={update.isPending}
            onSubmit={async (input) => {
              await update.mutateAsync({ goal: selected, input });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={archiveOpen}
        title="归档目标"
        description="目标和数值历史会保留，可以随时恢复。"
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
        <p>归档后，该目标不会继续出现在总览和搜索中。</p>
      </Modal>
      <Modal
        open={deleteOpen}
        title="永久删除目标"
        description="这个操作无法撤销，数值记录和关键结果也会一并删除。"
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
        <p>只有已归档目标可以永久删除。</p>
      </Modal>
    </div>
  );
}

function GoalDetail({
  goal,
  measurement,
  measuring,
  onMeasurementChange,
  onMeasure,
  onBack,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  goal: Goal;
  measurement: { value: string; note: string };
  measuring: boolean;
  onMeasurementChange(value: { value: string; note: string }): void;
  onMeasure(): void;
  onBack(): void;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
}): React.JSX.Element {
  return (
    <div className="entity-detail">
      <button type="button" className="mobile-back" onClick={onBack}>
        <ArrowLeft size={17} /> 返回目标
      </button>
      <header className="entity-detail__header">
        <div>
          <span
            className={`source-pill ${goal.status === 'completed' ? 'source-pill--completed' : goal.status === 'archived' ? 'source-pill--archived' : ''}`}
          >
            {statusLabels[goal.status]}
          </span>
          <p className="eyebrow">
            {periodLabels[goal.periodType]} · {goal.periodLabel}
          </p>
          <h2>{goal.title}</h2>
          <p>{goal.description || `${goal.startDate} 至 ${goal.endDate}`}</p>
        </div>
        <div className="entity-detail__actions">
          {goal.status === 'archived' ? (
            <>
              <button type="button" className="button button--quiet" onClick={onRestore}>
                <ArchiveRestore size={16} /> 恢复
              </button>
              <button type="button" className="button button--danger" onClick={onDelete}>
                <Trash2 size={16} /> 永久删除
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button button--quiet" onClick={onEdit}>
                <Edit3 size={16} /> 编辑
              </button>
              <button type="button" className="button button--quiet" onClick={onArchive}>
                <Archive size={16} /> 归档
              </button>
            </>
          )}
        </div>
      </header>

      <section className="goal-progress-panel">
        <div className="goal-progress-panel__number">
          <strong>{goal.progress}</strong>
          <span>%</span>
          <small>当前进度</small>
        </div>
        <div className="goal-progress-panel__track">
          <span style={{ width: `${goal.progress}%` }} />
        </div>
        <div className="goal-progress-panel__dates">
          <span>{goal.startDate}</span>
          <span>{goal.endDate}</span>
        </div>
      </section>

      {goal.metric ? (
        <section className="detail-section">
          <div className="detail-section__heading">
            <div>
              <p className="eyebrow">数据轨迹</p>
              <h3>
                {goal.metric.currentValue.toLocaleString()} {goal.metric.unit}
              </h3>
            </div>
            <TrendingUp size={22} />
          </div>
          <div className="metric-strip">
            <span>
              起始{' '}
              <strong>
                {goal.metric.startValue} {goal.metric.unit}
              </strong>
            </span>
            <span>
              当前{' '}
              <strong>
                {goal.metric.currentValue} {goal.metric.unit}
              </strong>
            </span>
            <span>
              目标{' '}
              <strong>
                {goal.metric.targetValue} {goal.metric.unit}
              </strong>
            </span>
          </div>
          <GoalTrendChart measurements={goal.measurements ?? []} unit={goal.metric.unit} />
          {goal.status !== 'archived' ? (
            <form
              className="quick-measure"
              onSubmit={(event) => {
                event.preventDefault();
                onMeasure();
              }}
            >
              <label className="field">
                <span>快捷记录当前值</span>
                <input
                  required
                  type="number"
                  step="any"
                  value={measurement.value}
                  onChange={(event) =>
                    onMeasurementChange({ ...measurement, value: event.target.value })
                  }
                  placeholder={String(goal.metric.currentValue)}
                />
              </label>
              <label className="field">
                <span>备注</span>
                <input
                  maxLength={500}
                  value={measurement.note}
                  onChange={(event) =>
                    onMeasurementChange({ ...measurement, note: event.target.value })
                  }
                  placeholder="可选，例如：晨起空腹"
                />
              </label>
              <button type="submit" className="button button--primary" disabled={measuring}>
                {measuring ? '记录中…' : '记录数值'}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="detail-section">
        <div className="detail-section__heading">
          <div>
            <p className="eyebrow">完成证据</p>
            <h3>关键结果</h3>
          </div>
          <CheckCircle2 size={22} />
        </div>
        {goal.keyResults.length ? (
          <div className="key-result-list">
            {goal.keyResults.map((item) => (
              <article key={item.id}>
                <span className={item.completed ? 'complete' : ''}>
                  <CheckCircle2 size={18} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <div className="progress-track">
                    <span style={{ width: `${item.completed ? 100 : item.progress}%` }} />
                  </div>
                </div>
                <b>{item.completed ? 100 : item.progress}%</b>
              </article>
            ))}
          </div>
        ) : (
          <p className="detail-muted">这个目标尚未设置关键结果。</p>
        )}
      </section>
    </div>
  );
}
