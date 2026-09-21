import api from "./axios";

export const getHeaderProfile = async () => {
  const response = await api.get("/erp/profile/");
  return response.data;
};