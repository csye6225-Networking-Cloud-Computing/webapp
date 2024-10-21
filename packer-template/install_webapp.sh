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
sudo apt-get install -y nodejs npm unzip || { debug_log "Failed to install dependencies"; exit 1; }

# Set up webapp directory
debug_log "Setting up webapp directory..."
sudo mkdir -p /opt/webapp
sudo unzip /opt/webapp.zip -d /opt/webapp || { debug_log "Failed to unzip webapp"; exit 1; }
cd /opt/webapp

# Install Node.js dependencies
debug_log "Installing Node.js dependencies..."
sudo npm install || { debug_log "Failed to install Node.js dependencies"; exit 1; }

# Create a non-privileged user for running the app and set permissions
debug_log "Creating user 'csye6225' and setting permissions..."
sudo useradd -r -s /usr/sbin/nologin csye6225 || { debug_log "Failed to create user"; exit 1; }
sudo chown -R csye6225:csye6225 /opt/webapp || { debug_log "Failed to set permissions on /opt/webapp"; exit 1; }

# Set up systemd service to run the app
debug_log "Setting up systemd service..."
sudo cp /opt/my-app.service /etc/systemd/system/ || { debug_log "Failed to copy systemd service file"; exit 1; }
sudo systemctl daemon-reload
sudo systemctl enable my-app.service || { debug_log "Failed to enable my-app service"; exit 1; }
sudo systemctl start my-app.service || { debug_log "Failed to start my-app service"; exit 1; }

# Check service status
debug_log "Checking my-app service status..."
sudo systemctl is-active --quiet my-app.service && debug_log "my-app service is running" || { debug_log "my-app service is not running"; sudo journalctl -xe | tail -n 50; exit 1; }

# Check Node.js and npm versions
debug_log "Node.js and npm versions:"
node --version
npm --version

# List contents of /opt/webapp
debug_log "Contents of /opt/webapp:"
ls -la /opt/webapp

debug_log "Web application setup complete!"
