import { Component, type ErrorInfo, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  public state = { error: null as Error | null };

  public static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Workbench render error', error, info.componentStack);
  }

  public render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <p className="eyebrow">界面发生错误</p>
        <h1>工作台没有正确显示</h1>
        <p>重新载入页面可以恢复应用壳；如果问题重复出现，请保留当前时间用于检查日志。</p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => window.location.reload()}
        >
          重新载入
        </button>
      </main>
    );
  }
}
