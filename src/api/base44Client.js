import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Create a client with authentication required by each feature as before.
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// One-way, best-effort CustomerOrder sync to Dawaa Pharmacy.
// This intentionally does NOT block Base44 operations if the management app is unavailable.
// Destination deduplicates again by the stable Base44 record id, so multiple open tabs stay safe.
if (typeof window !== 'undefined') {
  const syncStateKey = '__dawaa_customer_order_sync_subscription_v1__';
  if (!window[syncStateKey]) {
    window[syncStateKey] = true;
    const recent = new Map();

    const shouldSend = (event) => {
      if (!event?.id || !['create', 'update'].includes(String(event.type || ''))) return false;
      const version = String(event?.data?.updated_date || event?.data?.updated_at || event?.timestamp || '');
      const fingerprint = `${event.id}:${version}`;
      const now = Date.now();
      const previous = recent.get(fingerprint) || 0;
      recent.set(fingerprint, now);

      // Prune old browser-only dedupe entries.
      if (recent.size > 250) {
        for (const [key, at] of recent.entries()) {
          if (now - at > 10 * 60 * 1000) recent.delete(key);
        }
      }
      return now - previous > 5000;
    };

    try {
      base44.entities.CustomerOrder.subscribe((event) => {
        if (!shouldSend(event)) return;
        base44.functions
          .invoke('syncCustomerOrdersToDawaaPharmacy', { record_id: event.id })
          .catch((error) => {
            console.warn('[CustomerOrder sync] deferred; Base44 order remains saved', {
              recordId: event.id,
              message: error?.message || String(error),
            });
          });
      });
    } catch (error) {
      console.warn('[CustomerOrder sync] subscription unavailable', error);
    }
  }
}
