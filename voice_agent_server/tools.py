import httpx

BACKEND_API_URL = "http://localhost:8055/api"

async def check_order_status(user_id: int) -> str:
    """
    Checks the active and historical order status for a given user.
    Uses an HTTP GET proxy to the local backend.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BACKEND_API_URL}/orders/{user_id}")
            if response.status_code == 200:
                orders = response.json()
                if not orders:
                    return "The user has no past or active orders."
                # Summarize the orders
                summary = "\n".join([
                    f"Order #{o['id']} at {o['restaurant_name']} - Status: {o['status']} - Total: ${o['total_amount']}"
                    for o in orders
                ])
                return f"User Orders:\n{summary}"
            return "Failed to retrieve order status from the database."
        except Exception as e:
            return f"Error contacting data backend: {e}"

async def initiate_refund(user_id: int, order_id: int, reason: str) -> str:
    """
    Initiates a refund for a user's order and logs the complaint transcript.
    """
    async with httpx.AsyncClient() as client:
        try:
            payload = {
                "user_id": user_id,
                "order_id": order_id,
                "reason": reason
            }
            response = await client.post(f"{BACKEND_API_URL}/support/refund", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                return f"Refund ticket #{data.get('ticket_id')} has been created and the refund is processing."
            elif response.status_code == 404:
                return "Order not found. Cannot process refund. The order ID might be wrong."
            return "Failed to process refund due to internal database error."
        except Exception as e:
            return f"Error contacting data backend: {e}"
