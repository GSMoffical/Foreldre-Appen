# Synka — GDPR Data Flow Documentation

**Last updated:** <!-- update this date when the document changes -->  
**Status:** Draft — must be reviewed before any real users are onboarded  
**Relevant authority:** Datatilsynet (Norway)

---

## What personal data the app processes

| Data | Category | Where stored |
|---|---|---|
| Email address | Personal data | Supabase Auth (EU region — verify in dashboard) |
| Display name | Personal data | Supabase `profiles` table |
| Family member names (including children's names) | Personal data — children's data is highest protection category | Supabase `family_members` table |
| Calendar events (titles, locations, notes) | Personal data | Supabase `events` table |
| Tasks (titles, notes) | Personal data | Supabase `tasks` table |
| School schedules (timetables, subjects, lesson times) | Personal data — children | Supabase `family_members.profile` JSONB field |
| Uploaded school documents (images, PDFs) | Personal data — children | Sent to Tankestrøm, then to OpenAI. NOT stored by the app after analysis. |
| Invite tokens | Operational data | Supabase `family_invites` table — expire after 7 days |

---

## Third-party data processors

### OpenAI (via Tankestrøm)

**What is sent:** Uploaded school documents (images and PDFs). These may contain
children's names, school names, class names, teacher names, and school schedules.

**Purpose:** AI-powered extraction of calendar events and tasks from school letters.

**Legal basis:** Legitimate interest / consent — must be confirmed before launch.

**Data Processing Agreement (DPA) status:** ⚠️ NOT YET SIGNED  
OpenAI offers a DPA at https://openai.com/policies/data-processing-addendum  
This must be signed before any real user data is processed.

**Data transfer mechanism:** OpenAI is a US company. An adequacy decision or
Standard Contractual Clauses (SCCs) are required under GDPR Article 46.
OpenAI's DPA includes SCCs — confirm this covers the API use case.

**Retention:** OpenAI's API data retention policy must be reviewed and documented
here. As of 2024, API inputs are not used for training by default, but confirm
the current policy and zero-retention option.

### Supabase

**What is stored:** All user and family data listed above.

**Region:** ⚠️ VERIFY — confirm your Supabase project is hosted in an EU region
(e.g. eu-central-1 Frankfurt) in the Supabase dashboard under Project Settings → Infrastructure.

**DPA status:** Supabase offers a DPA. Review at https://supabase.com/privacy

---

## Children's data — special requirements (Datatilsynet)

Norwegian law and GDPR treat children's personal data as requiring extra protection:

- Children under 15 cannot consent on their own behalf — parental consent is required
- Data minimisation: only collect what is strictly necessary
- The Tankestrøm feature processes school documents that likely contain children's data
  — this requires explicit user consent and a clear privacy notice before first use
- **Action required before beta:** Add a consent screen before the Tankestrøm
  document upload feature is accessible to any user

---

## User rights (GDPR Articles 15–22)

The following rights must be implementable before launch:

| Right | Status |
|---|---|
| Right to access (Art. 15) | ⚠️ Not implemented — no data export feature |
| Right to erasure (Art. 17) | ⚠️ Partial — account deletion must remove all tables |
| Right to portability (Art. 20) | ⚠️ Not implemented |
| Right to rectification (Art. 16) | ✅ Users can edit their own data |
| Right to object (Art. 21) | ⚠️ Not implemented |

---

## Action items before any real users are onboarded

- [ ] Sign OpenAI DPA
- [ ] Verify Supabase project is in EU region
- [ ] Review Supabase DPA
- [ ] Add privacy policy page to the app
- [ ] Add consent screen before Tankestrøm document upload
- [ ] Implement account deletion (cascade delete all user data from all tables)
- [ ] Confirm legal basis for each data processing activity
- [ ] Review OpenAI API data retention settings
