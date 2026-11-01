from rest_framework.permissions import BasePermission

from .models import User


def is_admin_or_department(request, *departments):
    """
    Allow ERP Admin or users belonging to the specified departments.
    """

    user = request.user

    return (
        user
        and user.is_authenticated
        and (
            user.user_type == User.UserType.ADMIN
            or user.user_type in departments
        )
    )


class IsERPAdmin(BasePermission):
    """
    Admin-only access.
    """

    message = "Admin access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.user_type == User.UserType.ADMIN
        )


class IsProduction(BasePermission):
    """
    Production and Admin access.
    """

    message = "Production access required."

    def has_permission(self, request, view):
        return is_admin_or_department(
            request,
            User.UserType.PRODUCTION,
        )


class IsHR(BasePermission):
    """
    HR and Admin access.
    """

    message = "HR access required."

    def has_permission(self, request, view):
        return is_admin_or_department(
            request,
            User.UserType.HR,
        )


class IsHROrMaterialPlanning(BasePermission):
    """
    HR, Material Planning and Admin access.
    """

    message = "HR or Material Planning access required."

    def has_permission(self, request, view):
        return is_admin_or_department(
            request,
            User.UserType.HR,
            User.UserType.MATERIAL_PLANNING,
        )


class IsMaterialPlanning(BasePermission):
    """
    Material Planning and Admin access.
    """

    message = "Material Planning access required."

    def has_permission(self, request, view):
        return is_admin_or_department(
            request,
            User.UserType.MATERIAL_PLANNING,
        )


class IsSupervisor(BasePermission):
    """
    Supervisor and Admin access.
    """

    message = "Supervisor access required."

    def has_permission(self, request, view):
        return is_admin_or_department(
            request,
            User.UserType.SUPERVISOR,
        )


class IsAccounts(BasePermission):
    """
    Accounts and Admin access.
    """

    message = "Accounts access required."
    def has_permission(self, request, view):
        return is_admin_or_department(
            request,
            User.UserType.ACCOUNTS,
        )


class IsAccountsOrMaterialPlanning(BasePermission):
    """
    Accounts, Material Planning and Admin access.
    """

    message = "Accounts or Material Planning access required."

    def has_permission(self, request, view):
        return is_admin_or_department(
            request,
            User.UserType.ACCOUNTS,
            User.UserType.MATERIAL_PLANNING,
        )