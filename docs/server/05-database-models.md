# Database Models

This document outlines the core MongoDB schema definitions based strictly on the Mongoose models found in `server/models`.

## 1. User
**File:** `server/models/User.js`  
**Purpose:** Stores human user accounts for both Internal Staff (Admins/Managers) and Clients.

| Field | Type | Required | Default | Relation | Description |
|------|------|----------|---------|----------|-------------|
| name | String | Yes | | | User's full name |
| email | String | Yes | | | Unique, lowercase email used for login |
| password | String | Yes | | | Hashed via bcrypt |
| role | String | Yes | | | `OWNER`, `ADMIN`, `MANAGER`, `CLIENT_ADMIN`, `CLIENT_MANAGER`, `BOOTH_OPERATOR` |
| organizationId | ObjectId | No | null | Organization | Null for internal roles, required for tenant roles |
| useCustomPermissions | Boolean | No | false | | If true, overrides role defaults |
| customPermissions | [String] | No | [] | | Explicit string permissions |
| resetPasswordToken | String | No | null | | |
| resetPasswordExpires | Date | No | null | | |

**Indexes:** `organizationId`

## 2. Organization
**File:** `server/models/Organization.js`  
**Purpose:** The central tenant model. Every client is an Organization. Devices and Events belong to an Organization.

| Field | Type | Required | Default | Relation | Description |
|------|------|----------|---------|----------|-------------|
| name | String | Yes | | | Company/Client name |
| email | String | Yes | | | Unique billing email |
| plan | String | No | starter | | `starter`, `professional`, `business`, `enterprise` |
| currency | String | No | INR | | `AUD`, `INR` |
| paymentGateway | String | No | razorpay | | `razorpay`, `stripe` |
| status | String | No | trial | | `trial`, `active`, `suspended`, `expired` |
| allowedDevices | Number | No | 1 | | Enforced limit based on plan |
| logoLibrary | [String] | No | [] | | S3 URLs of uploaded client logos |
| frameLibrary | [Object] | No | [] | | Array of {url, name, tags} for frames |
| templates | [Object] | No | [] | | Client-defined photo templates |

**Indexes:** `status`, `plan`

## 3. Device
**File:** `server/models/Device.js`  
**Purpose:** Represents a physical photobooth running the client app.

| Field | Type | Required | Default | Relation | Description |
|------|------|----------|---------|----------|-------------|
| organizationId | ObjectId | Yes | | Organization | The tenant owning the device |
| deviceName | String | Yes | | | E.g., "Booth-01" |
| deviceToken | String | Yes | | | Unique token used for device auth (`x-device-token`) |
| currentEventId | ObjectId | No | null | Event | The event this booth is currently running |
| currentEventName | String | No | null | | |
| lastSeenAt | Date | No | null | | Updated every 30s by heartbeat ping |
| status | String | No | active | | `active`, `inactive`, `blocked` |
| printsSinceLastMaintenance| Number | No | 0 | | Counter for hardware maintenance |
| printerName | String | No | '' | | Name of local hardware printer |

**Indexes:** `organizationId`, `status`, `lastSeenAt`, `deviceToken` (unique)

## 4. Event
**File:** `server/models/Event.js`  
**Purpose:** A specific photo booth event (e.g., a wedding or corporate party).

| Field | Type | Required | Default | Relation | Description |
|------|------|----------|---------|----------|-------------|
| organizationId | ObjectId | No | null | Organization | The tenant owner |
| name | String | Yes | | | Event name |
| startDate | Date | Yes | | | |
| endDate | Date | Yes | | | |
| status | String | No | upcoming | | `upcoming`, `live`, `finished` |
| assignedTemplateIds | [ObjectId]| No | [] | Template | References to assigned templates |
| assignedDeviceIds | [ObjectId]| No | [] | Device | Devices allowed to run this event |
| assignedManagerId | ObjectId | No | null | User | `CLIENT_MANAGER` assigned to this event |
| shortCode | String | No | | | Random 6-char code |
| passkey | String | No | | | Random 4-digit code |
| branding | Object | No | | | Overlays, logos, positions |
| printPrice | Number | No | null | | Override global price |

**Indexes:** `shortCode` (unique, sparse), `organizationId`

## 5. Payment
**File:** `server/models/Payment.js`  
**Purpose:** Records a physical print purchase from a booth.

| Field | Type | Required | Default | Relation | Description |
|------|------|----------|---------|----------|-------------|
| organizationId | ObjectId | No | null | Organization | Tenant receiving the payment |
| eventId | ObjectId | No | null | Event | |
| razorpayOrderId | String | Yes | | | |
| paymentLinkId | String | No | null | | ID of the Razorpay QR/Link |
| amount | Number | Yes | | | In local currency |
| printCount | Number | Yes | | | Number of copies |
| digitalCopy | Boolean | No | false | | Did user opt-in for digital? |
| photoUrls | [String] | No | [] | | S3 URLs of individual photos |
| compositeUrl | String | No | null | | S3 URL of the print strip |
| status | String | No | created | | `created`, `paid`, `failed` |
| utr | String | No | null | | UPI reference number for manual checks |

**Indexes:** `organizationId`, `razorpayOrderId` (unique), `utr`
