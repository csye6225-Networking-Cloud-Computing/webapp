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

variable "db_host" {
  type = string
}

variable "db_user" {
  type = string
}

variable "db_password" {
  type = string
}

variable "db_name" {
  type = string
}

variable "db_port" {
  type = string
}

source "amazon-ebs" "my-ubuntu-image" {
  region          = var.aws_region
  instance_type   = var.instance_type
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
    environment_vars = [
      "DB_HOST=${var.db_host}",
      "DB_USER=${var.db_user}",
      "DB_PASSWORD=${var.db_password}",
      "DB_NAME=${var.db_name}",
      "DB_PORT=${var.db_port}"
    ]
    inline = [
      "sudo mv /tmp/webapp.zip /opt/webapp.zip",
      "sudo chmod 644 /opt/webapp.zip",
      "sudo mv /tmp/my-app.service /opt/my-app.service",
      "sudo chmod 644 /opt/my-app.service",
      "chmod +x /tmp/install_webapp.sh",
      "sudo -E /tmp/install_webapp.sh",
      
      # Add these lines to persist environment variables system-wide
      "sudo tee /etc/profile.d/myapp_env.sh > /dev/null <<EOT",
      "export DB_HOST='${var.db_host}'",
      "export DB_USER='${var.db_user}'",
      "export DB_PASSWORD='${var.db_password}'",
      "export DB_NAME='${var.db_name}'",
      "export DB_PORT='${var.db_port}'",
      "EOT",
      "sudo chmod 644 /etc/profile.d/myapp_env.sh"
    ]
  }
}