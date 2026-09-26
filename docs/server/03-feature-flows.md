# Feature Flows

This document traces complete business flows across the backend based entirely on the existing codebase logic.

## 1. Organization & User Creation Flow
This flow represents how a new client tenant is onboarded into HappyPix.

1. **Internal User initiates creation**: An `OWNER`, `ADMIN`, or `MANAGER` sends a request to `POST /api/organizations` with client details (`name`, `email`, `plan`).
2. **Organization Validation**: Backend checks if the email is already used by an Organization or User.
3. **Plan Limits Applied**: Backend reads `PLAN_DEVICE_LIMITS` from `Organization.js` to set `allowedDevices` based on the chosen plan (e.g., `starter` = 1 device).
4. **Tenant Creation**: The `Organization` record is saved in MongoDB.
5. **Admin Auto-Creation**: The system generates a random 8-byte hex string (e.g., `a3f2...`). It automatically creates a `User` record with role `CLIENT_ADMIN` linked to the new `organizationId` and hashes the temporary password.
6. **Response**: Returns the temporary password in plain text so the Internal User can share it with the new client.

## 2. Event Creation & Device Assignment Flow
How a tenant creates an event and binds photobooth devices to it.

1. **Client Request**: `CLIENT_ADMIN` sends `POST /api/events` with event details and `assignedDeviceIds` array.
2. **Device Occupancy Validation**: The backend (`validateDevices` helper in `eventRoutes.js`) checks if any requested device is already assigned to a different event (`currentEventId != null`). If busy, creation is blocked.
3. **Plan Limits Validation**: Checks `PLAN_EVENT_DEVICE_LIMITS` to ensure the tenant's plan allows that many devices per event.
4. **Event Creation**: The `Event` is created in MongoDB with generated `shortCode` and `passkey` (if not provided).
5. **Device Synchronization**: The `syncDeviceAssignments` helper loops through `assignedDeviceIds` and updates the respective `Device` models in MongoDB, setting their `currentEventId` to the newly created Event.
6. **Device Polling**: Within 30 seconds, the physical booth apps calling `POST /api/devices/ping` will receive their new `currentEventId` and transition to the assigned event.

## 3. Photobooth Login Flow
How a physical photobooth machine connects to the backend.

1. **Client Action**: The booth operator opens the app and enters their `CLIENT_ADMIN` email/password and a device name.
2. **Booth Request**: The booth sends `POST /api/devices/booth-login` with `orgId` and `password`.
3. **Authentication**: Backend finds the `CLIENT_ADMIN` for that `orgId` and verifies the password via bcrypt.
4. **Limit Enforcement**: Backend counts active devices for the org and blocks login if the plan's `allowedDevices` limit is reached.
5. **Device Registration**: Backend generates a random 32-byte hex token (`deviceToken`). It creates a new `Device` record.
6. **Response**: Returns the `deviceToken`. The booth app saves this in its local `.env` or `localStorage` and includes it as `x-device-token` on all future requests.

## 4. Payment & Printing Flow (QR Scanning)
How guests pay for and receive physical prints.

1. **Start Payment**: Booth calls `POST /api/payments/create-order` with `amount`, `printCount`, and `photoUrls`.
2. **Razorpay Order Creation**: Backend dynamically resolves Razorpay credentials (checking Event -> Org -> Global fallback). It creates an Order via the Razorpay API.
3. **UPI QR Generation**: Backend creates a Razorpay Smart Collect `upi_qr` strictly linked to the exact amount.
4. **Record Payment**: A `Payment` document is saved in MongoDB with status `created`.
5. **Polling for Success**: The booth app polls `GET /api/payments/status/:paymentId` every few seconds.
6. **Status Resolution**: Backend queries Razorpay directly to check if the QR code is paid.
7. **Fulfillment (If Paid)**: 
    - Payment is marked `paid`.
    - Backend looks up org settings. If `enableHardwarePrinting` is true and `compositeUrl` exists, it invokes the local `printHelper.printImage` utility to send the job to the attached physical printer.
    - Response tells booth to show success screen.

## 5. Photo Sharing (Multi-Channel)
How digital photos are delivered to guests.

1. **Trigger**: After successful payment verification (`POST /api/payments/verify`) or a free completion, the backend checks if `digitalCopy` is true.
2. **Digital Token Generation**: If true, it calls `generateDigitalToken`. This creates a `DigitalToken` record in DB linking the S3 `photoUrls` and generating a unique UUID token.
3. **PhotoShare Generation**: It also generates a `PhotoShare` record (token hash) scoped to the Event's sharing expiration policy (default 7 days).
4. **Download Endpoint**: Users scan the QR code which hits the frontend, which calls `GET /api/download/:token` to retrieve the `photoUrls` and display them for download.

*Note: Deliveries via SMS/Email/WhatsApp exist conceptually via `DeliveryService.js` and `POST /api/share/deliver/:token` in `photoShareRoutes.js`.*
