import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// HTTPS + host exposure is required so phones on the same Wi-Fi can access
// DeviceOrientation sensors (browsers only expose them in secure contexts).
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
  },
})
