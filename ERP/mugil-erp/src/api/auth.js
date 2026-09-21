import api from "./axios";

/**
 * Login user
 *
 * @param {string} username
 * @param {string} password
 * @param {string} userType
 * @returns {Promise<Object>}
 */
export const loginUser = async (username, password, userType) => {
  const response = await api.post("/erp/login/", {
    username: username.trim(),
    password,
    user_type: userType,
  });

  return response.data;
};