import type { SessionView, WorkbenchPreferences } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Check,
  DatabaseBackup,
  Eye,
  EyeOff,
  Grid2X2,
  Laptop,
  LogOut,
  Moon,
  Pencil,
  Server,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { humanizeApiError, queryClient, workbenchClient } from '../../platform/api/client.js';
import { useAuth } from '../../platform/auth/AuthProvider.js';
import { usePreferences } from '../../platform/preferences/usePreferences.js';
import { formatDateTime, formatRelativeTime } from '../../platform/time/format.js';
import { SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { featureCatalog } from '../feature-catalog.js';
import { FeatureIcon } from '../../components/ui/FeatureIcon.js';

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function SettingsPage(): React.JSX.Element {
  const { logout } = useAuth();
  const { preferences, save, saving } = usePreferences();
  const { show } = useToast();
  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => workbenchClient.listSessions(),
  });
  const status = useQuery({
    queryKey: ['workbench', 'system-status'],
    queryFn: () => workbenchClient.getSystemStatus(),
  });
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState('');
  const passwordForm = useForm<PasswordForm>();
  const rename = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      workbenchClient.renameSession(id, label),
    onSuccess: () => {
      setEditingSession(null);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      show('登录会话名称已更新');
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => workbenchClient.revokeSession(id),
    onSuccess: (_value, id) => {
      const current = sessions.data?.find((session) => session.sessionId === id)?.current;
      if (current) window.dispatchEvent(new CustomEvent('workbench:unauthorized'));
      else void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      show(current ? '当前会话已退出' : '登录会话已撤销');
    },
  });
  const logoutOthers = useMutation({
    mutationFn: () => workbenchClient.logoutOtherSessions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      show('其他登录会话已退出');
    },
  });
  const changePassword = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordForm) =>
      workbenchClient.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      show('密码已修改，请重新登录');
      window.dispatchEvent(new CustomEvent('workbench:unauthorized'));
    },
  });

  const updatePreference = async <K extends keyof WorkbenchPreferences>(
    key: K,
    value: WorkbenchPreferences[K],
  ): Promise<void> => {
    await save({ ...preferences, [key]: value });
    show('设置已保存');
  };

  return (
    <div className="settings-page page-stack">
      <header className="page-intro">
        <div>
          <p className="eyebrow">owner</p>
          <h2>账户、外观与运行状态。</h2>
          <p>这里只保存工作台共同需要的设置；功能自己的选项留在功能内部。</p>
        </div>
        <button type="button" className="button button--quiet" onClick={() => void logout()}>
          <LogOut aria-hidden="true" size={17} /> 退出当前会话
        </button>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card__heading">
            <span>
              <Sun aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">外观</p>
              <h2>主题与时间表达</h2>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>主题模式</strong>
              <small>在所有设备间同步</small>
            </div>
            <div className="segmented-control" aria-label="主题模式">
              {(['dark', 'light'] as const).map((theme) => (
                <button
                  type="button"
                  className={preferences.theme === theme ? 'active' : ''}
                  key={theme}
                  disabled={saving}
                  onClick={() => void updatePreference('theme', theme)}
                >
                  {theme === 'light' ? (
                    <>
                      <Sun aria-hidden="true" />
                      浅色
                    </>
                  ) : (
                    <>
                      <Moon aria-hidden="true" />
                      深色
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>时间显示</strong>
              <small>相对时间或完整日期</small>
            </div>
            <select
              aria-label="时间显示"
              value={preferences.dateDisplay}
              onChange={(event) =>
                void updatePreference(
                  'dateDisplay',
                  event.target.value as WorkbenchPreferences['dateDisplay'],
                )
              }
            >
              <option value="relative">优先相对时间</option>
              <option value="absolute">优先完整日期</option>
            </select>
          </div>
          <div className="setting-row">
            <div>
              <strong>自动刷新</strong>
              <small>0 表示只手动刷新</small>
            </div>
            <select
              aria-label="自动刷新间隔"
              value={preferences.refreshIntervalMinutes}
              onChange={(event) =>
                void updatePreference(
                  'refreshIntervalMinutes',
                  Number(event.target.value) as WorkbenchPreferences['refreshIntervalMinutes'],
                )
              }
            >
              {[0, 1, 5, 15, 30].map((value) => (
                <option value={value} key={value}>
                  {value === 0 ? '关闭' : `${value} 分钟`}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="settings-card settings-card--wide">
          <div className="settings-card__heading">
            <span>
              <Grid2X2 aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">侧边栏</p>
              <h2>显示的功能模块</h2>
            </div>
          </div>
          <p className="settings-card__description">
            功能默认显示在侧边栏。隐藏后仍可从功能目录和搜索进入，数据不会受到影响。
          </p>
          <div className="feature-visibility-list">
            {featureCatalog.map((feature) => {
              const visible = !preferences.hiddenFeatureIds.includes(feature.featureId);
              return (
                <label className="feature-visibility-row" key={feature.featureId}>
                  <span className="feature-visibility-row__icon">
                    <FeatureIcon name={feature.icon} size={20} />
                  </span>
                  <span>
                    <strong>{feature.name}</strong>
                    <small>{visible ? '显示在侧边栏' : '已从侧边栏隐藏'}</small>
                  </span>
                  <span className="feature-visibility-row__state" aria-hidden="true">
                    {visible ? <Eye size={17} /> : <EyeOff size={17} />}
                  </span>
                  <input
                    type="checkbox"
                    checked={visible}
                    disabled={saving}
                    aria-label={`在侧边栏显示${feature.name}`}
                    onChange={() => {
                      const hiddenFeatureIds = visible
                        ? [...preferences.hiddenFeatureIds, feature.featureId]
                        : preferences.hiddenFeatureIds.filter((id) => id !== feature.featureId);
                      void updatePreference('hiddenFeatureIds', hiddenFeatureIds);
                    }}
                  />
                </label>
              );
            })}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card__heading">
            <span>
              <Server aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">系统状态</p>
              <h2>服务与备份</h2>
            </div>
          </div>
          {status.isError ? (
            <SectionError
              message={humanizeApiError(status.error)}
              onRetry={() => void status.refetch()}
            />
          ) : status.data ? (
            <dl className="status-list">
              <div>
                <dt>服务连接</dt>
                <dd>
                  <i className="status-dot status-dot--ok" />
                  正常
                </dd>
              </div>
              <div>
                <dt>应用版本</dt>
                <dd>{status.data.version}</dd>
              </div>
              <div>
                <dt>数据库迁移</dt>
                <dd>{status.data.databaseMigration}</dd>
              </div>
              <div>
                <dt>工作区</dt>
                <dd className="mono" title={status.data.workspaceId}>
                  {status.data.workspaceId.slice(0, 8)}…
                </dd>
              </div>
              <div>
                <dt>最近成功备份</dt>
                <dd>
                  {status.data.lastSuccessfulBackupAt
                    ? formatRelativeTime(status.data.lastSuccessfulBackupAt)
                    : '尚无已记录备份'}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="skeleton skeleton--settings" />
          )}
          <div className="backup-note">
            <DatabaseBackup aria-hidden="true" />
            <p>
              <strong>备份通过服务器命令创建</strong>
              <span>网页只展示状态，避免在普通页面执行恢复或覆盖操作。</span>
              <code>npm run backup:create</code>
            </p>
          </div>
        </section>
      </div>

      <section className="settings-card settings-card--wide">
        <div className="settings-card__heading">
          <span>
            <Laptop aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">安全会话</p>
            <h2>登录会话</h2>
            <p>每个浏览器是一条独立会话，不使用硬件指纹。</p>
          </div>
          <button
            type="button"
            className="button button--quiet"
            disabled={logoutOthers.isPending || (sessions.data?.length ?? 0) <= 1}
            onClick={() => logoutOthers.mutate()}
          >
            退出其他会话
          </button>
        </div>
        {sessions.isError ? (
          <SectionError
            message={humanizeApiError(sessions.error)}
            onRetry={() => void sessions.refetch()}
          />
        ) : (
          <div className="session-list">
            {sessions.data?.map((session) => (
              <SessionRow
                key={session.sessionId}
                session={session}
                editing={editingSession === session.sessionId}
                draftLabel={sessionLabel}
                onStartEdit={() => {
                  setEditingSession(session.sessionId);
                  setSessionLabel(session.clientLabel);
                }}
                onLabelChange={setSessionLabel}
                onSave={() => rename.mutate({ id: session.sessionId, label: sessionLabel })}
                onCancel={() => setEditingSession(null)}
                onRevoke={() => revoke.mutate(session.sessionId)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="settings-card settings-card--wide">
        <div className="settings-card__heading">
          <span>
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">固定 owner</p>
            <h2>修改密码</h2>
            <p>修改后全部登录会话立即失效，包括当前会话。</p>
          </div>
        </div>
        <form
          className="password-form"
          onSubmit={(event) =>
            void passwordForm.handleSubmit((value) => {
              if (value.newPassword !== value.confirmPassword) {
                passwordForm.setError('confirmPassword', { message: '两次输入的新密码不一致' });
                return;
              }
              changePassword.mutate(value);
            })(event)
          }
        >
          <label className="field">
            <span>当前密码</span>
            <input
              type="password"
              autoComplete="current-password"
              {...passwordForm.register('currentPassword', { required: '请输入当前密码' })}
            />
          </label>
          <label className="field">
            <span>新密码</span>
            <input
              type="password"
              autoComplete="new-password"
              {...passwordForm.register('newPassword', {
                required: '请输入新密码',
                minLength: { value: 12, message: '至少需要 12 个字符' },
              })}
            />
            {passwordForm.formState.errors.newPassword ? (
              <small className="field-error">
                {passwordForm.formState.errors.newPassword.message}
              </small>
            ) : null}
          </label>
          <label className="field">
            <span>确认新密码</span>
            <input
              type="password"
              autoComplete="new-password"
              {...passwordForm.register('confirmPassword', { required: '请再次输入新密码' })}
            />
            {passwordForm.formState.errors.confirmPassword ? (
              <small className="field-error">
                {passwordForm.formState.errors.confirmPassword.message}
              </small>
            ) : null}
          </label>
          <button
            type="submit"
            className="button button--primary"
            disabled={changePassword.isPending}
          >
            <Check aria-hidden="true" size={17} />
            {changePassword.isPending ? '正在修改' : '修改密码'}
          </button>
          {changePassword.isError ? (
            <div className="form-error" role="alert">
              {humanizeApiError(changePassword.error)}
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}

function SessionRow({
  session,
  editing,
  draftLabel,
  onStartEdit,
  onLabelChange,
  onSave,
  onCancel,
  onRevoke,
}: {
  session: SessionView;
  editing: boolean;
  draftLabel: string;
  onStartEdit(): void;
  onLabelChange(value: string): void;
  onSave(): void;
  onCancel(): void;
  onRevoke(): void;
}): React.JSX.Element {
  return (
    <div className="session-row">
      <span className="session-row__icon">
        <Laptop aria-hidden="true" />
      </span>
      <div className="session-row__content">
        {editing ? (
          <div className="session-edit">
            <input
              value={draftLabel}
              maxLength={80}
              aria-label="会话名称"
              onChange={(event) => onLabelChange(event.target.value)}
            />
            <button type="button" className="button button--quiet" onClick={onSave}>
              保存
            </button>
            <button type="button" className="button button--text" onClick={onCancel}>
              取消
            </button>
          </div>
        ) : (
          <>
            <span>
              <strong>{session.clientLabel}</strong>
              {session.current ? <i>当前会话</i> : null}
            </span>
            <small>
              最近活动 {formatRelativeTime(session.lastSeenAt)} · 最晚{' '}
              {formatDateTime(session.absoluteExpiresAt)} 到期
            </small>
          </>
        )}
      </div>
      <div className="session-row__actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`重命名 ${session.clientLabel}`}
          onClick={onStartEdit}
        >
          <Pencil aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          aria-label={`撤销 ${session.clientLabel}`}
          onClick={onRevoke}
        >
          {session.current ? <LogOut aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
