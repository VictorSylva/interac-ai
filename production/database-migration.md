# InteracAI Database Migration & Management

The backend uses **SQLAlchemy** for ORM and **Alembic** for schema migrations.

## 1. Directory Structure
All migration files live in `backend/alembic/versions/`.
Configuration is in `backend/alembic.ini` and `backend/alembic/env.py`.

## 2. Generating a New Migration
When you change a model in `backend/database/models/`:
1. Ensure the model is imported in `backend/database/base.py` or wherever Alembic's `target_metadata` collects the metadata.
2. Run the revision command:
   ```bash
   cd backend
   alembic revision --autogenerate -m "Description of changes"
   ```
3. **CRITICAL**: Always review the generated script in `alembic/versions/` to ensure it only contains the intended changes.

## 3. Applying Migrations
### Local Environment
```bash
cd backend
alembic upgrade head
```

### Production Environment
In Render, migrations should run automatically during the build process or pre-deploy script.
If running manually via Render Shell:
```bash
alembic upgrade head
```

## 4. Downgrading Migrations
If you need to revert the database schema (e.g., during a rollback):
```bash
# Downgrade 1 version
alembic downgrade -1

# Downgrade to a specific revision ID
alembic downgrade <revision_id>
```

## 5. Seeding the Database
The project contains seed scripts to populate initial data:
- `seed_plans.py`: Seeds subscription plans (e.g., Free, Pro, Enterprise).
- `seed_all_businesses.py`: Populates demo or base business structures.
To run a seed script in production:
```bash
python seed_plans.py
```
*Note: Ensure seed scripts are idempotent (safe to run multiple times).*
