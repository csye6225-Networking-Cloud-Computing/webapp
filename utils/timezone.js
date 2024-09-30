const moment = require('moment-timezone');

// Utility function to convert timestamps to EST/EDT
const convertToEST = (user) => {
  if (user.account_created) {
    user.account_created = moment(user.account_created).tz('America/New_York').format();
  }
  if (user.account_updated) {
    user.account_updated = moment(user.account_updated).tz('America/New_York').format();
  }
  return user;
};

module.exports = convertToEST;
