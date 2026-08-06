output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (for ECS, RDS, Redis)"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (for ALB)"
  value       = aws_subnet.public[*].id
}

output "alb_dns_name" {
  description = "ALB DNS name — use this as the target for Route53 A record aliases and for initial smoke testing"
  value       = aws_lb.main.dns_name
}

output "api_url" {
  description = "HTTPS API URL after DNS propagation"
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (hostname:port). Use in DATABASE_URL."
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.main.port
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint. Use in REDIS_URL."
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
  sensitive   = true
}

output "s3_documents_bucket" {
  description = "S3 documents bucket name. Use in S3_BUCKET env var."
  value       = aws_s3_bucket.documents.bucket
}

output "ecs_cluster_name" {
  description = "ECS cluster name — used by CI deploy scripts"
  value       = aws_ecs_cluster.main.name
}

output "api_service_name" {
  description = "ECS API service name — used by CI deploy scripts"
  value       = aws_ecs_service.api.name
}

output "worker_service_name" {
  description = "ECS worker service name — used by CI deploy scripts"
  value       = aws_ecs_service.worker.name
}

output "secrets_manager_arns" {
  description = "Secrets Manager ARNs — populate values before starting ECS tasks"
  value = {
    database_url        = aws_secretsmanager_secret.database_url.arn
    jwt_admin_secret    = aws_secretsmanager_secret.jwt_admin_secret.arn
    jwt_customer_secret = aws_secretsmanager_secret.jwt_customer_secret.arn
    redis_url           = aws_secretsmanager_secret.redis_url.arn
    resend_api_key      = aws_secretsmanager_secret.resend_api_key.arn
  }
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN — must be ISSUED before ALB HTTPS listener works"
  value       = aws_acm_certificate.main.arn
}

output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "api_task_role_arn" {
  description = "API ECS task role ARN"
  value       = aws_iam_role.api_task.arn
}

output "worker_task_role_arn" {
  description = "Worker ECS task role ARN"
  value       = aws_iam_role.worker_task.arn
}
