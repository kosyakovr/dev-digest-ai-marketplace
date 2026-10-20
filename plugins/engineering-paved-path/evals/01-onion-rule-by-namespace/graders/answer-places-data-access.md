---
type: llm
focus: last_message
---
- The answer says a service must not import the ORM or database client directly.
- The answer says database access belongs in a repository (or an adapter behind a port) that the service depends on.
- The answer does not recommend querying the database from route handlers.
