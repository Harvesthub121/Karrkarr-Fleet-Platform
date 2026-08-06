# Deployment Runbook — AWS ap-southeast-1

This document is the step-by-step guide for deploying the Karrkarr Fleet Platform to AWS. It is written for an ops person who has basic AWS console access and can follow instructions. Each step includes what to do and why.

## Architecture Overview

```
Route53 → ACM cert
    ↓
ALB (HTTPS:443, HTTP:80 redirect)
    ↓
ECS Fargate Cluster (karrkarr-fleet)
    ├── API Service (karrkarr-api)         ← scales with HTTP traffic
    └── Worker Service (karrkarr-worker)   ← fixed 1 task, never scales with web
    ↓
RDS PostgreSQL Multi-AZ (karrkarr-fleet-db)
ElastiCache Redis (karrkarr-fleet-cache)
S3 bucket (karrkarr-fleet-documents-prod)

Vercel (or AWS Amplify)
    ├── Admin dashboard (admin.karrkarr.com.sg)
    └── Customer portal (portal.karrkarr.com.sg)
```

**Why separate API and Worker services:** The nightly jobs (interest accrual, invoice generation) run in the worker. If the API auto-scales under load, we do not want 10 worker tasks all running the interest accrual job simultaneously. The worker has exactly 1 task. It consumes from the Redis-backed BullMQ queues, which serialise execution.

---

## Prerequisites

Before starting, you need:
- AWS account with admin IAM access
- AWS CLI installed and configured (`aws configure`)
- Terraform >= 1.6 installed
- Domain name managed in Route53 (or transferrable to Route53)
- Resend account with a verified sending domain
- PayNow UEN from Karrkarr's bank

---

## Step 1: Terraform Infrastructure

The Terraform configuration in `infra/terraform/` creates all AWS infrastructure.

```bash
cd infra/terraform

# Initialise providers
terraform init

# Review the plan (read-only — no changes yet)
terraform plan \
  -var="environment=prod" \
  -var="db_password=CHANGE_ME" \
  -var="domain_name=karrkarr.com.sg"

# Apply (this creates real resources and will incur costs)
terraform apply \
  -var="environment=prod" \
  -var="db_password=CHANGE_ME" \
  -var="domain_name=karrkarr.com.sg"
```

Terraform creates:
- VPC with public and private subnets across 2 AZs
- RDS PostgreSQL 16 Multi-AZ in private subnets
- ElastiCache Redis single-node in private subnets
- S3 bucket with private ACL and versioning
- ECS Fargate cluster + task definitions + services
- ALB with HTTPS listener (ACM cert)
- Secrets Manager entries (empty — you fill them in next)
- IAM roles and security groups

**Save the Terraform outputs.** They include the RDS endpoint, Redis endpoint, ALB DNS name, and ECR repository URIs.

---

## Step 2: Fill in Secrets Manager

After Terraform runs, go to AWS Secrets Manager in ap-southeast-1 and set values for:

| Secret name                      | Value to set                                         |
|----------------------------------|------------------------------------------------------|
| karrkarr-fleet/prod/DATABASE_URL     | `postgresql://karrkarr:<password>@<rds-endpoint>:5432/karrkarr_fleet?schema=public&sslmode=require` |
| karrkarr-fleet/prod/JWT_ADMIN_SECRET | Random 64-char hex: `openssl rand -hex 64`           |
| karrkarr-fleet/prod/JWT_CUSTOMER_SECRET | Random 64-char hex: `openssl rand -hex 64`        |
| karrkarr-fleet/prod/REDIS_URL        | `redis://<elasticache-endpoint>:6379`                |
| karrkarr-fleet/prod/RESEND_API_KEY   | From your Resend dashboard                           |

Do not set AWS credentials here — the ECS tasks use IAM task roles.

---

## Step 3: Build and Push Docker Images

The API and worker run from the same Docker image. The entrypoint differs via an environment variable.

```bash
# Log in to ECR (replace ACCOUNT_ID and REGION)
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin \
  ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com

# Build the API image
docker build -t karrkarr-api ./apps/api

# Tag and push
docker tag karrkarr-api:latest \
  ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/karrkarr-api:latest
docker push \
  ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/karrkarr-api:latest
```

Repeat for the worker image if it has a separate Dockerfile. If using the same image with a different CMD, update the ECS task definition accordingly.

---

## Step 4: Run Database Migrations

Migrations must run before the API starts serving traffic. The safest way is to run them as a one-off ECS task:

```bash
aws ecs run-task \
  --cluster karrkarr-fleet \
  --task-definition karrkarr-api-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"karrkarr-api","command":["npx","prisma","migrate","deploy"]}]}'
```

Wait for the task to reach STOPPED state and check CloudWatch logs for success before proceeding.

**Do not run the seed script in production.** The seed creates demo data and must only be used in development and staging environments.

---

## Step 5: Deploy ECS Services

Update the ECS services to use the new image:

```bash
# Force a new deployment (pulls the latest image)
aws ecs update-service \
  --cluster karrkarr-fleet \
  --service karrkarr-api \
  --force-new-deployment

aws ecs update-service \
  --cluster karrkarr-fleet \
  --service karrkarr-worker \
  --force-new-deployment
```

Watch the deployment in the ECS console. Both services should reach a RUNNING steady state.

---

## Step 6: Deploy Frontend Applications

### Vercel (recommended)

1. Connect the `apps/admin` and `apps/customer` directories to two Vercel projects.
2. Set environment variables in each Vercel project:
   - `NEXT_PUBLIC_API_URL=https://api.karrkarr.com.sg`
3. Deploy via Vercel CI or `vercel deploy --prod`.

### AWS Amplify (alternative)

1. Create two Amplify apps pointing at the same Git repository.
2. Set the `App root` to `apps/admin` and `apps/customer` respectively.
3. Set the same environment variables.

---

## Step 7: DNS Cutover

1. In Route53, the ALB DNS name is in the Terraform outputs. Create:
   - `api.karrkarr.com.sg` → ALB DNS (A record, alias)
   - `admin.karrkarr.com.sg` → Vercel/Amplify CNAME
   - `portal.karrkarr.com.sg` → Vercel/Amplify CNAME
2. ACM certificate validation records were created by Terraform. Confirm the cert is `Issued` before cutover.
3. Lower TTLs to 60 seconds before cutover and restore after.

---

## Environment Variable Reference

All variables are injected from Secrets Manager or as ECS task definition environment variables.

| Variable                 | Required | Description                                          |
|--------------------------|----------|------------------------------------------------------|
| DATABASE_URL             | Yes      | PostgreSQL connection string with SSL                |
| PORT                     | Yes      | API listen port (3000)                               |
| NODE_ENV                 | Yes      | `production`                                         |
| CORS_ORIGINS             | Yes      | Comma-separated: `https://admin.karrkarr.com.sg,https://portal.karrkarr.com.sg` |
| JWT_ADMIN_SECRET         | Yes      | Minimum 64 chars, random                             |
| JWT_CUSTOMER_SECRET      | Yes      | Minimum 64 chars, random                             |
| JWT_ACCESS_TTL_SECONDS   | No       | Default 900 (15 min)                                 |
| JWT_REFRESH_TTL_DAYS     | No       | Default 30                                           |
| AWS_REGION               | Yes      | `ap-southeast-1`                                     |
| S3_BUCKET                | Yes      | `karrkarr-fleet-documents-prod`                          |
| S3_PRESIGN_TTL_SECONDS   | No       | Default 3600                                         |
| S3_ENDPOINT              | No       | Leave blank in production (MinIO only for local dev) |
| REDIS_URL                | Yes      | ElastiCache Redis endpoint                           |
| RESEND_API_KEY           | Yes      | From Resend dashboard                                |
| LOG_LEVEL                | No       | `log` (production) or `debug` (staging)              |

---

## Migration Strategy

### Initial deploy
Run `prisma migrate deploy` as a one-off ECS task before starting the API service, as described in Step 4.

### Subsequent deploys
The CI pipeline runs `prisma migrate deploy` as a pre-deploy step. The migration is idempotent — if it has already been applied, it is a no-op.

### Backward compatibility rule
All migrations must be backward-compatible with the previous version of the application for at least one deploy cycle. This allows a blue-green rollout where old tasks drain while new tasks start. Adding nullable columns, adding tables, and adding indexes are all safe. Dropping columns or changing types requires a two-step migration across two deploys.

### Rollback
If a migration causes problems, restore from the RDS automated snapshot taken before the deploy (automated daily snapshots are configured in Terraform). Do not roll forward with a compensating migration during an incident — restore the snapshot and diagnose offline.

---

## Backup and Restore

### RDS Automated Backups
Terraform configures:
- Automated daily snapshots, retained for 14 days
- Multi-AZ (synchronous replication to a standby in a second AZ)
- Point-in-time recovery enabled

To restore to a point in time:
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier karrkarr-fleet-db \
  --target-db-instance-identifier karrkarr-fleet-db-restored \
  --restore-time 2026-08-06T02:00:00Z
```

After restore, update Secrets Manager `DATABASE_URL` to point to the restored instance and restart ECS services.

### S3 Document Backup
The S3 bucket has versioning enabled. Deleted or overwritten objects are retained as previous versions. For disaster recovery, enable S3 Cross-Region Replication to a bucket in ap-southeast-2 (Sydney) if required.

### Redis
Redis (BullMQ queue state) is not backed up — it does not need to be. Jobs that were in-flight at the time of a Redis failure will be re-queued on restart. The BullMQ job processors are all idempotent and handle re-runs gracefully.

---

## Monitoring and Alerting

The following CloudWatch alarms are recommended. Create them via the AWS console or add to Terraform.

| Alarm                                      | Metric                                        | Threshold         |
|--------------------------------------------|-----------------------------------------------|-------------------|
| API error rate high                        | ECS service / HTTP 5xx count                  | > 10/min for 5min |
| API CPU high                               | ECS CPU utilisation                           | > 80% for 10min   |
| Worker task stopped unexpectedly           | ECS task stopped event                        | Any               |
| RDS CPU high                               | RDS CPUUtilization                            | > 80% for 10min   |
| RDS free storage low                       | RDS FreeStorageSpace                          | < 5 GB            |
| RDS connection count high                  | RDS DatabaseConnections                       | > 80 connections  |
| Redis memory high                          | ElastiCache FreeableMemory                    | < 100 MB          |
| Failed login spike (potential brute force) | Custom metric from application logs           | > 20/min          |
| Interest accrual job failed                | BullMQ failed job count (custom metric)       | > 0               |

Set up an SNS topic and subscribe the ops team email address to receive alarm notifications.

**Structured logging:** The API uses a structured logger (`AppLogger`) that outputs JSON. In production, ECS ships logs to CloudWatch Logs. Use CloudWatch Insights to query logs:

```
# Find all payment approvals in the last hour
fields @timestamp, actorAdminId, entityId
| filter action = "payment.approve"
| sort @timestamp desc
```

---

## Estimated Monthly Cost (500 Vehicles)

These are rough estimates for AWS ap-southeast-1 as of mid-2026. Actual costs depend on traffic and data volume.

| Service                              | Spec                                  | Est. Monthly    |
|--------------------------------------|---------------------------------------|-----------------|
| ECS Fargate — API (2 tasks × 0.5 vCPU, 1 GB) | ~720 hours/month            | ~S$55           |
| ECS Fargate — Worker (1 task × 0.25 vCPU, 512 MB) | ~720 hours/month         | ~S$14           |
| RDS PostgreSQL db.t4g.medium Multi-AZ | 20 GB storage                        | ~S$130          |
| ElastiCache Redis cache.t4g.micro    | Single node                           | ~S$25           |
| ALB                                  | Low traffic                           | ~S$25           |
| S3 (documents bucket)                | 50 GB storage + 100K requests/month   | ~S$15           |
| CloudFront (if used for frontend)    | Low traffic                           | ~S$10           |
| Route53                              | 1 hosted zone                         | ~S$1            |
| Secrets Manager                      | 6 secrets                             | ~S$3            |
| CloudWatch Logs                      | 5 GB/month                            | ~S$8            |
| **Total estimate**                   |                                       | **~S$286/month**|

This is a minimal footprint. Scale RDS instance size if query latency becomes an issue at higher vehicle/customer counts.

---

## Go-Live Checklist

### Things only the client can supply
- [ ] AWS account created and billing alerts configured
- [ ] Resend account created; sending domain `karrkarr.com.sg` verified (DKIM + SPF records added to DNS)
- [ ] Real PayNow UEN obtained from bank — update `paynow.uen` and `paynow.merchantName` in Policy settings after first login
- [ ] Real bank account details — update `bank.*` policy settings
- [ ] Domain `karrkarr.com.sg` accessible in Route53 or ready for NS delegation
- [ ] DNS TTLs lowered before cutover window

### Technical go-live steps
- [ ] All seed passwords rotated (none of the `Karrkarr@2026!` accounts exist in production)
- [ ] Production JWT secrets set in Secrets Manager (64+ char random strings)
- [ ] S3 bucket public access block confirmed enabled
- [ ] RDS encryption at rest confirmed enabled
- [ ] CORS_ORIGINS set to production domains only
- [ ] Terraform applied, all resources GREEN
- [ ] `prisma migrate deploy` completed successfully
- [ ] API health check endpoint returns 200
- [ ] Worker service showing 1 RUNNING task
- [ ] Admin dashboard accessible at `admin.karrkarr.com.sg`
- [ ] Customer portal accessible at `portal.karrkarr.com.sg`
- [ ] Test end-to-end: create vehicle → create customer → create rental → generate invoice → submit payment → approve payment → verify ledger entry
- [ ] CloudWatch alarms created and tested (trigger one intentionally)
- [ ] Penetration test completed (or formally deferred with client sign-off)
- [ ] UAT sign-off from Karrkarr operations manager

### UAT scenarios Karrkarr must validate before go-live
- [ ] Admin can log in with all 5 roles and permissions behave as documented
- [ ] Customer can receive invitation email, set password, and log in
- [ ] Customer can view their invoice and scan the PayNow QR code in a real banking app
- [ ] Customer can submit a payment claim with a proof screenshot
- [ ] Accounts staff can approve and reject payment submissions
- [ ] Interest accrual runs correctly (trigger manually from admin/jobs and verify ledger entries)
- [ ] Compliance expiry reminders fire for a test vehicle
- [ ] Reports export correctly in Excel format
