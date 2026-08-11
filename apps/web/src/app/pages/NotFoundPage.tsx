import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage(): React.JSX.Element {
  return (
    <div className="not-found">
      <p className="eyebrow">404</p>
      <h2>这里没有工作台页面</h2>
      <p>链接可能已经变化，返回总览可以继续使用其他功能。</p>
      <Link className="button button--primary" to="/">
        <ArrowLeft aria-hidden="true" size={17} /> 返回总览
      </Link>
    </div>
  );
}
