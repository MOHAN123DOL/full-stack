from django.urls import path

from .views import ChangePasswordAPIView, LoginAPIView ,InventoryAPIView, LogoutAPIView, MaterialMenuAPIView, ProfileAPIView, RefreshTokenAPIView, UserProfileListCreateAPIView


urlpatterns = [


    # FOR LOGIN, LOGOUT, REFRESH TOKEN
    path("login/", LoginAPIView.as_view(), name="erp-login"),
     
    path("refresh/",RefreshTokenAPIView.as_view(),name="erp-refresh", ),
    path("logout/", LogoutAPIView.as_view(), name="erp-logout",),
    # FOR PROFILE CREATE ONLY BUT DEV
     path("profiles/",UserProfileListCreateAPIView.as_view(),name="user-profile-list-create",),
     # TO GET PROFILE AND CHANGE PASSWORD
    path("profile/", ProfileAPIView.as_view(),name="profile",),
     path("profile/change-password/",ChangePasswordAPIView.as_view(),name="change-password",),

     # FOR HEADER 





       path("inventory/",InventoryAPIView.as_view(),name="inventory",),  
       path("inventory/material/menu/",MaterialMenuAPIView.as_view(),name="material-menu",),
]