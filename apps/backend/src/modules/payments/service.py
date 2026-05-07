from typing import List, Optional, Dict, Any
from uuid import UUID
import httpx

from src.modules.payments.models import Payment
from src.modules.payments.schemas import CreateCustomerInput, CreatePaymentInput, PaymentResponse
from src.modules.payments.repository import PaymentRepository
from src.core.config import get_settings
from src.core.logger import log

settings = get_settings()


class AsaasClient:
    BASE_URL = "https://sandbox.asaas.com/api/v3"
    
    def __init__(self):
        self.api_key = settings.asaas_api_key or ""
        self.base_url = self.BASE_URL
    
    async def _request(self, method: str, endpoint: str, json_data: Optional[Dict] = None) -> Dict:
        headers = {
            "Content-Type": "application/json",
            "access_token": self.api_key,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                f"{self.base_url}{endpoint}",
                headers=headers,
                json=json_data,
            )
            response.raise_for_status()
            return response.json()
    
    async def create_customer(self, customer_data: CreateCustomerInput) -> Dict:
        payload = {
            "name": customer_data.name,
            "email": customer_data.email,
        }
        if customer_data.cpf_cnpj:
            payload["cpfCnpj"] = customer_data.cpf_cnpj
        if customer_data.phone:
            payload["phone"] = customer_data.phone
        if customer_data.mobile_phone:
            payload["mobilePhone"] = customer_data.mobile_phone
        if customer_data.address:
            payload["address"] = customer_data.address
        if customer_data.address_number:
            payload["addressNumber"] = customer_data.address_number
        if customer_data.city:
            payload["city"] = customer_data.city
        if customer_data.state:
            payload["state"] = customer_data.state
        if customer_data.postal_code:
            payload["postalCode"] = customer_data.postal_code
        
        return await self._request("POST", "/customers", payload)
    
    async def get_customer(self, customer_id: str) -> Dict:
        return await self._request("GET", f"/customers/{customer_id}")
    
    async def create_payment(self, customer_id: str, payment_data: CreatePaymentInput) -> Dict:
        payload = {
            "customer": customer_id,
            "billingType": payment_data.payment_method.upper(),
            "value": payment_data.amount,
            "dueDate": payment_data.due_date,
            "description": payment_data.description or "Pagamento Cafe com BPO",
        }
        if payment_data.success_url:
            payload["callback"] = {"successUrl": payment_data.success_url}
        
        return await self._request("POST", "/payments", payload)
    
    async def get_payment(self, payment_id: str) -> Dict:
        return await self._request("GET", f"/payments/{payment_id}")
    
    async def get_payment_status(self, payment_id: str) -> Dict:
        return await self._request("GET", f"/payments/{payment_id}/status")
    
    async def list_payments(self, customer_id: str, limit: int = 20, offset: int = 0) -> Dict:
        params = {"customer": customer_id, "limit": limit, "offset": offset}
        return await self._request("GET", "/payments", params)


class PaymentService:
    def __init__(self, repository: PaymentRepository):
        self.repository = repository
        self.asaas = AsaasClient()
    
    def get_user_payments(self, user_id: UUID) -> List[Payment]:
        return self.repository.get_by_user(user_id)
    
    def get_payment(self, payment_id: UUID, user_id: UUID) -> Optional[Payment]:
        return self.repository.get_by_id(payment_id, user_id)
    
    async def create_customer_for_user(self, user_id: UUID, customer_data: CreateCustomerInput) -> Dict:
        existing = self.repository.get_customer_by_user(user_id)
        if existing:
            return await self.asaas.get_customer(existing.asaas_customer_id)
        
        asaas_customer = await self.asaas.create_customer(customer_data)
        self.repository.save_customer_id(user_id, asaas_customer["id"])
        log.info(f"💳 Cliente Asaas criado para usuário {user_id}: {asaas_customer['id']}")
        return asaas_customer
    
    async def create_payment(
        self,
        user_id: UUID,
        payment_data: CreatePaymentInput,
        customer_info: CreateCustomerInput,
    ) -> Payment:
        customer = self.repository.get_customer_by_user(user_id)
        if not customer:
            asaas_customer = await self.asaas.create_customer(customer_info)
            customer_id = asaas_customer["id"]
        else:
            customer_id = customer.asaas_customer_id
        
        asaas_payment = await self.asaas.create_payment(customer_id, payment_data)
        
        payment = self.repository.create_payment(
            user_id=user_id,
            amount=payment_data.amount,
            description=payment_data.description,
            payment_method=payment_data.payment_method,
            due_date=payment_data.due_date,
            asaas_customer_id=customer_id,
            asaas_payment_id=asaas_payment["id"],
            success_url=payment_data.success_url,
            error_url=payment_data.error_url,
        )
        
        log.info(f"💳 Pagamento criado: {payment.id} | Asaas: {asaas_payment['id']} | Valor: R$ {payment_data.amount}")
        
        return payment
    
    def process_webhook(self, event_data: Dict) -> Optional[Payment]:
        event_type = event_data.get("event")
        if event_type not in ("PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_OVERDUE", "PAYMENT_REFUNDED", "PAYMENT_DELETED"):
            return None
        
        asaas_payment_id = event_data.get("payment", {}).get("id") or event_data.get("paymentId")
        if not asaas_payment_id:
            return None
        
        payment = self.repository.get_by_asaas_id(asaas_payment_id)
        if not payment:
            return None
        
        status_map = {
            "PAYMENT_RECEIVED": "received",
            "PAYMENT_CONFIRMED": "confirmed",
            "PAYMENT_OVERDUE": "overdue",
            "PAYMENT_REFUNDED": "refunded",
            "PAYMENT_DELETED": "deleted",
        }
        new_status = status_map.get(event_type, payment.status)
        
        self.repository.update_status(payment.id, new_status, event_data)
        log.info(f"💳 Webhook processado: {payment.id} | {event_type} -> {new_status}")
        
        return payment
