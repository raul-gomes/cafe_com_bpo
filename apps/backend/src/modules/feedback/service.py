from src.core.config import get_settings
from src.core.email import EmailService
from src.core.logger import log

settings = get_settings()


class FeedbackService:
    @staticmethod
    def send_feedback(
        title: str, description: str, user_name: str, user_email: str
    ) -> None:
        support_email = settings.support_email

        subject = f"[Feedback] {title}"

        text = f"""
Relato de Erro / Feedback - Café com BPO

Usuário: {user_name} ({user_email})

Título: {title}

Descrição:
{description}
        """.strip()

        html = f"""
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f7; color: #1d1d1f;">
    <div style="background: white; border-radius: 12px; padding: 32px;">
        <h1 style="font-size: 20px; margin-bottom: 4px;">Café com BPO</h1>
        <h2 style="font-size: 16px; font-weight: 400; color: #555; margin-bottom: 24px;">Relato de Erro / Feedback</h2>
        <table style="width: 100%; font-size: 14px; color: #333; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: 600; color: #888;">Usuário</td></tr>
            <tr><td style="padding: 0 0 16px 0;">{user_name} ({user_email})</td></tr>
            <tr><td style="padding: 8px 0; font-weight: 600; color: #888;">Título</td></tr>
            <tr><td style="padding: 0 0 16px 0;">{title}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: 600; color: #888;">Descrição</td></tr>
            <tr><td style="padding: 0 0 16px 0; white-space: pre-wrap;">{description}</td></tr>
        </table>
    </div>
</body>
</html>
        """.strip()

        EmailService.send_email(support_email, subject, text, html)
        log.info(f"📧 Feedback enviado por {user_name} ({user_email}): {title}")
