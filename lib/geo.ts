/** Robust browser geolocation for check-in. Client-only (uses navigator). */

export type Coords = { lat: number; lng: number; accuracy: number };

function once(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
}

const BLOCKED_MSG =
  "Location is blocked for this site. Tap the location / lock icon in your browser's address bar, allow location, then try again.";
const DENIED_MSG = "Please allow location access when prompted, then tap Check in again.";
const FAIL_MSG = "Couldn't get your location. Turn on location for your device + browser and try again — or use your phone.";

/**
 * Ask the browser for the current position. Triggers the permission prompt when
 * it hasn't been decided yet; gives clear guidance when it's blocked; and if a
 * precise fix times out (common on laptops), retries with a faster low-accuracy
 * fix that uses Wi-Fi / network location.
 */
export async function getCurrentCoords(): Promise<Coords> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new Error("Location isn't available on this device.");
  }

  // If we can tell it's already blocked, say so clearly (a re-prompt won't show).
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (perm?.state === "denied") throw new Error(BLOCKED_MSG);
  } catch (e) {
    if (e instanceof Error && e.message === BLOCKED_MSG) throw e;
    /* Permissions API not supported — fall through and just try. */
  }

  const toCoords = (p: GeolocationPosition): Coords => ({
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: p.coords.accuracy,
  });

  try {
    // Precise first, but accept a recent cached fix to avoid a needless wait.
    return toCoords(await once({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }));
  } catch (err) {
    if ((err as GeolocationPositionError)?.code === 1) throw new Error(DENIED_MSG);
    // Timeout / position unavailable — retry with a faster, coarser fix.
    try {
      return toCoords(await once({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }));
    } catch (err2) {
      if ((err2 as GeolocationPositionError)?.code === 1) throw new Error(DENIED_MSG);
      throw new Error(FAIL_MSG);
    }
  }
}
