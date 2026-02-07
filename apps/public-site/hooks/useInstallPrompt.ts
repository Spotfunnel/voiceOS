import { useState, useEffect } from 'react';

export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        const installed = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
        setIsInstalled(installed);

        // Capture install prompt event (Android/Desktop)
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const promptInstall = async () => {
        if (deferredPrompt) {
            // Android/Desktop - trigger native install
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setIsInstalled(true);
            }
        } else {
            // iOS - navigate to install guide page
            window.location.href = '/install-guide';
        }
    };

    return { promptInstall, isInstalled, canInstall: !!deferredPrompt || /iPad|iPhone|iPod/.test(navigator.userAgent) };
}
