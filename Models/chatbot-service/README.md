# Chatbot Service

This service uses the CohereLabs/aya-expanse-8b model for multilingual chat generation.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # On Windows
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Service

To run the FastAPI server:
```bash
python app.py
```

The service will be available at http://localhost:8000

## Testing

To test the chatbot locally:
```bash
python test_chat.py
```

## API Endpoint

- POST /generate_reply
  - Body: {"user_text": "Your message", "system_prompt": "Optional system prompt"}
  - Response: {"reply": "Generated response"}

## Notes

- The model is 8B parameters, suitable for most GPUs.
- For even larger scale, consider the 32B version with quantization.
- Somali is not officially supported; test quality accordingly.