# Critical Flow Smoke Checks (Mobile/iPad)

Run these checks on phone-size and iPad-size viewports before release.

1. Add activity
- Open day view, press `+ Legg til`, save activity.
- Expect: `Lagrer...` then `Lagret`, activity appears.

2. Resolve collision
- Open a background block with collision.
- Choose an action.
- Expect: save feedback shown and no silent failure.

3. Next activity actions
- In `I dag` card, run `Ferdig`, `Bekreft`, `Utsett 15 min`, `Flytt til i morgen`.
- Expect: each action gives save feedback and `Angre` where applicable.

4. School schedule setup
- In child profile, switch to `Timer`.
- Set end time on one lesson.
- Expect: next lesson start is suggested from previous end.
- Use pause chips `+10 min` / `+15 min`.
- Expect: next lesson start adjusts.

5. Invite join role
- Open app with invite token.
- Select `Voksen` or `Barn`, sign in.
- Expect: created member kind matches selected role.
