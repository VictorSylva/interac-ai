# Backup and Recovery Strategy

Data integrity is critical for SaaS platforms. This document outlines the backup policies.

## 1. Render PostgreSQL Backups
Render automatically manages backups for PostgreSQL databases on paid plans.
- **Daily Backups**: Render takes a full automated snapshot daily.
- **Point-in-Time Recovery (PITR)**: Render allows restoring the database to any exact second within the last 7 days.

### How to Restore
1. Go to the Render Dashboard -> PostgreSQL.
2. Select the `interact-db-prod` instance.
3. Go to the "Backups" tab.
4. Select "Restore" on a specific backup, OR use the PITR option to specify an exact timestamp.
5. Render will spin up a *new* database instance with the restored data. You must update your `DATABASE_URL` environment variables to point to this new instance.

## 2. Redis Caching
- **Persistence**: The default Render Redis acts as an ephemeral cache. If it restarts, session data, rate-limit counters, and queued Celery tasks may be lost.
- **Recovery**: The platform should be designed so that Redis failure is non-fatal. Re-logging in or retrying workflows should resolve issues.

## 3. Persistent File Storage (Argus OS)
If Argus OS writes video clips to the Render Persistent Disk (`/var/lib/surveillance`):
- Render Persistent Disks are backed up daily.
- Manual snapshots can be taken via the Render Dashboard.
- Restoring a disk requires creating a new disk from a snapshot and updating the service volume mounts.

## 4. Disaster Recovery Drill
It is highly recommended to perform a staging restore drill every quarter:
1. Take a manual snapshot of the production DB.
2. Restore it to a new staging DB instance.
3. Connect the staging backend to the restored DB.
4. Verify data integrity and application behavior.
