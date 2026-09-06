import sqlite3
import os
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DB = os.path.join(ROOT, "sql", "credit_risk.db")
SEED_DB = os.path.join(ROOT, "sql", "credit_risk_seed.db")

def make_seed_db(n_applicants=20000):
    if os.path.exists(SEED_DB):
        os.remove(SEED_DB)
        
    src = sqlite3.connect(SRC_DB)
    dst = sqlite3.connect(SEED_DB)
    
    print(f"Sampling {n_applicants} applicants from {SRC_DB}...")
    df_app = pd.read_sql(f"SELECT * FROM applicants LIMIT {n_applicants}", src)
    df_app.to_sql("applicants", dst, index=False)
    
    app_ids = tuple(df_app["SK_ID_CURR"].tolist())
    id_list_str = ",".join(map(str, app_ids[:10000]))
    id_prev_str = ",".join(map(str, app_ids[:5000]))
    
    print("Exporting matching bureau_summary...")
    df_bur = pd.read_sql(f"SELECT * FROM bureau_summary WHERE SK_ID_CURR IN ({id_list_str})", src)
    df_bur.to_sql("bureau_summary", dst, index=False)
    
    print("Exporting matching previous_applications...")
    df_prev = pd.read_sql(f"SELECT * FROM previous_applications WHERE SK_ID_CURR IN ({id_prev_str})", src)
    df_prev.to_sql("previous_applications", dst, index=False)
    
    print("Exporting matching installment_summary...")
    df_inst = pd.read_sql(f"SELECT * FROM installment_summary WHERE SK_ID_CURR IN ({id_list_str})", src)
    df_inst.to_sql("installment_summary", dst, index=False)
    
    # Create indexes
    cur = dst.cursor()
    cur.execute("CREATE INDEX IF NOT EXISTS idx_applicants_id ON applicants(SK_ID_CURR);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_applicants_target ON applicants(TARGET);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bureau_id ON bureau_summary(SK_ID_CURR);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_prev_id ON previous_applications(SK_ID_CURR);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_inst_id ON installment_summary(SK_ID_CURR);")
    dst.commit()
    
    cur.execute("VACUUM;")
    dst.close()
    src.close()
    
    size_mb = os.path.getsize(SEED_DB) / (1024 * 1024)
    print(f"Seed DB created successfully: {size_mb:.2f} MB")

if __name__ == "__main__":
    make_seed_db()
