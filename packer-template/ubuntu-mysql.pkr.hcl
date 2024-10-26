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
      "sudo apt-get clean",
      "sudo rm -rf /var/lib/apt/lists/*",
      "sudo sed -i 's|http://us-east-1.ec2.archive.ubuntu.com/ubuntu/|http://archive.ubuntu.com/ubuntu/|g' /etc/apt/sources.list",
      "sudo apt-get update || (sleep 30 && sudo apt-get update)",
      "sudo apt-get install -y nodejs npm unzip",
      "if [[ ! -f /usr/bin/node ]]; then echo 'ERROR: Node.js not found!' && exit 1; fi",
      "sudo mkdir -p /opt/webapp",
      "sudo unzip /tmp/webapp.zip -d /opt/webapp",
      "cd /opt/webapp",
      "sudo npm install",
      "if [[ ! -f /opt/webapp/app.js ]]; then echo 'ERROR: /opt/webapp/app.js not found!' && exit 1; fi",
      "sudo chmod +x /opt/webapp/app.js",
      "sudo useradd -r -s /usr/sbin/nologin csye6225",
      "sudo chown -R csye6225:csye6225 /opt/webapp",
      "sudo chmod -R 755 /opt/webapp",
      "sudo cp /tmp/my-app.service /etc/systemd/system/",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable my-app.service",
      "sudo systemctl start my-app.service",
      "sudo systemctl status my-app.service || exit 1",

      # Install and configure CloudWatch Agent
      "echo 'Installing CloudWatch Agent...'",
      "curl -s https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -o amazon-cloudwatch-agent.deb",
      "sudo dpkg -i -E ./amazon-cloudwatch-agent.deb",

      # Set up CloudWatch Agent configuration
      "echo 'Setting up CloudWatch Agent configuration...'",
      "cat <<EOF | sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json",
      "{",
      "  \"agent\": {",
      "    \"metrics_collection_interval\": 60,",
      "    \"run_as_user\": \"root\"",
      "  },",
      "  \"metrics\": {",
      "    \"append_dimensions\": {",
      "      \"InstanceId\": \"$${aws:InstanceId}\"",
      "    },",
      "    \"metrics_collected\": {",
      "      \"mem\": {",
      "        \"measurement\": [\"mem_used_percent\"],",
      "        \"metrics_collection_interval\": 60",
      "      },",
      "      \"cpu\": {",
      "        \"measurement\": [\"cpu_usage_active\"],",
      "        \"metrics_collection_interval\": 60",
      "      }",
      "    }",
      "  },",
      "  \"logs\": {",
      "    \"logs_collected\": {",
      "      \"files\": {",
      "        \"collect_list\": [",
      "          {",
      "            \"file_path\": \"/var/log/syslog\",",
      "            \"log_group_name\": \"/aws/ec2/syslog\",",
      "            \"log_stream_name\": \"{instance_id}\",",
      "            \"timestamp_format\": \"%b %d %H:%M:%S\"",
      "          }",
      "        ]",
      "      }",
      "    }",
      "  }",
      "}",
      "EOF",

      # Start the CloudWatch Agent
      "sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s"
    ]
  }
}
