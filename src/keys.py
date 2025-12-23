import os

# Load OpenAI API key from environment if available, otherwise fall back to a placeholder.
# For production, prefer setting the environment variable OPENAI_API_KEY instead of committing keys.
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "sk-efgh5678abcd1234efgh5678abcd1234efgh5678")

# Supabase Credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://foyvtslydgvdgcncxtlc.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZveXZ0c2x5ZGd2ZGdjbmN4dGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NjAxODEsImV4cCI6MjA4MjAzNjE4MX0.c3Ohv84QwuOBXGBZ9DAoPsEc2Sb9rPG7pojrGVdQy7c")

# Claude API Key
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "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")