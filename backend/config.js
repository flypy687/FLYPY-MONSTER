const SIGNAL_PROFILES = Object.freeze({
  granted: Object.freeze({ minScore:84, minAgreement:0.82, minTrendStrength:3, maxSpreadATR:0.35, requireMTF:true }),
  powerx: Object.freeze({ minScore:80, minAgreement:0.78, minTrendStrength:2, maxSpreadATR:0.45, requireMTF:true }),
  ultrafx: Object.freeze({ minScore:82, minAgreement:0.80, minTrendStrength:3, maxSpreadATR:0.40, requireMTF:true })
});

const PAIRS = Object.freeze({
  granted:Object.freeze(["EUR/USD"]),
  powerx:Object.freeze(["USD/JPY","GBP/USD","AUD/USD"]),
  ultrafx:Object.freeze(["USD/CAD","EUR/JPY"])
});

const TIMEFRAMES = Object.freeze({
  granted:Object.freeze(["1 Minute"]),
  powerx:Object.freeze(["15 Seconds","30 Seconds","1 Minute"]),
  ultrafx:Object.freeze(["30 Seconds","1 Minute","5 Minutes"])
});

const ENV = Object.freeze({
  port:Number(process.env.PORT || 3000),
  host:process.env.HOST || "0.0.0.0",
  liveFeedUrl:process.env.LIVE_FEED_URL || "https://biquote.io/api",
  otcFeedUrl:process.env.OTC_FEED_URL || "",
  quotexWsUrl:process.env.QUOTEX_WS_URL || "wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket",
  quotexSession:process.env.QUOTEX_SESSION || "",
  quotexIsDemo:process.env.QUOTEX_IS_DEMO !== "0",
  corsOrigin:process.env.CORS_ORIGIN || "*",
  minCandles:Number(process.env.MIN_CANDLES || 120),
  cacheMs:Number(process.env.CACHE_MS || 2500)
});

function getServer(server){
  return SIGNAL_PROFILES[String(server || "").toLowerCase()] ? String(server).toLowerCase() : null;
}
function isPairAllowed(server,pair){
  const key=String(server || "").toLowerCase();
  return Array.isArray(PAIRS[key]) && PAIRS[key].includes(pair);
}
function isTimeframeAllowed(server,timeframe){
  const key=String(server || "").toLowerCase();
  return Array.isArray(TIMEFRAMES[key]) && TIMEFRAMES[key].includes(timeframe);
}

module.exports={SIGNAL_PROFILES,PAIRS,TIMEFRAMES,ENV,MIN_CANDLES:ENV.minCandles,CACHE_MS:ENV.cacheMs,getServer,isPairAllowed,isTimeframeAllowed};
