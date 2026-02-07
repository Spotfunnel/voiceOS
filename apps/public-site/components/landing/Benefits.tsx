import { motion, useReducedMotion } from 'framer-motion';
import { Clock, DollarSign, TrendingUp, Shield, Zap, Users } from 'lucide-react';

const benefits = [
  {
    icon: Clock,
    title: '24/7 Availability',
    description: 'Never miss a call again. Your AI agent answers every call, day or night, weekends and holidays.',
    stat: '99.9%',
    statLabel: 'Answer Rate',
  },
  {
    icon: DollarSign,
    title: 'Save on Staff Costs',
    description: 'Reduce the need for full-time reception staff while providing better customer service.',
    stat: '70%',
    statLabel: 'Cost Reduction',
  },
  {
    icon: TrendingUp,
    title: 'Increase Bookings',
    description: 'Convert more callers into booked appointments with instant responses and scheduling.',
    stat: '3x',
    statLabel: 'More Bookings',
  },
  {
    icon: Shield,
    title: 'Professional Image',
    description: 'Sound professional on every call with consistent, friendly responses customized to your brand.',
    stat: '4.9★',
    statLabel: 'Customer Rating',
  },
  {
    icon: Zap,
    title: 'Instant Setup',
    description: 'Get started in minutes, not weeks. No complex integrations or technical skills required.',
    stat: '5 min',
    statLabel: 'Setup Time',
  },
  {
    icon: Users,
    title: 'Multi-Call Handling',
    description: 'Handle unlimited simultaneous calls. No more busy signals or hold music for customers.',
    stat: '∞',
    statLabel: 'Concurrent Calls',
  },
];

export function Benefits() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="benefits" className="py-12 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.3 }}
          className="text-center mb-8 sm:mb-16"
        >
          <span className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider">Benefits</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mt-2 mb-3 sm:mb-4">
            Why Businesses Love SpotFunnel
          </h2>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Join hundreds of service businesses that have transformed their customer experience with AI.
          </p>
        </motion.div>

        {/* Benefits Grid - No animations on mobile for performance */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="group bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-xl sm:text-2xl font-bold text-primary">{benefit.stat}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{benefit.statLabel}</p>
                </div>
              </div>

              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5 sm:mb-2">{benefit.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
