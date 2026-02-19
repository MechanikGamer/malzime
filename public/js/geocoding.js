import { state } from "./state.js";
import { getLanguage } from "./i18n.js";

/* Geocoding vorausladen — wird gestartet sobald GPS gefunden wird,
   läuft parallel zur Analyse. Retry bei TLS 425 "Too Early". */
export function startGeocoding(lat, lng) {
  /* Laufendes Geocoding abbrechen (BUG-005) */
  if (state.geocodeAbortController) state.geocodeAbortController.abort();
  state.geocodeAbortController = new AbortController();
  const signal = state.geocodeAbortController.signal;
  const timeoutId = setTimeout(() => {
    if (!signal.aborted) state.geocodeAbortController.abort();
  }, 15000);

  const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${getLanguage()}`;
  const doFetch = () =>
    fetch(geoUrl, {
      headers: { "User-Agent": "malzime-workshop-demo/1.0" },
      signal,
    });
  state.pendingGeocode = (async () => {
    try {
      let res;
      try {
        res = await doFetch();
      } catch (_e) {
        if (signal.aborted) return null;
        await new Promise((r) => setTimeout(r, 600));
        res = await doFetch();
      }
      const data = await res.json();
      return data.display_name || null;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  })();
}
