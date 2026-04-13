from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, User, Order, SupportTicket
import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./database.sqlite"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Clean check
    if db.query(User).first():
        print("Database already seeded!")
        db.close()
        return

    # Create Users
    user1 = User(id=1, name="Ayush Ranjan", email="ayush@example.com", phone="+919876543210")
    user2 = User(id=2, name="Akash Doe", email="akash@example.com", phone="+919876543211")
    db.add_all([user1, user2])
    db.commit()

    # Create Orders with realistic Indian cuisine
    orders = [
        Order(user_id=1, restaurant_name="Paradise Biryani (Hyderabadi Chicken Biryani)", status="Preparing", total_amount=450.00),
        Order(user_id=1, restaurant_name="Punjabi Dhaba (Butter Chicken & Garlic Naan)", status="Delivered", total_amount=650.50),
        Order(user_id=1, restaurant_name="Karim's (Mutton Rogan Josh)", status="Delivered", total_amount=920.00),
        Order(user_id=1, restaurant_name="Bikanerwala (Paneer Tikka & Tandoori Roti)", status="Cancelled", total_amount=350.00),
        Order(user_id=2, restaurant_name="Aminia (Lucknowi Mutton Biryani)", status="Out for Delivery", total_amount=550.00),
    ]
    db.add_all(orders)
    db.commit()

    # Create Tickets
    tickets = [
        SupportTicket(user_id=1, order_id=2, issue_type="Complaint", status="Resolved", transcript="Missing extra raita with the biryani order."),
        SupportTicket(user_id=1, order_id=4, issue_type="Refund", status="Resolved", transcript="Restaurant unable to prepare Paneer Tikka, refunded."),
    ]
    db.add_all(tickets)
    db.commit()
    
    print("Database seeded with realistic Indian food data successfully!")
    db.close()

if __name__ == "__main__":
    seed_database()
