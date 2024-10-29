#!/bin/bash
set -e
set -x

# Clean apt cache and update sources
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*
sudo sed -i 's|http://us-east-1.ec2.archive.ubuntu.com/ubuntu/|http://archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list
sudo apt-get update || (sleep 30 && sudo apt-get update)

# Install Node.js, npm, and unzip
sudo apt-get install -y nodejs npm unzip

# Verify Node.js installation
if [[ ! -f /usr/bin/node ]]; then 
  echo 'ERROR: Node.js not found!' 
  exit 1
fi

# Set up the web application
sudo mkdir -p /opt/webapp
sudo unzip /tmp/webapp.zip -d /opt/webapp
cd /opt/webapp
sudo npm install

# Check if app.js exists
if [[ ! -f /opt/webapp/app.js ]]; then 
  echo 'ERROR: /opt/webapp/app.js not found!' 
  exit 1
fi

# Ensure app.js is executable
sudo chmod +x /opt/webapp/app.js

# Create the csye6225 user if not exists, for non-root ownership and permissions
if ! id -u csye6225 &>/dev/null; then
  sudo useradd -r -s /usr/sbin/nologin csye6225
fi

# Set up logs directory and app.log with appropriate ownership and permissions
sudo mkdir -p /opt/webapp/logs
sudo touch /opt/webapp/logs/app.log
sudo chown csye6225:csye6225 /opt/webapp/logs/app.log
sudo chmod 664 /opt/webapp/logs/app.log  # Read-write for owner and group

# Set ownership and permissions for web application directory
sudo chown -R csye6225:csye6225 /opt/webapp
sudo chmod -R 755 /opt/webapp

# Configure and start systemd service for the web application
sudo cp /tmp/my-app.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-app.service
sudo systemctl start my-app.service

# Verify service status
sudo systemctl status my-app.service || exit 1

# Install CloudWatch Agent
echo "Installing CloudWatch Agent..."
curl -s https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -o amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Create CloudWatch Agent config directory if it does not exist
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc

# Configure CloudWatch Agent
echo "Configuring CloudWatch Agent..."
cat <<EOF | sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "metrics": {
    "append_dimensions": {
      "InstanceId": "\${aws:InstanceId}"
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
          },
          {
            "file_path": "/opt/webapp/logs/app.log",
            "log_group_name": "/aws/ec2/app-logs",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch Agent
echo "Starting CloudWatch Agent..."
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Check CloudWatch Agent status
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status

# Verify CloudWatch Agent status
sudo systemctl status amazon-cloudwatch-agent || exit 1

# Install and Configure StatsD
echo "Installing StatsD and CloudWatch backend for StatsD..."
sudo npm install -g statsd statsd-cloudwatch-backend

# Create StatsD configuration directory if it doesn't exist
sudo mkdir -p /etc/statsd

# Create a StatsD configuration file with CloudWatch backend
cat <<EOF | sudo tee /etc/statsd/config.js
{
  port: 8125,
  backends: ["statsd-cloudwatch-backend"],
  cloudwatch: {
    namespace: "WebAppMetrics",
    region: process.env.AWS_REGION || "us-east-1"
  }
}
EOF

# Start StatsD as a background process
echo "Starting StatsD..."
sudo nohup statsd /etc/statsd/config.js &

echo "Installation completed!"
