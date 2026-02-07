import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
  { q: 'How does SpotFunnel work?', a: 'SpotFunnel connects to your business phone. When customers call, our AI answers, understands their needs, and can book appointments directly into your calendar.' },
  { q: 'Can I customize what the AI says?', a: 'Yes! You can customize greetings, responses, and the overall tone to match your brand perfectly.' },
  { q: 'What happens if the AI can\'t handle a call?', a: 'The AI will take a message and notify you immediately. You can also set up call forwarding for specific situations.' },
  { q: 'Is there a contract or can I cancel anytime?', a: 'No contracts! You can cancel your subscription at any time with no penalties.' },
  { q: 'How long does setup take?', a: 'Setup takes between 48 to 72 hours depending on what softwares are currently being used. Our onboarding team handles the heavy lifting for you.' },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="faq" className="py-12 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="text-center mb-8 sm:mb-16"
        >
          <span className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider">FAQ</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mt-2 mb-3 sm:mb-4">Frequently Asked Questions</h2>
        </motion.div>
        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-card rounded-lg sm:rounded-xl border border-border overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-left">
                <span className="font-semibold text-foreground text-sm sm:text-base pr-4">{faq.q}</span>
                <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground transition-transform shrink-0 ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && <div className="px-4 sm:px-6 pb-3 sm:pb-4 text-muted-foreground text-xs sm:text-sm leading-relaxed">{faq.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
