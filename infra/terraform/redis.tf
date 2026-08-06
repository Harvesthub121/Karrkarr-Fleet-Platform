# ── ElastiCache Redis 7 ───────────────────────────────────────────────────────
# Single-node Redis for BullMQ queues. Redis state (queue jobs) is not
# critical — a node failure causes in-flight jobs to be requeued.
# If uptime SLA requires it, upgrade to a replication group.

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.name_prefix}-redis-subnet-group" }
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.2"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Automatic minor version upgrades during maintenance window
  auto_minor_version_upgrade = true
  maintenance_window         = "sun:19:00-sun:20:00" # 03:00-04:00 SGT Sunday

  # Snapshot for backup — 1 day retention is sufficient (queue state is ephemeral)
  snapshot_retention_limit = 1
  snapshot_window          = "16:00-17:00" # 00:00-01:00 SGT

  tags = { Name = "${local.name_prefix}-redis" }
}
