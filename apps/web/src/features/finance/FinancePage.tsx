import type {
  FinanceAccount,
  FinanceAccountInput,
  FinanceDebtPlatform,
  FinanceDebtPlatformInput,
  FinanceDebtRecord,
  FinanceDebtRecordInput,
} from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  Building2,
  CreditCard,
  Edit3,
  Landmark,
  Plus,
  RotateCcw,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { financeApi, financeKeys, invalidateFinanceData } from './api.js';
import {
  accountTypeLabels,
  FinanceAccountForm,
  FinanceDebtPlatformForm,
} from './components/FinanceForms.js';
import { AnnualDebtTable } from './components/AnnualDebtTable.js';
type View = 'overview' | 'accounts' | 'debt' | 'archived';
type Editor =
  { kind: 'account'; item?: FinanceAccount } | { kind: 'platform'; item?: FinanceDebtPlatform };
type RemoveTarget =
  { kind: 'account'; item: FinanceAccount } | { kind: 'platform'; item: FinanceDebtPlatform };
function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}
function accountTitle(account: FinanceAccount): string {
  if (account.type === 'alipay' || account.type === 'wechat') {
    return account.phone ?? accountTypeLabels[account.type];
  }
  return account.name;
}
function accountReference(account: FinanceAccount): string | null {
  if (account.type === 'bank' || account.type === 'digital-cny') {
    return account.cardNumber ? `卡号 ${account.cardNumber}` : '尚未补充卡号';
  }
  return null;
}
export function FinancePage(): React.JSX.Element {
  const now = new Date();
  const [params] = useSearchParams();
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const [year, month] = period.split('-').map(Number) as [number, number];
  const [view, setView] = useState<View>(
    params.get('create') === 'account' ? 'accounts' : 'overview',
  );
  const [editor, setEditor] = useState<Editor | undefined>(
    params.get('create') === 'account' ? { kind: 'account' } : undefined,
  );
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget>();
  const { show } = useToast();
  const archived = view === 'archived';
  const summary = useQuery({
    queryKey: financeKeys.summary(year, month),
    queryFn: () => financeApi.summary(year, month),
  });
  const accounts = useQuery({
    queryKey: financeKeys.accounts(archived),
    queryFn: () => financeApi.accounts(archived),
  });
  const platforms = useQuery({
    queryKey: financeKeys.platforms(archived),
    queryFn: () => financeApi.platforms(archived),
  });
  const records = useMemo(() => summary.data?.records ?? [], [summary.data]);
  const after = async (message: string): Promise<void> => {
    await invalidateFinanceData();
    setEditor(undefined);
    setRemoveTarget(undefined);
    show(message);
  };
  const accountCreate = useMutation({
    mutationFn: (input: FinanceAccountInput) => financeApi.createAccount(input),
    onSuccess: () => after('资金账户已添加'),
  });
  const accountUpdate = useMutation({
    mutationFn: ({ item, input }: { item: FinanceAccount; input: FinanceAccountInput }) =>
      financeApi.updateAccount(item.id, { ...input, version: item.version }),
    onSuccess: () => after('资金账户已更新'),
  });
  const platformCreate = useMutation({
    mutationFn: (input: FinanceDebtPlatformInput) => financeApi.createPlatform(input),
    onSuccess: () => after('负债平台已添加'),
  });
  const platformUpdate = useMutation({
    mutationFn: ({ item, input }: { item: FinanceDebtPlatform; input: FinanceDebtPlatformInput }) =>
      financeApi.updatePlatform(item.id, { ...input, version: item.version }),
    onSuccess: () => after('负债平台已更新'),
  });
  const recordSave = useMutation({
    mutationFn: (input: FinanceDebtRecordInput) => financeApi.upsertRecord(input),
    onSuccess: () => after('负债记录已保存'),
  });
  const accountArchive = useMutation({
    mutationFn: (item: FinanceAccount) => financeApi.archiveAccount(item.id, item.version),
    onSuccess: () => after('资金账户已归档'),
  });
  const platformArchive = useMutation({
    mutationFn: (item: FinanceDebtPlatform) => financeApi.archivePlatform(item.id, item.version),
    onSuccess: () => after('负债平台已归档'),
  });
  const accountRestore = useMutation({
    mutationFn: (item: FinanceAccount) => financeApi.restoreAccount(item.id, item.version),
    onSuccess: () => after('资金账户已恢复'),
  });
  const platformRestore = useMutation({
    mutationFn: (item: FinanceDebtPlatform) => financeApi.restorePlatform(item.id, item.version),
    onSuccess: () => after('负债平台已恢复'),
  });
  const remove = useMutation({
    mutationFn: (target: RemoveTarget) =>
      target.kind === 'account'
        ? financeApi.deleteAccount(target.item.id, target.item.version)
        : financeApi.deletePlatform(target.item.id, target.item.version),
    onSuccess: () => after('记录已永久删除'),
  });
  const error =
    summary.error ??
    accounts.error ??
    platforms.error ??
    accountCreate.error ??
    accountUpdate.error ??
    platformCreate.error ??
    platformUpdate.error ??
    recordSave.error ??
    accountArchive.error ??
    platformArchive.error ??
    accountRestore.error ??
    platformRestore.error ??
    remove.error;
  return (
    <div className="feature-shell-page feature-shell-page--finance">
      {error ? <SectionError title="数据没有更新" message={humanizeApiError(error)} /> : null}
      <div className="lifecycle-tabs finance-tabs">
        {(['overview', 'accounts', 'debt', 'archived'] as const).map((item) => (
          <button
            key={item}
            className={view === item ? 'active' : ''}
            onClick={() => setView(item)}
          >
            {{ overview: '总览', accounts: '资金账户', debt: '负债管理', archived: '已归档' }[item]}
          </button>
        ))}
        <label className="finance-period-picker">
          <span>汇总月份</span>
          <input
            aria-label="汇总月份"
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          />
        </label>
      </div>
      {view === 'overview' ? (
        <FinanceOverview summary={summary.data} />
      ) : view === 'accounts' ? (
        <AccountSection
          items={accounts.data?.items ?? []}
          onCreate={() => setEditor({ kind: 'account' })}
          onEdit={(item) => setEditor({ kind: 'account', item })}
          onArchive={(item) => accountArchive.mutate(item)}
        />
      ) : view === 'debt' ? (
        <DebtSection
          year={year}
          month={month}
          onYearChange={(nextYear) => setPeriod(`${nextYear}-${String(month).padStart(2, '0')}`)}
          platforms={platforms.data?.items ?? []}
          records={records}
          savingRecord={recordSave.isPending}
          onCreatePlatform={() => setEditor({ kind: 'platform' })}
          onEditPlatform={(item) => setEditor({ kind: 'platform', item })}
          onArchivePlatform={(item) => platformArchive.mutate(item)}
          onSaveRecord={(input) => recordSave.mutateAsync(input)}
        />
      ) : (
        <ArchivedSection
          accounts={accounts.data?.items ?? []}
          platforms={platforms.data?.items ?? []}
          onRestoreAccount={(item) => accountRestore.mutate(item)}
          onRestorePlatform={(item) => platformRestore.mutate(item)}
          onDeleteAccount={(item) => setRemoveTarget({ kind: 'account', item })}
          onDeletePlatform={(item) => setRemoveTarget({ kind: 'platform', item })}
        />
      )}
      <Modal
        open={Boolean(editor)}
        title={
          editor?.kind === 'account'
            ? editor.item
              ? '编辑资金账户'
              : '添加资金账户'
            : editor?.kind === 'platform'
              ? editor.item
                ? '编辑负债平台'
                : '添加负债平台'
              : ''
        }
        onClose={() => setEditor(undefined)}
        className="modal--wide"
      >
        {editor?.kind === 'account' ? (
          <FinanceAccountForm
            key={editor.item?.id ?? 'new-account'}
            {...(editor.item ? { account: editor.item } : {})}
            submitting={accountCreate.isPending || accountUpdate.isPending}
            onSubmit={async (input) => {
              if (editor.item) {
                await accountUpdate.mutateAsync({ item: editor.item, input });
              } else {
                await accountCreate.mutateAsync(input);
              }
            }}
          />
        ) : editor?.kind === 'platform' ? (
          <FinanceDebtPlatformForm
            key={editor.item?.id ?? 'new-platform'}
            {...(editor.item ? { platform: editor.item } : {})}
            submitting={platformCreate.isPending || platformUpdate.isPending}
            onSubmit={async (input) => {
              if (editor.item) {
                await platformUpdate.mutateAsync({ item: editor.item, input });
              } else {
                await platformCreate.mutateAsync(input);
              }
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={Boolean(removeTarget)}
        title="永久删除财务记录"
        onClose={() => setRemoveTarget(undefined)}
        footer={
          <>
            <button className="button button--quiet" onClick={() => setRemoveTarget(undefined)}>
              取消
            </button>
            <button
              className="button button--danger"
              onClick={() => removeTarget && remove.mutate(removeTarget)}
            >
              永久删除
            </button>
          </>
        }
      >
        <p>该记录已归档，永久删除后无法恢复。删除负债平台也会删除它的月度记录。</p>
      </Modal>
    </div>
  );
}
function FinanceOverview({
  summary,
}: {
  summary: Awaited<ReturnType<typeof financeApi.summary>> | undefined;
}): React.JSX.Element {
  if (!summary) return <div className="skeleton skeleton--detail" />;
  const months = Array.from({ length: 12 }, (_, index) => index + 1);
  const totals = months.map((month) =>
    summary.records
      .filter((item) => item.month === month)
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const max = Math.max(1, ...totals);
  return (
    <div className="finance-overview">
      <div className="metric-card-row metric-card-row--finance">
        <div>
          <small>总资产</small>
          <strong>{money(summary.totalAssets)}</strong>
        </div>
        <div>
          <small>本月负债</small>
          <strong>{money(summary.currentMonthDebt)}</strong>
        </div>
        <div>
          <small>当前净额</small>
          <strong>{money(summary.netPosition)}</strong>
        </div>
        <div>
          <small>剩余额度</small>
          <strong>{money(summary.remainingCredit)}</strong>
        </div>
      </div>
      <section className="finance-chart-card">
        <header>
          <div>
            <p className="eyebrow">年度趋势</p>
            <h3>{summary.year} 年月度负债</h3>
          </div>
          <strong>{money(summary.yearDebt)}</strong>
        </header>
        <div className="finance-bars" aria-label={`${summary.year}年月度负债柱状图`}>
          {months.map((month, index) => (
            <div key={month}>
              <span
                style={{ height: `${Math.max(3, (totals[index]! / max) * 100)}%` }}
                title={`${month}月 ${money(totals[index]!)}`}
              />
              <small>{month}月</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function AccountSection({
  items,
  onCreate,
  onEdit,
  onArchive,
}: {
  items: FinanceAccount[];
  onCreate(): void;
  onEdit(item: FinanceAccount): void;
  onArchive(item: FinanceAccount): void;
}): React.JSX.Element {
  return (
    <section className="finance-section">
      <header>
        <div>
          <p className="eyebrow">资金账户</p>
          <h3>{items.length} 个账户</h3>
        </div>
        <button className="button button--primary" onClick={onCreate}>
          <Plus size={17} />
          添加账户
        </button>
      </header>
      {items.length ? (
        <div className="finance-card-grid">
          {items.map((item) => (
            <article key={item.id}>
              <span className="finance-icon">
                <Landmark />
              </span>
              <small>{accountTypeLabels[item.type]}</small>
              <h3>{accountTitle(item)}</h3>
              {accountReference(item) ? (
                <p className="finance-account-reference">{accountReference(item)}</p>
              ) : null}
              <strong>
                {item.type === 'credit'
                  ? `额度 ${money(item.creditLimit ?? 0)}`
                  : money(item.balance)}
              </strong>
              {item.note ? <p>{item.note}</p> : null}
              <div>
                <button
                  className="icon-button"
                  aria-label={`编辑${item.name}`}
                  onClick={() => onEdit(item)}
                >
                  <Edit3 />
                </button>
                <button
                  className="icon-button"
                  aria-label={`归档${item.name}`}
                  onClick={() => onArchive(item)}
                >
                  <Archive />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="还没有资金账户" description="先记录现金、银行卡或支付账户的当前余额。" />
      )}
    </section>
  );
}
function DebtSection({
  year,
  month,
  onYearChange,
  platforms,
  records,
  savingRecord,
  onCreatePlatform,
  onEditPlatform,
  onArchivePlatform,
  onSaveRecord,
}: {
  year: number;
  month: number;
  onYearChange(year: number): void;
  platforms: FinanceDebtPlatform[];
  records: FinanceDebtRecord[];
  savingRecord: boolean;
  onCreatePlatform(): void;
  onEditPlatform(item: FinanceDebtPlatform): void;
  onArchivePlatform(item: FinanceDebtPlatform): void;
  onSaveRecord(input: FinanceDebtRecordInput): Promise<unknown>;
}): React.JSX.Element {
  return (
    <section className="finance-section">
      <header>
        <div>
          <p className="eyebrow">负债管理</p>
          <h3>年度负债与平台额度</h3>
        </div>
        <div className="finance-heading-actions">
          <button className="button button--accent" onClick={onCreatePlatform}>
            <Plus size={17} />
            添加平台
          </button>
        </div>
      </header>
      {platforms.length ? (
        <>
          <AnnualDebtTable
            year={year}
            onYearChange={onYearChange}
            platforms={platforms}
            records={records}
            saving={savingRecord}
            onSave={async (input) => {
              await onSaveRecord(input);
            }}
          />
          <div className="finance-subheading">
            <div>
              <p className="eyebrow">平台设置</p>
              <h3>额度与当前月份</h3>
            </div>
          </div>
          <div className="debt-table">
            {platforms.map((item) => {
              const record = records.find(
                (entry) => entry.platformId === item.id && entry.month === month,
              );
              return (
                <article key={item.id}>
                  <span className="finance-icon">
                    <CreditCard />
                  </span>
                  <div>
                    <small>
                      {item.billingDay ? `${item.billingDay}日出账` : '未设置账单日'} ·{' '}
                      {item.repaymentDay ? `${item.repaymentDay}日还款` : '未设置还款日'}
                    </small>
                    <strong>{item.name}</strong>
                    <p>
                      总额度 {money(item.fixedLimit + item.temporaryLimit)} · 剩余{' '}
                      {money(item.remainingLimit)}
                    </p>
                  </div>
                  <div className="debt-value">
                    <small>{month}月负债</small>
                    <strong>{money(record?.amount ?? 0)}</strong>
                  </div>
                  <div>
                    <button
                      className="icon-button"
                      aria-label={`编辑${item.name}`}
                      onClick={() => onEditPlatform(item)}
                    >
                      <Edit3 />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`归档${item.name}`}
                      onClick={() => onArchivePlatform(item)}
                    >
                      <Archive />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title="还没有负债平台"
          description="添加信用卡、消费金融或其他负债平台后再记录月度金额。"
        />
      )}
    </section>
  );
}
function ArchivedSection({
  accounts,
  platforms,
  onRestoreAccount,
  onRestorePlatform,
  onDeleteAccount,
  onDeletePlatform,
}: {
  accounts: FinanceAccount[];
  platforms: FinanceDebtPlatform[];
  onRestoreAccount(item: FinanceAccount): void;
  onRestorePlatform(item: FinanceDebtPlatform): void;
  onDeleteAccount(item: FinanceAccount): void;
  onDeletePlatform(item: FinanceDebtPlatform): void;
}): React.JSX.Element {
  const empty = !accounts.length && !platforms.length;
  return (
    <section className="finance-section">
      <header>
        <div>
          <p className="eyebrow">归档区</p>
          <h3>不再参与汇总的记录</h3>
        </div>
      </header>
      {empty ? (
        <EmptyState title="还没有归档记录" description="归档后的账户和平台会保留在这里。" />
      ) : (
        <div className="archived-finance-list">
          {accounts.map((item) => (
            <article key={item.id}>
              <WalletCards />
              <div>
                <small>资金账户</small>
                <strong>{accountTitle(item)}</strong>
              </div>
              <button className="button button--quiet" onClick={() => onRestoreAccount(item)}>
                <RotateCcw />
                恢复
              </button>
              <button className="button button--danger" onClick={() => onDeleteAccount(item)}>
                <Trash2 />
                删除
              </button>
            </article>
          ))}
          {platforms.map((item) => (
            <article key={item.id}>
              <Building2 />
              <div>
                <small>负债平台</small>
                <strong>{item.name}</strong>
              </div>
              <button className="button button--quiet" onClick={() => onRestorePlatform(item)}>
                <RotateCcw />
                恢复
              </button>
              <button className="button button--danger" onClick={() => onDeletePlatform(item)}>
                <Trash2 />
                删除
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
