import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export function Pricing() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="pricing" className="py-12 sm:py-24 bg-muted/30 relative overflow-hidden">
      {/* Decorative gradient - smaller on mobile */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] sm:w-[800px] sm:h-[800px] bg-primary/5 rounded-full blur-[120px] -z-10" />

      <div className="container mx-auto px-3 sm:px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 leading-tight">
              Ready to <span className="gradient-text">Book More Jobs?</span>
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
              Join hundreds of service businesses using AI to answer every call and grow their revenue. Leave your credit card at home and get started in 48-72 hours.
            </p>

            <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 shadow-2xl relative group overflow-hidden">
              {/* Shine effect - disabled on mobile for performance */}
              <div className="hidden sm:block absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center">
                <Button size="xl" variant="hero" className="w-full sm:w-auto text-base sm:text-xl px-8 sm:px-16 py-6 sm:py-8 h-auto shadow-2xl hover:shadow-primary/20 transition-all duration-200 sm:duration-300 sm:transform sm:hover:-translate-y-1" asChild>
                  <Link to="/consultation" className="flex items-center justify-center gap-2 sm:gap-3">
                    Book More Jobs
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Link>
                </Button>

                <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-10">
                  <div className="flex items-center gap-2 sm:gap-3 group/item">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover/item:bg-primary/20 transition-colors shrink-0">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <span className="text-xs sm:text-base font-medium text-foreground/80">Leave your credit card at home</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 group/item">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover/item:bg-primary/20 transition-colors shrink-0">
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <span className="text-xs sm:text-base font-medium text-foreground/80">Setup in 48-72 Hours</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
