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
        from_email=settings.AUTH_FROM_EMAIL,
        recipient_list=[user_email],
        html_message=html_body,
        fail_silently=False,
    )


def send_password_reset_confirmation_email(user_email):
    subject = "Feynman Circuits - Your password was reset"

    context = {}

    text_body = render_to_string("emails/password_reset_confirmation.txt", context)
    html_body = render_to_string("emails/password_reset_confirmation.html", context)

    send_mail(
        subject=subject,
        message=text_body,
        from_email=settings.AUTH_FROM_EMAIL,
        recipient_list=[user_email],
        html_message=html_body,
        fail_silently=False,
    )

def send_feedback_email(context: dict):
    feedback_type = context.get('type', 'bug')
    area = context.get('area', '')
    type_label = 'Bug Report' if feedback_type == 'bug' else 'Feature Request'
    subject = f"[Feynman Circuits Feedback] {type_label} — {area}"

    text_body = render_to_string("emails/feedback_notification.txt", context)
    html_body = render_to_string("emails/feedback_notification.html", context)

    send_mail(
        subject=subject,
        message=text_body,
        from_email=settings.AUTH_FROM_EMAIL,
        recipient_list=[settings.FEEDBACK_TO_EMAIL],
        html_message=html_body,
        fail_silently=False,
    )


def send_account_deleted_email(user_email, first_name, circuit_count, deleted_at):
    """The receipt sent after an account is deleted. It is the last email we
    send to this address, so it lists exactly what was removed."""
    subject = "Feynman Circuits - Your account has been deleted"

    context = {
        "email": user_email,
        "first_name": first_name,
        "circuit_count": circuit_count,
        "deleted_at": deleted_at.strftime("%d %B %Y at %H:%M UTC"),
    }

    text_body = render_to_string("emails/account_deleted.txt", context)
    html_body = render_to_string("emails/account_deleted.html", context)

    send_mail(
        subject=subject,
        message=text_body,
        from_email=settings.AUTH_FROM_EMAIL,
        recipient_list=[user_email],
        html_message=html_body,
        fail_silently=False,
    )


def send_password_change_notification_email(user_email):
    subject = "Feynman Circuits - Your password was changed"

    context = {}

    text_body = render_to_string("emails/password_change_notification.txt", context)
    html_body = render_to_string("emails/password_change_notification.html", context)

    send_mail(
        subject=subject,
        message=text_body,
        from_email=settings.AUTH_FROM_EMAIL,
        recipient_list=[user_email],
        html_message=html_body,
        fail_silently=False,
    )
