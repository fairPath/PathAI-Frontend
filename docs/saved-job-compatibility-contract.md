# Saved-job match checks

Saving only persists metadata through `POST /saved-jobs/prepare`, leaving a new job
NOT_REQUESTED. Only Saved Jobs details show Check match / Retry match / Check match
again in place of the upper-right star. Search keeps save/remove stars.

The explicit action sends only `{jobId}` to `POST /saved-jobs/compare`. Spring derives
the owner from the JWT and returns 202/PENDING; duplicate pending requests reuse the
request ID. The worker resolves the latest ACTIVE resume key, ID and updated timestamp
on each attempt, and fences completion against resume replacement. No resume snapshots
or snapshot cleanup remain. The owner resets the database; no migration is included.

The existing authenticated batch polling continues only while saved jobs are PENDING.
Results appear automatically and polling stops for terminal or removed jobs.
