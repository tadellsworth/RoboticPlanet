# Save and recovery audit

November 19, 2026. Tested in local headless Chromium with controlled single-player fixtures.

Follow-up on November 19. Both findings below have been fixed on the working branch. In a phone-sized Chromium viewport, the main menu listed the stored checkpoint after a defeat and page reload. Cancel left the stored state intact, and accepting the restore recovered the Hauler's cargo and updated **Continue**. A simulated quota failure during load kept the old resume save and displayed the **Save → File** warning.

## Checkpoint restoration

The one-minute checkpoint contained a Hauler carrying 2 Ore, a Worker partway through building a Depot, and a Warbot walking to a rally. The test recorded cargo, stock and reservations, construction progress and costs, and the Warbot's position and order. It advanced the simulation by 40 game seconds, opened the Defeat screen, and restored the checkpoint through **Restore checkpoint**.

At the restored tick, every sampled value matched. Forty game seconds later, the results matched uninterrupted play. The Hauler had delivered its 2 Ore once and cleared the reservation, the Depot completed once and recorded 3 Fiber and 2 Cement, and the Warbot reached its assigned rally. Total Ore across the two buildings was 4 before pickup and after delivery.

## Browser reload and older files

- Generated a four-second Colony save using the code at the original base revision, [`f9689e4`](https://github.com/tadellsworth/RoboticPlanet/commit/f9689e4c9ddc3295c48a506b35259e2cd7125dde). Imported it through the main-menu file input. The original seed and Command Base loaded, and the game scheduled its first checkpoint at 1:00. After a page reload, **Continue** opened the saved colony.
- Invalid JSON was rejected and the previous resume save stayed available. A simulated browser quota error during autosave also preserved the previous resume save and displayed a warning.

## Findings

| Priority | Observed behavior | Proposed fix |
| --- | --- | --- |
| High | After defeat, reloading the page before pressing **Restore checkpoint** returns to the main menu with **Continue** hidden. The 1:00 checkpoint was still in IndexedDB. The results screen clears the resume save, and the main menu has no entry point into the stored history. | Keep the last solo run's checkpoint history reachable from the main menu after defeat and reload. Open the checkpoint picker as a deliberate recovery action. |
| Medium | With browser writes to the resume slot blocked, a valid file opened in play and announced “Save file loaded. Welcome back.” The previous **Continue** save stayed in storage. The same loader is used for checkpoint restores. | Confirm the game loaded in memory and report a separate warning if the resume slot could not be updated. Keep the prior resume save and point to **Download save file**. |

Corrected the README's old 20-second reference to match the in-game one-minute checkpoint behavior. The browser checks used local storage and IndexedDB on Chromium. Cloud transfer, real mobile browser storage behavior, and saves older than the tested revision remain open.
