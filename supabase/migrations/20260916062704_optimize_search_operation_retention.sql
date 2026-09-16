-- Retention runs inside the reservation path. This keeps the cleanup bounded
-- as the counter table grows over time.
create index search_operation_limits_period_idx
  on private.search_operation_limits(period);
