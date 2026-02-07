import { motion, useReducedMotion } from 'framer-motion';
import { Phone, Bot, Calendar, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: Phone,
    title: 'Customer Calls',
    description: 'When a customer calls your business number, SpotFunnel answers instantly - even at 3 AM.',
  },
  {
    icon: Bot,
    title: 'AI Engages',
    description: 'Our AI understands their needs, answers questions about your services, and provides helpful information.',
  },
  {
    icon: Calendar,
    title: 'Books Appointment',
    description: 'The AI checks your availability and books appointments directly into your calendar.',
  },
  {
    icon: BarChart3,
    title: 'You Get Insights',
    description: 'View all calls, transcripts, and booked appointments in your dashboard. Never miss a lead.',
  },
];

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="py-12 sm:py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.3 }}
          className="text-center mb-8 sm:mb-16"
        >
          <span className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider">How It Works</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mt-2 mb-3 sm:mb-4">
            Set Up in Minutes, Save Hours Every Day
          </h2>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Our AI voice agent handles customer calls just like a trained receptionist, but it never takes a break.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-full h-0.5 bg-border -translate-x-1/2 z-0" />
              )}

              <div className="relative z-10 bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-border hover:border-primary/50 transition-colors duration-200 h-full">
                {/* Step number */}
                <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-bold flex items-center justify-center">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <step.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5 sm:mb-2">{step.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
