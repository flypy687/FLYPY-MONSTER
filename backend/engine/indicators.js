function sma(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;

  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function ema(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let result =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) /
    period;

  for (let i = period; i < values.length; i += 1) {
    result =
      values[i] * multiplier +
      result * (1 - multiplier);
  }

  return result;
}

function rsi(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let i = candles.length - period; i < candles.length; i += 1) {
    const delta = candles[i].close - candles[i - 1].close;

    if (delta > 0) gains += delta;
    if (delta < 0) losses -= delta;
  }

  if (losses === 0) return 100;

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function trueRange(current, previous) {
  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previous.close),
    Math.abs(current.low - previous.close)
  );
}

function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return null;
  }

  const ranges = [];

  for (let i = 1; i < candles.length; i += 1) {
    ranges.push(trueRange(candles[i], candles[i - 1]));
  }

  return sma(ranges, period);
}

function macd(candles) {
  if (!Array.isArray(candles)) return null;

  const closes = candles.map(candle => candle.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);

  if (fast === null || slow === null) return null;

  return fast - slow;
}

function adxLike(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length < period + 1) {
    return null;
  }

  let directional = 0;
  let totalRange = 0;

  for (let i = candles.length - period; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];

    const range = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );

    const move = current.close - previous.close;

    directional += Math.abs(move);
    totalRange += range;
  }

  if (totalRange === 0) return 0;

  return Math.min(100, (directional / totalRange) * 100);
}

module.exports = {
  sma,
  ema,
  rsi,
  atr,
  macd,
  adxLike
};
