import type { Subscription, SubscriptionInput } from '@workspace/client-sdk';
import { useState } from 'react';

export const subscriptionCategoryLabels = {
  software: '软件',
  membership: '会员',
  domain: '域名',
  server: '服务器',
  other: '其他',
} as const;
export const billingCycleLabels = { monthly: '每月', quarterly: '每季度', yearly: '每年' } as const;

interface SubscriptionFormState {
  name: string;
  category: SubscriptionInput['category'];
  amount: string;
  currency: string;
  billingCycle: SubscriptionInput['billingCycle'];
  renewalDate: string;
  autoRenew: boolean;
  note: string;
  status: NonNullable<SubscriptionInput['status']>;
}

export function SubscriptionForm({
  subscription,
  submitting,
  onSubmit,
}: {
  subscription?: Subscription;
  submitting: boolean;
  onSubmit(input: SubscriptionInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState<SubscriptionFormState>({
    name: subscription?.name ?? '',
    category: subscription?.category ?? 'software',
    amount: String(subscription?.amount ?? 0),
    currency: subscription?.currency ?? 'CNY',
    billingCycle: subscription?.billingCycle ?? 'monthly',
    renewalDate: subscription?.renewalDate ?? '',
    autoRenew: subscription?.autoRenew ?? false,
    note: subscription?.note ?? '',
    status: subscription?.status === 'expired' ? 'expired' : 'active',
  });
  const set = <K extends keyof SubscriptionFormState>(
    name: K,
    value: SubscriptionFormState[K],
  ): void => setForm((current) => ({ ...current, [name]: value }));
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          name: form.name.trim(),
          category: form.category,
          amount: Number(form.amount) || 0,
          currency: form.currency.trim().toUpperCase(),
          billingCycle: form.billingCycle,
          renewalDate: form.renewalDate,
          autoRenew: form.autoRenew,
          note: form.note,
          status: form.status,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>订阅名称</span>
          <input
            required
            autoFocus
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </label>
        <label className="field">
          <span>分类</span>
          <select
            value={form.category}
            onChange={(event) =>
              set('category', event.target.value as SubscriptionFormState['category'])
            }
          >
            {Object.entries(subscriptionCategoryLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>金额</span>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => set('amount', event.target.value)}
          />
        </label>
        <label className="field">
          <span>货币</span>
          <input
            required
            maxLength={3}
            value={form.currency}
            onChange={(event) => set('currency', event.target.value)}
          />
        </label>
        <label className="field">
          <span>计费周期</span>
          <select
            value={form.billingCycle}
            onChange={(event) =>
              set('billingCycle', event.target.value as SubscriptionFormState['billingCycle'])
            }
          >
            {Object.entries(billingCycleLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>续费日期</span>
          <input
            required
            type="date"
            value={form.renewalDate}
            onChange={(event) => set('renewalDate', event.target.value)}
          />
        </label>
        <label className="field">
          <span>状态</span>
          <select
            value={form.status}
            onChange={(event) =>
              set('status', event.target.value as SubscriptionFormState['status'])
            }
          >
            <option value="active">生效中</option>
            <option value="expired">已到期</option>
          </select>
        </label>
        <label className="check-field entity-form__wide">
          <input
            type="checkbox"
            checked={form.autoRenew}
            onChange={(event) => set('autoRenew', event.target.checked)}
          />
          <span>自动续费</span>
        </label>
        <label className="field entity-form__wide">
          <span>备注</span>
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) => set('note', event.target.value)}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? '正在保存…' : subscription ? '保存修改' : '添加订阅'}
        </button>
      </div>
    </form>
  );
}
