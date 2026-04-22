import httpx
import time
import hashlib
import cloudinary
import cloudinary.uploader
from typing import Optional, Dict, Tuple
from src.core.config import get_settings
from src.core.logger import log

settings = get_settings()

# Configuração global do Cloudinary
cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True
)

class CloudinaryService:
    @classmethod
    async def upload_file(cls, content: bytes, user_id: str) -> Dict:
        """
        Faz o upload de um arquivo para o Cloudinary com ID único para evitar conflitos.
        """
        try:
            timestamp = int(time.time())
            upload_result = cloudinary.uploader.upload(
                content,
                folder=f"cafe_com_bpo/avatars/{user_id}",
                public_id=f"avatar_{timestamp}",
                overwrite=True,
                resource_type="image"
            )
            
            return {
                "id": upload_result["public_id"],
                "url": upload_result["secure_url"]
            }
        except Exception as e:
            log.error(f"❌ Erro no upload para Cloudinary: {str(e)}")
            raise e

    @classmethod
    async def delete_file(cls, public_id: str):
        """
        Remove um arquivo do Cloudinary.
        """
        try:
            cloudinary.uploader.destroy(public_id)
            log.info(f"🗑️ Arquivo Cloudinary removido: {public_id}")
        except Exception as e:
            log.error(f"❌ Erro ao deletar arquivo no Cloudinary: {str(e)}")


class OneDriveService:
    _token_cache: Dict[str, Tuple[str, float]] = {}

    @classmethod
    async def _get_access_token(cls) -> str:
        """
        Obtém um token de acesso usando o fluxo de Client Credentials.
        """
        now = time.time()
        # Verificar cache
        if "token" in cls._token_cache:
            token, expiry = cls._token_cache["token"]
            if now < expiry - 60: # 1 minuto de margem
                return token

        log.info(" Solicitando novo token de acesso Microsoft Graph API...")
        url = f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/oauth2/v2.0/token"
        data = {
            "client_id": settings.microsoft_client_id,
            "client_secret": settings.microsoft_client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, data=data)
                response.raise_for_status()
                res_json = response.json()
                
                token = res_json["access_token"]
                expires_in = res_json["expires_in"]
                cls._token_cache["token"] = (token, now + expires_in)
                return token
            except Exception as e:
                log.error(f"❌ Falha ao obter token Microsoft: {str(e)}")
                raise Exception("Erro na autenticação com provedor de storage.")

    @classmethod
    def generate_file_hash(cls, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()[:16]

    @classmethod
    async def upload_file(cls, content: bytes, user_id: str, extension: str) -> Dict:
        """
        Faz o upload de um arquivo para o OneDrive.
        Retorna o itemId e metadados.
        """
        token = await cls._get_access_token()
        file_hash = cls.generate_file_hash(content)
        filename = f"avatar_{file_hash}{extension}"
        
        storage_account = settings.microsoft_storage_account_id
        path = f"/users/{storage_account}/drive/root:/CafeComBPO/avatars/{user_id}/{filename}:/content"
        url = f"https://graph.microsoft.com/v1.0{path}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.put(url, content=content, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                log.error(f"❌ Erro no upload para OneDrive: {str(e)}")
                raise e

    @classmethod
    async def create_sharing_link(cls, item_id: str) -> str:
        """
        Cria um link de visualização anônima para o arquivo.
        """
        token = await cls._get_access_token()
        storage_account = settings.microsoft_storage_account_id
        url = f"https://graph.microsoft.com/v1.0/users/{storage_account}/drive/items/{item_id}/createLink"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        data = {
            "type": "view",
            "scope": "anonymous"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=data, headers=headers)
                response.raise_for_status()
                return response.json()["link"]["webUrl"]
            except Exception as e:
                log.error(f"❌ Erro ao criar link no OneDrive: {str(e)}")
                return ""

    @classmethod
    async def delete_file(cls, item_id: str):
        """
        Remove um arquivo do OneDrive.
        """
        token = await cls._get_access_token()
        storage_account = settings.microsoft_storage_account_id
        url = f"https://graph.microsoft.com/v1.0/users/{storage_account}/drive/items/{item_id}"
        
        headers = {
            "Authorization": f"Bearer {token}"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(url, headers=headers)
                if response.status_code != 204:
                    log.warning(f"⚠️ Resposta inesperada ao deletar item {item_id}: {response.status_code}")
            except Exception as e:
                log.error(f"❌ Erro ao deletar arquivo no OneDrive: {str(e)}")
