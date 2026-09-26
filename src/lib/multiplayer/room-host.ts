/** Shared SQL lease: concurrent requests must choose the same room owner. */
export const HOST_TABLE_SQL = `CREATE TABLE IF NOT EXISTS webrtc_room_hosts (
  room TEXT PRIMARY KEY, peer_id TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now())`;

export const CLAIM_HOST_SQL = `INSERT INTO webrtc_room_hosts (room, peer_id) VALUES ($1, $2)
     ON CONFLICT (room) DO UPDATE SET
       peer_id = CASE WHEN webrtc_room_hosts.last_seen <= now() - interval '120 seconds'
         THEN EXCLUDED.peer_id ELSE webrtc_room_hosts.peer_id END,
       last_seen = CASE WHEN webrtc_room_hosts.peer_id = EXCLUDED.peer_id
         OR webrtc_room_hosts.last_seen <= now() - interval '120 seconds'
         THEN now() ELSE webrtc_room_hosts.last_seen END
     RETURNING peer_id`;
