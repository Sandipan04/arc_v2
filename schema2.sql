-- 1. Users Table (Synced via Clerk Webhooks)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    school_abbr TEXT,
    program TEXT,
    batch INTEGER,
    about TEXT,
    role TEXT DEFAULT 'student',
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Schools Table (Admin created only)
CREATE TABLE schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abbr TEXT NOT NULL UNIQUE
);

-- 3. Courses Table (Student created -> Mod approved)
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- Replaced is_approved[cite: 1]
    created_by TEXT NOT NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 4. Iterations Table (Student created -> Instantly live via dropdowns)
CREATE TABLE iterations (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    sem TEXT NOT NULL DEFAULT 'FA',
    inst TEXT NOT NULL DEFAULT 'Unknown',
    status TEXT DEFAULT 'approved', -- Replaced is_approved[cite: 1]
    created_by TEXT NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(course_id, year, sem)
);

-- 5. Items (Files) Table (Student uploaded -> Instantly live -> Community flagged)
CREATE TABLE items (
    id TEXT PRIMARY KEY,
    iteration_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    r2_key TEXT NOT NULL,
    file_hash TEXT NOT NULL,        -- NEW: Stores the SHA-256 hash of the file
    status TEXT DEFAULT 'approved', -- Replaced is_approved[cite: 1]
    is_deleted BOOLEAN DEFAULT 0,
    is_flagged BOOLEAN DEFAULT 0,   -- NEW: For community reporting
    uploaded_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (iteration_id) REFERENCES iterations(id),
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    UNIQUE(iteration_id, file_hash) -- NEW: Prevents identical files in the same iteration natively
);
CREATE INDEX idx_items_uploader ON items(uploaded_by);
CREATE INDEX idx_items_date ON items(created_at);

-- 6. Comments Table (Instantly live -> Community flagged)
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    path_slug TEXT NOT NULL,
    content TEXT NOT NULL,
    is_flagged BOOLEAN DEFAULT 0,   -- NEW: For community reporting
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_date ON comments(created_at);
