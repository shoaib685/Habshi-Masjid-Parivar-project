# Roadmap

- [x] Mobile-first, installable PWA with public dashboard, duty schedule, contribution summary, announcements, and settings
- [x] Single server-authenticated administrator login
- [x] Family management and sequential food-duty scheduling with manual reassignment, skip, and completion records
- [x] Separate mandatory family-fee and voluntary-contribution ledgers
- [x] Admin payment history, announcements, app settings, JSON export, and local rotating backups
- [x] Persistent Node.js + JSON storage implementation
- [x] Public homepage food display and empty state
- [x] Family-specific Web Push subscriptions, VAPID delivery, expired-subscription cleanup, and duplicate-attempt prevention
- [x] Twilio SMS fallback adapter and private notification delivery logs
- [x] Admin-controlled 12-hour IST duty reminder time and automatic Node scheduler
- [x] Authenticated cron endpoint for hosts that cannot keep a background process running
- [ ] Confirm and configure a persistent Node.js hosting provider and protected writable data volume
- [ ] Configure production VAPID and Twilio credentials; verify real push/SMS delivery and hosting behavior
- [ ] Pending-fee reminders and payment-confirmation notifications
- [ ] Printable/downloadable monthly fee ledger and duty rotation calendar PDFs
- [ ] Automated encrypted off-host backups and documented restore procedure
