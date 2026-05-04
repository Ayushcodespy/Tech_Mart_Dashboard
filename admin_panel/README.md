# Green & Grains Admin Panel (React + Vite)

## Features
- JWT-based admin login
- Protected routes with role-aware backend access
- Modern responsive dashboard (cards + charts)
- Products management (create, pricing, stock, feature, active toggle, image upload)
- Orders management (status, payment status, tracking updates)
- Reports section (day wise, monthly, and custom date range)
- Banner management (create/upload/toggle/delete)
- Inventory management (low stock + logs + manual adjustments)
- Users & roles management (for super admin)

## Setup
1. Copy env:
   - `Copy-Item .env.example .env`
2. Install:
   - `npm install`
3. Start dev server:
   - `npm run dev`
4. Open:
   - `http://localhost:5174`

## Required Backend
- Backend must run on `http://127.0.0.1:8000`
- API base URL should match `VITE_API_BASE_URL`
- Brand name can be changed with `VITE_APP_NAME`
- Add admin panel URL in CORS:
  - `http://localhost:5174`

## Build
- `npm run build`
- `npm run preview`
