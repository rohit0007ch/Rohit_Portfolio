import { useEffect } from 'react';
import { startVisitorTracking } from '../lib/tracking/tracker';

/**
 * Mounts silent visitor analytics. Errors never propagate to the UI.
 */
export function useVisitorTracking(): void {
  useEffect(() => {
    startVisitorTracking();
  }, []);
}
