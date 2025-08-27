# Upranked Marting Backend

A robust backend API for Upranked Marting team built with Node.js, Express.js, TypeScript, and PostgreSQL. This API provides comprehensive user management, subscription handling, and payment processing capabilities with Stripe integration.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control (USER, ADMIN, SUPER_ADMIN)
- **User Management**: Complete user registration, email verification, profile management with image upload
- **Subscription System**: Flexible subscription plans with Stripe payment integration
- **Payment Processing**: Secure payment handling with Stripe webhooks and checkout sessions
- **File Upload**: Image upload functionality with Cloudinary integration
- **Email Services**: Automated email notifications using Brevo SMTP for verification and password reset
- **Database Management**: PostgreSQL with Prisma ORM for type-safe database operations
- **Error Handling**: Comprehensive error handling with custom error classes and validation
- **Security**: Password hashing with bcrypt, JWT tokens, request validation, and CORS configuration
- **Super Admin Seeding**: Automatic super admin creation on application startup

## 🛠 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **Payment**: Stripe
- **File Storage**: Cloudinary
- **Email Service**: Brevo (formerly Sendinblue) SMTP
- **Validation**: Zod for request validation
- **Development**: ts-node-dev, ESLint

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- Yarn package manager
- Stripe account for payment processing
- Cloudinary account for file uploads
- Brevo (formerly Sendinblue) account for email services

## ⚙️ Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/SMTech24-official/uprankedmarting_Backend_Neuro_Night_ai.git
   cd backend_starter_pack_with_postgres
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/uprankedmarting"

   # Server Configuration
   NODE_ENV=development
   PORT=5005
   HOST=localhost

   # JWT Configuration
   JWT_ACCESS_SECRET=your_jwt_access_secret_key
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
   JWT_ACCESS_EXPIRES_IN=2y
   JWT_REFRESH_EXPIRES_IN=5y
   JWT_RESET_PASS_ACCESS_EXPIRES_IN=5m

   # Brevo Email Configuration (formerly Sendinblue)
   BREVO_EMAIL=your_brevo_smtp_email
   BREVO_PASS=your_brevo_smtp_password
   EMAIL_FROM=your_sender_email@domain.com

   # Stripe Configuration
   STRIPE_SECRET_KEY=your_stripe_secret_key

   # Cloudinary Configuration
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Super Admin Configuration
   SUPER_ADMIN_EMAIL=superadmin@example.com
   SUPER_ADMIN_PASSWORD=your_super_admin_password

   # URL Configuration
   RESET_PASS_UI_LINK=http://localhost:3000/reset-password
   BACKEND_URL=http://localhost:5005/api/v1
   IMAGE_URL=http://localhost:5005
   FRONTEND_URL=http://localhost:3000
   VERIFY_EMAIL_LINK=http://localhost:5005/api/v1/auth/verify-email
   VERIFY_RESET_PASS_LINK=http://localhost:5005/api/v1/auth/verify-reset-password
   ```

4. **Set up the database**

   ```bash
   # Generate Prisma client
   npx prisma generate

   # Run database migrations
   npx prisma migrate dev

   # Seed the database (creates super admin automatically)
   yarn dev
   ```

## 🚀 Running the Application

### Development Mode

```bash
yarn dev
```

### Production Build

```bash
yarn build
yarn start
```

### Using Docker

```bash
docker-compose up -d
```

The server will start on `http://localhost:5005`

## 📁 Project Structure

```
src/
├── app/
│   ├── builder/          # Query builder utilities
│   ├── config/           # Configuration files
│   ├── errors/           # Error handling utilities
│   ├── helpers/          # Helper functions (password, JWT, OTP)
│   ├── interface/        # TypeScript interfaces
│   ├── middlewares/      # Express middlewares
│   ├── modules/          # Feature modules
│   │   ├── auth/         # Authentication module
│   │   ├── plan/         # Subscription plans module
│   │   ├── subscription/ # Subscription management
│   │   └── user/         # User management
│   ├── routes/           # Route definitions
│   └── utils/            # Utility functions
├── prisma/               # Database schema and migrations
├── uploads/              # File upload directory
└── views/                # View templates
```

## 🔗 API Endpoints

### Authentication

- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/verify-email` - Email verification via link
- `PUT /api/v1/auth/change-password` - Change password (authenticated users)
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password via token
- `GET /api/v1/auth/verify-reset-password` - Verify password reset link
- `POST /api/v1/auth/resend-verification-link` - Resend email verification
- `POST /api/v1/auth/resend-reset-pass-link` - Resend password reset link
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/refresh-token` - Refresh JWT token

### Users

- `POST /api/v1/users/register` - User registration
- `GET /api/v1/users` - Get all users (Admin/Super Admin only)
- `GET /api/v1/users/:userId` - Get user by ID (Admin/Super Admin only)
- `PATCH /api/v1/users/update` - Update user profile with file upload
- `DELETE /api/v1/users/:userId` - Delete user (Admin/Super Admin only)

### Plans

- `GET /api/v1/plans` - Get all subscription plans
- `POST /api/v1/plans` - Create new plan (Admin)
- `PATCH /api/v1/plans/:id` - Update plan (Admin)
- `DELETE /api/v1/plans/:id` - Delete plan (Admin)

### Subscriptions

- `POST /api/v1/subscriptions/create-subscription` - Create new subscription
- `GET /api/v1/subscriptions/my-subscription` - Get current user's subscription
- `GET /api/v1/subscriptions` - Get all subscriptions (authenticated users)
- `GET /api/v1/subscriptions/:subscriptionId` - Get subscription by ID
- `PUT /api/v1/subscriptions/:subscriptionId` - Update subscription (Admin/Super Admin only)
- `DELETE /api/v1/subscriptions/:subscriptionId` - Delete subscription (Admin/Super Admin only)
- `POST /api/v1/subscriptions/stripe/webhook` - Stripe webhook handler

## 🗃️ Database Schema

### User Model

- User authentication and profile information
- Role-based access control (USER, ADMIN, SUPER_ADMIN)
- Email verification and password reset functionality

### Plan Model

- Subscription plan details
- Stripe integration with product and price IDs
- Flexible pricing with intervals and features

### Subscription Model

- User subscription tracking
- Payment status and history
- Integration with Stripe payment processing

## 🔒 Authentication & Authorization

The API uses JWT-based authentication with robust security measures:

### **Token Security**

- **Dual Token System**: Separate access and refresh tokens with different secret keys
- **Token Expiration**:
  - Access tokens: 2 years (configurable)
  - Refresh tokens: 5 years (configurable)
  - Password reset tokens: 5 minutes (short-lived for security)
- **Token Validation**: Secure token verification on every protected route
- **Automatic Invalidation**: Tokens become invalid when passwords are changed

### **Role-Based Access Control**

- **USER**: Regular users with basic access to personal data and subscriptions
- **ADMIN**: Administrative users with extended permissions for user and plan management
- **SUPER_ADMIN**: Full system access including all administrative functions

### **Authentication Flow**

Protected routes require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Token refresh is handled automatically through the `/api/v1/auth/refresh-token` endpoint.

## 💳 Payment Integration

The application integrates with Stripe for payment processing:

- Subscription plan creation and management
- Secure payment processing
- Webhook handling for payment events
- Automatic subscription status updates

## 📧 Email Services

- **Email Provider**: Brevo (formerly Sendinblue) SMTP service
- **Email Verification**: Automated email verification for new user registration
- **Password Reset**: Secure password reset functionality with time-limited tokens
- **Template System**: HTML email templates with branded design
- **Time Limits**: Email verification and password reset links expire in 10 minutes for security

## 🛡️ Security Features

- **Password Security**: Bcrypt hashing with salt rounds for secure password storage
- **JWT Token Security**:
  - Separate access and refresh tokens with different secret keys
  - Configurable token expiration (Access: 2 years, Refresh: 5 years, Reset: 5 minutes)
  - Secure token generation and validation
  - Token-based authentication for all protected routes
  - Password change invalidates existing tokens
- **Request Validation**: Zod schema validation for all incoming requests
- **CORS Configuration**: Configured for specific frontend origins with credentials support
- **Role-Based Access**: Three-tier role system (USER, ADMIN, SUPER_ADMIN)
- **File Upload Security**: Secure file handling with Cloudinary integration
- **Email Security**: Time-limited verification and reset links (10-minute expiration)
- **Error Handling**: Comprehensive error handling without exposing sensitive information

## 🧪 Development

### Code Style

The project uses ESLint and TypeScript for code quality and type safety.

### Database Management

Use Prisma Studio to manage your database:

```bash
npx prisma studio
```

### Debugging

The application includes comprehensive error handling and logging for debugging purposes.

## License

This project is licensed under the MIT License.

<!-- ## 👨‍💻 Author

**S M Hasan Jamil**

- Email: smhasanjamil14@gmail.com
# uprankedmarting_Backend_Neuro_Night_ai -->
