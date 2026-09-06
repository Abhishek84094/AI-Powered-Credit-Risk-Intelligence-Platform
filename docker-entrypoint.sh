#!/bin/bash
set -e

echo "=========================================================="
echo "  CredPulse AI-Powered Credit Risk Intelligence Platform  "
echo "=========================================================="

DB_FILE="/app/sql/credit_risk.db"
DATA_DIR="/app/data"

# Check if SQLite analytical database exists and is non-empty
if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
    echo "[*] SQLite database ($DB_FILE) not found or empty."

    # Check if Home Credit CSVs exist in /app/data or /app/data/home-credit-default-risk
    if [ -f "$DATA_DIR/application_train.csv" ] || [ -f "$DATA_DIR/home-credit-default-risk/application_train.csv" ]; then
        echo "[+] Found Home Credit dataset in $DATA_DIR."
        echo "[+] Initializing analytical SQLite database (sql/init_db.py)..."
        python sql/init_db.py || echo "[!] Warning: sql/init_db.py encountered an error during initialization."
    else
        echo "[!] Notice: Home Credit CSVs not found in $DATA_DIR."
        echo "[!] Talk-to-Data tab will display an informative offline notice until CSVs are placed in ./data."
    fi
else
    echo "[OK] SQLite database found: $DB_FILE"
fi

echo "[+] Starting CredPulse ASGI server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
