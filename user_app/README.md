# Green & Grains User App

React/Vite customer storefront converted from the Flutter mobile app.

## Run

```bash
npm install
npm run dev
```

The app uses the same backend API as Flutter by default:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Set `VITE_API_BASE_URL` in `.env` if you want to point it to a local Node.js server.
Set `VITE_APP_NAME` and `VITE_APP_TAGLINE` to change the visible app name.
