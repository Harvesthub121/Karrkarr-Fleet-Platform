import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import {
  S3Client, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3Service — all document I/O routes through here.
 *
 * Design decisions:
 *   - Objects are NEVER public. Every download is a presigned GET URL with a
 *     short TTL (default 1 hour, configurable via S3_PRESIGN_TTL_SECONDS).
 *   - Uploads use presigned PUT URLs so the client streams the bytes directly
 *     to S3, bypassing the API server. This keeps the API payload-free and
 *     avoids OOM on large PDF/image uploads.
 *   - We use server-side encryption (SSE-S3) by default. If the bucket has
 *     SSE-KMS configured in its bucket policy, this is a no-op.
 *   - Keys are caller-supplied (from DocumentService) to ensure they encode
 *     the business context (branch/vehicleId/filename) for forensic readability.
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly presignTtl: number;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? '';
    this.presignTtl = parseInt(process.env.S3_PRESIGN_TTL_SECONDS ?? '3600', 10);

    const endpoint = process.env.S3_ENDPOINT; // Set for local MinIO
    this.client = new S3Client({
      region: process.env.AWS_REGION ?? 'ap-southeast-1',
      ...(endpoint && {
        endpoint,
        // MinIO requires path-style; AWS uses virtual-hosted-style
        forcePathStyle: true,
      }),
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
          }
        : undefined, // Falls back to IAM role in prod
    });

    if (!this.bucket) {
      throw new InternalServerErrorException('S3_BUCKET environment variable is not set');
    }
  }

  /**
   * MIME types a client is permitted to upload.
   *
   * This is an allowlist, not a blocklist, and it is enforced HERE rather than
   * in the controller because a presigned PUT is a capability: once issued, the
   * holder can write that object without touching our API again. Handing out an
   * unrestricted presign would let an authenticated customer park an HTML or
   * SVG payload in our bucket and, if it were ever served from a domain we
   * trust, run script in that origin. Payment proofs are photos and PDFs; there
   * is no legitimate reason to accept anything else.
   */
  private static readonly ALLOWED_UPLOAD_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'application/pdf',
  ]);

  /** 15 MB. A phone screenshot is ~2 MB; a scanned agreement ~5 MB. */
  private static readonly MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

  /**
   * Generate a presigned PUT URL.
   * The client uploads directly to S3; we never touch the bytes.
   *
   * `ContentLength` is signed into the URL so the size limit is enforced by S3
   * itself. Enforcing it only in our own code would be theatre — the client
   * uploads straight to AWS and never passes through us.
   */
  async presignedPut(key: string, mimeType: string, sizeBytes?: number): Promise<string> {
    const normalised = mimeType?.toLowerCase().trim();

    if (!S3Service.ALLOWED_UPLOAD_MIME_TYPES.has(normalised)) {
      throw new BadRequestException(
        `Unsupported file type "${mimeType}". Allowed: ${[...S3Service.ALLOWED_UPLOAD_MIME_TYPES].join(', ')}`,
      );
    }

    if (sizeBytes !== undefined) {
      if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
        throw new BadRequestException('File size must be a positive integer.');
      }
      if (sizeBytes > S3Service.MAX_UPLOAD_BYTES) {
        throw new BadRequestException(
          `File exceeds the ${S3Service.MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit.`,
        );
      }
    }

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: normalised,
      ...(sizeBytes !== undefined ? { ContentLength: sizeBytes } : {}),
      ServerSideEncryption: 'AES256',
      // Defence in depth: even if the bucket policy is later loosened, an
      // uploaded object cannot be rendered inline in a browser tab.
      ContentDisposition: 'attachment',
    });
    return getSignedUrl(this.client, cmd, { expiresIn: this.presignTtl });
  }

  /**
   * Generate a presigned GET URL. TTL matches presignTtl.
   * Never return a public URL — all downloads route through here.
   */
  async presignedGet(key: string): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: this.presignTtl });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Returns size in bytes, or null if the object does not exist. */
  async headObject(key: string): Promise<{ sizeBytes: number; etag: string } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return {
        sizeBytes: res.ContentLength ?? 0,
        etag: res.ETag?.replace(/"/g, '') ?? '',
      };
    } catch {
      return null;
    }
  }
}
