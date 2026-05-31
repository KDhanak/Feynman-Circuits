from django.contrib import admin
from .models import Circuit


@admin.register(Circuit)
class CircuitAdmin(admin.ModelAdmin):
    ordering = ('-updated_at',)
    list_display = ('name', 'user', 'is_public', 'created_at', 'updated_at')
    search_fields = ('name', 'user__email')
    list_filter = ('is_public',)
    readonly_fields = ('id', 'created_at', 'updated_at')
