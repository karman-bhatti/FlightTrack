import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchFlightByHex,
  fetchFlightsByCallsign,
  fetchFlightsByHex,
  fetchFlightsByPoint,
  getCircuitState,
  PROVIDER_CHANGE_EVENT,
  resetAllCircuits,
  setProviderOverride,
} from "./flight-api-client";

function rawAircraft(hex = "abc123") {
  return {
    hex,
    type: "adsb_icao",
    flight: "TST123 ",
    lat: 12.5,
    lon: 77.6,
    alt_baro: 30_000,
    seen_pos: 0.2,
  };
}

function readsbResponse(ac: unknown[], status = 200): Response {
  return Response.json(
    { ac, msg: "No error", now: Date.now(), total: ac.length },
    { status },
  );
}

function openskyResponse(hex = "abc123"): Response {
  return Response.json({
    time: 1,
    states: [
      [
        hex,
        "TST123 ",
        "Unknown",
        1,
        1,
        77.6,
        12.5,
        9_144,
        false,
        220,
        90,
        0,
        null,
        9_200,
        "1200",
        false,
        0,
        3,
      ],
    ],
  });
}

function restoreWindow(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(globalThis, "window", descriptor);
  } else {
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
  }
}

function providerFromRequest(input: RequestInfo | URL | string): string | null {
  return new URL(input.toString(), "http://localhost").searchParams.get(
    "provider",
  );
}

test("provider selection updates the URL and emits an immediate refresh event", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events: string[] = [];
  const location = {
    href: "https://aeris.example/city/sfo?provider=adsb",
    search: "?provider=adsb",
  };
  const fakeWindow = {
    location,
    history: {
      replaceState: (_state: unknown, _unused: string, href: string) => {
        location.href = href;
        location.search = new URL(href).search;
      },
    },
    addEventListener: () => {},
    dispatchEvent: (event: Event) => {
      events.push(event.type);
      return true;
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });

  try {
    setProviderOverride("adsbfi");
    assert.equal(location.search, "?provider=adsbfi");
    assert.deepEqual(events, [PROVIDER_CHANGE_EVENT]);

    setProviderOverride("auto");
    assert.equal(location.search, "");
    assert.deepEqual(events, [PROVIDER_CHANGE_EVENT, PROVIDER_CHANGE_EVENT]);
  } finally {
    restoreWindow(originalWindow);
  }
});

test("adsb.fi success short-circuits point fallback", async () => {
  resetAllCircuits();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    calls.push(input.toString());
    return readsbResponse([rawAircraft()]);
  };

  try {
    const result = await fetchFlightsByPoint(12.5, 77.6, 1);
    assert.equal(result.source, "adsbfi");
    assert.equal(result.flights.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(providerFromRequest(calls[0]), "adsbfi");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a valid empty point response does not trigger fallback", async () => {
  resetAllCircuits();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    calls.push(input.toString());
    return readsbResponse([]);
  };

  try {
    const result = await fetchFlightsByPoint(12.5, 77.6, 1);
    assert.deepEqual(result.flights, []);
    assert.equal(result.source, "adsbfi");
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an adsb.fi point failure falls back to adsb.lol", async () => {
  resetAllCircuits();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    calls.push(url);
    const provider = providerFromRequest(url);
    return provider === "adsbfi"
      ? new Response(null, { status: 502 })
      : readsbResponse([rawAircraft()]);
  };

  try {
    const result = await fetchFlightsByPoint(12.5, 77.6, 1);
    assert.equal(result.source, "adsb");
    assert.equal(result.flights.length, 1);
    assert.equal(calls.length, 2);
    assert.equal(providerFromRequest(calls[0]), "adsbfi");
    assert.equal(providerFromRequest(calls[1]), "adsb");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an empty hex lookup continues from adsb.fi to adsb.lol", async () => {
  resetAllCircuits();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    calls.push(url);
    return providerFromRequest(url) === "adsbfi"
      ? readsbResponse([])
      : readsbResponse([rawAircraft()]);
  };

  try {
    const result = await fetchFlightsByHex("abc123");
    assert.equal(result.source, "adsb");
    assert.equal(result.flights.length, 1);
    assert.equal(calls.length, 2);
    assert.equal(providerFromRequest(calls[0]), "adsbfi");
    assert.equal(providerFromRequest(calls[1]), "adsb");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("explicit adsb.lol override stays pinned", async () => {
  resetAllCircuits();
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const calls: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "?provider=adsb" },
      addEventListener: () => {},
    },
  });
  globalThis.fetch = async (input: RequestInfo | URL) => {
    calls.push(input.toString());
    return readsbResponse([rawAircraft()]);
  };

  try {
    const result = await fetchFlightsByPoint(12.5, 77.6, 1);
    assert.equal(result.source, "adsb");
    assert.equal(calls.length, 1);
    assert.equal(providerFromRequest(calls[0]), "adsb");
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow(originalWindow);
  }
});

test("explicit adsb.fi override stays pinned", async () => {
  resetAllCircuits();
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const calls: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "?provider=adsbfi" },
      addEventListener: () => {},
    },
  });
  globalThis.fetch = async (input: RequestInfo | URL) => {
    calls.push(input.toString());
    return readsbResponse([rawAircraft()]);
  };

  try {
    const result = await fetchFlightsByPoint(12.5, 77.6, 1);
    assert.equal(result.source, "adsbfi");
    assert.equal(calls.length, 1);
    assert.equal(providerFromRequest(calls[0]), "adsbfi");
  } finally {
    globalThis.fetch = originalFetch;
    restoreWindow(originalWindow);
  }
});

test("401 and 403 open a provider circuit immediately for five minutes", async () => {
  for (const status of [401, 403]) {
    resetAllCircuits();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) =>
      providerFromRequest(input) === "adsbfi"
        ? new Response(null, { status })
        : readsbResponse([rawAircraft()]);

    try {
      await fetchFlightsByPoint(12.5, 77.6, 1);
      const circuit = getCircuitState("adsbfi");
      assert.equal(circuit.state, "open");
      assert.ok(circuit.cooldownRemaining > 299_000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test("429 remains rate limiting and does not open the circuit", async () => {
  resetAllCircuits();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) =>
    providerFromRequest(input) === "adsbfi"
      ? new Response(null, { status: 429 })
      : readsbResponse([rawAircraft()]);

  try {
    const result = await fetchFlightsByPoint(12.5, 77.6, 1);
    assert.equal(result.source, "adsb");
    assert.equal(getCircuitState("adsbfi").state, "closed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("one-off lookup success does not change point-polling stickiness", async () => {
  resetAllCircuits();
  let phase: "lookup" | "point" = "lookup";
  const pointCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = input.toString();
    if (phase === "lookup") {
      return providerFromRequest(url) === "adsbfi"
        ? readsbResponse([])
        : readsbResponse([rawAircraft()]);
    }
    pointCalls.push(url);
    return readsbResponse([rawAircraft()]);
  };

  try {
    assert.ok((await fetchFlightByHex("abc123")).flight);
    phase = "point";
    const result = await fetchFlightsByPoint(12.5, 77.6, 1);
    assert.equal(result.source, "adsbfi");
    assert.equal(pointCalls.length, 1);
    assert.equal(providerFromRequest(pointCalls[0]), "adsbfi");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid callsigns are rejected before any provider request", async () => {
  resetAllCircuits();
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCount++;
    return readsbResponse([]);
  };

  try {
    assert.deepEqual(await fetchFlightsByCallsign("TOO-LONG-123"), {
      flights: [],
      rateLimited: false,
    });
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
