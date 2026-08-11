import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, LockKeyhole, TimerReset } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { humanizeApiError } from '../../platform/api/client.js';
import { isSafeReturnTo, useAuth } from '../../platform/auth/AuthProvider.js';

interface LoginForm {
  username: 'owner';
  password: string;
  remember: boolean;
}

export function LoginPage(): React.JSX.Element {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const returnTo = params.get('returnTo');
  const form = useForm<LoginForm>({
    defaultValues: { username: 'owner', password: '', remember: true },
  });
  const mutation = useMutation({
    mutationFn: (input: LoginForm) => login(input),
    onSuccess: () => navigate(isSafeReturnTo(returnTo) ? returnTo : '/', { replace: true }),
  });

  if (session) return <Navigate to={isSafeReturnTo(returnTo) ? returnTo : '/'} replace />;

  return (
    <main className="login-page">
      <section className="login-story" aria-label="工作台说明">
        <div className="login-story__brand">
          <span className="brand-mark brand-mark--light" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>个人工作台</span>
        </div>
        <div className="login-story__copy">
          <p className="eyebrow">你的时间，只在一处展开</p>
          <h1>
            重要的日子，
            <br />
            不必靠记忆保管。
          </h1>
          <p>同一个工作台，在电脑和 Android 浏览器中保持一致。登录一次，继续使用。</p>
        </div>
        <div className="login-time-rail" aria-hidden="true">
          <span className="login-time-rail__line" />
          <div>
            <small>现在</small>
            <strong>整理今天</strong>
          </div>
          <div>
            <small>接下来</small>
            <strong>看见时间节点</strong>
          </div>
          <div>
            <small>以后</small>
            <strong>持续增加功能</strong>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__icon">
            <TimerReset aria-hidden="true" />
          </div>
          <p className="eyebrow">固定所有者账户</p>
          <h2>登录工作台</h2>
          <p className="login-card__intro">用户名已经固定，只需输入部署时设置的密码。</p>

          <form
            onSubmit={(event) => void form.handleSubmit((value) => mutation.mutate(value))(event)}
          >
            <label className="field">
              <span>账户</span>
              <div className="input-shell">
                <LockKeyhole aria-hidden="true" size={18} />
                <input {...form.register('username')} autoComplete="username" readOnly />
              </div>
            </label>
            <label className="field">
              <span>密码</span>
              <div className="input-shell">
                <input
                  {...form.register('password', { required: '请输入密码' })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
              {form.formState.errors.password ? (
                <small className="field-error">{form.formState.errors.password.message}</small>
              ) : null}
            </label>
            <label className="checkbox-row">
              <input type="checkbox" {...form.register('remember')} />
              <span>
                <strong>记住此设备</strong>
                <small>当前浏览器保持长期登录，最长 365 天</small>
              </span>
            </label>
            {mutation.isError ? (
              <div className="form-error" role="alert">
                {humanizeApiError(mutation.error)}
              </div>
            ) : null}
            <button
              type="submit"
              className="button button--primary button--large"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                '正在登录…'
              ) : (
                <>
                  登录工作台 <ArrowRight aria-hidden="true" size={18} />
                </>
              )}
            </button>
          </form>
          <p className="login-card__note">
            没有注册和找回密码入口。忘记密码时需要在服务器上执行重置命令。
          </p>
        </div>
      </section>
    </main>
  );
}
