# Audit result

Result of an audit run against subject is defined using [audit-result.json schema](schemas/audit-result.json).

Result `score` defines how well audit went. Score 100 means perfect audit with no findings. If audit found risks associated with given subject, it will return `risks` list. 

## Risks

Each risk has UUID associated with it for easy referencing.