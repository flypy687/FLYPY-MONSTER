const {
  ema,
  rsi,
  atr,
  macd,
  adxLike
} = require("./indicators");

const { analyzeStructure } = require("./structure");

function candleQuality(candle) {
  const range = candle.high - candle.low;

  if (range <= 0) {
    return {
      direction: "NEUTRAL",
      quality: 0
    };
  }

  const body = Math.abs(candle.close - candle.open);
  const bodyRatio = body / range;

  if (bodyRatio < 0.35) {
    return {
      direction: "NEUTRAL",
      quality: bodyRatio
    };
  }

  return {
    direction:
      candle.close > candle.open
        ? "BULL"
        : candle.close < candle.open
          ? "BEAR"
          : "NEUTRAL",
    quality: bodyRatio
  };
}

function analyzeConfluence(candles) {
  if (!Array.isArray(candles) || candles.length < 60) {
    return {
      side: "NONE",
      score: 0,
      agreement: 0,
      reason: "Insufficient candles"
    };
  }

  const closes = candles.map(c => c.close);
  const last = candles.at(-1);

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsiValue = rsi(candles, 14);
  const atrValue = atr(candles, 14);
  const macdValue = macd(candles);
  const trendStrength = adxLike(candles, 14);
  const structure = analyzeStructure(candles);
  const quality = candleQuality(last);

  let bull = 0;
  let bear = 0;

  // Trend
  if (ema20 !== null && ema50 !== null) {
    if (last.close > ema20 && ema20 > ema50) bull += 3;
    if (last.close < ema20 && ema20 < ema50) bear += 3;
  }

  // Structure
  if (structure.trend === "BULL") bull += structure.strength;
  if (structure.trend === "BEAR") bear += structure.strength;

  // Momentum / RSI
  if (rsiValue !== null) {
    if (rsiValue >= 52 && rsiValue < 70) bull += 2;
    if (rsiValue <= 48 && rsiValue > 30) bear += 2;
  }

  // MACD direction
  if (macdValue !== null) {
    if (macdValue > 0) bull += 2;
    if (macdValue < 0) bear += 2;
  }

  // Last-candle confirmation
  if (quality.direction === "BULL" && quality.quality >= 0.55) bull += 2;
  if (quality.direction === "BEAR" && quality.quality >= 0.55) bear += 2;

  const total = bull + bear;

  if (total === 0) {
    return {
      side: "NONE",
      score: 0,
      agreement: 0,
      reason: "No confluence",
      trendStrength,
      atr: atrValue,
      rsi: rsiValue,
      macd: macdValue,
      structure,
      candle: quality
    };
  }

  const side = bull > bear ? "BUY" : bear > bull ? "SELL" : "NONE";
  const dominant = Math.max(bull, bear);
  const score = Math.round((dominant / total) * 100);
  const agreement = dominant / total;

  return {
    side,
    score,
    agreement,
    bull,
    bear,
    trendStrength,
    atr: atrValue,
    rsi: rsiValue,
    macd: macdValue,
    structure,
    candle: quality
  };
}

module.exports = {
  analyzeConfluence
};
