# =============================================================
#  Team Tasks Management System — Flask Backend
#  app.py
# =============================================================

import os
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify, g

# ------------------------------------------------------------------
# App Configuration
# ------------------------------------------------------------------
app = Flask(__name__)
app.config["DATABASE"] = os.path.join(os.path.dirname(__file__), "tasks.db")
app.config["SECRET_KEY"] = "dev-secret-key-change-in-production"


# ------------------------------------------------------------------
# Database Helpers
# ------------------------------------------------------------------

def get_db():
    """Open a database connection and store it on Flask's 'g' object."""
    if "db" not in g:
        g.db = sqlite3.connect(
            app.config["DATABASE"],
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        # Return rows as dict-like objects so we can use row["column"]
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    """Close the database connection at the end of every request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create tables if they don't exist yet."""
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT    NOT NULL,
            description TEXT,
            assigned_to TEXT    NOT NULL,
            status      TEXT    NOT NULL DEFAULT 'Pending',
            priority    TEXT    NOT NULL DEFAULT 'Medium',
            due_date    TEXT,
            created_at  TEXT    NOT NULL
        )
    """)
    db.commit()


# Run init_db() once when the application starts
with app.app_context():
    init_db()


# ------------------------------------------------------------------
# Helper: Convert a sqlite3.Row to a plain dict
# ------------------------------------------------------------------

def row_to_dict(row):
    return dict(zip(row.keys(), row))


# ------------------------------------------------------------------
# Routes — Pages
# ------------------------------------------------------------------

@app.route("/")
def index():
    """Serve the single-page dashboard."""
    return render_template("index.html")


# ------------------------------------------------------------------
# API — Tasks CRUD
# ------------------------------------------------------------------

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """
    Return all tasks.
    Supports optional query params:
        status   — filter by status  (Pending | In Progress | Completed)
        priority — filter by priority (Low | Medium | High)
        search   — search in title / description / assigned_to
    """
    db = get_db()
    query = "SELECT * FROM tasks WHERE 1=1"
    params = []

    status = request.args.get("status", "").strip()
    priority = request.args.get("priority", "").strip()
    search = request.args.get("search", "").strip()

    if status:
        query += " AND status = ?"
        params.append(status)

    if priority:
        query += " AND priority = ?"
        params.append(priority)

    if search:
        like = f"%{search}%"
        query += " AND (title LIKE ? OR description LIKE ? OR assigned_to LIKE ?)"
        params.extend([like, like, like])

    query += " ORDER BY id DESC"

    rows = db.execute(query, params).fetchall()
    tasks = [row_to_dict(r) for r in rows]
    return jsonify(tasks)


@app.route("/api/tasks", methods=["POST"])
def create_task():
    """Create a new task."""
    data = request.get_json(force=True)

    # Basic validation
    required = ["title", "assigned_to"]
    for field in required:
        if not data.get(field, "").strip():
            return jsonify({"error": f"'{field}' is required"}), 400

    # Validate status & priority
    valid_status   = {"Pending", "In Progress", "Completed"}
    valid_priority = {"Low", "Medium", "High"}

    status   = data.get("status",   "Pending").strip()
    priority = data.get("priority", "Medium").strip()

    if status not in valid_status:
        status = "Pending"
    if priority not in valid_priority:
        priority = "Medium"

    db = get_db()
    cursor = db.execute(
        """INSERT INTO tasks (title, description, assigned_to, status, priority, due_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            data["title"].strip(),
            data.get("description", "").strip(),
            data["assigned_to"].strip(),
            status,
            priority,
            data.get("due_date", ""),
            datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        ),
    )
    db.commit()

    new_task = row_to_dict(db.execute("SELECT * FROM tasks WHERE id = ?", (cursor.lastrowid,)).fetchone())
    return jsonify(new_task), 201


@app.route("/api/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id):
    """Fetch a single task by id."""
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(row_to_dict(row))


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """Update an existing task (full update)."""
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Task not found"}), 404

    data = request.get_json(force=True)

    valid_status   = {"Pending", "In Progress", "Completed"}
    valid_priority = {"Low", "Medium", "High"}

    title       = data.get("title",       row["title"]).strip()
    description = data.get("description", row["description"] or "").strip()
    assigned_to = data.get("assigned_to", row["assigned_to"]).strip()
    status      = data.get("status",      row["status"]).strip()
    priority    = data.get("priority",    row["priority"]).strip()
    due_date    = data.get("due_date",    row["due_date"] or "")

    if not title or not assigned_to:
        return jsonify({"error": "title and assigned_to are required"}), 400
    if status not in valid_status:
        status = row["status"]
    if priority not in valid_priority:
        priority = row["priority"]

    db.execute(
        """UPDATE tasks SET title=?, description=?, assigned_to=?,
           status=?, priority=?, due_date=? WHERE id=?""",
        (title, description, assigned_to, status, priority, due_date, task_id),
    )
    db.commit()

    updated = row_to_dict(db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())
    return jsonify(updated)


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """Delete a task."""
    db = get_db()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Task not found"}), 404

    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return jsonify({"message": "Task deleted successfully"})


# ------------------------------------------------------------------
# API — Statistics
# ------------------------------------------------------------------

@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Return aggregate statistics for the dashboard counters."""
    db = get_db()

    total       = db.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    pending     = db.execute("SELECT COUNT(*) FROM tasks WHERE status='Pending'").fetchone()[0]
    in_progress = db.execute("SELECT COUNT(*) FROM tasks WHERE status='In Progress'").fetchone()[0]
    completed   = db.execute("SELECT COUNT(*) FROM tasks WHERE status='Completed'").fetchone()[0]
    high_prio   = db.execute("SELECT COUNT(*) FROM tasks WHERE priority='High'").fetchone()[0]

    return jsonify({
        "total":       total,
        "pending":     pending,
        "in_progress": in_progress,
        "completed":   completed,
        "high_priority": high_prio,
    })


# ------------------------------------------------------------------
# Entry Point
# ------------------------------------------------------------------

if __name__ == "__main__":
    # debug=True for local development only — turned off via gunicorn in prod
    app.run(debug=True, host="0.0.0.0", port=5000)
