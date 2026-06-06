const base_url = 'https://api.exbitron.com/api/v1';
const market_url_template = 'https://app.exbitron.com/exchange/?market={coin}-{base}';

const rateLimitLib = require('../ratelimit');
const rateLimit = new rateLimitLib.RateLimit(1, 2000, false);

function doFetch(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  });
}

function ticker_dash(coin, exchange) {
  return coin.toUpperCase() + '-' + exchange.toUpperCase();
}

function ticker_cg(coin, exchange) {
  return coin.toUpperCase() + '_' + exchange.toUpperCase();
}

function get_summary(coin, exchange, api_error_msg, cb) {
  const url = base_url + '/trading/info/' + ticker_dash(coin, exchange);
  rateLimit.schedule(function() {
    doFetch(url)
      .then((body) => {
        if (!body || typeof body !== 'object') return cb('get_summary: invalid response', null);
        if (body.hasError) return cb('get_summary: hasError=true', null);
        try {
          const m = body.data && body.data.market;
          if (!m) return cb('get_summary: no market data', null);
          const dyn = m.marketDynamics || {};
          cb(null, {
            high:       parseFloat(dyn.highPrice)  || 0,
            low:        parseFloat(dyn.lowPrice)   || 0,
            volume:     parseFloat(dyn.volume24h)  || 0,
            volume_btc: parseFloat(dyn.amount24h)  || 0,
            bid:        parseFloat(m.highestBid)   || 0,
            ask:        parseFloat(m.lowestAsk)    || 0,
            last:       parseFloat(dyn.lastPrice)  || 0,
            prev:       parseFloat(dyn.startPrice) || 0,
            change:     parseFloat(dyn.change24)   || 0
          });
        } catch (err) {
          cb('get_summary: ' + err.message, null);
        }
      })
      .catch((err) => cb('get_summary: ' + (err.message || err), null));
  });
}

function get_trades(coin, exchange, api_error_msg, cb) {
  const url = base_url + '/cg/historical_trades?ticker_id=' + ticker_cg(coin, exchange) + '&limit=300';
  rateLimit.schedule(function() {
    doFetch(url)
      .then((body) => {
        if (!body) return cb('get_trades: empty response', null);

        let list;
        if (Array.isArray(body)) {
          list = body;
        } else if (body.buy || body.sell) {
          list = (body.buy || []).concat(body.sell || []);
        } else if (body.trade_id !== undefined || body.price !== undefined) {
          list = [body];
        } else {
          // Empty object {} or unrecognized — no trades
          list = [];
        }

        try {
          cb(null, list.map((t) => ({
            ordertype: t.type,
            price:     parseFloat(t.price)       || 0,
            quantity:  parseFloat(t.base_volume) || 0,
            timestamp: parseInt(t.timestamp)     || 0
          })));
        } catch (err) {
          cb('get_trades: ' + err.message, null);
        }
      })
      .catch((err) => cb('get_trades: ' + (err.message || err), null));
  });
}

function get_orders(coin, exchange, api_error_msg, cb) {
  const url = base_url + '/cg/orderbook?ticker_id=' + ticker_cg(coin, exchange);
  doFetch(url)
    .then((body) => {
      if (!body || typeof body !== 'object' || !body.bids || !body.asks)
        return cb('get_orders: invalid response: ' + JSON.stringify(body).slice(0, 120), null, null);
      try {
        cb(null,
          body.bids.map((b) => ({ price: parseFloat(b[0]) || 0, quantity: parseFloat(b[1]) || 0 })),
          body.asks.map((s) => ({ price: parseFloat(s[0]) || 0, quantity: parseFloat(s[1]) || 0 }))
        );
      } catch (err) {
        cb('get_orders: ' + err.message, null, null);
      }
    })
    .catch((err) => cb('get_orders: ' + (err.message || err), null, null));
}

module.exports = {
  market_name: 'Exbitron',
  market_logo: '',
  market_url_template: market_url_template,
  market_url_case: 'u',
  get_data: function(settings, cb) {
    get_orders(settings.coin, settings.exchange, settings.api_error_msg, function(order_error, buys, sells) {
      if (order_error) return cb(order_error, null);
      get_trades(settings.coin, settings.exchange, settings.api_error_msg, function(trade_error, trades) {
        if (trade_error) return cb(trade_error, null);
        get_summary(settings.coin, settings.exchange, settings.api_error_msg, function(summary_error, stats) {
          if (summary_error) return cb(summary_error, null);
          // Build chartdata from summary — avoids separate /cg/tickers call
          // where ticker_id matching can fail
          const now  = Math.floor(Date.now() / 1000);
          const last = stats.last || 0;
          const chartdata = null;
          cb(null, { buys, sells, trades, stats, chartdata });
        });
      });
    });
  }
};
