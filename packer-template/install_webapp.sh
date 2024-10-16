#!/bin/bash
set -e
set -x

# Function to log debug information
debug_log() {
    echo "[DEBUG] $1" >&2
}

debug_log "Starting installation script"

# Update package lists and install dependencies
debug_log "Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip mysql-server

# Configure MySQL
debug_log "Configuring MySQL server..."
sudo systemctl enable mysql
sudo systemctl start mysql

# MySQL setup
debug_log "Setting up MySQL..."
sudo mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
FLUSH PRIVILEGES;
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

# Set up webapp
debug_log "Setting up webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /opt/webapp.zip -d /opt/webapp
cd /opt/webapp

# Install Node.js dependencies
debug_log "Installing Node.js dependencies..."
sudo npm install

# Create csye6225 user and set permissions
debug_log "Creating user 'csye6225' and setting permissions..."
sudo useradd -r -s /usr/sbin/nologin csye6225
sudo chown -R csye6225:csye6225 /opt/webapp

# Set environment variables securely
debug_log "Setting environment variables..."
sudo tee /etc/systemd/system/my-app.service.d/override.conf > /dev/null <<EOT
[Service]
Environment="DB_HOST=${DB_HOST}"
Environment="DB_USER=${DB_USER}"
Environment="DB_PASSWORD=${DB_PASSWORD}"
Environment="DB_NAME=${DB_NAME}"
Environment="DB_PORT=${DB_PORT}"
EOT

# Set up systemd service
debug_log "Setting up systemd service..."
sudo cp /opt/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service
sudo systemctl start my-app.service

# Check service status
debug_log "Checking my-app service status..."
sudo systemctl status my-app.service

# Check if MySQL is running
debug_log "Checking MySQL status..."
sudo systemctl status mysql.service

# Check Node.js and npm versions
debug_log "Node.js and npm versions:"
node --version
npm --version

# List contents of /opt/webapp
debug_log "Contents of /opt/webapp:"
ls -la /opt/webapp

debug_log "Web application setup complete!"