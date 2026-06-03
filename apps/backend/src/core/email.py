import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.core.config import get_settings
from src.core.logger import log

settings = get_settings()


class EmailService:
    @staticmethod
    def _build_message(to_email: str, subject: str, text: str, html: str) -> MIMEMultipart:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from_email
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        return msg

    @staticmethod
    def _send(msg: MIMEMultipart, to_email: str) -> None:
        context = ssl.create_default_context() if settings.smtp_use_tls else None

        if settings.smtp_use_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls(context=context)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)

        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)

        server.sendmail(settings.smtp_from_email, to_email, msg.as_string())
        server.quit()

    @staticmethod
    def send_email(to_email: str, subject: str, text: str, html: str) -> None:
        """Send a generic email. Logs in dev mode if SMTP is not configured."""
        msg = EmailService._build_message(to_email, subject, text, html)

        if settings.mode in ("development", "test") and not settings.smtp_user:
            log.info(f"📧 [DEV MODE] E-mail para {to_email}")
            log.info(f"📧 [DEV MODE] Assunto: {subject}")
            return

        try:
            EmailService._send(msg, to_email)
            log.info(f"📧 E-mail enviado para {to_email}: {subject}")
        except Exception as e:
            log.error(f"❌ Falha ao enviar e-mail para {to_email}: {str(e)}")
            raise

    @staticmethod
    def send_reset_password_email(to_email: str, reset_token: str):
        reset_url = f"{settings.frontend_url}/redefinir-senha?token={reset_token}"

        subject = "Redefina sua senha – Café com BPO"

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f7; color: #1d1d1f;">
            <div style="background: white; border-radius: 12px; padding: 40px; text-align: center;">
                <h1 style="font-size: 24px; margin-bottom: 8px;">Café com BPO</h1>
                <h2 style="font-size: 18px; font-weight: 400; color: #555; margin-bottom: 24px;">Redefinição de Senha</h2>
                
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta.
                </p>
                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    Clique no botão abaixo para criar uma nova senha:
                </p>
                
                <a href="{reset_url}" 
                   style="display: inline-block; background-color: #0071e3; color: white; 
                          padding: 14px 32px; border-radius: 8px; text-decoration: none; 
                          font-size: 16px; font-weight: 500; margin: 24px 0;">
                    Redefinir Senha
                </a>
                
                <p style="font-size: 14px; color: #888; margin-top: 32px;">
                    Se você não solicitou a redefinição, ignore este e-mail.<br>
                    Este link expira em 1 hora.
                </p>
            </div>
        </body>
        </html>
        """

        text = f"""
        Café com BPO - Redefinição de Senha

        Recebemos uma solicitação para redefinir a senha da sua conta.

        Acesse o link abaixo para criar uma nova senha:
        {reset_url}

        Se você não solicitou a redefinição, ignore este e-mail.
        Este link expira em 1 hora.
        """

        EmailService.send_email(to_email, subject, text, html)
