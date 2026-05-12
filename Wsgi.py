"""
wsgi.py — production entry-point for Gunicorn / Render.com
Run locally:  gunicorn wsgi:application
"""

from app import app, init_db

init_db()          # ensure DB and tables exist before the first request
application = app  # Gunicorn looks for 'application' by convention