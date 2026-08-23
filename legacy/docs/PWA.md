# PWA (Progressive Web App) Features

This application has been configured as a Progressive Web App (PWA), providing an enhanced user experience with offline capabilities, installability, and native app-like features.

## What's Included

### 1. Web App Manifest (`/public/manifest.json`)
The manifest file defines how the app appears and behaves when installed on a user's device:
- **Name**: Work Hours Tracker
- **Short Name**: Hours Tracker
- **Display Mode**: Standalone (full-screen without browser UI)
- **Theme Color**: #0f172a (slate dark)
- **Background Color**: #f8fafc (slate light)
- **Icons**: Multiple sizes (192px, 256px, 384px, 512px) for different devices

### 2. Service Worker
A service worker is automatically generated during the build process to:
- Cache static assets for faster loading
- Enable offline functionality
- Provide background sync capabilities
- Handle push notifications (can be extended)

### 3. Icons
PWA-compliant icons in multiple sizes:
- `icon-192x192.png` - Used on home screens and splash screens
- `icon-256x256.png` - Android adaptive icon
- `icon-384x384.png` - High-DPI displays
- `icon-512x512.png` - Large displays and splash screens

All icons support both "maskable" and "any" purposes for better compatibility.

### 4. Offline Page
A dedicated offline page (`/~offline`) provides a user-friendly experience when the network is unavailable.

### 5. Apple iOS Support
Special configuration for iOS devices:
- Apple Web App capable
- Custom status bar styling
- Apple touch icons

## Installation

### Desktop (Chrome, Edge, Brave)
1. Open the app in your browser
2. Click the install icon (⊕) in the address bar
3. Click "Install" in the prompt
4. The app will open in its own window

### Android
1. Open the app in Chrome
2. Tap the three-dot menu
3. Select "Add to Home screen" or "Install app"
4. Follow the prompts
5. Launch from your home screen

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button (□↑)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add"
5. Launch from your home screen

## Development

### Building with PWA Support
The service worker is generated during production builds:

```bash
npm run build
```

In development mode, the PWA is disabled for faster development cycles:

```bash
npm run dev
```

### Configuration
PWA settings can be adjusted in `next.config.ts`:

```typescript
withPWA({
  dest: "public",                    // Service worker output directory
  disable: process.env.NODE_ENV === "development", // Disable in dev
  register: true,                    // Auto-register service worker
  workboxOptions: {
    skipWaiting: true,               // Activate new SW immediately
    clientsClaim: true,              // Take control of all clients
    cleanupOutdatedCaches: true,     // Remove old caches
  },
})(nextConfig);
```

### Caching Strategy
The service worker uses intelligent caching strategies:
- **Static Assets**: Cache first (images, fonts, CSS, JS)
- **API Calls**: Network first with fallback
- **Pages**: Network first with cache fallback
- **Google Fonts**: Special handling for external fonts

## Testing PWA Features

### Using Chrome DevTools
1. Open DevTools (F12)
2. Go to the "Application" tab
3. Check:
   - **Manifest**: Verify manifest.json is loaded correctly
   - **Service Workers**: Check registration and status
   - **Cache Storage**: View cached resources
   - **Offline**: Test offline functionality

### Lighthouse Audit
Run a Lighthouse audit to verify PWA compliance:
1. Open DevTools (F12)
2. Go to the "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Generate report"

## Generated Files

The following files are automatically generated during build and should NOT be committed:
- `/public/sw.js` - Service worker script
- `/public/sw.js.map` - Service worker source map
- `/public/workbox-*.js` - Workbox runtime library
- `/public/workbox-*.js.map` - Workbox source maps

These files are already excluded in `.gitignore`.

## Browser Compatibility

- ✅ Chrome/Edge (Desktop & Mobile) - Full support
- ✅ Firefox (Desktop & Mobile) - Full support
- ✅ Safari (iOS 11.3+) - Partial support (no service worker on older iOS)
- ✅ Samsung Internet - Full support
- ⚠️ IE11 - Not supported (application may work without PWA features)

## Offline Functionality

When offline, users will:
1. See cached content from their last visit
2. Be able to navigate previously visited pages
3. See the offline page for new/uncached pages
4. Be able to retry loading when back online

## Future Enhancements

Potential PWA features to add:
- [ ] Push notifications for time entry reminders
- [ ] Background sync for offline time entries
- [ ] Periodic background sync for updates
- [ ] Share target API for sharing time reports
- [ ] Badge API for unread notifications

## Troubleshooting

### Service Worker Not Updating
1. Unregister the old service worker:
   - DevTools → Application → Service Workers → Unregister
2. Clear cache storage:
   - DevTools → Application → Cache Storage → Delete all
3. Hard reload: Ctrl+Shift+R (Cmd+Shift+R on Mac)

### App Not Installable
Check in DevTools:
1. Application → Manifest: Verify no errors
2. Console: Look for manifest warnings
3. Lighthouse → PWA: Check for failing criteria

### Offline Mode Not Working
1. Verify service worker is registered:
   - DevTools → Application → Service Workers
2. Check cache storage has content:
   - DevTools → Application → Cache Storage
3. Test offline mode:
   - DevTools → Network → Check "Offline"

## Documentation

- [Next PWA Documentation](https://ducanh-next-pwa.vercel.app/docs/next-pwa)
- [Workbox Documentation](https://developer.chrome.com/docs/workbox/)
- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev PWA](https://web.dev/progressive-web-apps/)
