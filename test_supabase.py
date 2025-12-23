
import os
import sys
import json
from datetime import datetime
from supabase import create_client, Client

# Add src to path to import keys
sys.path.append(os.path.join(os.getcwd(), 'src'))
try:
    from keys import SUPABASE_URL, SUPABASE_KEY
except ImportError:
    print("Could not import keys from src.keys")
    sys.exit(1)

def test_connection():
    print(f"Testing connection to: {SUPABASE_URL}")
    print(f"Using Key (truncated): {SUPABASE_KEY[:5]}..." if SUPABASE_KEY else "No Key Found")

    if not SUPABASE_URL or not SUPABASE_KEY or "your-supabase" in SUPABASE_URL:
        print("❌ Invalid configuration. Please check src/keys.py")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # internal check usually happens on first request
        print("Client initialized. Attempting INSERT...")

        dummy_data = {
            "patient_name": "Test Patient",
            "patient_age": "30",
            "patient_gender": "Other",
            "doctor_name": "Dr. Test",
            "doctor_license": "TEST1234",
            "prescription_date": datetime.now().strftime("%Y-%m-%d"),
            "medications": [
                {"name": "TestMeds", "dosage": "10mg", "frequency": "Daily", "duration": "5 days"}
            ],
            "additional_notes": "This is a test record from the verification script."
        }

        response = supabase.table("prescriptions").insert(dummy_data).execute()
        
        if response.data:
            print("✅ INSERT SUCCESSFUL!")
            print("Inserted Record:")
            print(json.dumps(response.data[0], indent=2))
            
            # Optional: Clean up
            # print("Cleaning up...")
            # supabase.table("prescriptions").delete().eq("id", response.data[0]['id']).execute()
        else:
            print("❌ Insert returned no data (but no exception). Check policies?")
            
            
    except Exception as e:
        print("FAIL: " + str(e))

if __name__ == "__main__":
    test_connection()
