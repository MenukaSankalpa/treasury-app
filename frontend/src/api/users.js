import { api } from "./client";

export const usersApi = {
  list: () => api.get("/users"),
  create: (user) => api.post("/users", user),
  update: (id, user) => api.put(`/users/${id}`, user),
  remove: (id) => api.delete(`/users/${id}`),
};