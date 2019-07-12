const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const keys = require('../config/keys');

// const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);

//Goal is to overwrite the native mongoose function so that we can plug out redis logic
//in directly.

const exec = mongoose.Query.prototype.exec;

//CASE WHERE WE DO NOT WANT TO USE AN ARROW FUNCTION
//we want to make sure that the exec function is bound to whatever the query is.
mongoose.Query.prototype.cache = async function(options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  //returning this makes method chainable
  return this;
};

mongoose.Query.prototype.exec = async function() {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );

  // see if redis has a val for key
  const cacheValue = await client.hget(this.hashKey, key);

  if (cacheValue) {
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }
  // if so, return it
  //else, make query and cache the result

  const result = await exec.apply(this, arguments);

  client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);

  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
};
