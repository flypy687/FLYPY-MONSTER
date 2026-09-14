const WebSocket = require("ws");

function toOTCSymbol(pair){
  return `${pair.replace("/","").toUpperCase()}_otc`;
}
function timeframeToSeconds(timeframe){
  const map={"15 Seconds":15,"30 Seconds":30,"1 Minute":60,"5 Minutes":300};
  return map[timeframe] || null;
}
function parseSocketPacket(raw){
  const text=Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  const packets=[];
  let rest=text;
  while(rest.startsWith("0")) rest=rest.slice(1);
  const parts=rest.split("\n");
  for(const part of parts){
    if(!part) continue;
    if(part.startsWith("2")) continue;
    if(part.startsWith("3")) continue;
    if(part.startsWith("40")) continue;
    if(part.startsWith("42")){
      const json=part.slice(2);
      try{ packets.push(JSON.parse(json)); }catch{}
    }
  }
  return packets;
}

function normalizeCandle(x){
  if(!x || typeof x!=="object") return null;
  const time=Number(x.time ?? x.timestamp ?? x.from ?? x.at ?? x[0]);
  const open=Number(x.open ?? x.o ?? x[1]);
  const high=Number(x.high ?? x.h ?? x[2]);
  const low=Number(x.low ?? x.l ?? x[3]);
  const close=Number(x.close ?? x.c ?? x[4]);
  if(![time,open,high,low,close].every(Number.isFinite)) return null;
  return {time:time<1e12?time*1000:time,open,high,low,close};
}

async function getOTCCandles({pair,timeframe}){
  if(process.env.OTC_FEED_URL){
    const url=new URL(process.env.OTC_FEED_URL);
    url.searchParams.set("pair",pair);
    url.searchParams.set("timeframe",timeframe);
    url.searchParams.set("limit","220");
    const response=await fetch(url,{headers:{Accept:"application/json"}});
    if(!response.ok) throw new Error(`OTC feed returned HTTP ${response.status}`);
    const data=await response.json();
    const rows=Array.isArray(data) ? data : data.candles;
    if(!Array.isArray(rows)) throw new Error("OTC feed returned an unexpected candle format.");
    return rows.map(normalizeCandle).filter(Boolean).slice(-220);
  }

  const session=process.env.QUOTEX_SESSION || "";
  const wsUrl=process.env.QUOTEX_WS_URL || "wss://ws2.qxbroker.com/socket.io/?EIO=3&transport=websocket";
  const period=timeframeToSeconds(timeframe);
  if(!session) throw new Error("OTC feed is not configured: QUOTEX_SESSION is missing on the backend.");
  if(!period) throw new Error(`Unsupported OTC timeframe: ${timeframe}`);

  return await new Promise((resolve,reject)=>{
    const ws=new WebSocket(wsUrl);
    const candles=[];
    let settled=false;
    const finish=(err,data)=>{ if(settled) return; settled=true; try{ws.close();}catch{}; err?reject(err):resolve(data); };
    const timer=setTimeout(()=>finish(new Error("OTC WebSocket timeout while waiting for candles.")),15000);
    ws.on("open",()=>{
      ws.send(`42["authorization",${JSON.stringify({session,isDemo:process.env.QUOTEX_IS_DEMO !== "0",tournamentId:0})}]`);
      setTimeout(()=>ws.send(`42["instruments/update",${JSON.stringify({asset:toOTCSymbol(pair),period})}]`),250);
    });
    ws.on("message",raw=>{
      const packets=parseSocketPacket(raw);
      for(const packet of packets){
        const payload=packet && packet[1];
        const candidates=payload?.candles || payload?.history || payload?.data || payload;
        if(Array.isArray(candidates)){
          for(const item of candidates){
            const c=normalizeCandle(item);
            if(c) candles.push(c);
          }
        } else if(candidates && typeof candidates === "object"){
          for(const item of Object.values(candidates)){
            const c=normalizeCandle(item);
            if(c) candles.push(c);
          }
        }
      }
      const unique=Array.from(new Map(candles.map(c=>[c.time,c])).values()).sort((a,b)=>a.time-b.time);
      if(unique.length >= Number(process.env.MIN_CANDLES || 120)){
        clearTimeout(timer);
        finish(null,unique.slice(-220));
      }
    });
    ws.on("error",err=>{clearTimeout(timer);finish(new Error(`OTC WebSocket error: ${err.message}`));});
    ws.on("close",()=>{ if(!settled){ clearTimeout(timer); if(candles.length < Number(process.env.MIN_CANDLES || 120)) finish(new Error("OTC WebSocket closed before enough candles were received.")); }});
  });
}
module.exports={getOTCCandles};
