/**
 * Flight API client - barrel re-export.
 *
 * Default 2-tier fallback chain:
 *   Tier 1: adsb.fi        (server proxy, primary)
 *   Tier 2: adsb.lol       (server proxy, fallback)
 *
 * Override: add ?provider=adsbfi|adsb to the URL.
 *
 * @see https://github.com/adsbfi/opendata
 * @see https://api.adsb.lol/docs
 */

// ── Types ──────────────────────────────────────────────────────────────
export type { RawAircraft, ReadsbApiResponse } from "./flight-api-types";

export type { FlightApiFetchResult, ProviderName } from "./flight-api-client";

// ── Constants ──────────────────────────────────────────────────────────
export { MAX_RADIUS_NM, NM_PER_DEG_LAT } from "./flight-api-types";

// ── Client ─────────────────────────────────────────────────────────────
export {
  fetchFlightsByPoint,
  fetchFlightByHex,
  fetchFlightByCallsign,
  getProviderOverride,
  setProviderOverride,
  PROVIDER_CHANGE_EVENT,
  getCircuitState,
  resetAllCircuits,
} from "./flight-api-client";

export type { CircuitState } from "./flight-api-client";

// ── Parser ─────────────────────────────────────────────────────────────
export { parseAircraftList } from "./flight-api-parsing";
