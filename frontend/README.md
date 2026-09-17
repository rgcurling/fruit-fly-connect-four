# Frontend

Next.js + TypeScript + Tailwind client for **Connect Four vs. a Fruit Fly**.
See the [root README](../README.md) for the project overview, architecture and
roadmap.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit
```

The fly's move comes from the FastAPI backend, which must be running on
`http://localhost:8000` (or wherever `NEXT_PUBLIC_API_URL` points).
