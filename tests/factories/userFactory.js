const mongoose = require('mongoose');
const User = mongoose.model('User');

module.exports = () => {
  //supply data to user object for actual googleId and userName
  return new User({}).save();
};
