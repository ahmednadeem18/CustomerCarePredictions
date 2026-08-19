CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL
        CHECK (role IN ('department_member', 'director')),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,

    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(30),
    order_number VARCHAR(100),

    question TEXT NOT NULL,

    ai_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    ai_confidence DECIMAL(5,4),

    current_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    final_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'open'
        CHECK (status IN (
            'open',
            'in_progress',
            'director_review',
            'closed'
        )),

    response TEXT,

    accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE ticket_history (
    id SERIAL PRIMARY KEY,

    ticket_id INTEGER NOT NULL
        REFERENCES tickets(id) ON DELETE CASCADE,

    action VARCHAR(40) NOT NULL
        CHECK (action IN (
            'created',
            'ai_predicted',
            'assigned',
            'forwarded',
            'marked_irrelevant',
            'director_routed',
            'director_closed_irrelevant',
            'accepted',
            'response_sent',
            'closed'
        )),

    from_department_id INTEGER
        REFERENCES departments(id) ON DELETE SET NULL,

    to_department_id INTEGER
        REFERENCES departments(id) ON DELETE SET NULL,

    performed_by INTEGER
        REFERENCES users(id) ON DELETE SET NULL,

    response TEXT,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE training_examples (
    id SERIAL PRIMARY KEY,

    ticket_id INTEGER NOT NULL UNIQUE
        REFERENCES tickets(id) ON DELETE CASCADE,

    text TEXT NOT NULL,

    department_id INTEGER NOT NULL
        REFERENCES departments(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_versions (
    id SERIAL PRIMARY KEY,

    version VARCHAR(50) NOT NULL UNIQUE,

    model_path TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_current_department
    ON tickets(current_department_id);

CREATE INDEX idx_tickets_status
    ON tickets(status);

CREATE INDEX idx_ticket_history_ticket
    ON ticket_history(ticket_id);

CREATE INDEX idx_training_examples_department
    ON training_examples(department_id);