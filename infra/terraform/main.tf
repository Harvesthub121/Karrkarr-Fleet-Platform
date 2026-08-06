terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for team use. S3 bucket and DynamoDB table must
  # be created manually before first terraform init.
  # backend "s3" {
  #   bucket         = "karrkarr-fleet-tfstate"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "karrkarr-fleet-tflock"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Convenience locals used across modules
locals {
  name_prefix = "${var.project}-${var.environment}"

  # All secrets that ECS tasks pull from Secrets Manager at start time.
  # Values are populated manually (or via CI) after terraform apply.
  secret_arns = {
    database_url         = aws_secretsmanager_secret.database_url.arn
    jwt_admin_secret     = aws_secretsmanager_secret.jwt_admin_secret.arn
    jwt_customer_secret  = aws_secretsmanager_secret.jwt_customer_secret.arn
    redis_url            = aws_secretsmanager_secret.redis_url.arn
    resend_api_key       = aws_secretsmanager_secret.resend_api_key.arn
  }
}

# Data source: fetch availability zones dynamically
data "aws_availability_zones" "available" {
  state = "available"
}
