import { useState, useEffect } from 'react';

interface PushSubscriptionState {
    subscription: PushSubscription | null;
    isSupported: boolean;
    permission: NotificationPermission;
    isInstalled: boolean;
}

export function usePushNotifications() {
    const [state, setState] = useState<PushSubscriptionState>({
        subscription: null,
        isSupported: false,
        permission: 'default',
        isInstalled: false
    });

    useEffect(() => {
        // Check if push notifications are supported
        const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

        // Check if PWA is installed
        const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        setState(prev => ({
            ...prev,
            isSupported,
            permission: isSupported ? Notification.permission : 'denied',
            isInstalled
        }));

        if (isSupported) {
            checkExistingSubscription();
        }
    }, []);

    const checkExistingSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                console.log('Existing subscription found on device.');
                // We'll let the component handle saving when the user is available
            }

            setState(prev => ({
                ...prev,
                subscription,
                permission: Notification.permission
            }));
        } catch (error) {
            console.error('Error checking subscription:', error);
        }
    };

    const requestPermission = async (): Promise<boolean> => {
        if (!state.isSupported) {
            throw new Error('Push notifications are not supported');
        }

        try {
            const permission = await Notification.requestPermission();
            setState(prev => ({ ...prev, permission }));

            if (permission === 'granted') {
                await subscribe();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error requesting permission:', error);
            return false;
        }
    };

    const subscribe = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const vapidPublicKey = 'BLP3Ul8fZix8OjB6gPCB5-IPjGJszmoq259pyd6ALAL2TUYxWW9v0uyF4D3O-uSoZTat1wSRWJdUZGrHrF7xhdA';

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any
            });

            setState(prev => ({ ...prev, subscription }));
            return subscription;
        } catch (error) {
            console.error('Error subscribing to push:', error);
            throw error;
        }
    };

    const unsubscribe = async () => {
        if (!state.subscription) return;

        try {
            await state.subscription.unsubscribe();
            setState(prev => ({ ...prev, subscription: null }));
        } catch (error) {
            console.error('Error unsubscribing:', error);
            throw error;
        }
    };

    return {
        ...state,
        requestPermission,
        subscribe,
        unsubscribe,
        checkExistingSubscription
    };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Separate helper for saving
export async function syncSubscriptionToDb(subscription: PushSubscription, userId: string) {
    const { supabase } = await import('@/integrations/supabase/client');
    const { toast } = await import('sonner');

    console.log('Syncing push subscription for user:', userId);
    const subscriptionData = subscription.toJSON();

    const { error } = await supabase
        .from('push_subscriptions' as any)
        .upsert({
            user_id: userId,
            endpoint: subscriptionData.endpoint!,
            p256dh: subscriptionData.keys!.p256dh,
            auth: subscriptionData.keys!.auth,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'endpoint'
        });

    if (error) {
        console.error('CRITICAL: Supabase Push Save Error:', error);
        toast.error('Notification Setup Failed', {
            description: 'Could not link your phone to your account: ' + error.message
        });
        throw new Error('Failed to save subscription details: ' + error.message);
    } else {
        console.log('✅ Push subscription successfully synced for user:', userId);
        toast.success('Notifications Linked!', {
            description: 'Your device is now ready to receive alerts.'
        });
    }
}
