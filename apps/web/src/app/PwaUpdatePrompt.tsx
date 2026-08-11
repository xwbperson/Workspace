import { RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt(): React.JSX.Element | null {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!offlineReady && !needRefresh) return null;
  return (
    <div className="pwa-prompt" role="status">
      {needRefresh ? <RefreshCw aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
      <div>
        <strong>{needRefresh ? '工作台有新版本' : '静态界面已可离线打开'}</strong>
        <small>{needRefresh ? '重新载入后使用最新版本。' : '业务数据仍需要连接服务器。'}</small>
      </div>
      {needRefresh ? (
        <button
          type="button"
          className="button button--primary"
          onClick={() => void updateServiceWorker(true)}
        >
          重新载入
        </button>
      ) : null}
      <button
        type="button"
        className="icon-button"
        aria-label="关闭"
        onClick={() => {
          setOfflineReady(false);
          setNeedRefresh(false);
        }}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
