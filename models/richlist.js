let mongoose = require('mongoose'),
    Schema = mongoose.Schema;

let RichlistSchema = new Schema({
  coin: { type: String },
  received: { type: Array, default: [] },
  balance: { type: Array, default: [] },
  burned: { type: Array, default: [] }
});

module.exports = mongoose.model('Richlist', RichlistSchema);