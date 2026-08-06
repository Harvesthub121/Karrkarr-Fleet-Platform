# ── RDS PostgreSQL 16 Multi-AZ ────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.name_prefix}-db-subnet-group" }
}

resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-db"

  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = 100 # Autoscaling ceiling in GB
  storage_type          = "gp3"
  storage_encrypted     = true # Encryption at rest — mandatory for personal data

  multi_az = true # Synchronous standby in a second AZ
  publicly_accessible = false

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "17:00-18:00" # 01:00-02:00 SGT
  maintenance_window      = "sun:18:00-sun:19:00" # 02:00-03:00 SGT Sunday

  deletion_protection     = true # Prevent accidental drop
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot"

  # Performance Insights helps diagnose slow queries without enabling
  # slow query log (which has higher overhead)
  performance_insights_enabled = true

  # Parameter group with recommended settings for this workload
  parameter_group_name = aws_db_parameter_group.main.name

  tags = { Name = "${local.name_prefix}-db" }
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name_prefix}-pg16"
  family = "postgres16"

  # Log slow queries (>1 second) to CloudWatch Logs
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # Log connections and disconnections — useful for debugging connection pool issues
  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = { Name = "${local.name_prefix}-pg16" }
}
