import type {
  FinanceAccount,
  FinanceAccountInput,
  FinanceAccountType,
  FinanceDebtPlatform,
  FinanceDebtPlatformInput,
  FinanceDebtRecord,
  FinanceDebtRecordInput,
} from '@workspace/client-sdk';
import { useState } from 'react';

export const accountTypeLabels = {
  cash: '现金',
  alipay: '支付宝',
  wechat: '微信',
  bank: '银行卡',
  credit: '信用卡',
  'digital-cny': '数字人民币',
  other: '其他',
} as const satisfies Record<FinanceAccountType, string>;
export function FinanceAccountForm({
  account,
  submitting,
  onSubmit,
}: {
  account?: FinanceAccount;
  submitting: boolean;
  onSubmit(input: FinanceAccountInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    type: account?.type ?? 'bank',
    name: account?.name ?? '',
    balance: String(account?.balance ?? 0),
    cardNumber: account?.cardNumber ?? '',
    phone: account?.phone ?? '',
    creditLimit: String(account?.creditLimit ?? 0),
    note: account?.note ?? '',
  });
  const showName = ['bank', 'credit', 'digital-cny', 'other'].includes(form.type);
  const showCardNumber = form.type === 'bank' || form.type === 'digital-cny';
  const showPhone = form.type === 'alipay' || form.type === 'wechat';
  const showBalance = form.type !== 'credit';
  const showCreditLimit = form.type === 'credit';

  const accountInput = (): FinanceAccountInput => {
    const common = { type: form.type, note: form.note };
    if (form.type === 'cash') return { ...common, balance: Number(form.balance) || 0 };
    if (form.type === 'alipay' || form.type === 'wechat') {
      return {
        ...common,
        phone: form.phone.trim(),
        balance: Number(form.balance) || 0,
      };
    }
    if (form.type === 'bank' || form.type === 'digital-cny') {
      return {
        ...common,
        name: form.name.trim(),
        cardNumber: form.cardNumber.trim(),
        balance: Number(form.balance) || 0,
      };
    }
    if (form.type === 'credit') {
      return {
        ...common,
        name: form.name.trim(),
        creditLimit: Number(form.creditLimit) || 0,
      };
    }
    return { ...common, name: form.name.trim(), balance: Number(form.balance) || 0 };
  };
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(accountInput());
      }}
    >
      <div className="entity-form__grid">
        <label className="field">
          <span>账户类型</span>
          <select
            value={form.type}
            onChange={(event) =>
              setForm({ ...form, type: event.target.value as FinanceAccountType })
            }
          >
            {Object.entries(accountTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {showName ? (
          <label className="field">
            <span>名称</span>
            <input
              required
              autoFocus
              value={form.name}
              placeholder={form.type === 'credit' ? '例如：日常信用卡' : '例如：工资卡'}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
        ) : null}
        {showCardNumber ? (
          <label className="field">
            <span>卡号</span>
            <input
              required
              inputMode="numeric"
              autoComplete="off"
              value={form.cardNumber}
              placeholder="输入完整卡号"
              onChange={(event) => setForm({ ...form, cardNumber: event.target.value })}
            />
          </label>
        ) : null}
        {showPhone ? (
          <label className="field">
            <span>手机号</span>
            <input
              required
              autoFocus
              type="tel"
              autoComplete="tel"
              value={form.phone}
              placeholder="绑定的手机号"
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
        ) : null}
        {showBalance ? (
          <label className={`field ${form.type === 'cash' ? 'entity-form__wide' : ''}`}>
            <span>余额</span>
            <input
              required
              autoFocus={form.type === 'cash'}
              type="number"
              step="0.01"
              value={form.balance}
              onChange={(event) => setForm({ ...form, balance: event.target.value })}
            />
          </label>
        ) : null}
        {showCreditLimit ? (
          <label className="field">
            <span>额度</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.creditLimit}
              onChange={(event) => setForm({ ...form, creditLimit: event.target.value })}
            />
          </label>
        ) : null}
      </div>
      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : account ? '保存账户' : '添加账户'}
        </button>
      </div>
    </form>
  );
}

export function FinanceDebtPlatformForm({
  platform,
  submitting,
  onSubmit,
}: {
  platform?: FinanceDebtPlatform;
  submitting: boolean;
  onSubmit(input: FinanceDebtPlatformInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    name: platform?.name ?? '',
    billingDay: String(platform?.billingDay ?? ''),
    repaymentDay: String(platform?.repaymentDay ?? ''),
    fixedLimit: String(platform?.fixedLimit ?? 0),
    temporaryLimit: String(platform?.temporaryLimit ?? 0),
    remainingLimit: String(platform?.remainingLimit ?? 0),
    note: platform?.note ?? '',
  });
  const set = (name: keyof typeof form, value: string): void =>
    setForm((current) => ({ ...current, [name]: value }));
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          name: form.name.trim(),
          billingDay: form.billingDay ? Number(form.billingDay) : null,
          repaymentDay: form.repaymentDay ? Number(form.repaymentDay) : null,
          fixedLimit: Number(form.fixedLimit) || 0,
          temporaryLimit: Number(form.temporaryLimit) || 0,
          remainingLimit: Number(form.remainingLimit) || 0,
          note: form.note,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>平台名称</span>
          <input
            required
            autoFocus
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </label>
        <label className="field">
          <span>账单日</span>
          <input
            type="number"
            min="1"
            max="31"
            value={form.billingDay}
            onChange={(event) => set('billingDay', event.target.value)}
          />
        </label>
        <label className="field">
          <span>还款日</span>
          <input
            type="number"
            min="1"
            max="31"
            value={form.repaymentDay}
            onChange={(event) => set('repaymentDay', event.target.value)}
          />
        </label>
        <label className="field">
          <span>固定额度</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.fixedLimit}
            onChange={(event) => set('fixedLimit', event.target.value)}
          />
        </label>
        <label className="field">
          <span>临时额度</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.temporaryLimit}
            onChange={(event) => set('temporaryLimit', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>剩余额度</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.remainingLimit}
            onChange={(event) => set('remainingLimit', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>备注</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) => set('note', event.target.value)}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : platform ? '保存平台' : '添加平台'}
        </button>
      </div>
    </form>
  );
}

export function FinanceDebtRecordForm({
  platforms,
  record,
  year,
  month,
  submitting,
  onSubmit,
}: {
  platforms: Array<Pick<FinanceDebtPlatform, 'id' | 'name'>>;
  record?: FinanceDebtRecord;
  year: number;
  month: number;
  submitting: boolean;
  onSubmit(input: FinanceDebtRecordInput): Promise<void>;
}): React.JSX.Element {
  const [platformId, setPlatformId] = useState(record?.platformId ?? platforms[0]?.id ?? '');
  const [amount, setAmount] = useState(String(record?.amount ?? 0));
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          platformId,
          year,
          month,
          amount: Number(amount) || 0,
          ...(record ? { version: record.version } : {}),
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field">
          <span>负债平台</span>
          <select
            required
            value={platformId}
            onChange={(event) => setPlatformId(event.target.value)}
          >
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>本月负债</span>
          <input
            autoFocus
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={submitting || !platformId}
        >
          {submitting ? '正在保存…' : '保存月度负债'}
        </button>
      </div>
    </form>
  );
}
