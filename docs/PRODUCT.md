# ForeldrePortalen – product strategy

## Primary goal

**Polished MVP**: A simple parenting calendar. Focus on nailing the core experience before adding advanced features.

## Target users

- **Flexible** for all family situations (single parent, shared custody, more than two adults, etc.).
- **Primary audience**: Families with 2 parents and 1–3 children. Avoid hardcoding this; keep data model and UX adaptable.

## Infrastructure

- **Supabase**: Dev vs production environments not set up yet. Prefer non-destructive SQL; suggest environment strategy when relevant.

## Post-MVP roadmap

1. **Tankestrømmen** (info dump)  
   Upload voice memos, notes, screenshots, pictures. An AI sorts the content and **automatically adds items to the calendar** as blocks.  
   - Technical: Ingestion pipeline, AI parsing, calendar integration. Use `Event.metadata` / `sourceId` and extension points (e.g. `useAutoFillWeek`) so Tankestrømmen can create events without special-case code in the core calendar.

2. **Mail scraper**  
   Scrape/parse email for event-like information and **auto-add to the calendar**.  
   - Same event model; consider source attribution in metadata and idempotency (avoid duplicate events from the same email).

3. **Norwegian school app integration**  
   When the app has traction in Norway: integrate with Norwegian school apps so school events flow into the same calendar.  
   - Keep person/event model and family structure flexible so “school” can be one source/context among others.

## Conventions

- Norwegian copy and UX throughout.
- Keep `Event.metadata` and automation hooks extensible for Tankestrømmen and mail scraper.
