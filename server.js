require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const {
  ENV,
  isPairAllowed,
  isTimeframeAllowed
} = require("./backend/config");

const {
  candlesRoute
} = require("./backend/routes/candles");

const {
  analyzeSignal
} = require("./backend/engine/signal-engine");

const PORT = ENV.port;
const HOST = ENV.host;

const ROOT = __dirname;

const CACHE = new Map();

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ENV.corsOrigin,
    "Access-Control-Allow-Methods":
      "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type"
  });

  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": ENV.corsOrigin
  });

  res.end(text);
}

function getCacheKey({
  pair,
  timeframe,
  market
}) {
  return [
    String(market).toLowerCase(),
    pair,
    timeframe
  ].join("|");
}

function getCached(key) {
  const item = CACHE.get(key);

  if (!item) {
    return null;
  }

  if (
    Date.now() - item.timestamp >
    ENV.cacheMs
  ) {
    CACHE.delete(key);
    return null;
  }

  return item.data;
}

function setCached(key, data) {
  CACHE.set(key, {
    timestamp: Date.now(),
    data
  });
}

function cleanOldCache() {
  const now = Date.now();

  for (const [
    key,
    item
  ] of CACHE.entries()) {
    if (
      now - item.timestamp >
      ENV.cacheMs * 4
    ) {
      CACHE.delete(key);
    }
  }
}

setInterval(
  cleanOldCache,
  Math.max(ENV.cacheMs * 4, 5000)
).unref();

function validateRequest({
  server,
  pair,
  timeframe,
  market
}) {
  if (!server) {
    throw new Error(
      "Server is required."
    );
  }

  if (!pair) {
    throw new Error(
      "Pair is required."
    );
  }

  if (!timeframe) {
    throw new Error(
      "Timeframe is required."
    );
  }

  if (
    !["live", "otc"].includes(
      String(market).toLowerCase()
    )
  ) {
    throw new Error(
      "Market must be live or otc."
    );
  }

  if (
    !isPairAllowed(server, pair)
  ) {
    throw new Error(
      `Pair ${pair} is not allowed for server ${server}.`
    );
  }

  if (
    !isTimeframeAllowed(
      server,
      timeframe
    )
  ) {
    throw new Error(
      `Timeframe ${timeframe} is not allowed for server ${server}.`
    );
  }
}

async function handleCandles(
  req,
  res,
  url
) {
  const pair =
    url.searchParams.get("pair");

  const timeframe =
    url.searchParams.get("timeframe");

  const market =
    (
      url.searchParams.get("market") ||
      "live"
    ).toLowerCase();

  const server =
    (
      url.searchParams.get("server") ||
      ""
    ).toLowerCase();

  try {
    validateRequest({
      server,
      pair,
      timeframe,
      market
    });

    const cacheKey =
      getCacheKey({
        pair,
        timeframe,
        market
      });

    const cached =
      getCached(cacheKey);

    if (cached) {
      return sendJSON(res, 200, {
        ok: true,
        cached: true,
        ...cached
      });
    }

    const result =
      await candlesRoute({
        pair,
        timeframe,
        market
      });

    if (
      !result ||
      !Array.isArray(result.candles)
    ) {
      throw new Error(
        "Market feed returned no valid candle array."
      );
    }

    if (
      result.candles.length <
      ENV.minCandles
    ) {
      throw new Error(
        `Insufficient candles. Received ${result.candles.length}, required ${ENV.minCandles}.`
      );
    }

    const payload = {
      market: result.market,
      pair: result.pair,
      timeframe: result.timeframe,
      candles: result.candles.slice(
        -ENV.minCandles
      )
    };

    setCached(
      cacheKey,
      payload
    );

    return sendJSON(res, 200, {
      ok: true,
      cached: false,
      ...payload
    });
  } catch (error) {
    console.error(
      "[CANDLES ERROR]",
      error.message
    );

    return sendJSON(res, 502, {
      ok: false,
      error: error.message
    });
  }
}

async function handleSignal(
  req,
  res,
  url
) {
  const pair =
    url.searchParams.get("pair");

  const timeframe =
    url.searchParams.get("timeframe");

  const market =
    (
      url.searchParams.get("market") ||
      "live"
    ).toLowerCase();

  const server =
    (
      url.searchParams.get("server") ||
      ""
    ).toLowerCase();

  try {
    validateRequest({
      server,
      pair,
      timeframe,
      market
    });

    const cacheKey =
      getCacheKey({
        pair,
        timeframe,
        market
      });

    let marketData =
      getCached(cacheKey);

    if (!marketData) {
      const result =
        await candlesRoute({
          pair,
          timeframe,
          market
        });

      if (
        !result ||
        !Array.isArray(result.candles)
      ) {
        throw new Error(
          "No valid market candles received."
        );
      }

      marketData = {
        market: result.market,
        pair: result.pair,
        timeframe: result.timeframe,
        candles: result.candles.slice(
          -ENV.minCandles
        )
      };

      setCached(
        cacheKey,
        marketData
      );
    }

    if (
      marketData.candles.length <
      60
    ) {
      throw new Error(
        "Not enough candles for AI analysis."
      );
    }

    const analysis =
      analyzeSignal({
        candles:
          marketData.candles,
        server,
        pair,
        timeframe,
        market
      });

    return sendJSON(res, 200, {
      ok: true,

      server,
      market,
      pair,
      timeframe,

      signal:
        analysis.signal,

      direction:
        analysis.direction,

      confidence:
        analysis.confidence,

      score:
        analysis.score,

      agreement:
        analysis.agreement,

      strength:
        analysis.strength,

      risk:
        analysis.risk,

      reason:
        analysis.reason,

      reasons:
        analysis.reasons,

      analysis:
        analysis.analysis
    });
  } catch (error) {
    console.error(
      "[SIGNAL ERROR]",
      error.message
    );

    /*
      IMPORTANT:
      Feed failure never becomes a random
      CALL or PUT.
    */

    return sendJSON(res, 502, {
      ok: false,

      signal: "NO SIGNAL",

      error:
        error.message
    });
  }
}

function serveStatic(
  req,
  res,
  url
) {
  let pathname =
    decodeURIComponent(
      url.pathname
    );

  if (
    pathname === "/"
  ) {
    pathname = "/index.html";
  }

  const allowedFiles = {
    "/index.html":
      "index.html",
    "/style.css":
      "style.css",
    "/app.js":
      "app.js"
  };

  const filename =
    allowedFiles[pathname];

  if (!filename) {
    return sendText(
      res,
      404,
      "Not Found"
    );
  }

  const filePath =
    path.join(
      ROOT,
      filename
    );

  if (!fs.existsSync(filePath)) {
    return sendText(
      res,
      404,
      `${filename} not found`
    );
  }

  const ext =
    path.extname(
      filePath
    );

  const contentTypes = {
    ".html":
      "text/html; charset=utf-8",

    ".css":
      "text/css; charset=utf-8",

    ".js":
      "application/javascript; charset=utf-8"
  };

  res.writeHead(200, {
    "Content-Type":
      contentTypes[ext] ||
      "application/octet-stream"
  });

  fs.createReadStream(
    filePath
  ).pipe(res);
}

const server =
  http.createServer(
    async (req, res) => {
      try {
        if (
          req.method === "OPTIONS"
        ) {
          res.writeHead(204, {
            "Access-Control-Allow-Origin":
              ENV.corsOrigin,

            "Access-Control-Allow-Methods":
              "GET, OPTIONS",

            "Access-Control-Allow-Headers":
              "Content-Type"
          });

          return res.end();
        }

        if (
          req.method !== "GET"
        ) {
          return sendText(
            res,
            405,
            "Method Not Allowed"
          );
        }

        const url =
          new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
          );

        if (
          url.pathname ===
          "/health"
        ) {
          return sendJSON(
            res,
            200,
            {
              ok: true,
              service:
                "FLYPY MONSTER",
              status:
                "online",
              timestamp:
                new Date().toISOString()
            }
          );
        }

        if (
          url.pathname ===
          "/api/candles"
        ) {
          return await handleCandles(
            req,
            res,
            url
          );
        }

        if (
          url.pathname ===
          "/api/signal"
        ) {
          return await handleSignal(
            req,
            res,
            url
          );
        }

        return serveStatic(
          req,
          res,
          url
        );
      } catch (error) {
        console.error(
          "[SERVER ERROR]",
          error
        );

        return sendJSON(
          res,
          500,
          {
            ok: false,
            error:
              "Internal server error."
          }
        );
      }
    }
  );

server.listen(
  PORT,
  HOST,
  () => {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "        FLYPY MONSTER BACKEND"
    );
    console.log(
      "========================================"
    );
    console.log(
      `Server: http://${HOST}:${PORT}`
    );
    console.log(
      `Health: http://localhost:${PORT}/health`
    );
    console.log(
      "LIVE feed: configured"
    );
    console.log(
      "OTC feed: configured through local session"
    );
    console.log(
      "Signal engine: ACTIVE"
    );
    console.log(
      "Random/fake signals: DISABLED"
    );
    console.log(
      "========================================"
    );
    console.log("");
  }
);

process.on(
  "SIGINT",
  () => {
    console.log(
      "\nFLYPY server shutting down..."
    );

    server.close(
      () => process.exit(0)
    );
  }
);

process.on(
  "SIGTERM",
  () => {
    server.close(
      () => process.exit(0)
    );
  }
);