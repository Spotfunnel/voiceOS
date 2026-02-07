import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export function NotificationPrompt() {
    const [isVisible, setIsVisible] = useState(false);
    const { isSupported, permission, isInstalled, requestPermission } = usePushNotifications();

    useEffect(() => {
        // Show prompt if:
        // 1. Notifications are supported
        // 2. Permission is default (not asked yet)
        // 3. App is installed (required for iOS push notifications)
        // 4. User hasn't dismissed it this session
        const dismissed = sessionStorage.getItem('notification-prompt-dismissed');

        // For iOS, only show if installed as PWA
        if (isSupported && permission === 'default' && isInstalled && !dismissed) {
            // Show after 2 seconds to not be too aggressive
            const timer = setTimeout(() => setIsVisible(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [isSupported, permission, isInstalled]);

    const handleEnable = async () => {
        try {
            const granted = await requestPermission();
            if (granted) {
                toast.success('Notifications enabled! 🎉');
                setIsVisible(false);
            } else {
                // Silently dismiss - user chose not to enable notifications
                // They can always enable later from Settings
                setIsVisible(false);
            }
        } catch (error) {
            // Silently handle errors - don't block the user experience
            console.log('Notification permission not granted:', error);
            setIsVisible(false);
        }
    };

    const handleDismiss = () => {
        sessionStorage.setItem('notification-prompt-dismissed', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    // Only show if installed (notification prompt for enabling push)
    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
            <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm shadow-lg">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary/10 animate-pulse">
                        <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-sm mb-1">Stay Updated</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                            Get instant notifications for new consultation bookings and action-required calls.
                        </p>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleEnable}>
                                Enable Notifications
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleDismiss}>
                                Not Now
                            </Button>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </Card>
        </div>
    );
}
