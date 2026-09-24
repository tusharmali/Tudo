/** Robust browser geolocation for check-in. Client-only (uses navigator). */

export type Coords = { lat: number; lng: number; accuracy: number };

function once(opts: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
}

const BLOCKED_MSG =
  "Location is blocked for this site. Tap the location / lock icon in your browser's address bar, choose Allow, then tap Check in again.";
const DENIED_MSG = "Please tap Allow on the location prompt, then tap Check in again.";
const FAIL_MSG = "Couldn't get your location. Turn on location for your device + browser and try again — or use your phone.";

/** After a permission denial, is it a persistent block (needs settings) or a
 *  one-time dismissal (the prompt can show again next tap)? */
async function deniedMessage(): Promise<string> {
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (perm?.state === "denied") return BLOCKED_MSG;
  } catch {
    /* Permissions API unsupported — assume it can re-prompt. */
  }
  return DENIED_MSG;
}

/**
 * Ask the browser for the current position. We call getCurrentPosition
 * IMMEDIATELY (inside the click) so the native permission prompt fires within
 * the user gesture — awaiting anything first can suppress the popup in some
 * browsers. Only after a failure do we inspect the permission state to word the
 * message. A precise fix that times out (common on laptops) retries coarser.
 */
export async function getCurrentCoords(): Promise<Coords> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new Error("Location isn't available on this device.");
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
    if ((err as GeolocationPositionError)?.code === 1) throw new Error(await deniedMessage());
    // Timeout / position unavailable — retry with a faster, coarser fix.
    try {
      return toCoords(await once({ enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }));
    } catch (err2) {
      if ((err2 as GeolocationPositionError)?.code === 1) throw new Error(await deniedMessage());
      throw new Error(FAIL_MSG);
    }
  }
}

/** Call `cb` if/when the geolocation permission flips away from "denied"
 *  (e.g. the user allows it in site settings) — lets the UI auto-recover
 *  without a reload. Returns an unsubscribe fn. No-op where unsupported. */
export function onLocationEnabled(cb: () => void): () => void {
  let status: PermissionStatus | null = null;
  const handler = () => {
    if (status && status.state !== "denied") cb();
  };
  try {
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((s) => {
        status = s;
        s.addEventListener("change", handler);
      })
      .catch(() => {});
  } catch {
    /* unsupported */
  }
  return () => status?.removeEventListener("change", handler);
}
