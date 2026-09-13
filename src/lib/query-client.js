import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// Cache افتراضي موحد يقلل إعادة سحب نفس البيانات أثناء التنقل السريع بين الصفحات.
			staleTime: 60000,
			gcTime: 15 * 60 * 1000,
			refetchOnWindowFocus: false,
			refetchOnReconnect: true,
			retry: 1,
		},
	},
});