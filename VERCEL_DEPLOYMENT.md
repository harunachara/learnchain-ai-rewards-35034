# Vercel Deployment Guide

## Critical Setup Steps

### 1. Environment Variables

You **MUST** configure these environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

```
VITE_SUPABASE_URL=https://vklzgfcpnjkgpeegnors.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrbHpnZmNwbmprZ3BlZWdub3JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwODkzNjIsImV4cCI6MjA3NTY2NTM2Mn0.dmI8XQSxwOIWQM6ng6AmkSZ0m4LafcXqoB26NXFFhGo
```

4. Make sure to add them for **all environments** (Production, Preview, and Development)
5. **Redeploy your project** after adding environment variables

### 2. Build Settings

Ensure your Vercel build settings are:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3. Troubleshooting Common Issues

#### Courses Not Showing
- Check browser console for errors
- Verify environment variables are set correctly
- Ensure you're logged in (courses require authentication to view enrolled courses)
- Check network tab for failed API requests

#### Math Solver Not Working
- This feature requires authentication - make sure you're logged in
- Check console for any API errors
- Verify Supabase connection in the error banner at the top

#### 404 Errors on Page Refresh
- The `vercel.json` file should handle this
- If still occurring, check that the file is included in your deployment

#### General Debug Steps
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests
4. Look for the connection check banner at the top of the page
5. Try logging out and logging back in

### 4. After Deployment

After setting environment variables and redeploying:
1. Clear your browser cache
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Check that the connection warning is NOT showing at the top
4. Try logging in/signing up
5. Navigate to different pages to ensure routing works

## Support

If issues persist after following these steps:
- Check the browser console for specific error messages
- Verify all environment variables are correctly copied (no extra spaces)
- Ensure you redeployed after adding environment variables
