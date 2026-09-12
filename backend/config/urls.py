"""
URL settings for the config project.

The `urlpatterns` list connects each URL to the view that handles it. To learn more, see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Import the view:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Import the view:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf (another urls.py file)
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("circuits/", include("circuits.urls")),
    path("qec/", include("qec.urls")),
    # Public endpoint for share links. Anyone can read it without logging in.
    # It has a version number and sits at the root because other people rely on it,
    # so it must not change. The routes above are only used by this app and its own frontend.
    path("api/v1/", include("circuits.public_urls")),
]
