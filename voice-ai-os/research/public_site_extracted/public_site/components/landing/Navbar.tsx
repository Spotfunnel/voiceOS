
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { SpotFunnelLogo } from '@/components/brand/SpotFunnelLogo';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Trigger background change after hero section (approx 90% of viewport height)
      setIsScrolled(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#benefits', label: 'Benefits' },
    { href: '#use-cases', label: 'Use Cases' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-sm border-b border-gray-100 py-2' : 'bg-transparent py-4'
        }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <SpotFunnelLogo size={36} color={isScrolled ? "var(--primary)" : "white"} />
            <span className={cn("font-bold text-2xl tracking-tight transition-colors duration-300", isScrolled ? "text-gray-900" : "text-white")}>
              SpotFunnel
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  isScrolled ? "text-gray-600 hover:text-primary" : "text-white/70 hover:text-white"
                )}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button asChild className={cn("border-none shadow-lg transition-all active:scale-95", isScrolled ? "bg-primary text-white hover:bg-primary/90" : "bg-white text-black hover:bg-white/90")}>
              <Link to="/consultation">Book More Jobs</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className={cn("md:hidden p-2 transition-colors duration-300", isScrolled ? "text-gray-900" : "text-white")}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "md:hidden py-6 border-t px-4 -mx-4 transition-colors duration-300",
                isScrolled ? "bg-white border-gray-100" : "bg-black/95 backdrop-blur-lg border-white/10"
              )}
            >
              <div className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "text-base font-medium transition-colors duration-300",
                      isScrolled ? "text-gray-600 hover:text-primary" : "text-white/70 hover:text-white"
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                  <Button asChild className={isScrolled ? "bg-primary text-white" : "bg-white text-black"}>
                    <Link to="/consultation" onClick={() => setIsOpen(false)}>Book More Jobs</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
