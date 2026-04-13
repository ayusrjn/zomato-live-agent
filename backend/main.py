from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base, User, Order, SupportTicket
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./database.sqlite"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zomato Live Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str

    model_config = {
        "from_attributes": True
    }

class OrderResponse(BaseModel):
    id: int
    user_id: int
    restaurant_name: str
    status: str
    total_amount: float
    
    model_config = {
        "from_attributes": True
    }

class RefundRequest(BaseModel):
    user_id: int
    order_id: int
    reason: str

@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/api/orders/{user_id}", response_model=List[OrderResponse])
def get_orders(user_id: int, db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.user_id == user_id).all()
    return orders

@app.post("/api/support/refund")
def process_refund(req: RefundRequest, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == req.order_id, Order.user_id == req.user_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    ticket = SupportTicket(
        user_id=req.user_id,
        order_id=req.order_id,
        issue_type="Refund",
        status="Open",
        transcript=req.reason
    )
    db.add(ticket)
    
    order.status = "Refund Processing"
    db.commit()
    db.refresh(ticket)
    
    return {"message": "Refund processing. Ticket opened.", "ticket_id": ticket.id}
    
@app.post("/api/seed")
def seed_db(db: Session = Depends(get_db)):
    if not db.query(User).first():
        user1 = User(name="Alex Smith", email="alex@example.com", phone="+1234567890")
        db.add(user1)
        db.commit()
        db.refresh(user1)
        
        order1 = Order(user_id=user1.id, restaurant_name="The Spicy Bowl", status="Preparing", total_amount=15.99)
        order2 = Order(user_id=user1.id, restaurant_name="Sushi Palace", status="Delivered", total_amount=25.50)
        db.add_all([order1, order2])
        db.commit()
        return {"message": "Database seeded with mock user and orders"}
    return {"message": "Database already seeded"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
