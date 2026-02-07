
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { SpotFunnelLogo } from '@/components/brand/SpotFunnelLogo';

interface FormData {
    name: string;
    business: string;
    email: string;
    phone: string;
    website: string;
    teamSize: string;
    time: string;
    problem: string;
}

export default function Consultation() {
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<FormData>({
        name: '',
        business: '',
        email: '',
        phone: '',
        website: '',
        teamSize: '',
        time: '',
        problem: ''
    });

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Placeholder for actual submission logic
            console.log("Form submitted:", formData);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay

            toast.success("Request submitted! We'll be in touch shortly.");
            setSubmitted(true);
        } catch (error) {
            console.error('Submission error:', error);
            toast.error("Failed to submit request. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen hero-gradient text-white flex flex-col font-primary overflow-x-hidden">
            {/* Mobile-Responsive Navbar */}
            <motion.nav
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="fixed top-0 left-0 right-0 z-50 bg-transparent py-2 sm:py-4"
            >
                <div className="container mx-auto px-3 sm:px-4">
                    <div className="flex items-center justify-between h-12 sm:h-16">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity">
                            <SpotFunnelLogo size={28} color="white" className="sm:w-9 sm:h-9" />
                            <span className="font-bold text-lg sm:text-2xl tracking-tight text-white">
                                SpotFunnel
                            </span>
                        </Link>

                        {/* CTA Buttons - Responsive */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Sign In Removed for Public Export */}

                            {/* Book More Jobs - Smaller on mobile */}
                            <Button asChild className="bg-white text-black hover:bg-white/90 border-none shadow-lg transition-all active:scale-95 text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10">
                                <Link to="/consultation">Book Now</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.nav>

            <main className="flex-grow pt-32 pb-16 relative flex items-center justify-center min-h-screen">
                {/* Decorative background elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] -z-10" />

                <div className="container mx-auto px-4">
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-6">
                            <motion.h1
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-4xl md:text-5xl font-bold mb-3 tracking-tight text-white"
                            >
                                Book a call
                            </motion.h1>
                            <motion.p
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-lg text-white/80 max-w-lg mx-auto leading-relaxed"
                            >
                                A 15-minute call to understand your business. If SpotFunnel isn't right for you, we'll say so.
                            </motion.p>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.99 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.15 }}
                            className="bg-white/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-6 md:p-8 shadow-2xl relative group overflow-hidden"
                        >
                            {!submitted ? (
                                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 mb-1 relative">
                                        <h3 className="text-xs font-bold mb-3 text-slate-900 uppercase tracking-wider">
                                            What we'll cover:
                                        </h3>
                                        <ul className="space-y-2">
                                            {[
                                                'How you currently handle incoming calls',
                                                'What FSM system you use (if any)',
                                                'Whether voice AI makes sense for your setup'
                                            ].map((text) => (
                                                <li key={text} className="flex items-start gap-2 text-slate-700">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                    <span className="text-sm font-medium leading-tight">{text}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">Your name</label>
                                            <Input
                                                placeholder="John Smith"
                                                required
                                                value={formData.name}
                                                onChange={(e) => handleInputChange('name', e.target.value)}
                                                className="bg-transparent border-slate-300 h-10 rounded-lg focus:ring-primary focus:border-primary text-slate-900 text-sm px-3 hover:border-slate-400 transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">Business name</label>
                                            <Input
                                                placeholder="Smith Solar Installations"
                                                required
                                                value={formData.business}
                                                onChange={(e) => handleInputChange('business', e.target.value)}
                                                className="bg-transparent border-slate-300 h-10 rounded-lg focus:ring-primary focus:border-primary text-slate-900 text-sm px-3 hover:border-slate-400 transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">Email address</label>
                                            <Input
                                                type="email"
                                                placeholder="john@example.com"
                                                required
                                                value={formData.email}
                                                onChange={(e) => handleInputChange('email', e.target.value)}
                                                className="bg-transparent border-slate-300 h-10 rounded-lg focus:ring-primary focus:border-primary text-slate-900 text-sm px-3 hover:border-slate-400 transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">How many people are on your team?</label>
                                            <Select value={formData.teamSize} onValueChange={(value) => handleInputChange('teamSize', value)}>
                                                <SelectTrigger className="bg-transparent border-slate-300 h-10 rounded-lg text-slate-900 text-sm px-3 hover:border-slate-400 transition-all">
                                                    <SelectValue placeholder="Select team size" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-xl">
                                                    <SelectItem value="solo">Just me</SelectItem>
                                                    <SelectItem value="2-5">2–5 people</SelectItem>
                                                    <SelectItem value="6-10">6–10 people</SelectItem>
                                                    <SelectItem value="11-25">11–25 people</SelectItem>
                                                    <SelectItem value="26+">26+ people</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">Phone number</label>
                                            <Input
                                                type="tel"
                                                placeholder="0412 345 678"
                                                required
                                                value={formData.phone}
                                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                                className="bg-transparent border-slate-300 h-10 rounded-lg focus:ring-primary focus:border-primary text-slate-900 text-sm px-3 hover:border-slate-400 transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">Website address</label>
                                            <Input
                                                type="url"
                                                placeholder="www.yourbusiness.com"
                                                value={formData.website}
                                                onChange={(e) => handleInputChange('website', e.target.value)}
                                                className="bg-transparent border-slate-300 h-10 rounded-lg focus:ring-primary focus:border-primary text-slate-900 text-sm px-3 hover:border-slate-400 transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">Best time to call</label>
                                            <Select required value={formData.time} onValueChange={(value) => handleInputChange('time', value)}>
                                                <SelectTrigger className="bg-transparent border-slate-300 h-10 rounded-lg text-slate-900 text-sm px-3 hover:border-slate-400 transition-all">
                                                    <SelectValue placeholder="Select a time" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-xl">
                                                    <SelectItem value="morning">Morning (9am - 12pm)</SelectItem>
                                                    <SelectItem value="afternoon">Afternoon (12pm - 5pm)</SelectItem>
                                                    <SelectItem value="evening">Evening (5pm - 8pm)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-600 ml-0.5">Main problem to solve</label>
                                            <Select required value={formData.problem} onValueChange={(value) => handleInputChange('problem', value)}>
                                                <SelectTrigger className="bg-transparent border-slate-300 h-10 rounded-lg text-slate-900 text-sm px-3 hover:border-slate-400 transition-all">
                                                    <SelectValue placeholder="Select problem" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-xl">
                                                    <SelectItem value="losing-jobs">Losing jobs because calls are missed</SelectItem>
                                                    <SelectItem value="tied-to-phone">I'm constantly tied to my phone</SelectItem>
                                                    <SelectItem value="after-hours-exhausting">After-hours calls are exhausting</SelectItem>
                                                    <SelectItem value="unqualified-calls">Too many unqualified / time-wasting calls</SelectItem>
                                                    <SelectItem value="cant-keep-up">We're growing and can't keep up with calls</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <Button
                                            type="submit"
                                            variant="hero"
                                            disabled={isLoading}
                                            className="w-full h-12 text-base font-bold shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? 'Submitting...' : 'Request call'}
                                        </Button>
                                    </div>

                                    <p className="text-center text-[10px] text-slate-500 font-bold tracking-tight uppercase">
                                        We'll call you within 2 business days
                                    </p>
                                </form>
                            ) : (
                                <div className="text-center py-6 relative z-10">
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5 animate-float text-primary">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">You're all set!</h2>
                                    <p className="text-slate-700 text-base mb-6 max-w-xs mx-auto leading-relaxed font-medium">
                                        We've received your request and will call you within 2 business days.
                                    </p>
                                    <Button
                                        variant="hero"
                                        className="h-11 px-8"
                                        asChild
                                    >
                                        <Link to="/">Back to Home</Link>
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
