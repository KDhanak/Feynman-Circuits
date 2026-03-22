from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string


def send_password_reset_otp_email(user_email, otp_code, expiry_minutes=10):
    subject = "Feynman Circuits - Password Reset OTP"

    context = {
        "otp_code": otp_code,
        "expiry_minutes": expiry_minutes,
    }

    text_body = render_to_string("emails/password_reset_otp.txt", context)
    html_body = render_to_string("emails/password_reset_otp.html", context)

    send_mail(
        subject=subject,
        message=text_body, 
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user_email],
        html_message=html_body,
        fail_silently=False,
    )
