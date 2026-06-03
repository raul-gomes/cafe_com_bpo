from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)


class FeedbackResponse(BaseModel):
    message: str = "Relato enviado com sucesso. Agradecemos pelo seu feedback!"
