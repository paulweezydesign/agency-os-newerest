# Internal Mongo SoR with bidirectional tracker mirrors

Tasks are owned in **MongoDB (AgencyOS)**. Linear and Monday.com are mirrors: **status and assignee** sync both ways; **scope and description** are AgencyOS-only. GitHub is for code/PRs linked by reference, not task SoR. Chosen over AgencyOS-only writes and full bidirectional sync to let humans work in trackers without letting them fork scope away from the PM agent’s source of truth.
