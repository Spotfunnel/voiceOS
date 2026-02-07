import { Link } from 'react-router-dom';
import { SpotFunnelLogo } from '@/components/brand/SpotFunnelLogo';

export function Footer() {
  return (
    <footer className="py-12 bg-foreground text-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <SpotFunnelLogo size={36} color="white" />
            <span className="font-bold text-2xl tracking-tight">SpotFunnel</span>
          </Link>
          <div className="flex gap-8 text-sm opacity-70">
            <Link to="/privacy" className="hover:opacity-100 transition-opacity">Privacy</Link>
            <Link to="/terms" className="hover:opacity-100 transition-opacity">Terms</Link>
            <Link to="/contact" className="hover:opacity-100 transition-opacity">Contact</Link>
          </div>
          <p className="text-sm opacity-70">© 2026 SpotFunnel. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
