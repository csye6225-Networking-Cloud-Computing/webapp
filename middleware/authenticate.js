const bcrypt = require('bcryptjs');
const User = require('../models/user');  // Ensure this path is correct

// Middleware for Basic Authentication
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Basic ')) {
    return res.status(401).end();
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const [email, password] = Buffer.from(base64Credentials, 'base64').toString('ascii').split(':');

    if (!email || !password) {
      return res.status(401).end();
    }

    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).end();
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Error in authentication:', err);
    return res.status(500).end();
  }
};

module.exports = authenticate;
