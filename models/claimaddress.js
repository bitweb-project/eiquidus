let mongoose = require('mongoose'),
    Schema = mongoose.Schema;

let ClaimAddressSchema = new Schema({
  a_id: {type: String, unique: true, index: true},
  claim_name: {type: String, default: '', index: true}
}, {id: false});

module.exports = mongoose.model('ClaimAddress', ClaimAddressSchema);