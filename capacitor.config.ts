import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'online.karamellu.app',
  appName: 'Карамель LU',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
