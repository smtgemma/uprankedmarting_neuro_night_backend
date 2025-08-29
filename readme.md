# 1.install python 3.13

# 2.create a virutal enviroment and activate it
```
python -m venv venv

venv/script/activate
```

# 3.Install the requirements.txt
```
pip install -r requiremnts.txt
```
# 4.create the .env file

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY=your_api_key_sid
TWILIO_API_SECRET=your_api_key_secret
TWILIO_PHONE_NUMBER=your_twilio_number
TWILIO_APP_SID=twiml_app_id
BASE_URL=https://your-domain.com #use ngrok
SECRET_KEY=your-secret-key
ENVIRONMENT=development

```

# 5. Run the main file

```
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```