import { QueryClient } from '@tanstack/react-query'

// The single QueryClient of the app. Module-level singleton so the cache can be
// cleared from `AuthContext` (which lives under `QueryClientProvider`) without
// reaching into the providers tree: switching accounts must not leak the
// previous user's cached data (tasks, calls, access…), so login/logout/session
// expiry call `queryClient.clear()`.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})