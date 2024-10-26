#!/bin/bash
set -e
set -x

# Function to log debug information
debug_log() {
    echo "[DEBUG] $1" >&2
}

debug_log "Starting installation script"

# Update package lists and install dependencies (Node.js and npm)
debug_log "Updating packages and installing dependencies..."
sudo apt-get update
sudo apt-get install -y nodejs npm unzip

# Check if Node.js is installed
debug_log "Checking if Node.js is installed..."
if [ ! -f /usr/bin/node ]; then
    debug_log "ERROR: Node.js not found!"
    exit 1
fi

# Set up webapp
debug_log "Setting up webapp..."
sudo mkdir -p /opt/webapp
sudo unzip /tmp/webapp.zip -d /opt/webapp
cd /opt/webapp

# Install Node.js dependencies
debug_log "Installing Node.js dependencies..."
sudo npm install

# Check if app.js exists
debug_log "Checking if /opt/webapp/app.js exists..."
if [ ! -f /opt/webapp/app.js ]; then
    debug_log "ERROR: /opt/webapp/app.js not found!"
    exit 1
fi

# Ensure app.js is executable
sudo chmod +x /opt/webapp/app.js

# Create csye6225 user and set permissions
debug_log "Creating user 'csye6225' and setting permissions..."
sudo useradd -r -s /usr/sbin/nologin csye6225
sudo chown -R csye6225:csye6225 /opt/webapp
sudo chmod -R 755 /opt/webapp

# Test running the Node.js application manually
debug_log "Manually running the Node.js application to verify..."
sleep 5
ps aux | grep app.js || debug_log "WARNING: app.js not running."

# Set up systemd service
debug_log "Setting up systemd service..."
sudo cp /tmp/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service

# Check for any issues with systemd service before starting
debug_log "Checking for any issues with systemd service before starting..."
sudo systemctl status my-app.service || {
    debug_log "ERROR: Issue found with systemd service!";
    exit 1
}

# Start the service
debug_log "Starting my-app service..."
sudo systemctl start my-app.service

# Check service status after start
debug_log "Checking my-app service status after starting..."
sudo systemctl status my-app.service || {
    debug_log "ERROR: my-app service failed to start!";
    exit 1
}

# Install CloudWatch Agent
debug_log "Installing CloudWatch Agent..."
curl -s https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -o amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure CloudWatch Agent
debug_log "Configuring CloudWatch Agent..."
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/
cat <<EOF | sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "metrics": {
    "append_dimensions": {
      "InstanceId": "$${aws:InstanceId}"
    },
    "aggregation_dimensions": [["InstanceId"]],
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      },
      "cpu": {
        "measurement": ["cpu_usage_active"],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/syslog",
            "log_group_name": "/aws/ec2/syslog",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%b %d %H:%M:%S"
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch Agent
debug_log "Starting CloudWatch Agent..."
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

debug_log "Installation completed!"
