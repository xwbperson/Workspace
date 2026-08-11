import type {
  FinanceDebtPlatform,
  FinanceDebtRecord,
  FinanceDebtRecordInput,
} from '@workspace/client-sdk';
import { Check, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { useState } from 'react';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const DEBT_ROWS = [...MONTHS, 0] as const;

function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}

function monthLabel(month: number): string {
  return month === 0 ? '未入账' : `${month}月`;
}

export function AnnualDebtTable({
  year,
  onYearChange,
  platforms,
  records,
  saving,
  onSave,
}: {
  year: number;
  onYearChange(year: number): void;
  platforms: Array<Pick<FinanceDebtPlatform, 'id' | 'name'>>;
  records: FinanceDebtRecord[];
  saving: boolean;
  onSave(input: FinanceDebtRecordInput): Promise<void>;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const recordAt = (platformId: string, month: number): FinanceDebtRecord | undefined =>
    records.find((record) => record.platformId === platformId && record.month === month);
  const monthTotal = (month: number): number =>
    platforms.reduce((sum, platform) => sum + (recordAt(platform.id, month)?.amount ?? 0), 0);
  const platformTotal = (platformId: string): number =>
    DEBT_ROWS.reduce((sum, month) => sum + (recordAt(platformId, month)?.amount ?? 0), 0);
  const yearTotal = platforms.reduce((sum, platform) => sum + platformTotal(platform.id), 0);

  const saveCell = async (platformId: string, month: number, value: string): Promise<void> => {
    const record = recordAt(platformId, month);
    const amount = Math.max(0, Number(value) || 0);
    if (amount === (record?.amount ?? 0)) return;
    await onSave({
      platformId,
      year,
      month,
      amount,
      ...(record ? { version: record.version } : {}),
    });
  };

  return (
    <div className="annual-debt-card">
      <header>
        <div>
          <p className="eyebrow">年度视图</p>
          <h3>{year} 年负债表</h3>
          <p>按平台横向对照每月负债；“未入账”用于记录尚未进入账单月份的金额。</p>
        </div>
        <div className="annual-debt-actions">
          <div className="annual-debt-year-picker" role="group" aria-label="负债表年份">
            <button
              type="button"
              className="icon-button icon-button--small"
              disabled={saving || year <= 1900}
              aria-label="查看上一年负债"
              onClick={() => onYearChange(year - 1)}
            >
              <ChevronLeft />
            </button>
            <strong>{year} 年</strong>
            <button
              type="button"
              className="icon-button icon-button--small"
              disabled={saving || year >= 2200}
              aria-label="查看下一年负债"
              onClick={() => onYearChange(year + 1)}
            >
              <ChevronRight />
            </button>
          </div>
          <button
            type="button"
            className={editing ? 'button button--primary' : 'button button--accent'}
            disabled={saving}
            onClick={() => setEditing((current) => !current)}
            aria-label={editing ? '完成年度负债编辑' : '编辑年度负债'}
          >
            {editing ? <Check size={17} /> : <Edit3 size={17} />}
            {editing ? '完成' : '编辑'}
          </button>
        </div>
      </header>

      <div className="annual-debt-table-wrap">
        <table className="annual-debt-table" aria-label={`${year} 年负债表`}>
          <thead>
            <tr>
              <th scope="col">月份</th>
              {platforms.map((platform) => (
                <th scope="col" key={platform.id}>
                  {platform.name}
                </th>
              ))}
              <th scope="col">合计</th>
            </tr>
          </thead>
          <tbody>
            {DEBT_ROWS.map((month) => (
              <tr key={month} className={month === 0 ? 'annual-debt-table__unbilled' : undefined}>
                <th scope="row">{monthLabel(month)}</th>
                {platforms.map((platform) => {
                  const record = recordAt(platform.id, month);
                  return (
                    <td key={platform.id}>
                      {editing ? (
                        <input
                          key={`${year}:${platform.id}:${month}:${record?.version ?? 0}`}
                          aria-label={`${monthLabel(month)} ${platform.name} 负债`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={record?.amount ?? 0}
                          disabled={saving}
                          onBlur={(event) => {
                            void saveCell(platform.id, month, event.currentTarget.value).catch(
                              () => undefined,
                            );
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur();
                          }}
                        />
                      ) : (
                        <span>{money(record?.amount ?? 0)}</span>
                      )}
                    </td>
                  );
                })}
                <td>
                  <strong>{money(monthTotal(month))}</strong>
                </td>
              </tr>
            ))}
            <tr className="annual-debt-table__total">
              <th scope="row">总计</th>
              {platforms.map((platform) => (
                <td key={platform.id}>
                  <strong>{money(platformTotal(platform.id))}</strong>
                </td>
              ))}
              <td>
                <strong>{money(yearTotal)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
