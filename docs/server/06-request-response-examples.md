# Request / Response Examples

This document provides realistic JSON payload examples for the most critical API flows, derived directly from the input validators and Mongoose models in the HappyPix backend.

---

## 1. Device Booth Login
**Method:** POST `/api/devices/booth-login`  
**Purpose:** Registers a physical photobooth to an organization and returns a persistent device token.

### Request
```http
Content-Type: application/json
```
```json
{
  "orgId": "651a2b3c4d5e6f7a8b9c0d1e",
  "password": "clientSecurePassword123!",
  "deviceName": "Main Entrance Booth",
  "location": "Lobby"
}
```

### Response
**Success (201 Created):**
```json
{
  "message": "Device registered successfully.",
  "deviceToken": "hp_dev_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "deviceId": "651a2c4d5e6f7a8b9c0d1e2f",
  "deviceName": "Main Entrance Booth",
  "currentEventId": null
}
```
**Error (401 Unauthorized):**
```json
{
  "error": "Invalid credentials"
}
```

---

## 2. Create Event
**Method:** POST `/api/events`  
**Purpose:** Creates a new photobooth event for a client tenant.

### Request
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn...
Content-Type: application/json
```
```json
{
  "name": "Acme Corp Annual Gala",
  "location": "Grand Hyatt",
  "clientName": "Acme Corp",
  "startDate": "2026-10-15T18:00:00Z",
  "endDate": "2026-10-15T23:59:59Z",
  "assignedDeviceIds": ["651a2c4d5e6f7a8b9c0d1e2f"],
  "printOptions": [1, 2, 4],
  "downloadEnabled": true
}
```

### Response
**Success (201 Created):**
```json
{
  "_id": "651a3d5e6f7a8b9c0d1e2f3a",
  "name": "Acme Corp Annual Gala",
  "location": "Grand Hyatt",
  "status": "upcoming",
  "shortCode": "ACME26",
  "passkey": "4921",
  "organizationId": "651a2b3c4d5e6f7a8b9c0d1e",
  "assignedDeviceIds": [
    {
      "_id": "651a2c4d5e6f7a8b9c0d1e2f",
      "deviceName": "Main Entrance Booth",
      "location": "Lobby"
    }
  ],
  "createdAt": "2026-09-21T10:00:00.000Z"
}
```
**Error (400 Bad Request):**
```json
{
  "error": "Your starter plan allows a maximum of 1 device(s) per event."
}
```

---

## 3. Create Razorpay Payment Order
**Method:** POST `/api/payments/create-order`  
**Purpose:** Initiates a payment session from the booth.

### Request
```http
x-device-token: hp_dev_a1b2c3d4-e5f6-7890-abcd-ef1234567890
Content-Type: application/json
```
```json
{
  "amount": 150,
  "printCount": 2,
  "digitalCopy": true,
  "eventId": "651a3d5e6f7a8b9c0d1e2f3a",
  "eventName": "Acme Corp Annual Gala",
  "photoUrls": [
    "https://happypix-bucket.s3.ap-south-1.amazonaws.com/happypix/.../1.jpg"
  ],
  "compositeUrl": "https://happypix-bucket.s3.ap-south-1.amazonaws.com/happypix/.../composite.jpg"
}
```

### Response
**Success (201 Created):**
```json
{
  "orderId": "order_Mabc1234567890",
  "paymentId": "651b4e6f7a8b9c0d1e2f3a4b",
  "amount": 15000,
  "currency": "INR",
  "key": "rzp_live_abc123",
  "paymentLinkUrl": "https://rzp.io/i/Xyz123",
  "isImageUrl": false
}
```

---

## 4. Verify Payment (Callback)
**Method:** POST `/api/payments/verify`  
**Purpose:** Validates Razorpay signature and finalizes order.

### Request
```http
Content-Type: application/json
```
```json
{
  "razorpay_order_id": "order_Mabc1234567890",
  "razorpay_payment_id": "pay_Mabc0987654321",
  "razorpay_signature": "a1b2c3d4e5f6..."
}
```

### Response
**Success (200 OK):**
```json
{
  "success": true,
  "paymentId": "651b4e6f7a8b9c0d1e2f3a4b",
  "qrToken": "7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e",
  "qrUrl": "https://happypix.vercel.app/download/7b8c9d0e-1f2a-3b4c-5d6e-7f8a9b0c1d2e",
  "tokenExpiresAt": "2026-10-16T18:00:00Z",
  "shareToken": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
