# Terraform — Vida Fleet AWS Infrastructure

Creates the full AWS infrastructure for the Vida Partners Fleet Leasing Platform in `ap-southeast-1`.

## What This Creates

- VPC with public and private subnets across 2 AZs
- NAT gateways (one per AZ) for ECS task outbound internet access
- Security groups with least-privilege rules
- RDS PostgreSQL 16 Multi-AZ (encryption at rest, automated backups)
- ElastiCache Redis 7 (BullMQ queue backend)
- S3 bucket for documents (private, versioned, encrypted)
- Application Load Balancer with HTTPS (ACM certificate via DNS validation)
- Route53 DNS record for the API
- ECS Fargate cluster with API service (auto-scales) and worker service (fixed at 1 task)
- IAM roles for ECS task execution and application tasks
- Secrets Manager secrets (containers, not values — populate manually)
- CloudWatch log groups

## Prerequisites

- Terraform >= 1.6.0
- AWS CLI configured with credentials that have sufficient permissions
- Domain name (`domain_name` variable) managed in Route53 in the same account
- Docker images built and pushed to ECR (or another registry) before `terraform apply`

## Usage

```bash
# First time setup
terraform init

# Review what will be created (safe, no changes)
terraform plan \
  -var="db_password=<strong-password>" \
  -var="domain_name=vidapartners.com.sg" \
  -var="api_image_uri=<ecr-uri>/vida-api:latest" \
  -var="worker_image_uri=<ecr-uri>/vida-api:latest"

# Create all resources
terraform apply \
  -var="db_password=<strong-password>" \
  -var="domain_name=vidapartners.com.sg" \
  -var="api_image_uri=<ecr-uri>/vida-api:latest" \
  -var="worker_image_uri=<ecr-uri>/vida-api:latest"
```

After apply, note the outputs. Then populate Secrets Manager values before starting ECS tasks.

## After Apply: Populate Secrets

```bash
# DATABASE_URL
aws secretsmanager put-secret-value \
  --secret-id vida-fleet-prod/DATABASE_URL \
  --secret-string "postgresql://vida:<password>@<rds-endpoint>:5432/vida_fleet?schema=public&sslmode=require"

# JWT_ADMIN_SECRET (generate a strong random value)
aws secretsmanager put-secret-value \
  --secret-id vida-fleet-prod/JWT_ADMIN_SECRET \
  --secret-string "$(openssl rand -hex 64)"

# JWT_CUSTOMER_SECRET
aws secretsmanager put-secret-value \
  --secret-id vida-fleet-prod/JWT_CUSTOMER_SECRET \
  --secret-string "$(openssl rand -hex 64)"

# REDIS_URL (from terraform output)
aws secretsmanager put-secret-value \
  --secret-id vida-fleet-prod/REDIS_URL \
  --secret-string "redis://<elasticache-endpoint>:6379"

# RESEND_API_KEY (from Resend dashboard)
aws secretsmanager put-secret-value \
  --secret-id vida-fleet-prod/RESEND_API_KEY \
  --secret-string "re_xxxx"
```

## Destroying Resources

`aws_db_instance` and `aws_s3_bucket.documents` have `prevent_destroy = true` and `deletion_protection = true`. This is intentional — the database and document store must not be accidentally destroyed.

To destroy for real (non-production only):
1. Set `deletion_protection = false` on the RDS instance in the AWS console.
2. Remove `prevent_destroy` from the lifecycle blocks.
3. Run `terraform destroy`.

## Remote State

Uncomment the `backend "s3"` block in `main.tf` for team use. Create the S3 bucket and DynamoDB table first:

```bash
aws s3 mb s3://vida-fleet-tfstate --region ap-southeast-1
aws dynamodb create-table \
  --table-name vida-fleet-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-1
```
