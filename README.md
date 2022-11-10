# Random Coffee Generator
This is a Google Apps Script script for randomly matching people for a coffee break.
It checks which people have accepted the invite for a Random Coffee meeting in a certain
week, matches those people and then inform them by email.

## Setup the trigger
- Choose which function to run: doProductionRun
- Which runs at deployment: HEAD
- Event source: Time-driven
- Select type of time based trigger: Week timer
- Select day of week: Every Monday
- Select time of day: 6am to 7am
- Failure notification settings: Notify me immediately
