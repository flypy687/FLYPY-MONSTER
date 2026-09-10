require("dotenv").config();
const http=require("http");
const fs=require("fs");
const path=require("path");
const {URL}=require("url");
const {ENV,isPairAllowed,isTimeframeAllowed}=require("./backend/config");
const {candlesRoute}=require("./backend/routes/candles");
const {buildSignal}=require("./backend/engine/signal-engine");

const PORT=ENV.port, HOST=ENV.host, ROOT=__dirname;
const CACHE=new Map();
function sendJSON(res,status,data){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":ENV.corsOrigin,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type"});res.end(JSON.stringify(data));}
function sendText(res,status,text){res.writeHead(status,{"Content-Type":"text/plain; charset=utf-8","Access-Control-Allow-Origin":ENV.corsOrigin});res.end(text);}
function cacheKey(pair,timeframe,market){return `${String(market).toLowerCase()}|${pair}|${timeframe}`;}
function getCached(key){const item=CACHE.get(key);if(!item)return null;if(Date.now()-item.timestamp>ENV.cacheMs){CACHE.delete(key);return null;}return item.data;}
function setCached(key,data){CACHE.set(key,{timestamp:Date.now(),data});}
setInterval(()=>{for(const [k,v] of CACHE){if(Date.now()-v.timestamp>ENV.cacheMs*4)CACHE.delete(k);}},Math.max(ENV.cacheMs*4,5000)).unref();
function validate({server,pair,timeframe,market}){
  if(!server)throw new Error("Server is required.");
  if(!pair)throw new Error("Pair is required.");
  if(!timeframe)throw new Error("Timeframe is required.");
  if(!["live","otc"].includes(String(market).toLowerCase()))throw new Error("Market must be live or otc.");
  if(!isPairAllowed(server,pair))throw new Error(`Pair ${pair} is not allowed for server ${server}.`);
  if(!isTimeframeAllowed(server,timeframe))throw new Error(`Timeframe ${timeframe} is not allowed for server ${server}.`);
}
async function getMarket({pair,timeframe,market}){
  const key=cacheKey(pair,timeframe,market);let data=getCached(key);if(data)return data;
  const result=await candlesRoute({pair,timeframe,market});
  if(!result || !Array.isArray(result.candles))throw new Error("Market feed returned no valid candle array.");
  const candles=result.candles.filter(c=>[c.time,c.open,c.high,c.low,c.close].every(Number.isFinite)).slice(-ENV.minCandles);
  if(candles.length<ENV.minCandles)throw new Error(`Insufficient candles. Received ${candles.length}, required ${ENV.minCandles}.`);
  data={market:result.market,pair:result.pair,timeframe:result.timeframe,candles};setCached(key,data);return data;
}
async function handleCandles(req,res,url){
  const pair=url.searchParams.get("pair"), timeframe=url.searchParams.get("timeframe"), market=(url.searchParams.get("market")||"live").toLowerCase(), server=(url.searchParams.get("server")||"").toLowerCase();
  try{validate({server,pair,timeframe,market});const data=await getMarket({pair,timeframe,market});return sendJSON(res,200,{ok:true,...data});}
  catch(e){console.error("[CANDLES ERROR]",e.message);return sendJSON(res,502,{ok:false,error:e.message});}
}
async function handleSignal(req,res,url){
  const pair=url.searchParams.get("pair"), timeframe=url.searchParams.get("timeframe"), market=(url.searchParams.get("market")||"live").toLowerCase(), server=(url.searchParams.get("server")||"").toLowerCase();
  try{validate({server,pair,timeframe,market});const marketData=await getMarket({pair,timeframe,market});const analysis=buildSignal({candles:marketData.candles,server,pair,timeframe});return sendJSON(res,200,{ok:true,server,market,pair,timeframe,...analysis});}
  catch(e){console.error("[SIGNAL ERROR]",e.message);return sendJSON(res,502,{ok:false,signal:"NO SIGNAL",error:e.message});}
}
function serveStatic(req,res,url){let pathname=decodeURIComponent(url.pathname);if(pathname==="/")pathname="/index.html";const allowed={"/index.html":"index.html","/style.css":"style.css","/app.js":"app.js"};const file=allowed[pathname];if(!file)return sendText(res,404,"Not Found");const filePath=path.join(ROOT,file);if(!fs.existsSync(filePath))return sendText(res,404,`${file} not found`);const type={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8"}[path.extname(filePath)]||"application/octet-stream";res.writeHead(200,{"Content-Type":type});fs.createReadStream(filePath).pipe(res);}
const server=http.createServer(async(req,res)=>{try{if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":ENV.corsOrigin,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type"});return res.end();}if(req.method!=="GET")return sendText(res,405,"Method Not Allowed");const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);if(url.pathname==="/health")return sendJSON(res,200,{ok:true,service:"FLYPY MONSTER",status:"online",timestamp:new Date().toISOString()});if(url.pathname==="/api/candles")return handleCandles(req,res,url);if(url.pathname==="/api/signal")return handleSignal(req,res,url);return serveStatic(req,res,url);}catch(e){console.error("[SERVER ERROR]",e);return sendJSON(res,500,{ok:false,error:"Internal server error."});}});
server.listen(PORT,HOST,()=>console.log(`FLYPY MONSTER backend listening on ${HOST}:${PORT}`));
process.on("SIGINT",()=>server.close(()=>process.exit(0)));process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
