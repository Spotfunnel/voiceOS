import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Phone, ArrowRight, CheckCircle2 } from 'lucide-react';

export function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative min-h-[calc(100vh-4rem)] sm:min-h-screen flex items-center hero-gradient overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-hero-pattern opacity-20 sm:opacity-30" />

      {/* Gradient orbs - smaller on mobile */}
      <div className="absolute top-1/4 left-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 sm:w-96 sm:h-96 bg-accent/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-3 sm:px-4 pt-16 sm:pt-24 pb-12 sm:pb-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center lg:text-left"
          >
            {/* Top Badge */}
            <div className="flex justify-center lg:justify-start mb-4 sm:mb-6">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm shadow-sm">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs sm:text-sm font-semibold text-primary-foreground/90">Now with GPT-5.2 Intelligence</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight mb-4 sm:mb-6">
              Never Miss a
              <span className="block gradient-text">Customer Call</span>
              Again
            </h1>

            {/* Subheadline */}
            <p className="text-sm sm:text-lg md:text-xl text-primary-foreground/70 mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              AI-powered voice agent that answers your business calls 24/7, books appointments, and saves you hours of admin time. Perfect for trades & service businesses.
            </p>

            {/* Trust points */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-3 sm:gap-4 mb-6 sm:mb-8">
              {['24/7 Availability', 'Instant Responses', 'Books Appointments'].map((point) => (
                <div key={point} className="flex items-center gap-1.5 sm:gap-2 text-primary-foreground/80">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">{point}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <Button variant="hero" size="xl" asChild className="w-full sm:w-auto text-sm sm:text-base">
                <Link to="/consultation">
                  Book More Jobs
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </Button>
            </div>

            {/* Bottom Border Line */}
            <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-primary-foreground/10 flex justify-center lg:justify-start">
            </div>
          </motion.div>

          {/* Right Content - Phone mockup (hidden on mobile, shown on tablet+) */}
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, x: 20 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="relative hidden md:block"
          >
            <div className="relative z-10">
              {/* Phone frame */}
              <div className="bg-card rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 max-w-sm mx-auto lg:ml-auto lg:mr-0 border border-border">
                {/* Call interface */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-muted-foreground">Incoming Call</span>
                    <span className="text-[10px] sm:text-xs text-success font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-success animate-pulse" />
                      AI Active
                    </span>
                  </div>

                  <div className="text-center py-6 sm:py-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4 animate-float">
                      <Phone className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                    </div>
                    <p className="text-base sm:text-lg font-semibold text-foreground">0412 345 678</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Potential Customer</p>
                  </div>

                  <div className="bg-muted rounded-lg p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-foreground mb-2">
                      <span className="font-medium">AI:</span> "Good morning! Thank you for calling ABC Plumbing. How can I help you today?"
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      <span className="font-medium">Caller:</span> "I have a leaking pipe..."
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 bg-success/10 rounded-lg p-2.5 sm:p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-success font-medium">Appointment Booked</p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground">Today @ 2:00 PM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-8 -right-8 w-24 h-24 sm:w-32 sm:h-32 bg-primary/30 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 sm:w-32 sm:h-32 bg-accent/30 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
