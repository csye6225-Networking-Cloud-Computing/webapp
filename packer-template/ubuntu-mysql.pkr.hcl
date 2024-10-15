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

variable "instance_type" {
  type    = string
  default = "t2.micro"
}

variable "ssh_username" {
  type    = string
  default = "ubuntu"
}

variable "ami_users" {
  type    = string
}

variable "db_host" {
  type    = string
}

variable "db_user" {
  type    = string
}

variable "db_password" {
  type    = string
}

variable "db_name" {
  type    = string
}

variable "db_port" {
  type    = string
}

data "amazon-ami" "ubuntu" {
  filters = {
    name                = "ubuntu/images/hvm-ssd/ubuntu-jammy-24.04-amd64-server-*"
    root-device-type    = "ebs"
    virtualization-type = "hvm"
  }
  most_recent = true
  owners      = ["099720109477"] # Canonical
}

source "amazon-ebs" "my-ubuntu-image" {
  ami_name        = "my-custom-ubuntu-image-${formatdate("YYYYMMDDhhmmss", timestamp())}"
  instance_type   = var.instance_type
  region          = var.aws_region
  source_ami      = data.amazon-ami.ubuntu.id
  ssh_username    = var.ssh_username
  ami_users       = [var.ami_users]

  tags = {
    Name = "CSYE6225_Custom_AMI"
  }
}

build {
  sources = ["source.amazon-ebs.my-ubuntu-image"]

  provisioner "file" {
    source      = "webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  provisioner "file" {
    source      = "my-app.service"
    destination = "/tmp/my-app.service"
  }

  provisioner "file" {
    source      = "install_webapp.sh"
    destination = "/tmp/install_webapp.sh"
  }

  provisioner "shell" {
    inline = [
      "sudo mv /tmp/webapp.zip /opt/webapp.zip",
      "sudo mv /tmp/my-app.service /etc/systemd/system/my-app.service",
      "chmod +x /tmp/install_webapp.sh",
      "sudo /tmp/install_webapp.sh"
    ]
    environment_vars = [
      "DB_HOST=${var.db_host}",
      "DB_USER=${var.db_user}",
      "DB_PASSWORD=${var.db_password}",
      "DB_NAME=${var.db_name}",
      "DB_PORT=${var.db_port}"
    ]
  }
}