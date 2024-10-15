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
  default = "ami-0866a3c8686eaeeba" # Ubuntu 24.04 LTS AMI ID for us-east-1
}

variable "ssh_username" {
  type    = string
  default = "ubuntu"
}

variable "subnet_id" {
  type    = string
  default = "subnet-063beaf3ff4e82a4d"
}

# Declare the environment variable inputs
variable "DB_HOST" {
  type = string
}

variable "DB_USER" {
  type = string
}

variable "DB_PASSWORD" {
  type = string
}

variable "DB_NAME" {
  type = string
}

variable "DB_PORT" {
  type    = string
  default = "3306" # Default port for MySQL
}

source "amazon-ebs" "my-ubuntu-image" {
  region          = var.aws_region
  instance_type   = "t2.small"
  source_ami      = var.source_ami
  ssh_username    = var.ssh_username
  subnet_id       = var.subnet_id
  ami_name        = "my-custom-ubuntu-image-{{timestamp}}"
  ami_description = "Custom image for CSYE6225"

  tags = {
    Name        = "CSYE6225_Custom_AMI"
    Environment = "dev"
  }

  run_tags = {
    BuildBy = "Packer"
  }

  ami_regions = ["us-east-1"]

  aws_polling {
    delay_seconds = 120
    max_attempts  = 50
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

  # Set environment variables from GitHub Secrets
  provisioner "shell" {
    inline = [
      "echo 'DB_HOST=${var.DB_HOST}' | sudo tee -a /etc/environment",
      "echo 'DB_USER=${var.DB_USER}' | sudo tee -a /etc/environment",
      "echo 'DB_PASSWORD=${var.DB_PASSWORD}' | sudo tee -a /etc/environment",
      "echo 'DB_NAME=${var.DB_NAME}' | sudo tee -a /etc/environment",
      "echo 'DB_PORT=${var.DB_PORT}' | sudo tee -a /etc/environment",
      "source /etc/environment" # Reload environment variables
    ]
  }

  # Copy the webapp.zip to the /tmp directory
  provisioner "file" {
    source      = "${path.root}/webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  # Move the webapp.zip to /opt and set permissions
  provisioner "shell" {
    inline = [
      "sudo mv /tmp/webapp.zip /opt/webapp.zip",
      "sudo chmod 644 /opt/webapp.zip"
    ]
  }

  # Copy the my-app.service file to /tmp
  provisioner "file" {
    source      = "${path.root}/my-app.service"
    destination = "/tmp/my-app.service"
  }

  # Move the my-app.service to /opt with root privileges
  provisioner "shell" {
    inline = [
      "sudo mv /tmp/my-app.service /opt/my-app.service",
      "sudo chmod 644 /opt/my-app.service"
    ]
  }

  # Copy the install_webapp.sh script to /tmp
  provisioner "file" {
    source      = "${path.root}/install_webapp.sh"
    destination = "/tmp/install_webapp.sh"
  }

  # Run the install_webapp.sh script
  provisioner "shell" {
    inline = [
      "chmod +x /tmp/install_webapp.sh",
      "sudo /tmp/install_webapp.sh"
    ]
  }
}
