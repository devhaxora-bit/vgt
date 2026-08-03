import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return <div className="marketing-site"><SiteHeader /><main>{children}</main><SiteFooter /></div>;
}
