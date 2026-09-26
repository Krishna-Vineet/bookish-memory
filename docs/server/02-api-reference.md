# API Reference

This document provides a comprehensive inventory of the backend API routes, tracing them from endpoint to controller logic, middleware, and database models. It is based entirely on the existing codebase in `server/routes`.

---

## 1. Authentication (`authRoutes.js`)

-----------------------------------
### Register User (Admin Setup)
**Method:** POST `/api/auth/register`  
**Authentication:** Not Required (Appears to be initial setup)  
**Authorization:** None explicit  
**Middleware:** None  
**Database Models:** `User`, `AuditLog`  
**Request Body:**
```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "password": "securepassword",
  "role": "ADMIN"
}
```
**Response:** 201 Created `{"message": "User registered successfully"}`  
**Side Effects:** Creates User, logs `CREATE_USER` in AuditLog.

-----------------------------------
### Admin Login
**Method:** POST `/api/auth/login`  
**Authentication:** Not Required  
**Authorization:** None explicit  
**Middleware:** None  
**Database Models:** `User`, `RoleConfig`  
**Request Body:** `email`, `password`  
**Response:** 200 OK. Returns JWT Token, sets `hp_admin_token` as HttpOnly cookie, returns user profile and effective permissions based on RoleConfig or hardcoded fallbacks.  

-----------------------------------
### Get Current User
**Method:** GET `/api/auth/me`  
**Authentication:** Required (`authenticate` middleware)  
**Authorization:** Any authenticated user  
**Middleware:** `authenticate`  
**Database Models:** Returns `req.user` attached by middleware (queries `User`).  
**Response:** 200 OK. `{"user": { ... }}`

-----------------------------------
### Create User (Tenant/Internal)
**Method:** POST `/api/auth/users`  
**Authentication:** Required  
**Authorization:** `OWNER`, `ADMIN`, `MANAGER`, `CLIENT_ADMIN`  
**Middleware:** `authenticate`, `authorize`  
**Database Models:** `User`, `AuditLog`  
**Logic:** Verifies caller's role to determine if they can create the requested role. Derives `organizationId` from caller or request body based on role hierarchy.  
**Request Body:** `name`, `email`, `password`, `role`, `organizationId` (optional depending on caller)  
**Response:** 201 Created user object.

-----------------------------------

## 2. Organizations (`organizationRoutes.js`)

-----------------------------------
### List Organizations
**Method:** GET `/api/organizations`  
**Authentication:** Required  
**Authorization:** `OWNER`, `ADMIN`, `MANAGER`  
**Middleware:** `authenticate`, `authorize`  
**Database Models:** `Organization`, `Device`, `Event`  
**Query Parameters:** `status`, `plan`, `search`, `page`, `limit`  
**Response:** Paginated list of organizations, enriched with live device counts and event counts by querying the respective models.

-----------------------------------
### Create Organization
**Method:** POST `/api/organizations`  
**Authentication:** Required  
**Authorization:** `OWNER`, `ADMIN`, `MANAGER`  
**Middleware:** `authenticate`, `authorize`  
**Database Models:** `Organization`, `User`, `AuditLog`  
**Request Body:** `name`, `ownerName`, `email`, `phone`, `plan`, `currency`, `billingCycle`, `trialDays`, `internalNotes`  
**Side Effects:** Creates the Organization, auto-generates a `CLIENT_ADMIN` User account with a random temp password, logs `CREATE_ORGANIZATION`.  
**Response:** 201 Created, returns org and generated admin credentials.

-----------------------------------
### Client Logo Library
**Method:** GET / POST / DELETE `/api/organizations/my/logos`  
**Authentication:** Required  
**Authorization:** Authenticated user with an `organizationId` (Clients)  
**Middleware:** `authenticate`  
**Database Models:** `Organization` (modifies `logoLibrary` array)  
**Request Body (POST/DELETE):** `{ "url": "https://s3..." }`  
**Response:** Updated `logoLibrary` array.

-----------------------------------

## 3. Events (`eventRoutes.js`)

-----------------------------------
### Public Live Event Details
**Method:** GET `/api/events/public/live`  
**Authentication:** Not Required  
**Database Models:** `Event`  
**Logic:** Finds one event where `status: 'live'`, sorts by `startDate` desc.  
**Response:** Event object.

-----------------------------------
### Join Private Event
**Method:** POST `/api/events/public/join`  
**Authentication:** Not Required  
**Database Models:** `Event`  
**Request Body:** `eventId`, `passkey`  
**Logic:** Verifies passkey matches `event.passkey`.  
**Response:** Full Event object if valid.

-----------------------------------
### List Events
**Method:** GET `/api/events`  
**Authentication:** Required  
**Authorization:** Implicit via `getOrgFilter` (Org scoped)  
**Middleware:** `authenticate`  
**Database Models:** `Event`  
**Query Parameters:** `status`, `search`, `startDate`, `endDate`, `page`, `limit`  
**Side Effects:** Calls `syncEventStatuses()` before querying to lazily update upcoming/live/finished states based on current date.  
**Response:** Paginated events list.

-----------------------------------
### Create Event
**Method:** POST `/api/events`  
**Authentication:** Required  
**Authorization:** `requirePermission('manage_events')`  
**Middleware:** `authenticate`, `requirePermission`  
**Database Models:** `Event`, `Organization`, `Device`  
**Logic:** Validates `PLAN_EVENT_DEVICE_LIMITS`. Automatically checks if assigned devices are busy. Syncs `currentEventId` on assigned devices. Generates random `shortCode` and `passkey` if not provided.  
**Response:** 201 Created Event object.

-----------------------------------
### Fetch Event Photos
**Method:** GET `/api/events/:id/photos`  
**Authentication:** Required  
**Authorization:** Org-scoped  
**Middleware:** `authenticate`  
**Database Models:** `Event`, `Photo`, `Payment`  
**Logic:** Fetches recent 50 photos + composite photos from paid payments for the event.  

-----------------------------------

## 4. Devices (`deviceRoutes.js`)

-----------------------------------
### Booth Login
**Method:** POST `/api/devices/booth-login`  
**Authentication:** Not Required (Uses Client credentials)  
**Database Models:** `User`, `Organization`, `Device`  
**Request Body:** `orgId`, `password`, `deviceName`, `location`  
**Logic:** Verifies Client Admin's password for the given `orgId`. Checks `PLAN_DEVICE_LIMITS`. Generates a persistent `deviceToken`. Creates Device record.  
**Response:** `deviceToken`, `deviceId`, `currentEventId`.

-----------------------------------
### Device Ping (Heartbeat)
**Method:** POST `/api/devices/ping`  
**Authentication:** Required (`authenticateDevice`)  
**Authorization:** Uses `x-device-token` header  
**Middleware:** `authenticateDevice`  
**Database Models:** `Device`  
**Logic:** Updates `lastSeenAt`, `ipAddress`, `userAgent`.  
**Response:** `ok`, `currentEventId`, `needsMaintenance`.

-----------------------------------

## 5. Payments (`paymentRoutes.js`)

-----------------------------------
### Create Order
**Method:** POST `/api/payments/create-order`  
**Authentication:** Optional (`optionalDeviceAuth`)  
**Database Models:** `Event`, `Setting`, `Payment`  
**External Services:** Razorpay (`orders.create`, `qrCode.create`, `paymentLink.create`)  
**Request Body:** `amount`, `printCount`, `digitalCopy`, `photoUrls`, `compositeUrl`, `couponCode`, `discountApplied`, `eventId`, `eventName`  
**Logic:** Resolves dynamic Razorpay credentials (Event specific -> Org specific -> Global). Creates Razorpay Order and UPI QR Code. Saves pending Payment in DB.  
**Response:** `orderId`, `paymentId`, `paymentLinkUrl`, `isImageUrl`.

-----------------------------------
### Check Payment Status (Polling)
**Method:** GET `/api/payments/status/:paymentId`  
**Authentication:** Optional (`optionalDeviceAuth`)  
**Database Models:** `Payment`, `Setting`  
**External Services:** Razorpay (`qrCode.fetch` or `orders.fetchPayments`)  
**Side Effects:** If paid, updates DB, increments Coupon usage, and explicitly calls `printHelper.printImage` if hardware printing is enabled.  
**Response:** `{ success: true, status: 'paid' | 'pending' | 'failed' }`

-----------------------------------
### Verify Payment (Callback)
**Method:** POST `/api/payments/verify`  
**Authentication:** Optional  
**Database Models:** `Payment`, `Setting`, `DigitalToken`, `PhotoShare`  
**Request Body:** `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, `compositeUrl`, `photoUrls`  
**Logic:** Verifies HMAC-SHA256 signature. Marks payment paid. Dispatches print job. Generates DigitalToken and PhotoShare links.  
**Response:** `success`, `qrToken`, `shareToken`.

-----------------------------------

## 6. Server Direct Routes (`server.js`)

-----------------------------------
### Direct Photo Upload
**Method:** POST `/api/upload`  
**Authentication:** None explicit (Relies on passing `orgId` or `x-org-id` header/body, likely sent by booth app)  
**Middleware:** `multer.memoryStorage()`  
**External Services:** AWS S3 (`@aws-sdk/lib-storage` Upload)  
**Database Models:** `Photo`  
**Logic:** Accepts file or `photoBase64` data URI. Uploads to S3 path `happypix/<orgId>/<eventId>/<sessionId>/<timestamp>-<name>`. Saves record to `Photo` model.  
**Response:** 201 Created with S3 URL and `Photo._id`.

-----------------------------------
### S3 Logo Proxy
**Method:** GET `/api/proxy/logo`  
**Authentication:** None (Used to bypass public access denial for org logos)  
**Query Parameters:** `url` (S3 URL)  
**Logic:** Extracts bucket and key from URL, uses AWS SDK `GetObjectCommand` to fetch stream, pipes to Express response.
