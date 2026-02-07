
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function Privacy() {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-primary/10">
            <Navbar />

            {/* Subtle light background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-slate-100 rounded-full blur-[120px] -mr-64 -mt-64 opacity-50" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-slate-50 rounded-full blur-[120px] -ml-64 -mb-64 opacity-50" />
            </div>

            <main className="relative container mx-auto px-6 py-32 max-w-4xl">
                <header className="mb-20">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold tracking-[0.2em] uppercase mb-6">
                        Compliance & Transparency
                    </div>
                    <h1 className="text-6xl font-bold tracking-tighter mb-4 font-roobert text-slate-900 leading-tight">
                        Privacy Policy
                    </h1>
                    <p className="text-slate-500 font-medium italic">Last Updated: February 2, 2026</p>
                </header>

                <div className="space-y-16 text-lg leading-relaxed text-slate-700">
                    <section className="bg-slate-50 border border-slate-200/60 p-10 rounded-3xl">
                        <p className="font-medium text-slate-900 italic border-l-4 border-slate-900 pl-6 py-2">
                            SpotFunnel Pty Ltd is committed to protecting your privacy and complies with the
                            Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
                        </p>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4">
                            <span className="w-10 h-[2px] bg-slate-900" />
                            What We Collect
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                "Business contact details (name, email, phone number)",
                                "Call metadata (phone number, time, duration)",
                                "Voice recordings and call transcripts",
                                "Usage and diagnostic data"
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                    <span className="text-sm font-medium text-slate-600">{item}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4">
                            <span className="w-10 h-[2px] bg-slate-900" />
                            How We Collect Information
                        </h2>
                        <p>Information is collected through deterministic touchpoints:</p>
                        <ul className="space-y-4 mt-6">
                            {[
                                "Direct usage of our platform and website",
                                "Automated call handling via the SpotFunnel ecosystem",
                                "Seamless CRM and third-party API integrations"
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-4">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-900 shrink-0 mt-0.5 border border-slate-200">
                                        <span className="text-xs font-bold">{i + 1}</span>
                                    </div>
                                    <span className="text-slate-600">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4">
                            <span className="w-10 h-[2px] bg-slate-900" />
                            How We Use Information
                        </h2>
                        <p>We leverage data to maintain your Architecture of Scale:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                "Operational AI receptionist services",
                                "High-fidelity call transcription",
                                "Systemic reliability optimizations",
                                "Regulatory & legal compliance"
                            ].map((item, i) => (
                                <div key={i} className="px-6 py-4 rounded-2xl bg-white border border-slate-200 font-medium text-slate-700 shadow-sm">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="p-8 rounded-3xl bg-slate-900 text-white">
                        <h2 className="text-2xl font-bold font-roobert mb-4 italic">Call Recording</h2>
                        <p className="opacity-90">
                            Calls handled by SpotFunnel may be recorded and transcribed by default. Our customers
                            retain sole responsibility for notifying callers that recording is active,
                            ensuring professional transparency at every scale.
                        </p>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4">
                            <span className="w-10 h-[2px] bg-slate-900" />
                            Data Sharing
                        </h2>
                        <p>
                            We partner exclusively with trusted telemetry and AI infrastructure providers.
                            Data sharing is strictly scoped to service delivery. Some operational processing
                            may occur outside Australia to ensure 24/7 global resilience.
                        </p>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-3xl font-bold font-roobert text-slate-900 flex items-center gap-4">
                            <span className="w-10 h-[2px] bg-slate-900" />
                            Security & Integrity
                        </h2>
                        <p>
                            We deploy multi-layered security protocols to safeguard your information.
                            While no infrastructure is impenetrable, we maintain rigorous defensive
                            standards to protect your data integrity.
                        </p>
                    </section>

                    <section className="pt-20 border-t border-slate-200">
                        <div className="bg-slate-50 border border-slate-200 p-12 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="space-y-2">
                                <h3 className="text-3xl font-bold font-roobert text-slate-900">Access & Complaints</h3>
                                <p className="text-slate-500">Need to correct your data or file a report?</p>
                            </div>
                            <a
                                href="mailto:Support@getspotfunnel.com"
                                className="px-10 py-5 bg-slate-900 text-white rounded-full font-bold text-xl hover:scale-105 transition-transform shadow-xl"
                            >
                                Support@getspotfunnel.com
                            </a>
                        </div>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
}
