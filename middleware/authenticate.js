const bcrypt = require('bcrypt');
const User = require('../models/user');  // Ensure this path is correct

// Middleware for Basic Authentication
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ message: 'Missing or invalid authentication header' });
  }

  try {
    // Get the base64 encoded part of the header and decode it
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    // Ensure both email and password are extracted
    if (!email || !password) {
      return res.status(401).json({ message: 'Invalid authentication credentials' });
    }

    // Fetch the user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare the password with the hashed password in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Set the user in the request object so that it can be accessed later
    req.user = user;
    next();  // Pass control to the next middleware or route handler
  } catch (err) {
    console.error('Error in authentication:', err);  // Log the error
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = authenticate;
