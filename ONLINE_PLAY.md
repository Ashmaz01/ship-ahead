# Play online

## Service and access

The live client sends HTTPS JSON POST requests to https://ship-ahead-volcano-isle.expertmagpie5.chatgpt.site/api/rooms to create a room, then to the same path followed by /ROOMCODE to join, start, roll, answer, use a power or poll. It polls roughly once per second while a room is active. The server runs on OpenAI Sites using a Cloudflare Worker and D1 database bound as DB. The code and schema are in server/room.js and drizzle/0000_rooms.sql. There is no Firebase, Supabase, peer-to-peer connection, WebSocket, user account, client API key or environment secret. Deployment requires hosting access and a provisioned database. Apply the migration before serving the worker.

A room code lets a new player join before the race starts, up to six seats. The service issues a random bearer token identifying that seat. The browser stores it under ship.room.ROOMCODE in localStorage and sends it in the Authorization header on later requests. An invite URL contains the room code. The device may pass the invite URL to a share target chosen by the player.

## Data sent and stored

- **Creating and joining.** The live client sends the chosen nickname and avatar colour plus the whole setup object. This includes local player names and colours, school band(s), subject, question types, difficulty, timers, weather, and music/effects switches. The server accepts the online nickname (trimmed to 18 characters) and colour. It saves the host’s validated game options. It discards the extra local roster and audio fields and does not replace the host’s options with a joining player’s settings. Names may be nicknames.
- **Playing.** Requests include action, room code in the path, the current revision when available, seat token, and action-specific fields such as answer text or choice index, selected power and target. The server calculates scores and dice results. D1 stores the room code, revision, expiry, members and tokens, game settings and state (board, turns, powers, scores, question history, current question, escape order), recent events and feedback, timers and ending information. A separate presence table holds room code, seat number and last-seen time. The submitted answer is evaluated; feedback and correctness are retained as game state rather than an archive of raw submissions.
- **Network metadata.** Hosting infrastructure receives the connecting IP and ordinary HTTP metadata such as user agent, request path and time. The room application does not read IP or user agent into D1, collect GPS, advertising IDs or hardware identifiers, or set analytics cookies. Hosting access logs and backups are outside the game schema. Their retention and operator access cannot be determined from this repository.
- **Device storage.** Setup preferences (including local names and avatars), story-seen flag, volume settings and room tokens persist in browser/WebView local storage. Clear app data or site storage to remove them. This also removes the ability to reconnect to the same seat with that token.

## Who can see it and for how long

Room participants, including the host, receive member names and colours, shared game settings, current question and choices, visible game state, scores, feedback and standings. The host can start the game and receives the same public view as the other seats. Each client receives only its own bearer token. Server-side storage includes all tokens and the full current question. Parties administering the hosting and database can have access according to their permissions. There is no public room directory or public leaderboard.

A room expires six hours after creation or its latest state-changing update. Ordinary polls that only record presence do not extend that deadline. After expiry the room API refuses access. When another room is created, it deletes expired room rows. Presence rows are linked with ON DELETE CASCADE. Physical cleanup can therefore occur later than six hours. Leaving the screen stops polling and does not immediately erase the room or the local token.

## Offline and Android

Local pass-and-play uses the packaged assets and local game rules. Online play needs a reachable room server. Failed online requests display a connection error. In an existing room polling retries, and the server may skip an inactive turn after about 30 seconds when a later request observes the timeout. Reloading a room link on the same origin can recover the seat while the room and token remain valid. Moves are not queued offline.

The web client uses same-origin /api/rooms requests. A raw file:// launch offers an explicit link to the live online lobby; it contacts the site only if the player follows that link. For a fully bundled Android online client, serve the local client under the production HTTPS origin in WebView, intercept only known static asset paths, and let /api/rooms requests go through to that origin. A locally hosted website can instead serve the included worker on its own origin with DB configured. Merely pointing a different-origin page at the production API will not work: the worker checks Origin. No backend credentials belong in the client.

The existing site/policy text on main describes names as device-only. That description does not cover online requests; reconcile it with the above behavior before publishing a listing for online play.
