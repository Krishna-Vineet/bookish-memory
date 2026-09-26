# Backend Architecture

## 1. Backend Overview

The HappyPix backend is a Node.js API server built with Express.js and MongoDB (using Mongoose). It serves as the central data and business logic hub for both the CRM (Web Application) and external devices (photobooths/mobile apps). 

**Key Technologies:**
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT (JSON Web Tokens) stored in HttpOnly cookies, plus Device-level token authentication (`x-device-token`).
- **Authorization:** Role-Based Access Control (RBAC) supporting multi-tenant isolation.
- **Storage:** AWS S3 (via `@aws-sdk/client-s3` and `@aws-sdk/lib-storage`).
- **External Services:** Razorpay for payments, AWS S3 for photo/logo storage, plus potential SMS/Email services via `DeliveryService.js`.

### Application Bootstrap
The entry point is `server.js`.
1. **Environment Variables:** Loaded immediately via `dotenv`. Checks for required keys (`MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
2. **DNS Fix:** Explicitly sets DNS servers (`8.8.8.8`, `1.1.1.1`) to resolve MongoDB SRV issues on certain networks.
3. **CORS:** Configured to allow specific Origins including local development ports, production Vercel domains, and requests with no origin (mobile/curl).
4. **Middleware:** Configures JSON body parsing (50MB limit) and `cookie-parser`.
5. **Database Connection:** Connects to MongoDB lazily using a caching mechanism (`_mongoConnected`) to ensure serverless compatibility on Vercel. A global middleware awaits connection before any route executes.
6. **Routes Setup:** Mounts all API sub-routers (Auth, Events, Coupons, Organizations, Devices, Subscriptions, Superadmin, Audit, Templates, Access, Share).
7. **Direct Upload/Proxy Routes:** `server.js` directly implements AWS S3 logo proxying (`/api/proxy/logo`), logo upload (`/api/upload/logo`), profile photo upload, and general photo upload (`/api/upload`) using `multer.memoryStorage()`.

## 2. Folder Structure

The backend does not use a separate "controllers" directory; controller logic is co-located directly within the route files in the `routes/` directory.

```text
server/
├── middleware/         # Custom Express middleware
│   ├── auth.js         # JWT verification, RBAC (requirePermission, authorize), and org-filtering
│   └── deviceAuth.js   # Device authentication via x-device-token header
├── models/             # Mongoose database schemas
│   ├── AuditLog.js
│   ├── Coupon.js
│   ├── DeliveryRecord.js
│   ├── Device.js
│   ├── DigitalToken.js
│   ├── Event.js
│   ├── Organization.js
│   ├── Payment.js
│   ├── Photo.js
│   ├── PhotoShare.js
│   ├── RoleConfig.js
│   ├── Setting.js
│   ├── Subscription.js
│   ├── SupportTicket.js
│   ├── Template.js
│   └── User.js
├── routes/             # Express routes and embedded controller logic
│   ├── auditRoutes.js
│   ├── authRoutes.js
│   ├── couponRoutes.js
│   ├── deviceRoutes.js
│   ├── eventRoutes.js
│   ├── organizationRoutes.js
│   ├── paymentRoutes.js
│   ├── photoShareRoutes.js
│   ├── settingRoutes.js
│   ├── subscriptionRoutes.js
│   ├── superadminRoutes.js
│   ├── supportRoutes.js
│   ├── templateRoutes.js
│   └── usageAccessRoutes.js
├── services/           # External service integrations and core business logic
│   ├── DeliveryService.js # Handles email/SMS/WhatsApp deliveries
│   └── ai/             # AI generation services
├── utils/              # Helper functions
│   ├── auditLogger.js  # Audit logging utility
│   ├── printHelper.js  # Helpers for printing
│   └── s3.js           # AWS S3 utilities
└── server.js           # Main application entry point and server setup
```

### Responsibility Breakdown
- **`server.js`**: Initializes Express, configures CORS, handles DB connection caching for serverless, configures AWS S3 SDK, manages direct file uploads via `multer`, and mounts routes.
- **`routes/`**: Handles HTTP request parsing, input validation, core business logic, database queries (calling `models/`), and JSON responses. Acts as both router and controller.
- **`middleware/`**: Handles request interception. `auth.js` is critical for ensuring multi-tenancy (deriving Organization context) and RBAC enforcement.
- **`models/`**: Defines MongoDB schema definitions, constraints, indexes, and relationships.
- **`services/`**: Encapsulates external integrations to keep routes cleaner (e.g., `DeliveryService`).
