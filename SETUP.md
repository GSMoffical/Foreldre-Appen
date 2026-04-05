# Parenting Calendar — Supabase setup

Follow these steps so the app can sign you in and store events and family members.

## 1. Create the tables in Supabase

1. Open your [Supabase](https://supabase.com) project.
2. In the left sidebar click **SQL Editor**.
3. Paste the contents of **`supabase-setup.sql`** into the editor and click **Run**.
4. You should see: **Success. No rows returned.** (That’s correct.)

If you already ran an older script and the `events` table is missing **notes** or **location**, run **`supabase-fix.sql`** the same way.

## 2. Enable Email sign-in

1. In Supabase go to **Authentication** → **Providers**.
2. Open **Email** and turn **Enable Email provider** **On**.
3. Save.

## 3. Add your project URL and key

1. In Supabase go to **Project Settings** (gear) → **API**.
2. Copy **Project URL** and **anon public** key.
3. In the `parenting-calendar` folder create a file named **`.env.local`** with:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Restart the dev server: stop it (Ctrl+C) and run `npm run dev` again.

## 4. Shared family / invited parent (**run before launch**)

If a second parent accepts an invite, they must be able to **read the owner’s `family_members` rows** (same list as the owner). That requires RLS policies that include **linked** users, not only `auth.uid() = user_id`.

1. In Supabase **SQL Editor**, run **`supabase-invites.sql`** once (creates `family_links`, `family_invites`, invite RPCs, and updates RLS on `family_members` and `events`).
2. **Launch gate:** run **`supabase-family-members-rls-linked.sql`** if invited users still see an empty family list or load errors. It safely drops all policies on `family_members` and recreates **`family_members_access_owner_or_linked`** (owner **or** user linked via `family_links`).
3. **Verify with two accounts**
   - Owner creates family + invite link.
   - Invitee signs in, opens invite link, accepts.
   - Invitee should see **all family members** under filters / settings (not only themselves).

If you only ever ran **`supabase-setup.sql`** (and not **`supabase-invites.sql`** / **`supabase-family-members-rls-linked.sql`**), invited users only pass RLS for their **own** `user_id`, so they cannot see the owner’s family rows.

## 5. Use the app

1. Open the app in the browser (e.g. http://localhost:5173).
2. **Create account** or **Sign in** with an email and password.
3. You should see the calendar. The first time you load, the app will create your family members in the **family_members** table.
4. Click **+ Add**, fill in an event, and click **Add**. The event is saved to the **events** table.

In Supabase **Table Editor** you can open **events** and **family_members** and refresh to see rows after you’ve signed in and added an event.

## 6. Profiles and invite flow prerequisites (MVP)

For the full MVP journey (name in header + robust invite flow), run these SQL files as well:

1. **`supabase-profiles.sql`** (and if needed **`supabase-profiles-fix.sql`**) so sign-up can store display/family names.
2. **`supabase-invite-target-member.sql`** if you use parent-targeted invites and `linked_auth_user_id`.
3. **`supabase-events-update-rpc.sql`** for owner-safe linked edits.
4. **`supabase-events-insert-recurring.sql`** for atomic recurring series creation.
5. **`supabase-family-members-delete-rpc.sql`** for atomic member + event deletion.

## If something doesn’t work

- **“Could not save event”** in the app: run **`supabase-fix.sql`** so `events` has **notes** and **location**.
- **Sign-in errors**: ensure Email provider is enabled (step 2) and `.env.local` has the correct URL and key (step 3).
- **Empty tables**: tables stay empty until you sign in and use the app (step 5). Create an account, then add an event.
- **Invited parent sees no family / RLS errors on `family_members`**: run **`supabase-family-members-rls-linked.sql`** (see step 4). Confirm **`family_links`** has a row: `user_id` = invitee, `linked_to_user_id` = owner.
- **Recurring save creates only part of a series**: run **`supabase-events-insert-recurring.sql`**.
- **Removing family member leaves inconsistent data**: run **`supabase-family-members-delete-rpc.sql`**.
