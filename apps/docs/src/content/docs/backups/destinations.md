---
title: Storage destinations
description: Connect an S3-compatible bucket as a backup destination and test the connection.
---

A **destination** is the S3-compatible bucket that backups upload to. You manage
destinations under **Settings → Storage** (`/dashboard/settings/storage`), and
every [database](/backups/database-backups/) and [volume](/backups/volume-backups/)
backup picks one when it runs. Destinations are scoped to your organization and
can be reused by any number of backups.

Docklands talks to storage through [`rclone`](https://rclone.org/), so anything
`rclone`'s S3 backend supports works: AWS S3, Cloudflare R2, Backblaze B2,
MinIO, DigitalOcean Spaces, Wasabi, Storj, Ceph, SeaweedFS, and many more.

## Add a destination

On the Storage page, add a provider and fill in:

- **Name** — a label to identify the destination in backup pickers.
- **Provider** — the S3 provider preset (AWS, Cloudflare R2, MinIO, DigitalOcean
  Spaces, Wasabi, and [many others](#supported-providers); choose **Any other S3
  compatible provider** if yours is not listed). This maps to `rclone`'s
  `--s3-provider` and tunes provider-specific quirks.
- **Access Key** and **Secret Access Key** — the S3 credentials.
- **Bucket** — the bucket name backups are written into.
- **Region** — the bucket's region (use the provider's expected value; some
  S3-compatible services accept `auto` or `us-east-1`).
- **Endpoint** — the S3 endpoint URL. For AWS you can usually leave the default
  region endpoint; for R2, MinIO, Spaces, and others this is the custom endpoint
  your provider gives you.
- **Additional flags** *(optional)* — extra `rclone` flags, one per entry, each
  beginning with `--` (for example `--s3-sign-accept-encoding=false`). These are
  validated against a strict format and appended to every `rclone` call for this
  destination.

### Test the connection

Use **Test connection** before saving. Docklands runs an `rclone ls` against the
bucket with short timeouts and a single retry, so a bad endpoint, wrong
credentials, or unreachable bucket fails fast with the error message surfaced in
the UI. A successful test means Docklands could authenticate and list the bucket.

:::note
The test always runs from the **Docklands host**, even though the form may let
you pick a runtime worker. If your backups run on a remote runtime worker that
reaches storage differently (for example a private MinIO only that worker can
see), a passing test on the host does not guarantee the worker can upload — run a
manual backup on that service to confirm end to end.
:::

## How credentials are used

Credentials are stored in the destination record and passed to `rclone` on the
command line at backup time as `--s3-access-key-id` / `--s3-secret-access-key`
(together with the region, endpoint, and provider). Docklands also adds
`--s3-no-check-bucket` and `--s3-force-path-style` to every call.

:::caution
**Backup credentials are stored as-is (not encrypted at rest) and are passed on
the command line.** Two practical consequences:

- Anyone with database access to your Docklands instance can read the keys.
- The keys appear in the process command line on the host while a backup runs.

Mitigate by giving each destination a **scoped, least-privilege S3 key** —
ideally write-only to a single bucket/prefix, no delete unless you use
retention — rather than a root account key. Logs redact the credentials, but the
stored value and the live process arguments are not protected. Rotate keys if a
host or its database is ever exposed.
:::

## Edit and delete

You can update a destination's fields or delete it. Deleting a destination
**cascades**: any backups that point at it are removed along with it (the
database enforces this with `ON DELETE CASCADE`). It does **not** touch the files
already in your bucket — those remain until you delete them in your storage
provider.

## Supported providers

The provider preset covers the common S3-compatible services, including: Amazon
S3, Cloudflare R2, DigitalOcean Spaces, Wasabi, Backblaze (via S3 gateway),
MinIO, Storj, Ceph, SeaweedFS, Google Cloud Storage, IBM COS, IDrive e2, Linode
Object Storage, Scaleway, Tencent COS, Alibaba OSS, Huawei OBS, and more. If
yours is missing, choose **Any other S3 compatible provider** and set the
endpoint and region manually.
