const {getLiveCandles}=require("../market/live-feed");
const {getOTCCandles}=require("../market/otc-feed");

async function candlesRoute({pair,timeframe,market}){
  const selected=String(market || "live").toLowerCase();
  if(selected === "live") return {market:"live",pair,timeframe,candles:await getLiveCandles({url:process.env.LIVE_FEED_URL || "https://biquote.io/api",pair,timeframe})};
  if(selected === "otc") return {market:"otc",pair,timeframe,candles:await getOTCCandles({pair,timeframe})};
  throw new Error(`Unsupported market: ${selected}`);
}
module.exports={candlesRoute};
