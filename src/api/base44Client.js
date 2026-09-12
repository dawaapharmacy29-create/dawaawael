import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Create a client with authentication required by each feature as before.
// CustomerOrder automatic sync is intentionally NOT started from the browser.
// The single automatic path is the server workflow -> syncEntityToDawaaBills -> Outbox,
// which mirrors CustomerOrder to both DawaaBills and the management app with retry tracking.
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
