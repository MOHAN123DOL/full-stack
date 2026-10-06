from rest_framework.permissions import BasePermission

from .models import User


class IsProduction(BasePermission):
    message = "Production access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.user_type == User.UserType.PRODUCTION
        )


class IsERPAdmin(BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.user_type == User.UserType.ADMIN
        )


class IsHR(BasePermission):
    message = "HR access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.user_type == User.UserType.HR
        )


class IsMaterialPlanning(BasePermission):
    message = "Material Planning access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.user_type
            == User.UserType.MATERIAL_PLANNING
        )


class IsSupervisor(BasePermission):
    message = "Supervisor access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.user_type == User.UserType.SUPERVISOR
        )


class IsAccounts(BasePermission):
    message = "Accounts access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.user_type == User.UserType.ACCOUNTS
        )


from rest_framework.permissions import BasePermission


class IsAccountsOrMaterialPlanning(BasePermission):
    """
    Allows either Accounts or Material Planning users.
    Needed because PO Integration runs as Material Planning,
    but the PO list/detail views were originally Accounts-only.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.user_type in {
                User.UserType.ACCOUNTS,
                User.UserType.MATERIAL_PLANNING,
            }
        )