variable "environment" {
  description = "Deployment environment: prod, staging, dev"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "project" {
  description = "Project identifier used in resource names and tags"
  type        = string
  default     = "vida-fleet"
}

# ── VPC ───────────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to use (2 minimum for Multi-AZ RDS)"
  type        = number
  default     = 2
}

# ── RDS ───────────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class. db.t4g.medium handles ~500 vehicles comfortably."
  type        = string
  default     = "db.t4g.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "vida_fleet"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "vida"
}

variable "db_password" {
  description = "PostgreSQL master password. Set via -var or TF_VAR_db_password. Never hardcode."
  type        = string
  sensitive   = true
}

variable "db_allocated_storage_gb" {
  description = "Initial RDS storage in GB. RDS autoscaling handles growth."
  type        = number
  default     = 20
}

variable "db_backup_retention_days" {
  description = "RDS automated backup retention period in days"
  type        = number
  default     = 14
}

# ── ElastiCache ───────────────────────────────────────────────────────────────

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t4g.micro"
}

# ── ECS ───────────────────────────────────────────────────────────────────────

variable "api_cpu" {
  description = "ECS API task CPU units (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "api_memory_mb" {
  description = "ECS API task memory in MB"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 2
}

variable "worker_cpu" {
  description = "ECS worker task CPU units"
  type        = number
  default     = 256
}

variable "worker_memory_mb" {
  description = "ECS worker task memory in MB"
  type        = number
  default     = 512
}

# Worker is ALWAYS 1. Do not expose this as a variable to prevent accidental multi-task workers.

variable "api_image_uri" {
  description = "ECR image URI for the API container"
  type        = string
  # e.g. "123456789.dkr.ecr.ap-southeast-1.amazonaws.com/vida-api:latest"
}

variable "worker_image_uri" {
  description = "ECR image URI for the worker container (may be same image as API with different CMD)"
  type        = string
}

# ── ALB / ACM ─────────────────────────────────────────────────────────────────

variable "domain_name" {
  description = "Root domain name for ACM certificate (e.g. vidapartners.com.sg)"
  type        = string
}

variable "api_subdomain" {
  description = "Subdomain for the API"
  type        = string
  default     = "api"
}

# ── S3 ────────────────────────────────────────────────────────────────────────

variable "documents_bucket_suffix" {
  description = "Suffix appended to the documents S3 bucket name to ensure global uniqueness"
  type        = string
  default     = "documents"
}
