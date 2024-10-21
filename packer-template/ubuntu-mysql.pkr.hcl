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
  default = "ami-0866a3c8686eaeeba"
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

  # Copy webapp.zip
  provisioner "file" {
    source      = "${path.root}/webapp.zip"
    destination = "/tmp/webapp.zip"
  }

  # Copy systemd service file
  provisioner "file" {
    source      = "${path.root}/my-app.service"
    destination = "/tmp/my-app.service"
  }

  # Copy install_webapp.sh
  provisioner "file" {
    source      = "${path.root}/install_webapp.sh"
    destination = "/tmp/install_webapp.sh"
  }

  # Clean up any unnecessary packages (example: remove git)
  provisioner "shell" {
    inline = [
      "if command -v git >/dev/null 2>&1; then echo 'Git is installed, removing it...'; sudo apt-get remove --purge -y git; else echo 'Git is NOT installed'; fi"
    ]
  }

  # Execute shell script to set up environment and app
  provisioner "shell" {
    inline = [
      "sudo mkdir -p /opt",
      "sudo mv /tmp/webapp.zip /opt/webapp.zip",
      "sudo chmod 644 /opt/webapp.zip",
      "sudo unzip /opt/webapp.zip -d /opt/webapp",
      "sudo mv /tmp/my-app.service /etc/systemd/system/my-app.service",
      "sudo chmod 644 /etc/systemd/system/my-app.service",
      "chmod +x /tmp/install_webapp.sh",
      "sudo /tmp/install_webapp.sh"
    ]
  }

  # Validate the app and system service setup
  provisioner "shell" {
    inline = [
      "sudo systemctl daemon-reload",
      "sudo systemctl enable my-app.service",
      "sudo systemctl start my-app.service",
      "sudo systemctl status my-app.service"
    ]
  }
}
