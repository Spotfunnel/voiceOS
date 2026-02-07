import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const testimonials = [
  { name: 'Mike Johnson', role: 'Owner, Johnson Plumbing', quote: "SpotFunnel has transformed our business. We've increased bookings by 40% and I finally have my weekends back.", rating: 5 },
  { name: 'Sarah Chen', role: 'Director, Elite HVAC', quote: "The AI handles calls just like a real receptionist. Our customers love the instant response, even at 2 AM.", rating: 5 },
  { name: 'David Rodriguez', role: 'Founder, Spark Electric', quote: "Best investment we made this year. The ROI was visible within the first month. Highly recommend!", rating: 5 },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Testimonials</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-2 mb-4">Trusted by Service Professionals</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex gap-1 mb-4">{[...Array(t.rating)].map((_, j) => <Star key={j} className="w-5 h-5 fill-accent text-accent" />)}</div>
              <p className="text-foreground mb-4">"{t.quote}"</p>
              <div><p className="font-semibold text-foreground">{t.name}</p><p className="text-sm text-muted-foreground">{t.role}</p></div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
