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
sudo apt-get install -y nodejs npm unzip

# Set up webapp
debug_log "Setting up webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /opt/webapp.zip -d /opt/webapp || { debug_log "Failed to unzip webapp"; exit 1; }
cd /opt/webapp

# Install Node.js dependencies
debug_log "Installing Node.js dependencies..."
sudo npm install || { debug_log "Failed to install Node.js dependencies"; exit 1; }

# Create csye6225 user and set permissions
debug_log "Creating user 'csye6225' and setting permissions..."
sudo useradd -r -s /usr/sbin/nologin csye6225
sudo chown -R csye6225:csye6225 /opt/webapp

# Set environment variables for RDS (passed from Terraform)
debug_log "Setting up environment variables for RDS..."
sudo mkdir -p /etc/systemd/system/my-app.service.d

# Pass the RDS connection details to the application using environment variables
sudo tee /etc/systemd/system/my-app.service.d/override.conf <<EOT
[Service]
Environment="DB_HOST=${DB_HOST}"
Environment="DB_USER=${DB_USER}"
Environment="DB_PASSWORD=${DB_PASSWORD}"
Environment="DB_NAME=${DB_NAME}"
Environment="DB_PORT=${DB_PORT}"
EOT

# Persist environment variables system-wide
sudo tee /etc/profile.d/myapp_env.sh > /dev/null <<EOT
export DB_HOST='${DB_HOST}'
export DB_USER='${DB_USER}'
export DB_PASSWORD='${DB_PASSWORD}'
export DB_NAME='${DB_NAME}'
export DB_PORT='${DB_PORT}'
EOT
sudo chmod 644 /etc/profile.d/myapp_env.sh

# Set up systemd service
debug_log "Setting up systemd service..."
sudo cp /opt/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service
sudo systemctl start my-app.service || { debug_log "Failed to start my-app service"; exit 1; }

# Check service status
debug_log "Checking my-app service status..."
sudo systemctl is-active --quiet my-app.service && debug_log "my-app service is running" || { debug_log "my-app service is not running"; exit 1; }

# Check Node.js and npm versions
debug_log "Node.js and npm versions:"
node --version
npm --version

# List contents of /opt/webapp
debug_log "Contents of /opt/webapp:"
ls -la /opt/webapp

debug_log "Web application setup complete!"
