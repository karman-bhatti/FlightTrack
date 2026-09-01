"use client";

import { motion } from "motion/react";
import {
  Plane,
  Radio,
  X,
  Compass,
  Gauge,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
} from "lucide-react";
import type { FlightState } from "@/lib/opensky";
import { lookupAirline } from "@/lib/airlines";
import { airlineLogoCandidates } from "@/lib/airline-logos";
import {
  formatAltitude,
  formatSpeed,
  formatVerticalSpeed,
} from "@/lib/unit-formatters";
import { useState, useMemo } from "react";

type OverheadAlertToastProps = {
  flight: FlightState;
  distanceKm: number;
  addressLabel: string;
  unitSystem?: "aviation" | "metric" | "imperial";
  onTrack: () => void;
  onDismiss: () => void;
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

export function OverheadAlertToast({
  flight,
  distanceKm,
  addressLabel,
  unitSystem = "aviation",
  onTrack,
  onDismiss,
}: OverheadAlertToastProps) {
  const callsign = flight.callsign?.trim() || flight.icao24.toUpperCase();
  const airline = useMemo(() => lookupAirline(callsign), [callsign]);
  const logoCandidates = useMemo(
    () => airlineLogoCandidates(callsign),
    [callsign],
  );
  const [logoIdx, setLogoIdx] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);

  const altitudeStr =
    flight.baroAltitude != null
      ? formatAltitude(flight.baroAltitude, unitSystem)
      : "In Flight";

  // Calculate Flight Level (e.g. FL340)
  const flightLevel = useMemo(() => {
    if (flight.baroAltitude == null) return null;
    const feet = flight.baroAltitude * 3.28084;
    if (feet >= 18000) {
      return `FL${Math.round(feet / 100)}`;
    }
    return null;
  }, [flight.baroAltitude]);

  const speedStr =
    flight.velocity != null ? formatSpeed(flight.velocity, unitSystem) : null;

  const vspeedStr =
    flight.verticalRate != null
      ? formatVerticalSpeed(flight.verticalRate, unitSystem)
      : null;

  const isOverhead = distanceKm <= 1.8;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -12 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className="relative flex w-[350px] sm:w-[380px] flex-col overflow-hidden rounded-2xl border border-emerald-500/40 bg-zinc-950/95 p-3.5 text-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-2xl ring-1 ring-emerald-500/20"
      role="alert"
    >
      {/* Top Avionics Radar Bar */}
      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <span className="font-mono text-[10px] font-black tracking-widest text-emerald-400 uppercase">
            TRAFFIC ALERT • OVERHEAD
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
            {isOverhead ? "DIRECTLY OVERHEAD" : `${distanceKm.toFixed(1)} KM`}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Dismiss alert"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Aircraft Telemetry Header */}
      <div className="my-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {!logoFailed && logoCandidates[logoIdx] && (
            <img
              src={logoCandidates[logoIdx]}
              alt="Logo"
              className="h-7 w-7 shrink-0 rounded-full bg-white object-contain p-0.5 shadow-sm"
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
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl font-black tracking-tight text-white">
                {callsign}
              </span>
              {flightLevel && (
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {flightLevel}
                </span>
              )}
            </div>

            <span className="truncate text-xs font-medium text-zinc-400">
              {airline ?? flight.typeCode ?? flight.icao24.toUpperCase()}
              {addressLabel ? ` • ${addressLabel}` : ""}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onTrack}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-md transition-all hover:bg-emerald-400 active:scale-95"
        >
          <Plane className="h-3.5 w-3.5" />
          <span>TRACK</span>
        </button>
      </div>

      {/* Avionics Telemetry Grid */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-zinc-900/80 p-2 font-mono text-[11px] ring-1 ring-zinc-800">
        {/* Altitude */}
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold text-zinc-500 uppercase">
            ALTITUDE
          </span>
          <span className="font-bold text-zinc-200">{altitudeStr}</span>
        </div>

        {/* Speed */}
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold text-zinc-500 uppercase">
            SPEED
          </span>
          <span className="font-bold text-zinc-200">{speedStr ?? "-"}</span>
        </div>

        {/* Vertical Rate */}
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold text-zinc-500 uppercase">
            V/S RATE
          </span>
          <span
            className={`flex items-center gap-0.5 font-bold ${
              flight.verticalRate != null && flight.verticalRate > 0.5
                ? "text-emerald-400"
                : flight.verticalRate != null && flight.verticalRate < -0.5
                  ? "text-orange-400"
                  : "text-zinc-300"
            }`}
          >
            {flight.verticalRate != null && flight.verticalRate > 0.5 ? (
              <ArrowUp className="h-2.5 w-2.5" />
            ) : flight.verticalRate != null && flight.verticalRate < -0.5 ? (
              <ArrowDown className="h-2.5 w-2.5" />
            ) : null}
            {vspeedStr ?? "LEVEL"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
