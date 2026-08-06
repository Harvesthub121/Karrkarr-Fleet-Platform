# ── ECS Fargate ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${local.name_prefix}-cluster" }
}

# CloudWatch log group for both services
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}/api"
  retention_in_days = 30

  tags = { Name = "${local.name_prefix}-api-logs" }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name_prefix}/worker"
  retention_in_days = 30

  tags = { Name = "${local.name_prefix}-worker-logs" }
}

# ── API Task Definition ────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory_mb
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  container_definitions = jsonencode([{
    name      = "karrkarr-api"
    image     = var.api_image_uri
    essential = true

    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "PORT",          value = "3000" },
      { name = "NODE_ENV",      value = "production" },
      { name = "AWS_REGION",    value = var.aws_region },
      { name = "S3_BUCKET",     value = aws_s3_bucket.documents.bucket },
      { name = "CORS_ORIGINS",  value = "https://admin.${var.domain_name},https://portal.${var.domain_name}" },
      # Worker mode off — this is the API container
      { name = "WORKER_MODE",   value = "false" },
    ]

    secrets = [
      { name = "DATABASE_URL",          valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "JWT_ADMIN_SECRET",      valueFrom = aws_secretsmanager_secret.jwt_admin_secret.arn },
      { name = "JWT_CUSTOMER_SECRET",   valueFrom = aws_secretsmanager_secret.jwt_customer_secret.arn },
      { name = "REDIS_URL",             valueFrom = aws_secretsmanager_secret.redis_url.arn },
      { name = "RESEND_API_KEY",        valueFrom = aws_secretsmanager_secret.resend_api_key.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = { Name = "${local.name_prefix}-api-task" }
}

# ── API ECS Service ────────────────────────────────────────────────────────────

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  # Minimum 50% healthy during rolling deploy
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "karrkarr-api"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.https]

  tags = { Name = "${local.name_prefix}-api-service" }

  lifecycle {
    # Allow external CI deploys to update task_definition without Terraform drift
    ignore_changes = [task_definition, desired_count]
  }
}

# ── Worker Task Definition ─────────────────────────────────────────────────────
# Same image as API but with WORKER_MODE=true so the app boots only the
# BullMQ worker module, not the HTTP server.

resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory_mb
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  container_definitions = jsonencode([{
    name      = "karrkarr-worker"
    image     = var.worker_image_uri
    essential = true

    # No port mappings — the worker has no inbound traffic

    environment = [
      { name = "NODE_ENV",    value = "production" },
      { name = "AWS_REGION",  value = var.aws_region },
      { name = "S3_BUCKET",   value = aws_s3_bucket.documents.bucket },
      { name = "WORKER_MODE", value = "true" },
    ]

    secrets = [
      { name = "DATABASE_URL",        valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "REDIS_URL",           valueFrom = aws_secretsmanager_secret.redis_url.arn },
      { name = "RESEND_API_KEY",      valueFrom = aws_secretsmanager_secret.resend_api_key.arn },
      { name = "JWT_ADMIN_SECRET",    valueFrom = aws_secretsmanager_secret.jwt_admin_secret.arn },
      { name = "JWT_CUSTOMER_SECRET", valueFrom = aws_secretsmanager_secret.jwt_customer_secret.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])

  tags = { Name = "${local.name_prefix}-worker-task" }
}

# ── Worker ECS Service ─────────────────────────────────────────────────────────
# ALWAYS 1 task. Do not attach to a load balancer. Do not configure auto-scaling.

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1 # Hard-coded. See DEPLOYMENT.md for rationale.
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 0  # Allow the single task to stop before new one starts
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = false
  }

  tags = { Name = "${local.name_prefix}-worker-service" }

  lifecycle {
    ignore_changes = [task_definition]
  }
}

# ── Auto-scaling for the API (not the worker) ─────────────────────────────────

resource "aws_appautoscaling_target" "api" {
  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name_prefix}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
