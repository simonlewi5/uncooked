# Database Schema

This document describes the Supabase (PostgreSQL) database schema for Uncooked.

## Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │  (Supabase Auth - managed)
│─────────────────│
│ id (PK)         │
│ email           │
│ ...             │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐       ┌─────────────────┐
│     users       │       │     resumes     │
│─────────────────│       │─────────────────│
│ id (PK, FK)     │◄──────│ user_id (FK)    │
│ full_name       │  1:N  │ id (PK)         │
│ avatar_url      │       │ title           │
│ created_at      │       │ content         │
│ updated_at      │       │ file_url        │
└────────┬────────┘       │ is_primary      │
         │                └────────┬────────┘
         │ 1:N                     │
         ▼                         │
┌─────────────────┐                │
│ company_profiles│                │
│─────────────────│                │
│ id (PK)         │                │
│ user_id (FK)    │                │
│ company_name    │                │
│ company_website │                │
│ industry        │                │
│ notes           │                │
└────────┬────────┘                │
         │                         │
    ┌────┴────┐                    │
    │         │                    │
    │ 1:N     │ 1:N                │
    ▼         ▼                    │
┌─────────────────┐      ┌─────────────────┐
│research_sessions│      │ job_applications│
│─────────────────│      │─────────────────│
│ id (PK)         │      │ id (PK)         │
│ user_id (FK)    │      │ user_id (FK)    │
│ company_profile │      │ company_profile │
│   _id (FK)      │      │   _id (FK)      │
│ title           │      │ resume_id (FK)──┼──┘
│ messages (JSONB)│      │ job_title       │
└─────────────────┘      │ status (ENUM)   │
                         │ applied_at      │
                         └─────────────────┘
```

---

## Tables

### `users`

Extends Supabase Auth with additional profile fields. Auto-created on signup via trigger.

| Column       | Type        | Constraints             | Description              |
| ------------ | ----------- | ----------------------- | ------------------------ |
| `id`         | UUID        | PK, FK → auth.users     | User's auth ID           |
| `email`      | TEXT        |                         | User's email address     |
| `full_name`  | TEXT        |                         | User's display name      |
| `avatar_url` | TEXT        |                         | Profile picture URL      |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When profile was created |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update timestamp    |

**RLS Policies:**

- Users can SELECT, INSERT, UPDATE their own row only

---

### `company_profiles`

Saved companies in user's Research Board. Users can star/favorite companies to highlight top targets on the Dashboard.

| Column            | Type        | Constraints                            | Description                              |
| ----------------- | ----------- | -------------------------------------- | ---------------------------------------- |
| `id`              | UUID        | PK, DEFAULT gen_random_uuid()          | Unique identifier                        |
| `user_id`         | UUID        | NOT NULL, FK → users                   | Owner of the profile                     |
| `company_name`    | TEXT        | NOT NULL                               | Company name                             |
| `company_website` | TEXT        |                                        | Company website URL                      |
| `industry`        | TEXT        |                                        | Industry sector                          |
| `company_size`    | TEXT        |                                        | Size (startup, mid, enterprise)          |
| `location`        | TEXT        |                                        | HQ or office location                    |
| `notes`           | TEXT        |                                        | User's notes about company               |
| `is_favorite`     | BOOLEAN     | NOT NULL, DEFAULT false                | Whether the company is starred/favorited |
| `created_at`      | TIMESTAMPTZ | NOT NULL, DEFAULT now()                | Created timestamp                        |
| `updated_at`      | TIMESTAMPTZ | NOT NULL, DEFAULT now()                | Last update timestamp                    |

**RLS Policies:**

- Users can SELECT, INSERT, UPDATE, DELETE their own rows only (including toggling `is_favorite` on their own companies)

---

### `research_sessions`

Chat history per company/board for AI research conversations.

| Column               | Type        | Constraints                                | Description           |
| -------------------- | ----------- | ------------------------------------------ | --------------------- |
| `id`                 | UUID        | PK, DEFAULT gen_random_uuid()              | Unique identifier     |
| `user_id`            | UUID        | NOT NULL, FK → users                       | Owner of session      |
| `company_profile_id` | UUID        | FK → company_profiles (ON DELETE SET NULL) | Associated company    |
| `title`              | TEXT        |                                            | Session title         |
| `messages`           | JSONB       | NOT NULL, DEFAULT '[]'                     | Chat messages array   |
| `created_at`         | TIMESTAMPTZ | NOT NULL, DEFAULT now()                    | Created timestamp     |
| `updated_at`         | TIMESTAMPTZ | NOT NULL, DEFAULT now()                    | Last update timestamp |

**Messages JSONB Structure:**

```json
[
  { "role": "user", "content": "Tell me about this company" },
  { "role": "assistant", "content": "Based on my research..." }
]
```

**RLS Policies:**

- Users can SELECT, INSERT, UPDATE, DELETE their own rows only

---

### `resumes`

Stored resume content per user.

| Column       | Type        | Constraints                         | Description                   |
| ------------ | ----------- | ----------------------------------- | ----------------------------- |
| `id`         | UUID        | PK, DEFAULT gen_random_uuid()       | Unique identifier             |
| `user_id`    | UUID        | NOT NULL, FK → users                | Owner of resume               |
| `title`      | TEXT        | NOT NULL, DEFAULT 'Untitled Resume' | Resume title/version name     |
| `content`    | TEXT        |                                     | Parsed text content           |
| `file_url`   | TEXT        |                                     | Storage URL for uploaded file |
| `file_name`  | TEXT        |                                     | Original file name            |
| `is_primary` | BOOLEAN     | DEFAULT false                       | Primary resume flag           |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now()             | Created timestamp             |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now()             | Last update timestamp         |

**RLS Policies:**

- Users can SELECT, INSERT, UPDATE, DELETE their own rows only

**Triggers:**

- `ensure_single_primary_resume`: Ensures only one resume per user has `is_primary = true`

---

### `job_applications`

Tracks Applied/Interviewing/Offer status per job.

| Column               | Type               | Constraints                                | Description                    |
| -------------------- | ------------------ | ------------------------------------------ | ------------------------------ |
| `id`                 | UUID               | PK, DEFAULT gen_random_uuid()              | Unique identifier              |
| `user_id`            | UUID               | NOT NULL, FK → users                       | Owner of application           |
| `company_profile_id` | UUID               | FK → company_profiles (ON DELETE SET NULL) | Associated company             |
| `resume_id`          | UUID               | FK → resumes (ON DELETE SET NULL)          | Resume used for application    |
| `job_title`          | TEXT               | NOT NULL                                   | Position title                 |
| `job_url`            | TEXT               |                                            | Link to job posting            |
| `job_description`    | TEXT               |                                            | Job description text           |
| `status`             | application_status | NOT NULL, DEFAULT 'saved'                  | Current status                 |
| `applied_at`         | TIMESTAMPTZ        |                                            | When application was submitted |
| `notes`              | TEXT               |                                            | User's notes                   |
| `created_at`         | TIMESTAMPTZ        | NOT NULL, DEFAULT now()                    | Created timestamp              |
| `updated_at`         | TIMESTAMPTZ        | NOT NULL, DEFAULT now()                    | Last update timestamp          |

**application_status ENUM values:**

- `saved` - Job saved, not yet applied
- `applied` - Application submitted
- `phone_screen` - Phone screen scheduled/completed
- `interviewing` - In interview process
- `offer` - Received offer
- `rejected` - Application rejected
- `withdrawn` - User withdrew application

**RLS Policies:**

- Users can SELECT, INSERT, UPDATE, DELETE their own rows only

**Triggers:**

- `set_applied_at`: Auto-sets `applied_at` when status changes to 'applied'

---

### `practice_sessions`

Tracks individual interview/practice sessions so the Dashboard Practice Consistency card can show real activity instead of an empty state.

| Column             | Type        | Constraints                            | Description                                |
| ------------------ | ----------- | -------------------------------------- | ------------------------------------------ |
| `id`               | UUID        | PK, DEFAULT gen_random_uuid()          | Unique identifier                          |
| `user_id`          | UUID        | NOT NULL, FK → users                   | Owner of the session                       |
| `duration_minutes` | INTEGER     | NOT NULL, CHECK (duration_minutes > 0) | Duration of the practice session in minutes |
| `created_at`       | TIMESTAMPTZ | NOT NULL, DEFAULT now()                | When the practice session was recorded     |
| `updated_at`       | TIMESTAMPTZ | NOT NULL, DEFAULT now()                | Last update timestamp                      |

**RLS Policies:**

- Users can SELECT, INSERT, UPDATE, DELETE their own rows only

---

## Foreign Key Relationships

| From Table        | Column             | To Table         | Column | On Delete |
| ----------------- | ------------------ | ---------------- | ------ | --------- |
| users             | id                 | auth.users       | id     | CASCADE   |
| company_profiles  | user_id            | users            | id     | CASCADE   |
| research_sessions | user_id            | users            | id     | CASCADE   |
| research_sessions | company_profile_id | company_profiles | id     | SET NULL  |
| resumes           | user_id            | users            | id     | CASCADE   |
| job_applications  | user_id            | users            | id     | CASCADE   |
| job_applications  | company_profile_id | company_profiles | id     | SET NULL  |
| job_applications  | resume_id          | resumes          | id     | SET NULL  |
| practice_sessions | user_id            | users            | id     | CASCADE   |

---

## Indexes

| Table             | Index Name                               | Columns            |
| ----------------- | ---------------------------------------- | ------------------ |
| company_profiles  | company_profiles_user_id_idx             | user_id            |
| research_sessions | research_sessions_user_id_idx            | user_id            |
| research_sessions | research_sessions_company_profile_id_idx | company_profile_id |
| resumes           | resumes_user_id_idx                      | user_id            |
| job_applications  | job_applications_user_id_idx             | user_id            |
| job_applications  | job_applications_company_profile_id_idx  | company_profile_id |
| job_applications  | job_applications_status_idx              | status             |
| practice_sessions | practice_sessions_user_id_created_at_idx | user_id, created_at |

---

## Shared Functions

### `update_updated_at()`

Trigger function that sets `updated_at = now()` on any row update.

### `handle_new_user()`

Trigger function that auto-creates a `users` row when a new `auth.users` record is created (on signup).

---

## Applying Migrations

```bash
# Local development
supabase db reset          # Reset and run all migrations

# Push to remote
supabase db push           # Apply pending migrations to remote
```
