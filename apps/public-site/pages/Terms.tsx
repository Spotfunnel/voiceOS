
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function Terms() {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-primary/10">
            <Navbar />

            {/* Subtle light background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-slate-100 rounded-full blur-[120px] -ml-64 -mt-64 opacity-50" />
                <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-slate-50 rounded-full blur-[120px] -mr-32 opacity-50" />
            </div>

            <main className="relative container mx-auto px-6 py-32 max-w-4xl">
                <header className="mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
                        Governance & Participation
                    </div>
                    <h1 className="text-6xl font-bold tracking-tighter mb-4 font-roobert text-slate-900 leading-tight">
                        Terms of Service
                    </h1>
                    <p className="text-slate-500 font-medium italic">Last Updated: February 2, 2026</p>
                </header>

                <div className="space-y-16 text-lg leading-relaxed text-slate-700">
                    <section className="bg-slate-50 border border-slate-200/60 p-10 rounded-3xl">
                        <p className="text-xl font-medium text-slate-900 italic border-l-4 border-slate-900 pl-6 py-2 leading-relaxed">
                            These Terms govern your use of the SpotFunnel platform and services. By using
                            our website or services, you agree to these Terms.
                        </p>
                    </section>

                    <div className="grid grid-cols-1 gap-12">
                        <section className="space-y-6">
                            <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4 underline decoration-slate-200 decoration-4 underline-offset-8 transition-colors hover:decoration-slate-400">
                                1. Nature of the Service
                            </h2>
                            <p>
                                SpotFunnel provides an AI-powered voice receptionist for businesses. It is a
                                deterministic tool designed for high efficiency; it is not a human receptionist
                                and does not guarantee perfect accuracy, availability, or understanding.
                            </p>
                        </section>

                        <section className="space-y-6">
                            <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4 underline decoration-slate-200 decoration-4 underline-offset-8 transition-colors hover:decoration-slate-400">
                                2. No Guarantees
                            </h2>
                            <p>We do not guarantee specific outcomes, including but not limited to:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                                {["Sales, leads, or conversions", "Continuous or uninterrupted service", "Error-free call handling"].map((item, i) => (
                                    <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-center flex items-center justify-center shadow-sm">
                                        {item}
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm opacity-60 italic mt-4">
                                The service is reliant on distributed third-party networks and advanced AI systems.
                            </p>
                        </section>

                        <section className="space-y-6">
                            <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4 underline decoration-slate-200 decoration-4 underline-offset-8 transition-colors hover:decoration-slate-400">
                                3. Customer Responsibilities
                            </h2>
                            <p>To ensure optimal scaling, customers are responsible for:</p>
                            <ul className="space-y-3 pl-2">
                                {[
                                    "Providing accurate scripts and operational instructions",
                                    "Ensuring full legal compliance (including local call recording laws)",
                                    "Valid configuration and monitoring of the platform"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                                        <span className="text-slate-600 font-medium">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="p-10 rounded-[40px] bg-slate-900 text-white space-y-4 shadow-2xl">
                            <h2 className="text-2xl font-bold font-roobert">Call Recording & Compliance</h2>
                            <p className="opacity-80 leading-relaxed">
                                SpotFunnel records and transcribes calls by default. Customers are solely
                                responsible for notifying callers and complying with Australian
                                telecommunications and surveillance laws.
                            </p>
                        </section>

                        <section className="space-y-6">
                            <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4 underline decoration-slate-200 decoration-4 underline-offset-8 transition-colors hover:decoration-slate-400">
                                4. Acceptable Use
                            </h2>
                            <p>Usage must be legitimate and ethical. You must not use the service for:</p>
                            <div className="flex flex-wrap gap-2 pt-2">
                                {[
                                    "Illegal, misleading, or deceptive activities",
                                    "Harassment or abuse",
                                    "Unlawful data collection"
                                ].map((tag, i) => (
                                    <span key={i} className="px-4 py-2 rounded-lg bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 uppercase tracking-wider">
                                        ✕ {tag}
                                    </span>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-6">
                            <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4 underline decoration-slate-200 decoration-4 underline-offset-8 transition-colors hover:decoration-slate-400">
                                5. Limitation of Liability
                            </h2>
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 space-y-4">
                                <p className="font-medium text-slate-900">To the maximum extent permitted by law:</p>
                                <div className="space-y-3">
                                    <div className="flex gap-4">
                                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] shrink-0 mt-1">•</div>
                                        <p className="text-slate-600">SpotFunnel is not liable for indirect or consequential loss.</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] shrink-0 mt-1">•</div>
                                        <p className="text-slate-600">Our total liability is strictly limited to fees paid in the three months prior to any claim.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="pt-20 border-t border-slate-200 text-center space-y-4">
                            <h2 className="text-4xl font-bold font-roobert text-slate-900 tracking-tight">Governing Law</h2>
                            <p className="text-xl text-slate-500 font-medium italic">
                                These Terms are governed by the laws of <span className="text-slate-900 not-italic font-bold">New South Wales, Australia</span>.
                            </p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
