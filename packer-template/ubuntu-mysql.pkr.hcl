packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "source_ami" {
  type    = string
  default = "ami-0866a3c8686eaeeba" # Replace with your base AMI
}

variable "instance_type" {
  type    = string
  default = "t2.small"
}

variable "ssh_username" {
  type    = string
  default = "ubuntu"
}

variable "subnet_id" {
  type    = string
  default = "subnet-063beaf3ff4e82a4d"
}

source "amazon-ebs" "my-ubuntu-image" {
  region          = var.aws_region
  instance_type   = var.instance_type
  source_ami      = var.source_ami
  ssh_username    = var.ssh_username
  subnet_id       = var.subnet_id
  ami_name        = "my-custom-ubuntu-image-{{timestamp}}"
  ami_description = "Custom image for CSYE6225"

  ami_users = ["194722437889"]

  tags = {
    Name        = "CSYE6225_Custom_AMI"
    Environment = "dev"
  }

  run_tags = {
    BuildBy = "Packer"
  }

  launch_block_device_mappings {
    device_name           = "/dev/sda1"
    volume_size           = 25
    volume_type           = "gp2"
    delete_on_termination = true
  }
}

build {
  sources = ["source.amazon-ebs.my-ubuntu-image"]

  provisioner "file" {
    source      = "${path.root}/webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  provisioner "file" {
    source      = "${path.root}/my-app.service"
    destination = "/tmp/my-app.service"
  }

  provisioner "file" {
    source      = "${path.root}/install_webapp.sh"
    destination = "/tmp/install_webapp.sh"
  }

  provisioner "shell" {
    inline = [
      # Clean the APT cache to ensure fresh package lists are fetched
      "sudo apt-get clean",
      "sudo rm -rf /var/lib/apt/lists/*",
      
      # Update the package lists using a more reliable mirror
      "sudo sed -i 's|http://us-east-1.ec2.archive.ubuntu.com/ubuntu/|http://archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list",
      
      # Retry the apt-get update in case of transient network issues
      "sudo apt-get update || (sleep 30 && sudo apt-get update)",

      # Install your dependencies
      "sudo apt-get install -y nodejs npm unzip",

      # Check if Node.js is installed correctly
      "if [[ ! -f /usr/bin/node ]]; then echo 'ERROR: Node.js not found!' && exit 1; fi",

      # Set up the webapp by unzipping it to /opt/webapp
      "sudo mkdir -p /opt/webapp",
      "sudo unzip /tmp/webapp.zip -d /opt/webapp",
      "cd /opt/webapp",

      # Install Node.js dependencies
      "sudo npm install",

      # Ensure app.js exists and is executable
      "if [[ ! -f /opt/webapp/app.js ]]; then echo 'ERROR: /opt/webapp/app.js not found!' && exit 1; fi",
      "sudo chmod +x /opt/webapp/app.js",

      # Create the user and set permissions
      "sudo useradd -r -s /usr/sbin/nologin csye6225",
      "sudo chown -R csye6225:csye6225 /opt/webapp",
      "sudo chmod -R 755 /opt/webapp",

      # Copy the systemd service file and enable the service
      "sudo cp /tmp/my-app.service /etc/systemd/system/",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable my-app.service",

      # Start the service and check if it's running correctly
      "sudo systemctl start my-app.service",
      "sudo systemctl status my-app.service || exit 1"
    ]
  }
}
