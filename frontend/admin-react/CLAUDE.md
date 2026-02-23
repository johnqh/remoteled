# Frontend — React Admin Console

## Running

```bash
cd frontend/admin-react
npm install
npm run dev        # http://localhost:5173/admin/
npm run build
npm run test       # vitest --run
```

## Tech Stack

React 18, TypeScript 5.5, Vite 5, Tailwind CSS, Recharts, React Router 6, Axios

## Project Structure

```
src/
  main.tsx               Entrypoint (BrowserRouter, AuthProvider)
  App.tsx                Route definitions

  core/                  *** PRIMARY shared code ***
    api/client.ts        Axios instance — auth interceptor, env detection
    types/index.ts       All TypeScript interfaces
    utils/index.ts       Utility functions

  contexts/
    AuthContext.tsx       Auth provider (login, logout, register, token in localStorage)

  features/              Feature modules (component + hook per feature)
    auth/                LoginPage
    dashboard/           DashboardPage, StatsCards, charts, useDashboard
    devices/             DevicesTab, DeviceCard, AddDeviceModal, useDevices
    orders/              OrdersTab, useOrders
    products/            ProductsTab, useProducts

  components/            Shared UI
    Badge, Button, Input, Modal, Select, Textarea, LoadingSpinner, Notification
    ProtectedRoute       Auth guard wrapper
    common/Modal         Alternative modal
    dashboard/           DeviceGrid, LiveOrdersPanel, OrdersTable, LogsTable, etc.
    forms/               DeviceForm, ServiceForm, LocationForm, LoginForm, etc.
    layout/              DashboardLayout, Header

  pages/                 Route pages
    Dashboard.tsx        Main page (tab-based: Devices, Products, Orders, Logs)
    Login.tsx            Login page

  hooks/                 (legacy — prefer features/*/use*.ts)
  api/                   (legacy — prefer core/api/client.ts)
```

## API Client

Primary: `src/core/api/client.ts` (Axios)

- Dev mode: requests go directly to `http://localhost:9999`
- Prod mode: requests go to `/api` (nginx proxy)
- Request interceptor: adds `Bearer <token>` from `localStorage.getItem('access_token')`
- Response interceptor: 401 -> clear auth, redirect to `/login`
- Exports: `authApi`, `statsApi`, `devicesApi`, `servicesApi`, `ordersApi`, `logsApi`

## Adding a New Feature

1. Create `src/features/myFeature/` directory
2. Create hook `useMyFeature.ts`:
   ```typescript
   const useMyFeature = () => {
     const [items, setItems] = useState<MyType[]>([]);
     const [isLoading, setIsLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);

     const fetchItems = useCallback(async () => {
       setIsLoading(true);
       setError(null);
       try {
         const data = await myApi.getAll();
         setItems(data);
       } catch (err: any) {
         setError(err.response?.data?.detail || 'Failed to load');
       } finally {
         setIsLoading(false);
       }
     }, []);

     return { items, isLoading, error, fetchItems };
   };
   ```
3. Create component `MyFeaturePage.tsx`
4. Add API methods to `src/core/api/client.ts`
5. Add TypeScript types to `src/core/types/index.ts`
6. Add route in `App.tsx` or tab in `pages/Dashboard.tsx`

## Conventions

- All API calls through Axios client (never raw fetch)
- Auth token key: `access_token` in localStorage
- Tailwind CSS for styling (no CSS modules, no inline style objects)
- Vite proxy: `/api` -> `http://localhost:9999` (in `vite.config.ts`)
- Base path: `/admin/` (in `vite.config.ts`)
- TypeScript strict mode enabled
- Test framework: vitest with jsdom (`src/test/setup.ts`)
