
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Benefits } from '@/components/landing/Benefits';
import { UseCases } from '@/components/landing/UseCases';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { Footer } from '@/components/landing/Footer';

const Index = () => {
    return (
        <div className="min-h-screen">
            <Navbar />
            <Hero />
            <HowItWorks />
            <Benefits />
            <UseCases />

            <Pricing />
            <FAQ />
            <Footer />
        </div>
    );
};

export default Index;
