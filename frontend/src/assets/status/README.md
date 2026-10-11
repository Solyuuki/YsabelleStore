# Status illustration assets

These SVG illustrations are locally vendored for Ysabelle Store full-screen status states.

Source collection:

- unDraw illustrations by Katerina Limpitsouni
- vendored from the MIT-licensed mirror: https://github.com/cuuupid/undraw-illustrations
- official unDraw license: https://undraw.co/license

Ysabelle Store changes the primary unDraw purple accent to product Indigo (#625BFF).
The files remain local to the frontend bundle so offline and service-unavailable screens do not rely
on a third-party network request.

Mapping:

- 401-login.svg -> authenticated session / sign-in state
- 403-security.svg -> permission denied
- 404-lost.svg -> missing route
- 503-maintenance.svg -> service unavailable
- service-unavailable.svg -> backend unreachable
- database-unavailable.svg -> database readiness failure
- offline.svg -> device/network offline
- timeout.svg -> repeated/system timeout
