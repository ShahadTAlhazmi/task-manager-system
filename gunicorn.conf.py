# Gunicorn configuration for Render.com deployment
# gunicorn.conf.py

# Number of worker processes (2-4 × CPU cores is recommended)
workers = 2

# Worker class — sync is safest for SQLite
worker_class = "sync"

# Bind address — Render sets the PORT environment variable
bind = "0.0.0.0:10000"

# Logging
loglevel  = "info"
accesslog = "-"   # log to stdout
errorlog  = "-"   # log to stderr

# Timeout (seconds)
timeout = 120

# Keep-alive
keepalive = 5
