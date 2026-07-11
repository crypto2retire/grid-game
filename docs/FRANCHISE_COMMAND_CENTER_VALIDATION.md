# Franchise Command Center Validation

Validation-only change to run the full CI pipeline and browser smoke suite against the management-first interface already on `main`.

Checks:
- Franchise dashboard default route
- Persistent desktop and mobile navigation
- Direct Team, Development, Games, League, Market, Facilities and Finance sections
- Development Training, Recovery and Equipment tabs
- Facilities Stadium and Transport tabs
- Active-team selector behavior
- Optional contained Campus view
- No page or console errors during navigation
- Removal of the map-first default workflow

Rerun requested after scoping Playwright selectors and correcting the API lint import.
