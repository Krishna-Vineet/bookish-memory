# Authentication & RBAC

This document outlines the authentication lifecycles and the Role-Based Access Control (RBAC) matrix implemented in the HappyPix backend.

## 1. Authentication Mechanisms

The backend employs a dual-authentication system to separate human CRM users from physical photobooth devices.

### A. Admin Authentication (CRM Users)
Human users authenticate via JWT (JSON Web Tokens).

**Login Flow:**
1. User submits email/password to `POST /api/auth/login`.
2. Backend validates credentials via `bcrypt`.
3. Backend generates a JWT containing `id`, `role`, and `organizationId`.
4. The JWT is signed with `JWT_SECRET` and set to expire in 8 hours.
5. **Token Delivery:** The token is returned in two ways:
   - As an `HttpOnly` cookie named `hp_admin_token` (used automatically by web browsers to prevent XSS).
   - As a JSON property `token` in the response body (for potential API clients that cannot use cookies).

**Session Management:**
- The backend relies entirely on the expiration of the JWT (8 hours).
- `POST /api/auth/logout` simply instructs the browser to clear the `hp_admin_token` cookie.
- There is no Redis/DB session store; tokens are stateless.

**Middleware (`authenticate` in `auth.js`):**
- Extracts token from cookies or `Authorization: Bearer <token>` header.
- Decodes token, finds `User` in MongoDB.
- Attaches `req.user` to the request object.

### B. Device Authentication (Photobooths)
Physical photobooths authenticate via a persistent, non-expiring Token.

**Registration Flow:**
1. Booth submits org credentials to `POST /api/devices/booth-login`.
2. Backend generates a random 32-byte hex token (`deviceToken`).
3. The token is saved in the `Device` document and returned to the booth.

**Authentication:**
- Booths must send the token in the `x-device-token` HTTP header on all requests.
- **Middleware (`authenticateDevice` in `deviceAuth.js`):** Looks up the `Device` in DB matching `deviceToken`. Attaches `req.device` to the request. Also extracts `organizationId` from the device and attaches it to `req.organizationId`.

---

## 2. Multi-Tenant Isolation (Organization Scoping)

Tenant isolation is strictly enforced at the database query level, not just the UI level.

**How it works:**
1. When a tenant user (`CLIENT_ADMIN`, `CLIENT_MANAGER`, `BOOTH_OPERATOR`) logs in, their `organizationId` is embedded in their JWT.
2. The `authenticate` middleware populates `req.user.organizationId`.
3. The helper function `getOrgFilter(req.user)` (in `auth.js`) is used on almost every GET/PUT/DELETE route.
    - If user is Internal (`OWNER`, `ADMIN`, `MANAGER`), `getOrgFilter` returns `{}` (can see all data).
    - If user is Tenant, `getOrgFilter` returns `{ organizationId: req.user.organizationId }`.
4. This filter is merged into MongoDB queries (e.g., `Event.find({ ...orgFilter })`), making it impossible for a tenant to query another tenant's events, devices, or payments.

---

## 3. Role-Based Access Control (RBAC)

The backend implements strict route-level authorization using the `authorize(...roles)` middleware, which blocks access if `req.user.role` is not in the allowed list.

### Roles Hierarchy

**Internal Roles (HappyPix Staff):**
- `OWNER`: Full system access. Can view all tenants, create admins, bypass org filters, manage platform subscriptions.
- `ADMIN`: Cannot manage subscriptions or other owners/admins. Can manage clients, devices, and support.
- `MANAGER`: Read-only for most internal metrics. Can view clients and manage support tickets. Cannot delete clients.

**Tenant Roles (Client Users):**
- `CLIENT_ADMIN`: The primary tenant owner. Can manage their organization's events, devices, payments, coupons, branding, and create `CLIENT_MANAGER`s.
- `CLIENT_MANAGER`: A restricted tenant user. Can only manage events that are explicitly assigned to them via `assignedManagerId`. Can view devices and gallery, but cannot access Payments, Settings, Branding, or Coupons.
- `BOOTH_OPERATOR`: Extremely restricted. Can only run the booth. Cannot access the CRM.

### Frontend Permissions Array
During login (`POST /api/auth/login`), the backend calculates an array of string permissions to send to the frontend (e.g., `['manage_events', 'view_payments']`). 

- This array is derived from the `RoleConfig` MongoDB collection if configured.
- If not configured, it falls back to a hardcoded mapping in `authRoutes.js`.
- The frontend uses this array purely to show/hide UI buttons (Frontend Restriction). 
- **True security** is handled by backend `authorize()` and `requirePermission()` middleware on the routes (Backend Restriction).
