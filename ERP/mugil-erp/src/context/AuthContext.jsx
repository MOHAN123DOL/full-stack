import { createContext, useContext, useState } from "react";
import { loginUser } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  const login = async (username, password, userType) => {
    try {
      const data = await loginUser(username, password, userType);

      if (!data?.success) {
        return {
          success: false,
          message: data?.message || "Unable to sign in.",
        };
      }

      setIsAuthenticated(true);
      setUser(data.user);

      return {
        success: true,
        user: data.user,
        accessToken: data.access,
        refreshToken: data.refresh,
      };
    } catch (error) {
      console.error("Login error:", error);

      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || "Unable to sign in.",
        };
      }

      if (error.request) {
        return {
          success: false,
          message: "Unable to connect to the server.",
        };
      }

      return {
        success: false,
        message: "Something went wrong. Please try again.",
      };
    }
  };

  /**
   * Logout
   */
  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
