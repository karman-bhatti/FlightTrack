"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plane,
  X,
  Gauge,
  Compass,
  ArrowUpRight,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  Camera,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Minus,
  ShieldAlert,
  Sparkles,
  MapPin,
} from "lucide-react";
import type { FlightState } from "@/lib/opensky";
import type { City } from "@/lib/cities";
import { useRouteInfo } from "@/hooks/use-route-info";
import { useAircraftPhotos } from "@/hooks/use-aircraft-photos";
import { lookupAirline } from "@/lib/airlines";
import { airlineLogoCandidates } from "@/lib/airline-logos";
import {
  formatAltitude,
  formatSpeed,
  formatVerticalSpeed,
} from "@/lib/unit-formatters";
import { useSettings } from "@/hooks/use-settings";
import { haversineDistanceRad } from "@/lib/geo";
import { playOverheadDing } from "@/lib/overhead-sound";

type DockedModeHudProps = {
  activeCity: City;
  flights: FlightState[];
  selectedFlight: FlightState | null;
  onSelectFlight: (flight: FlightState | null) => void;
  onExit: () => void;
  onSelectCity?: (city: City) => void;
};

function headingToCompass(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return "";
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const idx = Math.round(deg / 22.5) % 16;
  return directions[idx] || "N";
}

export function DockedModeHud({
  activeCity,
  flights,
  selectedFlight,
  onSelectFlight,
  onExit,
}: DockedModeHudProps) {
  const { settings, update } = useSettings();
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [autoCycle, setAutoCycle] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef<number | null>(null);

  // ── Screen Wake Lock (prevents smart display / tablet from sleeping) ──
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator && (navigator as any).wakeLock) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // WakeLock unsupported or denied
      }
    };
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // ── Digital Clock ───────────────────────────────────────────────────
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );
      setDateStr(
        now.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      );
    };
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // ── Airborne flights in area ─────────────────────────────────────────
  const airborneFlights = useMemo(() => {
    return flights.filter(
      (f) => !f.onGround && f.latitude != null && f.longitude != null,
    );
  }, [flights]);

  // Current active spotlight flight
  const currentFlight = useMemo(() => {
    if (selectedFlight && !selectedFlight.onGround) return selectedFlight;
    if (airborneFlights.length === 0) return null;

    // Prefer overhead flight if coordinates configured
    if (settings.overheadCoordinates) {
      const [homeLng, homeLat] = settings.overheadCoordinates;
      let closest: FlightState | null = null;
      let closestDist = Infinity;
      for (const f of airborneFlights) {
        if (f.latitude == null || f.longitude == null) continue;
        const d = haversineDistanceRad(homeLng, homeLat, f.longitude, f.latitude);
        if (d < closestDist) {
          closestDist = d;
          closest = f;
        }
      }
      if (closest) return closest;
    }

    // Otherwise nearest to city center
    const [cityLng, cityLat] = activeCity.coordinates;
    let closestToCity: FlightState | null = null;
    let minCityDist = Infinity;
    for (const f of airborneFlights) {
      if (f.latitude == null || f.longitude == null) continue;
      const d = haversineDistanceRad(cityLng, cityLat, f.longitude, f.latitude);
      if (d < minCityDist) {
        minCityDist = d;
        closestToCity = f;
      }
    }
    return closestToCity ?? airborneFlights[0] ?? null;
  }, [
    selectedFlight,
    airborneFlights,
    settings.overheadCoordinates,
    activeCity.coordinates,
  ]);

  // ── Auto-cycle spotlighted flight every 16s ──────────────────────────
  useEffect(() => {
    if (!autoCycle || airborneFlights.length <= 1) return;
    const interval = window.setInterval(() => {
      const currentIndex = currentFlight
        ? airborneFlights.findIndex((f) => f.icao24 === currentFlight.icao24)
        : -1;
      const nextIndex = (currentIndex + 1) % airborneFlights.length;
      onSelectFlight(airborneFlights[nextIndex]);
    }, 16_000);

    return () => window.clearInterval(interval);
  }, [autoCycle, airborneFlights, currentFlight, onSelectFlight]);

  // ── Controls auto-fade ──────────────────────────────────────────────
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 5000);
  }, []);

  useEffect(() => {
    showControlsTemporarily();
    return () => {
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [showControlsTemporarily]);

  const handleNextFlight = useCallback(() => {
    if (airborneFlights.length === 0) return;
    const idx = currentFlight
      ? airborneFlights.findIndex((f) => f.icao24 === currentFlight.icao24)
      : -1;
    const nextIdx = (idx + 1) % airborneFlights.length;
    onSelectFlight(airborneFlights[nextIdx]);
    showControlsTemporarily();
  }, [airborneFlights, currentFlight, onSelectFlight, showControlsTemporarily]);

  const handlePrevFlight = useCallback(() => {
    if (airborneFlights.length === 0) return;
    const idx = currentFlight
      ? airborneFlights.findIndex((f) => f.icao24 === currentFlight.icao24)
      : 0;
    const prevIdx = (idx - 1 + airborneFlights.length) % airborneFlights.length;
    onSelectFlight(airborneFlights[prevIdx]);
    showControlsTemporarily();
  }, [airborneFlights, currentFlight, onSelectFlight, showControlsTemporarily]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-2.5 sm:p-4 md:p-5 select-none"
      onPointerMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* ── Top Bar: Big Glanceable Clock & Airport Stats ── */}
      <div className="flex items-start justify-between gap-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col rounded-2xl border border-foreground/[0.08] bg-background/75 p-2.5 shadow-xl backdrop-blur-2xl sm:p-3.5"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {timeStr}
            </span>
            <span className="text-[11px] font-bold text-foreground/50 sm:text-xs md:text-sm">
              {dateStr}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground/75 sm:text-xs">
            <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground sm:text-[11px]">
              {activeCity.iata}
            </span>
            <span className="font-semibold">{activeCity.name}</span>
            <span className="text-foreground/30">•</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-500">
              <Plane className="h-3 w-3" />
              {airborneFlights.length} Airborne
            </span>
          </div>
        </motion.div>

        {/* ── Top-Right Docked Mode Controls ── */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-foreground/[0.08] bg-background/75 p-1 shadow-xl backdrop-blur-2xl sm:gap-1.5 sm:p-1.5"
            >
              <button
                type="button"
                onClick={() => setAutoCycle(!autoCycle)}
                className={`flex h-8 items-center gap-1 rounded-xl px-2 text-xs font-semibold transition-colors sm:h-9 sm:px-2.5 ${
                  autoCycle
                    ? "bg-foreground/15 text-foreground"
                    : "text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
                }`}
                title={autoCycle ? "Auto-cycling flights" : "Auto-cycle paused"}
              >
                <RotateCw
                  className={`h-3.5 w-3.5 ${autoCycle ? "animate-spin" : ""}`}
                  style={{ animationDuration: "12s" }}
                />
                <span className="hidden sm:inline">Cycle</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playOverheadDing("cabin");
                  if (!settings.overheadSound) {
                    update("overheadSound", true);
                  }
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors sm:h-9 sm:w-9 ${
                  settings.overheadSound
                    ? "text-foreground hover:bg-foreground/10"
                    : "text-foreground/40 hover:bg-foreground/10"
                }`}
                title="Play / Test Cabin Chime"
              >
                {settings.overheadSound ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={onExit}
                className="flex h-8 items-center gap-1 rounded-xl bg-foreground/10 px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/20 sm:h-9 sm:px-3"
                title="Exit Docked Mode (Esc or D)"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Bar: Spotlight Flight Card ── */}
      {currentFlight && (
        <div className="flex items-end justify-between gap-3">
          <DockedFlightCard
            flight={currentFlight}
            activeCity={activeCity}
            onPrev={handlePrevFlight}
            onNext={handleNextFlight}
          />
        </div>
      )}
    </div>
  );
}

// ── Subcomponent: Large Glanceable Docked Flight Card ───────────────────────

function DockedFlightCard({
  flight,
  activeCity,
  onPrev,
  onNext,
}: {
  flight: FlightState;
  activeCity: City;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { settings } = useSettings();
  const route = useRouteInfo(flight);
  const { photos, aircraft } = useAircraftPhotos(
    flight.icao24,
    flight.callsign?.trim() ?? null,
  );

  const callsign = flight.callsign?.trim() || flight.icao24.toUpperCase();
  const airline = useMemo(() => lookupAirline(callsign), [callsign]);
  const logoCandidates = useMemo(
    () => airlineLogoCandidates(callsign),
    [callsign],
  );
  const [logoIdx, setLogoIdx] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoIdx(0);
    setLogoFailed(false);
  }, [callsign]);

  const photo = photos[0] ?? null;
  const photoUrl = photo ? photo.thumbnail || photo.url : null;

  const altitudeStr =
    flight.baroAltitude != null
      ? formatAltitude(flight.baroAltitude, settings.unitSystem)
      : "In flight";

  const speedStr =
    flight.velocity != null
      ? formatSpeed(flight.velocity, settings.unitSystem)
      : null;

  const vspeedStr =
    flight.verticalRate != null
      ? formatVerticalSpeed(flight.verticalRate, settings.unitSystem)
      : null;

  const isEmergencySquawk =
    flight.squawk === "7700" ||
    flight.squawk === "7600" ||
    flight.squawk === "7500";

  // Distance computation
  const distanceInfo = useMemo(() => {
    if (flight.longitude == null || flight.latitude == null) return null;

    if (
      settings.overheadCoordinates &&
      settings.overheadCoordinates.length === 2
    ) {
      const [hLng, hLat] = settings.overheadCoordinates;
      const dKm =
        haversineDistanceRad(hLng, hLat, flight.longitude, flight.latitude) *
        6371;
      if (dKm <= 1.8) {
        return { text: "Directly Overhead", isOverhead: true };
      }
      return {
        text: `${dKm < 10 ? dKm.toFixed(1) : Math.round(dKm)} km from Home`,
        isOverhead: false,
      };
    }

    const [cLng, cLat] = activeCity.coordinates;
    const dKm =
      haversineDistanceRad(cLng, cLat, flight.longitude, flight.latitude) * 6371;
    return {
      text: `${dKm < 10 ? dKm.toFixed(1) : Math.round(dKm)} km from ${activeCity.iata}`,
      isOverhead: false,
    };
  }, [
    flight.longitude,
    flight.latitude,
    settings.overheadCoordinates,
    activeCity.coordinates,
    activeCity.iata,
  ]);

  const headingCompass = headingToCompass(flight.trueTrack);
  const aircraftModel =
    aircraft?.type ||
    (aircraft?.manufacturer && aircraft?.typeCode
      ? `${aircraft.manufacturer} ${aircraft.typeCode}`
      : aircraft?.typeCode || null);

  return (
    <motion.div
      key={flight.icao24}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="pointer-events-auto flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-foreground/[0.1] bg-background/85 shadow-2xl backdrop-blur-2xl"
    >
      <div className="flex items-stretch">
        {/* Photo thumbnail if available */}
        {photoUrl && (
          <div className="relative hidden w-32 shrink-0 overflow-hidden bg-foreground/5 sm:block sm:w-36 md:w-40">
            <img
              src={photoUrl}
              alt="Aircraft"
              className="h-full w-full object-cover"
              loading="eager"
            />
            {photo?.photographer && (
              <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-background/70 px-1 py-0.5 text-[8px] font-medium text-foreground/75 backdrop-blur-xs">
                <Camera className="h-2 w-2" />
                {photo.photographer}
              </span>
            )}
          </div>
        )}

        {/* Main Details */}
        <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3.5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {!logoFailed && logoCandidates[logoIdx] && (
                <img
                  src={logoCandidates[logoIdx]}
                  alt="Logo"
                  className="h-5 w-5 shrink-0 rounded-full bg-white object-contain p-0.5 shadow-xs"
                  onError={() => {
                    if (logoIdx + 1 < logoCandidates.length) {
                      setLogoIdx(logoIdx + 1);
                    } else {
                      setLogoFailed(true);
                    }
                  }}
                />
              )}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-black tracking-tight text-foreground sm:text-lg md:text-xl truncate">
                    {callsign}
                  </span>

                  {isEmergencySquawk && (
                    <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-red-500 animate-pulse">
                      <ShieldAlert className="h-2.5 w-2.5" />
                      SQK {flight.squawk}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/60 truncate">
                  <span>{airline ?? aircraftModel ?? flight.icao24.toUpperCase()}</span>
                  {aircraft?.registration && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{aircraft.registration}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Prev / Next Flight buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onPrev}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground sm:h-8 sm:w-8"
                aria-label="Previous flight"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground sm:h-8 sm:w-8"
                aria-label="Next flight"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Route Section */}
          {route.available && route.origin && route.destination ? (
            <div className="my-1.5 flex items-center gap-2 rounded-xl bg-foreground/[0.04] px-2.5 py-1.5">
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-xs font-bold text-foreground sm:text-sm">
                  {route.origin.iata || route.origin.icao}
                </span>
                <span className="max-w-[85px] truncate text-[9px] text-foreground/50 sm:max-w-[120px] sm:text-[10px]">
                  {route.origin.municipality || route.origin.name}
                </span>
              </div>

              <div className="flex flex-1 items-center justify-center gap-1 text-foreground/35">
                <div className="h-px flex-1 bg-foreground/15" />
                <ArrowUpRight className="h-3 w-3" />
                <div className="h-px flex-1 bg-foreground/15" />
              </div>

              <div className="flex flex-col items-end min-w-0">
                <span className="font-mono text-xs font-bold text-foreground sm:text-sm">
                  {route.destination.iata || route.destination.icao}
                </span>
                <span className="max-w-[85px] truncate text-[9px] text-foreground/50 sm:max-w-[120px] sm:text-[10px]">
                  {route.destination.municipality || route.destination.name}
                </span>
              </div>
            </div>
          ) : (
            <div className="my-1 flex items-center gap-2 text-[11px] text-foreground/45">
              {flight.trueTrack != null && (
                <span className="flex items-center gap-1 font-mono">
                  <Compass className="h-3 w-3 text-foreground/40" />
                  {Math.round(flight.trueTrack)}° {headingCompass}
                </span>
              )}
              {distanceInfo && (
                <>
                  <span>•</span>
                  <span>{distanceInfo.text}</span>
                </>
              )}
            </div>
          )}

          {/* Metrics Row */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 font-mono text-[11px] sm:text-xs">
            {/* Altitude */}
            <span className="inline-flex items-center gap-1 rounded-md bg-foreground/6 px-1.5 py-0.5 font-bold text-foreground/90">
              <Plane className="h-3 w-3 text-sky-400" />
              {altitudeStr}
            </span>

            {/* Ground Speed */}
            {speedStr && (
              <span className="inline-flex items-center gap-1 rounded-md bg-foreground/6 px-1.5 py-0.5 text-foreground/80 font-medium">
                <Gauge className="h-3 w-3 text-amber-400" />
                {speedStr}
              </span>
            )}

            {/* Vertical Speed */}
            {vspeedStr && flight.verticalRate != null && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${
                  flight.verticalRate > 0.6
                    ? "bg-emerald-500/10 text-emerald-500"
                    : flight.verticalRate < -0.6
                      ? "bg-orange-500/10 text-orange-400"
                      : "bg-foreground/6 text-foreground/60"
                }`}
              >
                {flight.verticalRate > 0.6 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : flight.verticalRate < -0.6 ? (
                  <ArrowDown className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {vspeedStr}
              </span>
            )}

            {/* Distance / Overhead Beacon */}
            {distanceInfo && (
              <span
                className={`hidden items-center gap-1 rounded-md px-1.5 py-0.5 font-medium sm:inline-flex ${
                  distanceInfo.isOverhead
                    ? "bg-emerald-500/15 text-emerald-400 font-bold"
                    : "bg-foreground/6 text-foreground/60"
                }`}
              >
                {distanceInfo.isOverhead ? (
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                ) : (
                  <MapPin className="h-3 w-3 text-foreground/40" />
                )}
                {distanceInfo.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
