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

# Execute MySQL commands with logging
echo "Starting MySQL setup..."

# Check if MySQL is running
sudo systemctl status mysql > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "MySQL service is running."
  echo "***DEBUG***"
  echo "DB_NAME :${DB_NAME}"
  echo "DB_USER :${DB_USER}"
  echo "DB_PASSWORD :${DB_PASSWORD}"
  echo "DB_PORT :${DB_PORT}"
else
  echo "Starting MySQL service..."
  sudo systemctl start mysql
fi

echo "Configuring root user to allow passwordless access..."
sudo mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';
FLUSH PRIVILEGES;
EOF

if [ $? -eq 0 ]; then
  echo "Root user configured for passwordless access."
else
  echo "Failed to configure root user."
fi

echo "Creating database ${DB_NAME} if it does not exist..."
sudo mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;
EOF

if [ $? -eq 0 ]; then
  echo "Database ${DB_NAME} created successfully or already exists."
else
  echo "Failed to create the database ${DB_NAME}."
fi

echo "Creating MySQL user ${DB_USER} if it does not exist..."
sudo mysql -u root <<EOF
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '';
EOF

if [ $? -eq 0 ]; then
  echo "MySQL user ${DB_USER} created successfully or already exists."
else
  echo "Failed to create MySQL user ${DB_USER}."
fi

echo "Granting privileges on ${DB_NAME} to ${DB_USER}..."
sudo mysql -u root <<EOF
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

if [ $? -eq 0 ]; then
  echo "Privileges granted to user ${DB_USER} on database ${DB_NAME}."
else
  echo "Failed to grant privileges to user ${DB_USER}."
fi

echo "MySQL setup completed."

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