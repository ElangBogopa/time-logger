-- Atomic calendar connection resolution
-- Saves calendar connection and cleans up pending record in one transaction.

CREATE OR REPLACE FUNCTION resolve_calendar_connection(
  p_user_id UUID,
  p_pending_id UUID,
  p_action TEXT -- 'calendar_only' or 'cancel'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending RECORD;
BEGIN
  -- Fetch and validate the pending connection
  SELECT * INTO v_pending
  FROM pending_calendar_connections
  WHERE id = p_pending_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending connection not found or does not belong to user';
  END IF;

  -- Check expiry
  IF v_pending.expires_at < NOW() THEN
    DELETE FROM pending_calendar_connections WHERE id = p_pending_id;
    RAISE EXCEPTION 'Connection request has expired';
  END IF;

  IF p_action = 'calendar_only' THEN
    -- Upsert calendar connection
    INSERT INTO calendar_connections (user_id, google_email, google_access_token, google_refresh_token, token_expires_at)
    VALUES (p_user_id, v_pending.google_email, v_pending.google_access_token, v_pending.google_refresh_token, v_pending.token_expires_at)
    ON CONFLICT (user_id)
    DO UPDATE SET
      google_email = EXCLUDED.google_email,
      google_access_token = EXCLUDED.google_access_token,
      google_refresh_token = EXCLUDED.google_refresh_token,
      token_expires_at = EXCLUDED.token_expires_at;
  END IF;

  -- Clean up pending record (both calendar_only and cancel)
  DELETE FROM pending_calendar_connections WHERE id = p_pending_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'cancelled', p_action = 'cancel'
  );
END;
$$;
