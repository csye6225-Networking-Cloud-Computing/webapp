const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the .env file explicitly
dotenv.config({ path: path.resolve(__dirname, '../.env') });
