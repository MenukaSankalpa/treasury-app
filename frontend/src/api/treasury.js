import { api } from "./client";

export const loansApi = {
  list: () => api.get("/loans"),
  create: (loan) => api.post("/loans", loan),
  accountantDecide: (id, action, reason) => api.post(`/loans/${id}/accountant`, { action, reason }),
  companyHeadDecide: (id, action, reason) => api.post(`/loans/${id}/company-head`, { action, reason }),
  decide: (id, action, reason) => api.post(`/loans/${id}/decide`, { action, reason }),
  update: (id, patch) => api.put(`/loans/${id}`, patch),
};

export const depositsApi = {
  list: () => api.get("/deposits"),
  create: (deposit) => api.post("/deposits", deposit),
};

export const balancesApi = {
  list: () => api.get("/balances"),
  save: (balance) => api.post("/balances", balance),
};

export const ratesApi = {
  list: () => api.get("/rates"),
  save: (rate) => api.post("/rates", rate),
};

export const intercompanyApi = {
  listLoans: () => api.get("/intercompany/loans"),
  getLoan: (id) => api.get(`/intercompany/loans/${id}`),
  createLoan: (loan) => api.post("/intercompany/loans", loan),
  bulkCreate: (rows) => api.post("/intercompany/loans/bulk", { rows }),
  accountantDecide: (id, action, reason) => api.post(`/intercompany/loans/${id}/accountant`, { action, reason }),
  companyHeadDecide: (id, action, reason) => api.post(`/intercompany/loans/${id}/company-head`, { action, reason }),
  treasuryDecide: (id, payload) => api.post(`/intercompany/loans/${id}/treasury`, payload),
  lenderDecide: (id, company, role, action) => api.post(`/intercompany/loans/${id}/lender`, { company, role, action }),
  releasePayment: (id, action, reason, bankConfirmed, bankRef) => api.post(`/intercompany/loans/${id}/release`, { action, reason, bankConfirmed, bankRef }),
  addNewRate: (id, rate) => api.post(`/intercompany/loans/${id}/new-rate`, { rate }),
  initiateSettle: (id, data) => api.post(`/intercompany/loans/${id}/settle/initiate`, data),
  settlementDecide: (id, role, action) => api.post(`/intercompany/loans/${id}/settle/decide`, { role, action }),
};

export const notificationsApi = {
  list: () => api.get("/notifications"),
  markRead: (id) => api.post(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post("/notifications/read-all", {}),
};

export const auditApi = {
  list: () => api.get("/audit"),
};

export const permissionsApi = {
  get: () => api.get("/permissions"),
  togglePageRole: (pageKey, role) => api.post("/permissions/page/toggle", { pageKey, role }),
  toggleActionRole: (actionKey, role) => api.post("/permissions/action/toggle-role", { actionKey, role }),
  grantActionEmail: (actionKey, email) => api.post("/permissions/action/grant-email", { actionKey, email }),
  revokeActionEmail: (actionKey, email) => api.post("/permissions/action/revoke-email", { actionKey, email }),
  reset: () => api.post("/permissions/reset", {}),
};