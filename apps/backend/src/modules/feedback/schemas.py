from pydantic import BaseModel


class FeedbackResponse(BaseModel):
    message: str = "Relato enviado com sucesso. Agradecemos pelo seu feedback!"
