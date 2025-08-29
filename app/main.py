#app/main.py

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from app.routes import twilio_webhooks, agent, queue
from app.config import settings

# Create FastAPI app
app = FastAPI(title="Twilio Call Center", version="1.0.0")

# Setup templates
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(twilio_webhooks.router)
app.include_router(agent.router)
app.include_router(queue.router)

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Main dashboard page"""
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "twilio_account_sid": settings.TWILIO_ACCOUNT_SID,
            "base_url": settings.BASE_URL
        }
    )

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Agent login page"""
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True if settings.ENVIRONMENT == "development" else False
    )