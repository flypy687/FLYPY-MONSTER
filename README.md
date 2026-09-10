# FLYPY MONSTER — Backend

This package contains the backend structure requested for the existing FLYPY MONSTER UI.

## Included

- `server.js`
- `package.json`
- `.env`
- `backend/config.js`
- `backend/market/live-feed.js`
- `backend/market/otc-feed.js`
- `backend/engine/indicators.js`
- `backend/engine/structure.js`
- `backend/engine/confluence.js`
- `backend/engine/signal-engine.js`
- `backend/routes/candles.js`

The existing `index.html`, `style.css`, and `app.js` are intentionally NOT included.

## Original server selections preserved

### GRANTED
- Pair: EUR/USD
- Timeframe: 1 Minute

### POWERX
- Pairs: USD/JPY, GBP/USD, AUD/USD
- Timeframes: 15 Seconds, 30 Seconds, 1 Minute

### ULTRAFX
- Pairs: USD/CAD, EUR/JPY
- Timeframes: 30 Seconds, 1 Minute, 5 Minutes

## Setup

1. Install Node.js 18 or newer.
2. Open this project folder in a terminal.
3. Run:
   `npm install`
4. Configure `.env`.
5. Start:
   `npm start`
6. Test:
   `http://localhost:3000/health`

## Feed requirements

The backend deliberately does NOT generate random or synthetic market candles.

A configured feed must return JSON containing one of:
- `candles`
- `data`
- `results`
- `values`

Each candle must contain:
- `time` (or timestamp/datetime/date)
- `open`
- `high`
- `low`
- `close`

At least 120 valid candles are required.

### LIVE
Set `LIVE_FEED_URL` to a genuine LIVE candle provider endpoint.

### OTC
Set `OTC_FEED_URL` to a genuine OTC candle provider endpoint.

### 15s / 30s
A genuine sub-minute source is required. A normal 1-minute candle feed cannot honestly be converted into real 15-second or 30-second candles without tick/order-flow data.

## Accuracy note

The engine is designed to reject weak/conflicting setups rather than force a signal. `score` and `confidence` are model scores, NOT guaranteed win probabilities.

Real accuracy must be measured with historical and out-of-sample testing using the same market/feed and execution rules.
