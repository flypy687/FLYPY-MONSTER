function toBiQuoteUrl(baseUrl,pair,timeframe){
  if(!baseUrl) throw new Error("LIVE_FEED_URL is not configured.");
  const symbol=pair.replace("/","").toUpperCase();
  const intervalMap={"1 Minute":"1m","5 Minutes":"5m"};
  const interval=intervalMap[timeframe];
  if(!interval){
    throw new Error(`${timeframe} LIVE candles are not available from the configured feed without a true sub-minute source.`);
  }
  const url=new URL(`${baseUrl.replace(/\/$/,"")}/${symbol}/ohlc`);
  url.searchParams.set("interval",interval);
  url.searchParams.set("limit","220");
  return url;
}

async function getLiveCandles({url,pair,timeframe}){
  const endpoint=toBiQuoteUrl(url,pair,timeframe);
  const response=await fetch(endpoint,{headers:{Accept:"application/json"}});
  if(!response.ok) throw new Error(`LIVE feed returned HTTP ${response.status}`);
  const data=await response.json();
  if(!Array.isArray(data.bars)) throw new Error("LIVE feed returned an unexpected candle format.");
  return data.bars.map(bar=>({
    time:Date.parse(bar.openTime),
    open:Number(bar.open),
    high:Number(bar.high),
    low:Number(bar.low),
    close:Number(bar.close)
  })).filter(c=>[c.time,c.open,c.high,c.low,c.close].every(Number.isFinite));
}
module.exports={getLiveCandles};
