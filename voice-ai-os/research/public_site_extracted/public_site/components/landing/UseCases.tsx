import { motion, useReducedMotion } from 'framer-motion';
import { Wrench, Zap, Wind, Home, Stethoscope, Briefcase } from 'lucide-react';

const useCases = [
  {
    icon: Wrench,
    title: 'Plumbers',
    description: 'Handle emergency calls 24/7, schedule repairs, and provide quotes for common plumbing issues.',
    features: ['Emergency dispatch', 'Quote estimates', 'Service scheduling'],
  },
  {
    icon: Zap,
    title: 'Electricians',
    description: 'Answer calls about electrical issues, book inspections, and handle permit inquiries.',
    features: ['Safety assessments', 'Permit info', 'Installation booking'],
  },
  {
    icon: Wind,
    title: 'HVAC',
    description: 'Schedule AC repairs, furnace maintenance, and seasonal tune-ups automatically.',
    features: ['Maintenance plans', 'Emergency repairs', 'System diagnostics'],
  },
  {
    icon: Home,
    title: 'Roofers',
    description: 'Book roof inspections, handle storm damage calls, and schedule estimates.',
    features: ['Damage assessment', 'Insurance claims', 'Free estimates'],
  },
  {
    icon: Stethoscope,
    title: 'Medical Clinics',
    description: 'Schedule patient appointments, handle prescription inquiries, and manage callbacks.',
    features: ['HIPAA compliant', 'Appointment reminders', 'Prescription refills'],
  },
  {
    icon: Briefcase,
    title: 'Agencies',
    description: 'Screen leads, schedule consultations, and qualify potential clients before connecting.',
    features: ['Lead qualification', 'Consultation booking', 'Follow-up calls'],
  },
];

export function UseCases() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="use-cases" className="py-12 sm:py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.3 }}
          className="text-center mb-8 sm:mb-16"
        >
          <span className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider">Use Cases</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mt-2 mb-3 sm:mb-4">
            Built for Service Businesses Like Yours
          </h2>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're a solo tradesperson or a growing agency, SpotFunnel adapts to your industry needs.
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {useCases.map((useCase, index) => (
            <div
              key={useCase.title}
              className="group bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <useCase.icon className="w-6 h-6 sm:w-7 sm:h-7 text-primary group-hover:text-primary-foreground" />
              </div>

              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-1.5 sm:mb-2">{useCase.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 leading-relaxed">{useCase.description}</p>

              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {useCase.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium bg-secondary text-secondary-foreground rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
