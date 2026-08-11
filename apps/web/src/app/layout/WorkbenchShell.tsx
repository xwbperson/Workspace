import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronLeft,
  Command,
  Grid2X2,
  Home,
  Menu,
  Plus,
  Search,
  Settings,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { featureCatalog } from '../feature-catalog.js';
import { getPinnedNavigation } from '../navigation.js';
import { FeatureIcon } from '../../components/ui/FeatureIcon.js';
import { Modal } from '../../components/ui/Modal.js';
import { useAuth } from '../../platform/auth/AuthProvider.js';
import { workbenchClient } from '../../platform/api/client.js';
import { usePreferences } from '../../platform/preferences/usePreferences.js';

function readCollapsedPreference(): boolean {
  return window.localStorage.getItem('workbench.sidebar-collapsed') === 'true';
}

function pageTitle(pathname: string): { eyebrow?: string; title: string } {
  if (pathname === '/') return { eyebrow: '今天', title: '总览' };
  if (pathname.startsWith('/features/countdowns'))
    return { eyebrow: '时间与提醒', title: '倒计时' };
  if (pathname === '/features') return { title: '功能' };
  if (pathname.startsWith('/search')) return { title: '搜索' };
  if (pathname.startsWith('/notifications')) return { title: '通知' };
  if (pathname.startsWith('/settings')) return { title: '我的工作台' };
  return { title: '个人工作台' };
}

export function WorkbenchShell(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { preferences } = usePreferences();
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const page = pageTitle(location.pathname);
  const pinned = useMemo(
    () => getPinnedNavigation(preferences.pinnedFeatureIds),
    [preferences.pinnedFeatureIds],
  );
  const notifications = useQuery({
    queryKey: ['workbench', 'notifications'],
    queryFn: () => workbenchClient.getNotifications(),
    refetchInterval: 60_000,
  });
  const quickActions = useQuery({
    queryKey: ['workbench', 'quick-actions'],
    queryFn: () => workbenchClient.getQuickActions(),
    enabled: quickCreateOpen,
  });
  const unreadCount =
    notifications.data?.filter((notification) => !notification.readAt).length ?? 0;

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        void navigate('/search?focus=1');
      }
      if (event.key.toLocaleLowerCase() === 'n') {
        event.preventDefault();
        setQuickCreateOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [navigate]);

  const toggleCollapsed = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem('workbench.sidebar-collapsed', String(next));
  };

  return (
    <div className={`workbench-shell ${collapsed ? 'workbench-shell--collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside
        className={`sidebar ${mobileMenuOpen ? 'sidebar--mobile-open' : ''}`}
        aria-label="主导航"
      >
        <div className="sidebar__brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="sidebar__label brand-name">个人工作台</span>
          <button
            type="button"
            className="icon-button sidebar__mobile-close"
            aria-label="关闭导航"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <NavLink to="/" end onClick={() => setMobileMenuOpen(false)}>
            <Home aria-hidden="true" />
            <span className="sidebar__label">总览</span>
          </NavLink>
          <NavLink to="/features" onClick={() => setMobileMenuOpen(false)}>
            <Grid2X2 aria-hidden="true" />
            <span className="sidebar__label">功能</span>
          </NavLink>
          <NavLink to="/search" onClick={() => setMobileMenuOpen(false)}>
            <Search aria-hidden="true" />
            <span className="sidebar__label">搜索</span>
          </NavLink>
        </nav>

        {pinned.length > 0 ? (
          <div className="sidebar__group">
            <p className="sidebar__group-label sidebar__label">常用功能</p>
            <nav>
              {pinned.slice(0, 6).map((feature) => (
                <NavLink
                  key={feature.featureId}
                  to={feature.route}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FeatureIcon name={feature.icon} />
                  <span className="sidebar__label">{feature.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ) : null}

        <div className="sidebar__footer">
          <NavLink to="/settings" onClick={() => setMobileMenuOpen(false)}>
            <Settings aria-hidden="true" />
            <span className="sidebar__label">设置与状态</span>
          </NavLink>
          <button type="button" className="sidebar__collapse" onClick={toggleCollapsed}>
            <ChevronLeft aria-hidden="true" />
            <span className="sidebar__label">收起侧栏</span>
          </button>
        </div>
      </aside>
      {mobileMenuOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="关闭导航"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <div className="workbench-main">
        <header className="topbar">
          <div className="topbar__title">
            <button
              type="button"
              className="icon-button topbar__menu"
              aria-label="打开导航"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu aria-hidden="true" />
            </button>
            <div>
              {page.eyebrow ? <span>{page.eyebrow}</span> : null}
              <h1>{page.title}</h1>
            </div>
          </div>
          <div className="topbar__actions">
            <button
              type="button"
              className="search-trigger"
              onClick={() => void navigate('/search?focus=1')}
            >
              <Search aria-hidden="true" size={18} />
              <span>搜索工作台</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="button button--primary topbar__create"
              onClick={() => setQuickCreateOpen(true)}
            >
              <Plus aria-hidden="true" size={18} />
              <span>快速创建</span>
            </button>
            <button
              type="button"
              className="icon-button notification-button"
              aria-label={unreadCount > 0 ? `${unreadCount} 条未读通知` : '通知'}
              onClick={() => void navigate('/notifications')}
            >
              <Bell aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="notification-dot">{Math.min(unreadCount, 9)}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="account-button"
              aria-label="打开账户设置"
              onClick={() => void navigate('/settings')}
            >
              <UserRound aria-hidden="true" size={18} />
              <span>{session?.owner.username}</span>
            </button>
          </div>
        </header>

        <main id="main-content" className="page-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <button
        type="button"
        className="mobile-create"
        aria-label="快速创建"
        onClick={() => setQuickCreateOpen(true)}
      >
        <Plus aria-hidden="true" />
      </button>
      <nav className="bottom-nav" aria-label="手机主导航">
        <NavLink to="/" end>
          <Home aria-hidden="true" />
          <span>总览</span>
        </NavLink>
        <NavLink to="/features">
          <Grid2X2 aria-hidden="true" />
          <span>功能</span>
        </NavLink>
        <NavLink to="/search">
          <Search aria-hidden="true" />
          <span>搜索</span>
        </NavLink>
        <NavLink to="/settings">
          <UserRound aria-hidden="true" />
          <span>我的</span>
        </NavLink>
      </nav>

      <Modal
        open={quickCreateOpen}
        title="快速创建"
        description="选择一个功能，继续完成创建。"
        onClose={() => setQuickCreateOpen(false)}
      >
        <div className="quick-action-list">
          {quickActions.isLoading ? <p className="muted">正在获取可用操作…</p> : null}
          {quickActions.data?.map((action) => {
            const feature = featureCatalog.find((item) => item.featureId === action.featureId);
            return (
              <button
                type="button"
                className="quick-action"
                key={`${action.featureId}:${action.actionId}`}
                onClick={() => {
                  setQuickCreateOpen(false);
                  void navigate(action.targetRoute);
                }}
              >
                {feature ? <FeatureIcon name={feature.icon} /> : <Command aria-hidden="true" />}
                <span>
                  <strong>{action.label}</strong>
                  <small>{feature?.description}</small>
                </span>
                <ChevronLeft className="quick-action__arrow" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
