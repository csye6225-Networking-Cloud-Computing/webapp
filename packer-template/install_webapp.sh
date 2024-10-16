#!/bin/bash

# Update package lists and install Node.js, npm, MySQL, and unzip
echo "Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip mysql-server

# Set up MySQL for the first time
echo "Configuring MySQL server..."
sudo mysql_secure_installation <<EOF
n
y
y
y
y
EOF

# Enable and start MySQL service
echo "Starting MySQL service..."
sudo systemctl enable mysql
sudo systemctl start mysql

# Log in to MySQL and set up the database
echo "Setting up MySQL database..."
sudo mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME};
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED WITH mysql_native_password BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EXIT;
EOF


# Ensure the /opt/webapp directory exists
echo "Unzipping webapp.zip to /opt/webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /opt/webapp.zip -d /opt/webapp

# List contents to verify
echo "Listing files in /opt/webapp..."
sudo ls -la /opt/webapp

# Navigate to the correct webapp directory
cd /opt/webapp || exit

# Check if package.json exists
if [ ! -f package.json ]; then
    echo "Error: package.json not found!"
    exit 1
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
sudo npm install

# Create csye6225 user with no login shell
echo "Creating user 'csye6225'..."
sudo useradd -r -s /usr/sbin/nologin csye6225

# Set proper ownership for /opt/webapp
echo "Setting ownership for /opt/webapp..."
sudo chown -R csye6225:csye6225 /opt/webapp

# Set environment variables
echo "Setting environment variables..."
sudo tee -a /etc/environment > /dev/null <<EOT
DB_HOST=${DB_HOST}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_PORT=${DB_PORT}
EOT

# Copy the systemd service file and enable the service
echo "Copying systemd service file and enabling service..."
sudo cp /opt/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service

# Verify the systemd service file
echo "Verifying the systemd service file..."
sudo ls -la /etc/systemd/system/my-app.service

# Start the application service
echo "Starting the application service..."
sudo systemctl start my-app.service

# Logging complete
echo "Web application setup complete!"