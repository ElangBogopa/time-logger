# Emergency Runbook - Time Logger

**Last Updated:** January 28, 2025  
**Version:** 1.0  
**Stack:** Next.js 16.1.1, React 19.2.3, Supabase, NextAuth v4  

## Section 1: Deployment

### 🛠 Tech Stack
- **Frontend:** Next.js 16.1.1 (App Router), React 19.2.3, TypeScript
- **Database:** Supabase (PostgreSQL + RLS)
- **Authentication:** NextAuth v4 (Google OAuth + Magic Links)
- **Email:** Resend API
- **AI:** OpenAI API (GPT-4o-mini)
- **Push Notifications:** Web Push API (VAPID)
- **Error Tracking:** Sentry
- **PWA:** @ducanh2912/next-pwa

### 🚀 Commands
```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production (runs: next build --webpack)
npm run start           # Start production server
npm test               # Run test suite
npm run lint           # Lint code

# Database (local dev)
npx supabase start      # Start local Supabase
npx supabase status     # Get connection details
npx supabase db reset   # Reset local database
```

### 🔧 Environment Variables (Required)

#### Core Application
- `NEXTAUTH_SECRET` - NextAuth encryption key (`openssl rand -base64 32`)
- `NEXTAUTH_URL` - Application base URL (https://app.timelogger.com)

#### Database
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Client-side Supabase key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side Supabase key (bypasses RLS)

#### Authentication  
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `EMAIL_FROM` - Sender email address for magic links
- `RESEND_API_KEY` - Resend email service API key

#### AI & Automation
- `OPENAI_API_KEY` - OpenAI API key for activity categorization
- `CRON_SECRET` - Authorization for cron/webhook endpoints

#### Push Notifications
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Web Push public key (client-visible)
- `VAPID_PRIVATE_KEY` - Web Push private key (server-only)
- `VAPID_EMAIL` - Contact email for push notifications

#### Error Tracking (Sentry - Already Configured)
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry project DSN
- `SENTRY_ORG` - Sentry organization slug  
- `SENTRY_PROJECT` - Sentry project name
- `SENTRY_AUTH_TOKEN` - Sentry source map upload token
> **Note:** Sentry configuration files already exist in the codebase. Only environment variables need to be set.

### ✅ Pre-Deploy Checklist
1. All environment variables are set and valid
2. `npm test` passes (13 test files)
3. `npm run build` succeeds without errors
4. Supabase migrations are applied
5. Sentry environment variables are configured (integration already installed)
6. Google OAuth redirect URIs include production domain
7. VAPID keys are generated and set

### 🔄 Rollback Procedure
1. **Immediate:** Revert to previous deployment via hosting platform
2. **Database:** If schema changes, run previous migration
3. **DNS:** Switch traffic back to stable environment
4. **Notify:** Update incident channel with rollback status

---

## Section 2: Incident Response

### 🚨 Severity Levels

#### P0 - Critical (Immediate Response)
- **Response Time:** 15 minutes
- **Examples:** Authentication completely broken, data loss, security breach
- **Actions:** Page on-call engineer, war room, immediate rollback if needed

#### P1 - High (1 Hour Response)  
- **Response Time:** 1 hour
- **Examples:** API errors >50%, OAuth flows failing, database connection issues
- **Actions:** Investigate via monitoring dashboards, fix or rollback

#### P2 - Medium (Next Business Day)
- **Response Time:** Next business day
- **Examples:** UI bugs, non-blocking feature issues, performance degradation <20%
- **Actions:** Create ticket, schedule fix in next sprint

### 📊 Monitoring & Dashboards

#### Sentry Dashboard
- **URL:** app.sentry.io/[org]/time-logger
- **Alerts:** Email + Slack for P0/P1 errors
- **Key Metrics:** Error rate, user impact, release tracking

#### Supabase Dashboard  
- **URL:** app.supabase.com/project/[project-id]
- **Monitor:** Database health, API usage, auth metrics
- **Logs:** Real-time SQL logs and API request logs

#### Hosting Platform
- **Monitor:** Build status, deployment health, performance metrics
- **Logs:** Application logs and build failure details

### 🔧 Common Issues & Fixes

#### Google OAuth Token Expired
- **Symptoms:** "RefreshAccessTokenError" in Sentry, users see GoogleReauthBanner
- **Fix:** User needs to sign out and sign in again to refresh tokens
- **Prevention:** Monitor token refresh failures in `src/lib/auth.ts:refreshAccessToken`

#### Supabase Connection Failed  
- **Symptoms:** 500 errors on all API routes, "connection refused" in logs
- **Check:** Supabase project status, `SUPABASE_SERVICE_ROLE_KEY` validity
- **Files:** `src/lib/supabase-server.ts` (line 20)
- **Fix:** Verify environment variables, check Supabase status page

#### OpenAI API Errors
- **Symptoms:** Activity categorization fails, 429/401 responses
- **Check:** `OPENAI_API_KEY` validity, rate limit quotas, OpenAI status
- **Files:** `src/app/api/categorize/route.ts` (line 38)
- **Fix:** Verify API key, check billing, implement fallback categorization

#### Push Notification Failures
- **Symptoms:** Push notifications not delivered, 410 errors in logs
- **Check:** VAPID keys, subscription validity, browser permissions
- **Files:** `src/app/api/push/send/route.ts` (line 15)
- **Fix:** Clean expired subscriptions, regenerate VAPID keys if needed

#### Build Failures
- **Common:** TypeScript errors, Sentry config issues, dependency conflicts
- **Check:** `npm test` locally, TypeScript compilation
- **Files:** Check error output for specific failing file paths

### 📞 Escalation Path

1. **L1 Response:** On-call engineer investigates via dashboards
2. **L2 Escalation:** Senior engineer if issue persists >2 hours
3. **L3 Escalation:** Technical lead for architecture decisions
4. **Management:** CEO notification for P0 incidents affecting >20% users

### 🔍 Debugging File Paths

#### Authentication Issues
- `src/lib/auth.ts` - NextAuth configuration and token refresh
- `src/lib/auth-adapter.ts` - Supabase adapter for user data
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API routes

#### Database Issues  
- `src/lib/supabase-server.ts` - Server-side database client
- `src/app/api/*/route.ts` - All API routes using Supabase

#### Error Tracking
- `src/components/ErrorBoundary.tsx` - React error boundary
- `src/app/global-error.tsx` - Next.js global error handler
- `sentry.*.config.ts` - Sentry configuration files

#### Security
- `src/middleware.ts` - CSRF protection and request routing
- `src/lib/rate-limit.ts` - Rate limiting implementation

### 📋 Incident Response Checklist

#### During Incident
- [ ] Classify severity level (P0/P1/P2)
- [ ] Check Sentry for error details and user impact
- [ ] Verify recent deployments in hosting platform
- [ ] Check external service status (Supabase, OpenAI, Resend)
- [ ] Document timeline and actions in incident channel

#### Post-Incident
- [ ] Root cause analysis with specific file paths
- [ ] Update monitoring/alerting if gaps found
- [ ] Create preventive measures (tests, validation)
- [ ] Update this runbook with new learnings

---

## 🆘 Emergency Contacts

**Primary:** [engineering-team@company.com]  
**Secondary:** [ceo@company.com]  
**Vendor Support:** Supabase, Sentry, hosting provider support channels

---

*This runbook should be updated after each incident to capture new failure modes and solutions.*