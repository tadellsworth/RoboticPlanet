# Multiplayer reconnect audit

November 19, 2026. Tested the browser client and local relay from [working-branch commit `7f4c887`](https://github.com/tadellsworth/RoboticPlanet/commit/7f4c887630763b7db8c8755e1c686693438a49ec).

Short interruptions, computer takeovers, and reloading into a running match on the default map recovered in testing. Fix **large snapshot delivery**, **rejoining a paused match**, and **preserving the seat when a player cancels** first. These failures can hold up or prevent a player from returning.

## What recovered

| Scenario | Observed result |
| --- | --- |
| Guest's socket closed for about 3 seconds | The same page reconnected and replayed missed traffic. A relay-accepted Depot order and a second order queued locally during the outage each applied once on both clients. Neither player lost control to the computer. |
| Guest disconnected until the computer took over | The host continued after approximately 12.5 seconds. The guest caught up and regained control. One unsent order was discarded during this recovery, as described below. |
| Host disconnected until the computer took over | The guest continued after approximately 18.4 seconds. The returning host caught up and regained control. |
| Guest reloaded during active play on a default-size map | **Rejoin multiplayer game** restored a full game snapshot. The snapshot contained cargo in transit and a host order for a later turn. Both clients applied that order once. The returning guest could issue an order after rejoining. |
| Guest reloaded during a pause, then the host resumed | The guest received the snapshot and regained control after the resume. |

After each recovery, both browsers matched at three shared whole-second game ticks. Checks covered the game fingerprint, building stocks and reservations, Hauler loads and assignments, the orders under test, and Uplink ownership and victory time.

## Findings and proposed fixes

### High priority — A large snapshot can stop the running match

Start a two-player **Standard** match at **Huge** size (60 × 84), reload the guest's page, then click **Rejoin multiplayer game**. The normal match already serialized to approximately 245,000 characters. The host browser closed during rejoin, and the guest received no game data. An instrumented run recorded a stack overflow and the host stayed on the snapshot turn.

The sender takes a 200,000-character piece and calls the same splitter on it after adding JSON framing. The framing makes the part larger than the split threshold. A bounded trace of the original sender showed part zero repeatedly growing from 200,281 to 202,059 characters, with nothing sent. Split the original snapshot once and send the framed parts through the existing socket queue. Verify reconstruction on Huge and around the size boundary, including snapshots used to repair a sync mismatch. [Sender](../js/net.js#L119-L130) · [Snapshot dispatch](../js/lockstep.js#L280-L302)

A test-only sender change delivered the Huge snapshot in two pieces. The guest regained control, and the inventory, cargo, order, and Uplink checks passed.

### High priority — Rejoining while paused waits for the host to resume

From the host's menu, select **Pause the game for everyone**. Reload the guest and click **Rejoin multiplayer game**. The guest stays on **Joining** across retries. The host has a snapshot queued for the next running turn, but the shared pause keeps that turn from starting. In the test, the host's **Resume** let the guest rejoin with matching state.

Allow the host to send a state snapshot while preserving the shared pause. Verify that pending orders are retained and only apply after resuming. For now, the host can resume while the returning player leaves the join screen open. [Snapshot request](../js/lockstep.js#L194-L203) · [Pause guard](../js/lockstep.js#L366-L376)

### High priority — Cancel removes the returning player's seat from their browser

While waiting on the paused rejoin above, press **Cancel**. The main menu loses its **Rejoin** button. After the host resumes, entering the same room code again returns **That game has already started**. Cancel cleared the local identity the relay uses to recover the original seat.

Keep the saved seat when the player backs out of the join screen. Clear it on a deliberate leave or when the room is confirmed gone. [Cancel handler](../js/mpui.js#L111-L123) · [Rejoin identity](../js/net.js#L58-L70)

### Medium priority — A finished match or two simultaneous reloads leave the join screen waiting

Reload both browser pages and click **Rejoin** on each, or have the guest reload after the host reaches the results screen. In both cases the join screen kept waiting past the automatic retry. With both pages reloaded, neither has a running game snapshot. After the match ends, the connected host queues a snapshot and stops advancing turns.

Give a clear ended-room or unavailable-state response and bound the join wait. Supporting both players reloading at once would require a recoverable match snapshot outside their open pages. [Join retry and end guard](../js/lockstep.js#L366-L376) · [Relay replay](../relay/src/index.js#L93-L98)

### Medium priority — An unsent order can disappear during computer takeover

With the guest's socket down and the game waiting, issue a Depot supply order and keep the guest disconnected through computer takeover. The order was in the guest's local queue. After reconnecting, neither client applied it and the order's completion callback was still waiting. The player only saw the general disconnect and control-return messages.

Mark unconfirmed orders as dropped when control changes and clear their pending callbacks. Tell the player which action needs to be issued again. [Order queue](../js/lockstep.js#L145-L151) · [Control handoff](../js/lockstep.js#L182-L192)

### Lower priority — The host-disconnect countdown reaches zero about six seconds early

Interrupt the host's socket while the guest stays connected. In the test, the guest's banner first showed **0 s** at approximately 12.3 seconds and the computer took over at 18.4 seconds. The banner counts down 12 seconds while the guest's takeover logic allows 18 seconds.

Use the same takeover deadline for the banner and the handoff. [Countdown](../js/mpui.js#L492-L496) · [Takeover deadline](../js/lockstep.js#L385-L393)

## Test setup

The tests used two separate headless Chromium profiles, one desktop-sized and one touch-sized, and the repository's Cloudflare Worker under local Wrangler 4.40.0. The pages used the normal host, join, pause, and rejoin buttons. The harness submitted Depot orders through the same command handler the UI uses, interrupted sockets through Playwright, and sampled each browser at the same simulation ticks. To exercise cargo and an active victory timer in short runs, it seeded road-connected Depots and claimed Uplinks. The Huge-map failure was also reproduced with a normal start.

To reproduce locally, serve the repository root with `python3 -m http.server 8766 --bind 127.0.0.1`. In a second terminal, run `npx --yes wrangler@4.40.0 dev --local --ip 127.0.0.1 --port 8787` from `relay/`. Open `http://127.0.0.1:8766/?relay=ws://127.0.0.1:8787` in two separate browser profiles and start a room.

The results cover local two-player Chromium matches. Live relay behavior, mobile Safari, and three- and four-player rooms need separate verification.
