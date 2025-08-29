# app/routes/queue.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.queue_service import queue_service
from app.services.websocket_service import websocket_service

router = APIRouter(prefix="/queue")

@router.get("/status")
async def get_queue_status():
    """Get current queue status"""
    return queue_service.get_queue_status()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time queue updates"""
    await websocket_service.connect(websocket)
    
    try:
        # Send initial queue status
        initial_status = queue_service.get_queue_status()
        await websocket_service.send_personal_message(
            {"type": "initial_status", "data": initial_status}, 
            websocket
        )
        
        # Keep connection alive and handle messages
        while True:
            data = await websocket.receive_text()
            # Handle any incoming messages if needed
            # For now, just echo back
            await websocket_service.send_personal_message(
                {"type": "echo", "data": data}, 
                websocket
            )
            
    except WebSocketDisconnect:
        websocket_service.disconnect(websocket)