from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


def send_password_reset_otp_email(user_email, otp_code, expiry_minutes=10):
    subject = "Reset Your Feynman Circuits Password"

    context = {
        "otp_code": otp_code,
        "expiry_minutes": expiry_minutes,
    }

    text_body = render_to_string("emails/password_reset_otp.txt", context)
    html_body = render_to_string("emails/password_reset_otp.html", context)

    email = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user_email],
    )
    email.attach_alternative(html_body, "text/html")
    email.send(fail_silently=False)
