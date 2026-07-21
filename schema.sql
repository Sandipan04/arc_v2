-- 1. Users Table (Synced via Clerk Webhooks)
CREATE TABLE users (
    id TEXT PRIMARY KEY,          -- Matches Clerk's user_id exactly
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    school_abbr TEXT,             -- e.g., 'SMS', 'SPS'
    program TEXT,                 -- e.g., 'Int. MSc.', 'PhD'
    batch INTEGER,                -- e.g., 2021
    about TEXT,                   -- Short bio / profile text
    role TEXT DEFAULT 'student',  -- 'student', 'moderator', 'admin'
    status TEXT DEFAULT 'pending',-- 'approved', 'pending'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Schools Table
CREATE TABLE schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abbr TEXT NOT NULL UNIQUE
);

-- 3. Courses Table
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT 1,
    created_by TEXT NOT NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 4. Iterations Table
CREATE TABLE iterations (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    sem TEXT NOT NULL DEFAULT 'FA',
    inst TEXT NOT NULL DEFAULT 'Unknown',
    is_approved BOOLEAN DEFAULT 1,
    created_by TEXT NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(course_id, year, sem)
);

-- 5. Items (Files) Table
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    iteration_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    r2_key TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT 1,
    is_deleted BOOLEAN DEFAULT 0,
    uploaded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (iteration_id) REFERENCES iterations(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE INDEX idx_items_uploader ON items(uploaded_by);
CREATE INDEX idx_items_date ON items(created_at);

-- 6. Comments Table
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    path_slug TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_date ON comments(created_at);
