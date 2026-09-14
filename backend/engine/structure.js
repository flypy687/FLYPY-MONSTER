function analyzeStructure(candles) {
  if (!Array.isArray(candles) || candles.length < 12) {
    return {
      trend: "NEUTRAL",
      strength: 0,
      higherHigh: false,
      higherLow: false,
      lowerHigh: false,
      lowerLow: false
    };
  }

  const recent = candles.slice(-6);
  const previous = candles.slice(-12, -6);

  const recentHigh = Math.max(...recent.map(c => c.high));
  const previousHigh = Math.max(...previous.map(c => c.high));
  const recentLow = Math.min(...recent.map(c => c.low));
  const previousLow = Math.min(...previous.map(c => c.low));

  const higherHigh = recentHigh > previousHigh;
  const higherLow = recentLow > previousLow;
  const lowerHigh = recentHigh < previousHigh;
  const lowerLow = recentLow < previousLow;

  if (higherHigh && higherLow) {
    return {
      trend: "BULL",
      strength: 4,
      higherHigh,
      higherLow,
      lowerHigh,
      lowerLow
    };
  }

  if (lowerHigh && lowerLow) {
    return {
      trend: "BEAR",
      strength: 4,
      higherHigh,
      higherLow,
      lowerHigh,
      lowerLow
    };
  }

  if (higherHigh || higherLow) {
    return {
      trend: "BULL",
      strength: 2,
      higherHigh,
      higherLow,
      lowerHigh,
      lowerLow
    };
  }

  if (lowerHigh || lowerLow) {
    return {
      trend: "BEAR",
      strength: 2,
      higherHigh,
      higherLow,
      lowerHigh,
      lowerLow
    };
  }

  return {
    trend: "NEUTRAL",
    strength: 1,
    higherHigh,
    higherLow,
    lowerHigh,
    lowerLow
  };
}

module.exports = {
  analyzeStructure
};
