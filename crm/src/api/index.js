// Typed API surface — one function per endpoint (v2 contract).

import { request } from './client.js'

export const api = {
  auth: {
    login: (email, password) => request('POST', 'auth/login', { email, password }),
    me: () => request('GET', 'auth/me'),
    logout: () => request('POST', 'auth/logout', {}), // revokes the current session token
    updateProfile: (body) => request('PUT', 'auth/profile', body),
    changePassword: (body) => request('POST', 'auth/password', body),
    // Forgot-password (OTP-style): issue a 6-digit code, then reset with it.
    // In demo the code is returned for display; the real backend emails/SMSes it.
    forgotPassword: (email) => request('POST', 'auth/forgot-password', { email }),
    resetPassword: (email, code, newPassword) => request('POST', 'auth/reset-password', { email, code, newPassword }),
    // Email change = current password + OTP to the new address.
    requestEmailChange: (newEmail, currentPassword) => request('POST', 'auth/email/change-request', { newEmail, currentPassword }),
    confirmEmailChange: (code) => request('POST', 'auth/email/change-confirm', { code }),
  },
  platform: {
    dashboard: () => request('GET', 'platform/dashboard'),
    revenue: () => request('GET', 'platform/revenue'),
    organizations: (q = '') => request('GET', `platform/organizations${q}`),
    organization: (id) => request('GET', `platform/organizations/${id}`),
    suspend: (id, reason) => request('POST', `platform/organizations/${id}/suspend`, { reason }),
    ban: (id, reason) => request('POST', `platform/organizations/${id}/ban`, { reason }),
    restore: (id) => request('POST', `platform/organizations/${id}/restore`, {}),
    audit: (q = '') => request('GET', `platform/audit${q}`),
    users: () => request('GET', 'platform/users'),
    createUser: (body) => request('POST', 'platform/users', body),
    updateUser: (id, body) => request('PUT', `platform/users/${id}`, body),
    templates: () => request('GET', 'platform/templates'),
    createTemplate: (body) => request('POST', 'platform/templates', body),
    updateTemplate: (id, body) => request('PUT', `platform/templates/${id}`, body),
    deleteTemplate: (id) => request('DELETE', `platform/templates/${id}`),
    generateTemplateAI: (body) => request('POST', 'platform/templates/ai-generate', body),
  },
  org: {
    dashboard: () => request('GET', 'org/dashboard'),
    revenue: (q = '') => request('GET', `org/revenue${q}`),
    events: (q = '') => request('GET', `org/events${q}`),
    createEvent: (body) => request('POST', 'org/events', body),
    updateEvent: (id, body) => request('PUT', `org/events/${id}`, body),
    pauseEvent: (id) => request('POST', `org/events/${id}/pause`, {}),
    resumeEvent: (id) => request('POST', `org/events/${id}/resume`, {}),
    deleteEvent: (id) => request('DELETE', `org/events/${id}`),
    devices: () => request('GET', 'org/devices'),
    updateDevice: (id, body) => request('PUT', `org/devices/${id}`, body),
    assignDevice: (id, eventId) => request('POST', `org/devices/${id}/assign`, { eventId }),
    unassignDevice: (id) => request('POST', `org/devices/${id}/unassign`, {}),
    removeDevice: (id) => request('DELETE', `org/devices/${id}`),
    tickets: (q = '') => request('GET', `org/tickets${q}`),
    ticket: (id) => request('GET', `org/tickets/${id}`),
    replyTicket: (id, message) => request('POST', `org/tickets/${id}/reply`, { message }),
    resolveTicket: (id, note) => request('POST', `org/tickets/${id}/resolve`, { note }),
    reopenTicket: (id) => request('POST', `org/tickets/${id}/reopen`, {}),
    wallet: () => request('GET', 'org/wallet'),
    withdraw: (amount) => request('POST', 'org/wallet/withdraw', { amount }), // min ₹500 → org UPI
    defaults: () => request('GET', 'org/defaults'),
    saveDefaults: (body) => request('PUT', 'org/defaults', body),
    coupons: () => request('GET', 'org/coupons'),
    createCoupon: (body) => request('POST', 'org/coupons', body),
    updateCoupon: (id, body) => request('PUT', `org/coupons/${id}`, body),
    pauseCoupon: (id) => request('POST', `org/coupons/${id}/pause`, {}),
    activateCoupon: (id) => request('POST', `org/coupons/${id}/activate`, {}),
    deleteCoupon: (id) => request('DELETE', `org/coupons/${id}`),
    team: () => request('GET', 'org/team'),
    createMember: (body) => request('POST', 'org/team', body), // { name, email, password, role: ORG_ADMIN | ORG_MANAGER }
    updateMember: (id, body) => request('PUT', `org/team/${id}`, body), // { name?, email?, role?, status? }
    deactivateMember: (id) => request('POST', `org/team/${id}/deactivate`, {}),
    activateMember: (id) => request('POST', `org/team/${id}/activate`, {}),
    audit: (q = '') => request('GET', `org/audit${q}`),
  },
}
