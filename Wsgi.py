"""
wsgi.py — production entry-point for Gunicorn / Render.com
"""

from app import app

application = app
