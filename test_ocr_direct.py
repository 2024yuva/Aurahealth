
import os
import base64
import json
import sys
from openai import OpenAI

# Add src to path to import keys
sys.path.append(os.path.join(os.getcwd(), 'src'))
try:
    from keys import OPENAI_API_KEY
except ImportError:
    print("Could not import OPENAI_API_KEY from src.keys")
    sys.exit(1)

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def analyze_prescription(image_path):
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    base64_image = encode_image(image_path)
    
    prompt = """
    You are an expert medical transcriptionist specializing in deciphering and accurately transcribing handwritten medical prescriptions. Your role is to meticulously analyze the provided prescription images and extract all relevant information with the highest degree of precision.

    Your job is to extract and accurately transcribe the following details from the provided prescription images:
    1. Patient's full name
    2. Patient's age (handle different formats like "42y", "42yrs", "42", "42 years")
    3. Patient's gender
    4. Doctor's full name
    5. Doctor's license number
    6. Prescription date (in YYYY-MM-DD format)
    7. List of medications including:
       - Medication name
       - Dosage
       - Frequency
       - Duration
    8. Additional notes or instructions. Provide detailed and enhanced notes using bullet points.
    
    Return the result as a valid JSON object with the following keys:
    patient_name, patient_age, patient_gender, doctor_name, doctor_license, prescription_date, medications (list of objects with name, dosage, frequency, duration), additional_notes.
    
    If portions of the image are not clear then leave the values as "Not available". Do not make up the values.
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            },
                        },
                    ],
                }
            ],
            response_format={ "type": "json_object" },
            temperature=0.5,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    target_image = r"C:\Users\HP\health-prescription\public\118.jpg"
    
    if not os.path.exists(target_image):
        print(f"Error: File not found at {target_image}")
    else:
        print(f"Analyzing {target_image}...")
        result = analyze_prescription(target_image)
        print("\n--- Result ---\n")
        print(result)
