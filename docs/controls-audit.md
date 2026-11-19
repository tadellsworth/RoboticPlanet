# Phone and desktop controls audit

November 19, 2026. Tested local Chromium with mouse and keyboard at 1280 × 760 and 1024 × 600, and emulated touch at 390 × 844, 320 × 568, and 640 × 360 landscape. A flat playfield with two Warbots and construction supplies kept the input cases repeatable.

## Verified

- **Desktop.** Pressing **R** opened road drawing. A left drag drafted six tiles. A right drag panned, and wheel zoom kept the draft intact. **Esc** undid the stroke. A box drag selected both Warbots, **Ctrl+1** saved the squad, **1** recalled it, and right-click sent both to a rally.
- **Touch.** A finger drag drafted six road tiles. A two-finger pinch changed map zoom from 30 to about 54 without changing the draft. **Undo** cleared the stroke and **Cancel** returned to the map tools. **Box** selected both Warbots. A tap issued a move and selection-bar **Undo** restored their previous rally destinations.
- **Night and resizing.** The selection title, group button, and test warning stayed within the screen at all five sizes. The checked touch group button was 44 px high and the selection controls needed no horizontal scroll. In the captured scene, unit bodies blended into the dark terrain more than the rally markers did.

## Findings

| Priority | Observed behavior | Proposed improvement |
| --- | --- | --- |
| Medium | At 640 × 360, a routine “Road planned” message hid a Murmur warning that was still in the message list. The landscape layout displays only the newest message, regardless of priority. | Keep an active warning in the single visible slot until it expires or a higher-priority warning arrives. |
| Lower | Tapping a Warbot standing on its rally flag opened the rally panel first. A second tap at the same point selected the unit, as the overlapping-target picker is designed to do. | When a person's own unit shares a target with a flag, make the tap-again hint or an explicit selection action easy to see. |

Touch gestures used Chromium's touch events. Physical iOS and Android devices, Safari trackpad input, and a formal contrast or screen-reader check remain open.
