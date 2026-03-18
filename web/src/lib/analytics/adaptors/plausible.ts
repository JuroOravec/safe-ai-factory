import { type AnalyticsAdapter } from '../types';

/**
 * Plausible's script (loaded by PlausibleProvider) exposes window.plausible.
 * This adapter calls it directly — no React context. If the script hasn't
 * loaded yet, calls no-op.
 */
export const plausibleAdapter: AnalyticsAdapter = {
  track(event: string, props?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    const plausible = (
      window as Window & { plausible?: (e: string, o?: { props?: Record<string, string> }) => void }
    ).plausible;
    if (plausible) {
      if (props) plausible(event, { props: props as Record<string, string> });
      else plausible(event);
    }
  },
};
