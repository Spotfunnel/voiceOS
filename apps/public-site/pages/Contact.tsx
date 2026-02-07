
import { useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, MessageSquare, Send } from "lucide-react";

export default function Contact() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate form submission
        setTimeout(() => {
            toast.success("Inquiry received. Our scaling architects will reach out shortly.");
            setIsSubmitting(false);
            (e.target as HTMLFormElement).reset();
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
            <Navbar />
            <main className="container mx-auto px-6 py-32">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-24 items-start">

                    <div className="space-y-12">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold tracking-[0.2em] uppercase">
                                Enterprise Inquiries
                            </div>
                            <h1 className="text-7xl font-bold tracking-tighter font-roobert leading-[1]">
                                Scale your <br />
                                infrastructure.
                            </h1>
                            <p className="text-xl text-slate-500 leading-relaxed max-w-md font-medium">
                                Connect with our team to discuss customized automation or high-volume funnel setups.
                            </p>
                        </div>

                        <div className="space-y-6 pt-12 border-t border-slate-100">
                            <div className="flex items-center gap-6 group cursor-pointer">
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Email us</p>
                                    <p className="text-lg font-bold">inquiry@getspotfunnel.com</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 group cursor-pointer">
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Chat with AI</p>
                                    <p className="text-lg font-bold">24/7 Support Active</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative group p-1">
                        <div className="absolute -inset-4 bg-slate-100 rounded-[40px] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                        <div className="relative bg-white border border-slate-200 p-12 rounded-[32px] shadow-2xl">
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Name</label>
                                        <Input placeholder="Marcus Chen" className="bg-slate-50 border-slate-200 h-14 rounded-xl focus:ring-slate-900 focus:border-slate-900" required />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Company</label>
                                        <Input placeholder="Acme Scaling" className="bg-slate-50 border-slate-200 h-14 rounded-xl focus:ring-slate-900 focus:border-slate-900" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                                    <Input type="email" placeholder="marcus@outlook.com.au" className="bg-slate-50 border-slate-200 h-14 rounded-xl focus:ring-slate-900 focus:border-slate-900" required />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Your Inquiry</label>
                                    <Textarea
                                        placeholder="Tell us about your current volume and scaling goals..."
                                        className="bg-slate-50 border-slate-200 min-h-[180px] rounded-xl focus:ring-slate-900 focus:border-slate-900 resize-none"
                                        required
                                    />
                                </div>

                                <Button type="submit" className="w-full h-16 text-lg font-bold group rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl hover:shadow-2xl transition-all duration-300" disabled={isSubmitting}>
                                    {isSubmitting ? "Deploying Request..." : (
                                        <>
                                            Send Inquiry
                                            <Send className="w-5 h-5 ml-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </div>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}
