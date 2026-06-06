const base_url = 'https://api.coingecko.com/api/v3/';
const Decimal = require('decimal.js');

function doFetch(url) {
  return fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  });
}

function get_coin_list(api_key, cb) {
  const url = base_url + 'coins/list?include_platform=false' +
    (api_key ? '&x_cg_demo_api_key=' + api_key : '');
  doFetch(url)
    .then((body) => {
      if (!Array.isArray(body)) {
        return cb((body && body.status && body.status.error_message) || 'Unexpected API response', []);
      }
      return cb(null, body);
    })
    .catch((err) => cb(err.message || err, []));
}

function get_simple_price(id, currency, market_array, api_key, cb) {
  const params = new URLSearchParams({
    ids: id.toLowerCase(),
    vs_currencies: 'usd' + (currency ? ',' + currency : '')
  });
  if (api_key) params.append('x_cg_demo_api_key', api_key);

  const url = base_url + 'simple/price?' + params.toString();
  doFetch(url)
    .then((body) => {
      if (!body || typeof body !== 'object') {
        return cb('No data returned', new Decimal('0'), new Decimal('0'));
      }
      if (body.status && body.status.error_message) {
        return cb(body.status.error_message, new Decimal('0'), new Decimal('0'));
      }

      try {
        if (market_array) {
          let last_price = new Decimal('0');
          let last_usd_price = new Decimal('0');
          let counter = 0;
          let api_market = null;

          if (currency) {
            const baseIdx = market_array.findIndex(p => p.currency.toLowerCase() === currency.toLowerCase());
            if (baseIdx > -1) {
              api_market = body[market_array[baseIdx].coingecko_id.toLowerCase()];
            }
          }

          Object.keys(body).forEach((key) => {
            const marketIdx = market_array.findIndex(
              p => p.coingecko_id.toLowerCase() === key.toLowerCase()
            );
            if (marketIdx > -1) {
              if (currency && body[key][currency.toLowerCase()] !== undefined) {
                last_price = last_price.add(
                  new Decimal(market_array[marketIdx].last_price.toString())
                    .mul(body[key][currency.toLowerCase()])
                );
              } else if (api_market) {
                const ratio = new Decimal(api_market.usd.toString())
                  .div(body[key].usd.toString());
                last_price = last_price.add(
                  new Decimal(market_array[marketIdx].last_price.toString()).div(ratio)
                );
              }
              last_usd_price = last_usd_price.add(
                new Decimal(market_array[marketIdx].last_price.toString())
                  .mul(body[key].usd.toString())
              );
              counter++;
            }
          });

          if (counter > 0) {
            last_price = last_price.div(counter.toString());
            last_usd_price = last_usd_price.div(counter.toString());
          }
          return cb(null, last_price, last_usd_price);
        } else {
          // один актив
          const price = currency ? body[id.toLowerCase()][currency.toLowerCase()] : 0;
          const usd = body[id.toLowerCase()].usd;
          return cb(
            null,
            new Decimal(price !== undefined ? price : 0),
            new Decimal(usd !== undefined ? usd : 0)
          );
        }
      } catch (err) {
        return cb('Received unexpected API data response', new Decimal('0'), new Decimal('0'));
      }
    })
    .catch((err) => cb(err.message || err, new Decimal('0'), new Decimal('0')));
}

module.exports = {
  get_coin_data: function (api_key, cb) {
    get_coin_list(api_key, cb);
  },
  get_market_prices: function (id, currency, api_key, cb) {
    get_simple_price(id, currency, null, api_key, (err, last_price, last_usd) => {
      if (last_price.toString() === '0' && currency) {
        console.log(`Error: "${currency}" is not a valid coingecko api currency`);
      }
      cb(err, last_price, last_usd);
    });
  },
  get_avg_market_prices: function (id, currency, market_array, api_key, cb) {
    get_simple_price(id, currency, market_array, api_key, (err, last_price, last_usd) => {
      if (last_price.toString() === '0' && currency) {
        console.log(`Error: "${currency}" is not a valid coingecko api currency`);
      }
      cb(err, last_price, last_usd);
    });
  }
};
