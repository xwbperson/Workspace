import type {
  FinanceDebtPlatform,
  FinanceDebtRecord,
  FinanceDebtRecordInput,
} from '@workspace/client-sdk';
import { Check, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { useRef, useState } from 'react';

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
  const [finishing, setFinishing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const pendingSaves = useRef(new Map<string, Promise<void>>());
  const recordAt = (platformId: string, month: number): FinanceDebtRecord | undefined =>
    records.find((record) => record.platformId === platformId && record.month === month);
  const cellKey = (platformId: string, month: number): string => `${platformId}:${month}`;
  const monthTotal = (month: number): number =>
    platforms.reduce((sum, platform) => sum + (recordAt(platform.id, month)?.amount ?? 0), 0);
  const platformTotal = (platformId: string): number =>
    DEBT_ROWS.reduce((sum, month) => sum + (recordAt(platformId, month)?.amount ?? 0), 0);
  const yearTotal = platforms.reduce((sum, platform) => sum + platformTotal(platform.id), 0);

  const saveCell = async (platformId: string, month: number): Promise<void> => {
    const key = cellKey(platformId, month);
    const currentSave = pendingSaves.current.get(key);
    if (currentSave) return currentSave;
    const record = recordAt(platformId, month);
    const value = drafts[key] ?? String(record?.amount ?? 0);
    const amount = Math.max(0, Number(value) || 0);
    if (amount === (record?.amount ?? 0)) return;
    const request = onSave({
      platformId,
      year,
      month,
      amount,
      ...(record ? { version: record.version } : {}),
    })
      .then(() => {
        setCellErrors((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      })
      .catch((error: unknown) => {
        setCellErrors((current) => ({
          ...current,
          [key]: error instanceof Error ? error.message : '保存失败，请重试。',
        }));
        throw error;
      })
      .finally(() => pendingSaves.current.delete(key));
    pendingSaves.current.set(key, request);
    return request;
  };

  const finishEditing = async (): Promise<void> => {
    setFinishing(true);
    const dirtyCells = platforms.flatMap((platform) =>
      DEBT_ROWS.filter((month) => {
        const key = cellKey(platform.id, month);
        return (
          key in drafts &&
          Math.max(0, Number(drafts[key]) || 0) !== (recordAt(platform.id, month)?.amount ?? 0)
        );
      }).map((month) => ({ platformId: platform.id, month })),
    );
    try {
      await Promise.all(dirtyCells.map((cell) => saveCell(cell.platformId, cell.month)));
      setEditing(false);
      setDrafts({});
      setCellErrors({});
    } catch {
      // The corresponding cell keeps its draft and shows the actionable error.
    } finally {
      setFinishing(false);
    }
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
            disabled={saving || finishing}
            onClick={() => {
              if (editing) void finishEditing();
              else {
                setDrafts({});
                setCellErrors({});
                setEditing(true);
              }
            }}
            aria-label={editing ? '完成年度负债编辑' : '编辑年度负债'}
          >
            {editing ? <Check size={17} /> : <Edit3 size={17} />}
            {finishing ? '正在保存…' : editing ? '完成' : '编辑'}
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
                  const key = cellKey(platform.id, month);
                  return (
                    <td key={platform.id}>
                      {editing ? (
                        <div className="annual-debt-cell-editor">
                          <input
                            key={`${year}:${platform.id}:${month}:${record?.version ?? 0}`}
                            aria-label={`${monthLabel(month)} ${platform.name} 负债`}
                            aria-invalid={cellErrors[key] ? 'true' : undefined}
                            aria-describedby={
                              cellErrors[key] ? `annual-debt-error-${key}` : undefined
                            }
                            type="number"
                            min="0"
                            step="0.01"
                            value={drafts[key] ?? String(record?.amount ?? 0)}
                            disabled={saving || finishing}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              setDrafts((current) => ({ ...current, [key]: value }));
                            }}
                            onBlur={() => {
                              void saveCell(platform.id, month).catch(() => undefined);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur();
                            }}
                          />
                          {cellErrors[key] ? (
                            <small id={`annual-debt-error-${key}`} role="alert">
                              {cellErrors[key]}
                            </small>
                          ) : null}
                        </div>
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
