from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, relationship
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, unique=True, index=True)
    
    orders = relationship("Order", back_populates="user")
    tickets = relationship("SupportTicket", back_populates="user")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    restaurant_name = Column(String)
    status = Column(String)  # e.g., Preparing, Out for Delivery, Delivered, Cancelled
    total_amount = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="orders")
    tickets = relationship("SupportTicket", back_populates="order")

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    issue_type = Column(String) # e.g., Refund, Status Update, Complaint
    status = Column(String) # Open, Resolved
    transcript = Column(String, nullable=True) # To store voice agent conversation
    
    user = relationship("User", back_populates="tickets")
    order = relationship("Order", back_populates="tickets")
