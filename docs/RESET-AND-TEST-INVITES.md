# Reset users & test invite flow

Use this when you want to clear everything and test with two fresh accounts (e.g. two parents and the invite/link flow).

> **Danger zone (dev/staging only):** this procedure permanently deletes calendar rows and auth users.
> Before running it, verify you are in the correct Supabase project and export any data you might need.

## 1. Clear app data in Supabase

1. Open your project in [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** → **New query**.
3. Paste the contents of **`supabase-reset-all.sql`** (the `TRUNCATE` block).
4. Click **Run**. All events, family members, invites, and links are removed.

## 2. Delete all auth users

1. In Supabase: **Authentication** → **Users**.
2. Delete every user (checkbox → Delete, or delete one by one).

You now have no users and no app data.

## 3. (Optional) Email confirmation

For the smoothest testing, you can turn off “Confirm email” so signup goes straight to logged-in:

1. **Authentication** → **Providers** → **Email**.
2. Turn **OFF** “Confirm email” (then new signups can log in immediately without clicking a link).

You can turn it back on later for production.

## 4. Test with two accounts

1. **Account A (inviter)**  
   - Sign up with e.g. `parent1@example.com`.  
   - Add family members / events if you want.  
   - Go to **Settings** → **Inviter til familien** → **Opprett invitasjonslenke** → **Kopier lenke**.

2. **Account B (invitee)**  
   - Open the invite link in a private/incognito window (or another browser).  
   - Sign up with e.g. `parent2@example.com`.  
   - After signup/login, the app accepts the invite and shows A’s family and calendar.

3. **Check**  
   - Both accounts see the same family and events.  
   - B can add/edit events.  
   - B can edit only their own family row (name/color), but **cannot** add/remove family members.  
   - B can go to **Settings** → **Forlat familie** to switch back to their own (empty) calendar.

## 5. Profiles (name + family name)

Run **`supabase-profiles.sql`** once so signup can save display name and family name. After that, new signups get a profile and the app header shows "Familien [name]" and "Du er: [your name]".

## 6. If something breaks

- Ensure **`supabase-invites.sql`** has been run once (invite/link tables and RLS).
- Ensure **`supabase-profiles.sql`** has been run (profiles table for name and family name).
- Ensure **Email** provider is enabled under Authentication → Providers.
- Check the browser console and Supabase → Logs for errors.
