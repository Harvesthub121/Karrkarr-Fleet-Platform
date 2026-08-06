# ── Secrets Manager ───────────────────────────────────────────────────────────
# These resources CREATE the secret entries. Values must be populated
# manually (or via CI) after `terraform apply`. Terraform does not manage
# secret values — only the secret containers and their IAM policies.

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}/DATABASE_URL"
  description             = "PostgreSQL connection string for the Vida Fleet API"
  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}/DATABASE_URL" }
}

resource "aws_secretsmanager_secret" "jwt_admin_secret" {
  name                    = "${local.name_prefix}/JWT_ADMIN_SECRET"
  description             = "JWT signing secret for admin access tokens"
  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}/JWT_ADMIN_SECRET" }
}

resource "aws_secretsmanager_secret" "jwt_customer_secret" {
  name                    = "${local.name_prefix}/JWT_CUSTOMER_SECRET"
  description             = "JWT signing secret for customer portal access tokens"
  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}/JWT_CUSTOMER_SECRET" }
}

resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "${local.name_prefix}/REDIS_URL"
  description             = "ElastiCache Redis connection URL for BullMQ"
  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}/REDIS_URL" }
}

resource "aws_secretsmanager_secret" "resend_api_key" {
  name                    = "${local.name_prefix}/RESEND_API_KEY"
  description             = "Resend transactional email API key"
  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}/RESEND_API_KEY" }
}

# ── IAM ───────────────────────────────────────────────────────────────────────

# ECS Task Execution Role — needed by the ECS agent to pull images from ECR
# and write CloudWatch logs. AWS managed policy covers this.
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow ECS execution role to read secrets (so containers can start with secrets injected)
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = values(local.secret_arns)
    }]
  })
}

# API Task Role — the role the application code runs as
resource "aws_iam_role" "api_task" {
  name = "${local.name_prefix}-api-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "api_task_s3" {
  name = "${local.name_prefix}-api-s3"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
      },
      {
        # Presigned URL generation requires s3:PutObject + caller identity
        Effect   = "Allow"
        Action   = ["sts:GetCallerIdentity"]
        Resource = "*"
      }
    ]
  })
}

# Worker Task Role — same as API but no need for S3 write (workers don't upload)
resource "aws_iam_role" "worker_task" {
  name = "${local.name_prefix}-worker-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "worker_task_s3_read" {
  name = "${local.name_prefix}-worker-s3-read"
  role = aws_iam_role.worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:ListBucket"]
      Resource = [aws_s3_bucket.documents.arn, "${aws_s3_bucket.documents.arn}/*"]
    }]
  })
}
