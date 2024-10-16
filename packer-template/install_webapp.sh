#!/bin/bash

# Update package lists and install Node.js, npm, MySQL, and unzip
echo "Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs
sudo apt-get install -y npm
sudo apt-get install -y unzip  # Ensure unzip is installed
sudo apt-get install -y mysql-server  # Install MySQL server

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

echo "Debugging environment variables:"
echo "DB_HOST: ${DB_HOST}"
echo "DB_USER: ${DB_USER}"
echo "DB_NAME: ${DB_NAME}"
echo "DB_PORT: ${DB_PORT}"
echo "DB_PASSWORD: ${DB_PASSWORD:0:3}..." # Only show first 3 characters for security

# Update package lists and install dependencies
echo "Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip mysql-server

# Configure MySQL
echo "Configuring MySQL server..."
sudo systemctl enable mysql
sudo systemctl start mysql

# MySQL setup
echo "Setting up MySQL..."
sudo mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

# Set up webapp
echo "Setting up webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /opt/webapp.zip -d /opt/webapp
cd /opt/webapp

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
sudo npm install

# Create csye6225 user and set permissions
echo "Creating user 'csye6225' and setting permissions..."
sudo useradd -r -s /usr/sbin/nologin csye6225
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

# Set up systemd service
echo "Setting up systemd service..."
sudo cp /opt/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service
sudo systemctl start my-app.service

echo "Web application setup complete!"