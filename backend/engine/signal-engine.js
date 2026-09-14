const {
  SIGNAL_PROFILES,
  PAIRS,
  TIMEFRAMES,
  MIN_CANDLES
} = require("../config");

const { analyzeConfluence } = require("./confluence");

function normalizeServer(server) {
  return String(server || "").trim().toLowerCase();
}

function validateSelection({ server, pair, timeframe }) {
  const s = normalizeServer(server);

  if (!SIGNAL_PROFILES[s]) {
    return { ok: false, reason: "Unknown server." };
  }

  if (!PAIRS[s].includes(pair)) {
    return { ok: false, reason: "Pair is not enabled for this server." };
  }

  if (!TIMEFRAMES[s].includes(timeframe)) {
    return { ok: false, reason: "Timeframe is not enabled for this server." };
  }

  return {
    ok: true,
    server: s
  };
}

function buildSignal({ server, pair, timeframe, candles }) {
  const selection = validateSelection({
    server,
    pair,
    timeframe
  });

  if (!selection.ok) {
    return {
      signal: "NO SIGNAL",
      allowed: false,
      reason: selection.reason
    };
  }

  if (!Array.isArray(candles) || candles.length < MIN_CANDLES) {
    return {
      signal: "NO SIGNAL",
      allowed: false,
      reason: `At least ${MIN_CANDLES} valid candles are required.`
    };
  }

  const profile = SIGNAL_PROFILES[selection.server];
  const analysis = analyzeConfluence(candles);

  if (analysis.side === "NONE") {
    return {
      signal: "NO SIGNAL",
      allowed: false,
      reason: "Market evidence is conflicting.",
      analysis
    };
  }

  if (analysis.score < profile.minScore) {
    return {
      signal: "NO SIGNAL",
      allowed: false,
      reason: "Confluence score is below the server threshold.",
      analysis
    };
  }

  if (analysis.agreement < profile.minAgreement) {
    return {
      signal: "NO SIGNAL",
      allowed: false,
      reason: "Indicator agreement is below the server threshold.",
      analysis
    };
  }

  if (analysis.trendStrength !== null &&
      analysis.trendStrength < profile.minTrendStrength * 10) {
    return {
      signal: "NO SIGNAL",
      allowed: false,
      reason: "Trend strength is too weak.",
      analysis
    };
  }

  const signal = analysis.side === "BUY" ? "CALL" : "PUT";

  return {
    signal,
    allowed: true,
    server: selection.server,
    pair,
    timeframe,
    score: analysis.score,
    confidence: analysis.score,
    strength:
      analysis.score >= 92
        ? "ELITE"
        : analysis.score >= 86
          ? "STRONG"
          : "MODERATE",
    risk:
      analysis.score >= 90
        ? "LOW"
        : "CONTROLLED",
    analysis
  };
}

module.exports = {
  validateSelection,
  buildSignal
};
