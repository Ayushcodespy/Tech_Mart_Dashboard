# TechMart Deployment Notes

## Backend

Deploy the `backend` folder as a Node.js service.

### Vercel Backend

The backend now includes Vercel adapter files:

```text
backend/api/index.js
backend/vercel.json
```

Vercel project settings:

```text
Root Directory: backend
Framework Preset: Other
Build Command: npm install
Output Directory: leave empty
Install Command: npm install
```

Set production environment variables from:

```text
backend/.env.production.example
```

After deployment, your backend URL will look like:

```text
https://your-backend-project.vercel.app
```

API base URL:

```text
https://your-backend-project.vercel.app/api/v1
```

Health check:

```text
https://your-backend-project.vercel.app/health
```

Important Vercel note: uploaded files saved through `/storage` are not permanent on Vercel Functions. Product/category/banner images should use external image URLs or a storage service such as Supabase Storage/Cloudinary for production.

### Node Service Backend

If you deploy to Render/Railway/VPS instead of Vercel, use this mode.

Use these commands:

```powershell
npm install
npm start
```

Set production environment variables from:

```text
backend/.env.production.example
```

Important backend values:

```text
GROCERY_DATABASE_URL=your-production-postgres-url
GROCERY_DATABASE_SSL=true
GROCERY_CORS_ORIGINS=["https://your-user-app-domain.com","https://your-admin-panel-domain.com"]
GROCERY_JWT_SECRET_KEY=replace-with-a-long-random-production-secret
```

Forgot password email uses these SMTP values:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=TechMart
SMTP_USE_TLS=false
SMTP_USE_SSL=true
```

## Admin Panel

Deploy the `admin_panel` folder as a Vite React static site.

Before build, set:

```text
admin_panel/.env.production
```

Example:

```text
VITE_API_BASE_URL=https://your-backend-domain.com/api/v1
VITE_APP_NAME=TechMart
VITE_ADMIN_TITLE=TechMart Admin Dashboard
```

Build command:

```powershell
npm install
npm run build
```

Deploy the generated `admin_panel/dist` folder.

## User App

Deploy the `user_app` folder as a Vite React static site.

Before build, set:

```text
user_app/.env.production
```

Example:

```text
VITE_API_BASE_URL=https://your-backend-domain.com/api/v1
VITE_APP_NAME=TechMart
VITE_APP_TAGLINE=Smart shopping made simple
```

Build command:

```powershell
npm install
npm run build
```

Deploy the generated `user_app/dist` folder.

## Where To Change Backend API URL

For local development:

```text
admin_panel/.env
user_app/.env
```

For production builds:

```text
admin_panel/.env.production
user_app/.env.production
```

Set `VITE_API_BASE_URL` to:

```text
https://your-backend-domain.com/api/v1
```
