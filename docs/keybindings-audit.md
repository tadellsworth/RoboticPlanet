# Keyboard shortcuts audit

Status: In progress. This inventory covers static map and selected-panel tables. Build tabs, modes, modifiers, dynamic buttons and other handlers still need review.

| Severity | Finding | Location |
| --- | --- | --- |
| Medium | L can select “Add a line” when the same Maglev Terminal panel also offers “Rebuild the missing Terminal.” | `js/ui.js:2694`, `js/ui.js:2721`, `js/ui.js:5271`, `js/ui.js:5284` |
| Unverified | Other same-letter selected-panel buttons require contextual review for overlap. | `js/ui.js:2623` |

| Key | Context | Action | Source |
| --- | --- | --- | --- |
| Q | Selected panel | Send warbots | js/ui.js:2626 |
| Q | Selected panel | Bombard a building | js/ui.js:2627 |
| F | Selected panel | Fire missile | js/ui.js:2628 |
| F | Selected panel | Aim missiles or the Lance | js/ui.js:2629 |
| G | Selected panel | Drive somewhere | js/ui.js:2630 |
| G | Selected panel | Drive somewhere | js/ui.js:2631 |
| E | Selected panel | Deploy here | js/ui.js:2632 |
| G | Selected panel | Make a Gate | js/ui.js:2633 |
| M | Selected panel | Move or cancel move | js/ui.js:2634 |
| M | Selected panel | Pack up to move | js/ui.js:2635 |
| P | Selected panel | Pause or resume production | js/ui.js:2636 |
| E | Selected panel | Repair | js/ui.js:2637 |
| B | Selected panel | Back to order (Army Group) | js/ui.js:2638 |
| H | Selected panel | Hold (Army Group) | js/ui.js:2639 |
| G | Selected panel | Defend area (Army Group) | js/ui.js:2640 |
| P | Selected panel | Patrol (Army Group) | js/ui.js:2641 |
| Q | Selected panel | Attack (Army Group) | js/ui.js:2642 |
| F | Selected panel | Follow (Army Group) | js/ui.js:2643 |
| R | Selected panel | Raid (Army Group) | js/ui.js:2644 |
| V | Selected panel | Select the group | js/ui.js:2645 |
| C | Selected panel | Go to the group | js/ui.js:2646 |
| R | Selected panel | Lay road | js/ui.js:2647 |
| K | Selected panel | Pipe it in | js/ui.js:2648 |
| C | Selected panel | Call back this squad | js/ui.js:2649 |
| C | Selected panel | Send back stationed warbots | js/ui.js:2650 |
| C | Selected panel | Stand down the Lance | js/ui.js:2651 |
| F | Selected panel | Sundering Ray: Strike the Deep | js/ui.js:2652 |
| Q | Selected panel | Sundering Ray: Quake | js/ui.js:2653 |
| C | Selected panel | Stand down the Sundering Ray | js/ui.js:2654 |
| F | Selected panel | Atmosphere Engine: Storm Front | js/ui.js:2655 |
| C | Selected panel | Call the storm off | js/ui.js:2656 |
| C | Selected panel | Call back a rally | js/ui.js:2657 |
| L | Selected panel | Choose the beach | js/ui.js:2658 |
| V | Selected panel | Station here | js/ui.js:2659 |
| V | Selected panel | Evacuate a strike zone | js/ui.js:2660 |
| Z | Selected panel | Bomb it | js/ui.js:2661 |
| N | Selected panel | Napalm | js/ui.js:2662 |
| X | Selected panel | Scorch the earth | js/ui.js:2663 |
| Q | Selected panel | Pick a target | js/ui.js:2664 |
| G | Selected panel | Sail somewhere | js/ui.js:2665 |
| E | Selected panel | Take warbots aboard | js/ui.js:2666 |
| L | Selected panel | Put them ashore | js/ui.js:2667 |
| H | Selected panel | Back to its line | js/ui.js:2668 |
| P | Selected panel | Found a Port | js/ui.js:2669 |
| O | Selected panel | Sail out of the Port | js/ui.js:2670 |
| R | Selected panel | Armor this train | js/ui.js:2671 |
| Q | Selected panel | Attack | js/ui.js:2672 |
| Q | Selected panel | Ally: Attack here | js/ui.js:2673 |
| G | Selected panel | Ally: Defend this area | js/ui.js:2674 |
| H | Selected panel | Ally: Help me | js/ui.js:2675 |
| B | Selected panel | Ally: Hold back | js/ui.js:2676 |
| C | Selected panel | Ally: Back to its own plan | js/ui.js:2677 |
| G | Selected panel | Hold ground | js/ui.js:2678 |
| V | Selected panel | Station | js/ui.js:2679 |
| C | Selected panel | Recall all | js/ui.js:2680 |
| F | Selected panel | Select all warbots | js/ui.js:2681 |
| 1 | Selected panel | Group of 2 | js/ui.js:2682 |
| 2 | Selected panel | Group of 4 | js/ui.js:2683 |
| 3 | Selected panel | Group of 8 | js/ui.js:2684 |
| 4 | Selected panel | Group of all | js/ui.js:2685 |
| Z | Selected panel | Army tab | js/ui.js:2686 |
| X | Selected panel | Air tab | js/ui.js:2687 |
| E | Selected panel | Strike: pick a target | js/ui.js:2688 |
| G | Selected panel | Start or change a trade route | js/ui.js:2689 |
| X | Selected panel | Stop trade route | js/ui.js:2690 |
| E | Selected panel | Toggle trade escort | js/ui.js:2691 |
| L | Selected panel | Link Mooring Masts | js/ui.js:2692 |
| L | Selected panel | Unlink Mooring Masts | js/ui.js:2693 |
| L | Selected panel | Plan a Maglev line | js/ui.js:2694 |
| L | Selected panel | Rebuild a Maglev line | js/ui.js:2695 |
| Z | Selected panel | Call down Security | js/ui.js:2696 |
| X | Selected panel | Call down Crew | js/ui.js:2697 |
| C | Selected panel | Call down Alloy | js/ui.js:2698 |
| V | Selected panel | Call down Chips | js/ui.js:2699 |
| T | Selected panel | Begin Uplink transmission | js/ui.js:2700 |
| C | Selected panel | Stand down the Uplink | js/ui.js:2701 |
| S | Selected panel | Passenger Town: Strip for salvage | js/ui.js:2702 |
| S | Selected panel | Passenger Town: Stop stripping | js/ui.js:2703 |
| E | Selected panel | The Walking Factory: Send warbots aboard | js/ui.js:2704 |
| D | Selected panel | The Dam: Demolish the dam | js/ui.js:2705 |
| D | Selected panel | Megastructure: Demolish it, or seize it | js/ui.js:2706 |
| D | Selected panel | The Dam: Stop demolishing | js/ui.js:2707 |
| U | Selected panel | The Dam: Shore it up | js/ui.js:2708 |
| T | Selected panel | Aim a defence at an enemy | js/ui.js:2709 |
| U | Selected panel | The Dam: Stop shoring up | js/ui.js:2711 |
| B | build | Toggle Build | js/ui.js:2787 |
| P | paths | Toggle Paths on the last tool | js/ui.js:2788 |
| R | paths | Toggle Paths on Roads | js/ui.js:2789 |
| O | paths | Arrows | js/ui.js:2792 |
| G | paths | Bridges | js/ui.js:2793 |
| V | paths | Ramps | js/ui.js:2794 |
| E | paths | Pave | js/ui.js:2795 |
| T | paths | Traffic map | js/ui.js:2796 |
| L | paths | Junctions and traffic lights | js/ui.js:2797 |
| X | paths | Walls (Versus) | js/ui.js:2798 |
| N | paths | Rail | js/ui.js:2799 |
| K | paths | Pipes | js/ui.js:2800 |
| Z | paths | Toggle Route to | js/ui.js:2801 |
| Q | army | Toggle Army panel | js/ui.js:2802 |
| C | army | Recall all warbots | js/ui.js:2803 |
| H, HOME | camera | Go to your Command Base | js/ui.js:2804 |
| M | camera | Toggle minimap | js/ui.js:2805 |
| F | selection | Select all warbots | js/ui.js:2806 |
| I | panels | Statistics: the Economy panel\ | js/ui.js:2810 |
| U | panels | Your robots | js/ui.js:2811 |
| Y | panels | Toggle Economy: your goods, their chains and bottlenecks | js/ui.js:2812 |
| J | camera | Jump to the latest alert (again: the one before) | js/ui.js:2815 |
| [ | game | Slow down | js/ui.js:2816 |
| +, = | camera | Zoom in | js/ui.js:2818 |
| -, _ | camera | Zoom out | js/ui.js:2819 |
| ? | panels | How to play | js/ui.js:2820 |
| , | army | Pick idle warbots (again: the next group) | js/ui.js:2821 |
| TAB | army | Command view: your Army Groups from above (drag one to send it, tap it for its panel) | js/ui.js:2822 |
| . | army | Ping under the pointer for your team (multiplayer; Alt+click too) | js/ui.js:2823 |
| H | Build gather | Select harvester | js/ui.js:2601 |
| Q | Build gather | Select quarry | js/ui.js:2601 |
| R | Build gather | Select mine | js/ui.js:2601 |
| C | Build gather | Select tap | js/ui.js:2601 |
| G | Build gather | Select grower | js/ui.js:2601 |
| F | Build gather | Select farm | js/ui.js:2601 |
| P | Build gather | Select pump | js/ui.js:2601 |
| T | Build gather | Select fueltank | js/ui.js:2601 |
| C | Build make | Select kiln | js/ui.js:2602 |
| M | Build make | Select smelter | js/ui.js:2602 |
| F | Build make | Select fab | js/ui.js:2602 |
| R | Build make | Select refinery | js/ui.js:2602 |
| T | Build make | Select tarworks | js/ui.js:2602 |
| B | Build make | Select foundry | js/ui.js:2602 |
| I | Build make | Select armory | js/ui.js:2602 |
| N | Build make | Select munitions | js/ui.js:2602 |
| Y | Build make | Select reactor | js/ui.js:2602 |
| L | Build make | Select lab | js/ui.js:2602 |
| G | Build make | Select generator | js/ui.js:2602 |
| F | Build move | Select charger | js/ui.js:2603 |
| E | Build move | Select depot | js/ui.js:2603 |
| O | Build move | Select roadworks | js/ui.js:2603 |
| N | Build move | Select station | js/ui.js:2603 |
| G | Build move | Select magterm | js/ui.js:2603 |
| V | Build move | Select mdriver | js/ui.js:2603 |
| C | Build move | Select catcher | js/ui.js:2603 |
| P | Build move | Select port | js/ui.js:2603 |
| I | Build move | Select airfield | js/ui.js:2603 |
| T | Build move | Select mast | js/ui.js:2603 |
| M | Build move | Select terminal | js/ui.js:2603 |
| O | Build defend | Select outpost | js/ui.js:2604 |
| T | Build defend | Select turret | js/ui.js:2604 |
| G | Build defend | Select minigun | js/ui.js:2604 |
| U | Build defend | Select bunker | js/ui.js:2604 |
| K | Build defend | Select keep | js/ui.js:2604 |
| Z | Build defend | Select disruptor | js/ui.js:2604 |
| M | Build defend | Select mortar | js/ui.js:2604 |
| F | Build defend | Select flak | js/ui.js:2604 |
| R | Build defend | Select repair | js/ui.js:2604 |
| I | Build defend | Select silo | js/ui.js:2604 |
| N | Build defend | Select nukesilo | js/ui.js:2604 |
| L | Build mega | Select lance | js/ui.js:2605 |
| Y | Build mega | Select sunder | js/ui.js:2605 |
| H | Build mega | Select dome | js/ui.js:2605 |
| C | Build mega | Select city | js/ui.js:2605 |
| O | Build mega | Select lift | js/ui.js:2605 |
| N | Build mega | Select atmos | js/ui.js:2605 |
| E | Build mega | Select deepcore | js/ui.js:2605 |
| U | Build mega | Select gup | js/ui.js:2605 |
| R | Build terra | Select tf-raise | js/ui.js:2607 |
| L | Build terra | Select tf-lower | js/ui.js:2607 |
| F | Build terra | Select tf-flatten | js/ui.js:2607 |
| H | Build terra | Select tf-fill | js/ui.js:2607 |
| C | Build terra | Select tf-dig | js/ui.js:2607 |
| 1–7 | Build menu | Select Gather, Make, Move, Defend, All, Mega, Terraform | js/ui.js:2609 |
| Shift+W | Map | Open Workforce | js/ui.js:2827 |
| Y | Map | Open Economy | js/ui.js:2811 |
| D | Enemy megastructure panel | Demolish or seize | js/ui.js:2706 |
| W/A/S/D, arrow keys | Map | Pan while held; a focused panel or tool may take precedence | js/ui.js:2590, js/ui.js:3044 |
| ] | Map | Increase game speed | js/ui.js:2817 |
| / | In game | Open or close shortcut sheet | js/ui.js:2842, js/ui.js:2955 |
| Escape | In game | Step back or open pause | js/ui.js:3008 |
| Space | In game | Pause or resume | js/ui.js:3013 |
| Shift+Space, Pause | Single-player game | Plan while paused | js/ui.js:3013 |
| Shift+F | Map | Open Foundry orders, cycle Foundries | js/ui.js:2826 |
| Shift+T | Map | Toggle goods-flow display | js/ui.js:2828 |
| Shift+A | Map, with computer ally | Open ally command panel; otherwise pan | js/ui.js:2829 |
| Shift+V/Y/M/E | Map | Viaduct, Ropeway, Maglev, Express paths | js/ui.js:2615, js/ui.js:2830 |
| F1–F4, Shift+F1–F4 | Map | Recall, or save, a camera view | js/ui.js:3035 |
| 1–9, Ctrl/Cmd/Shift+1–9 | Map | Recall, or save, control group | js/ui.js:2966 |
| Alt+1–6, Alt+Shift+1–6 | Map | Select Army Group, or open its panel | js/ui.js:2993 |
| Ctrl/Cmd+Z | Paths or immediately after placing a site | Undo last stroke or site | js/ui.js:3001 |
| Enter | Active banner | Confirm its main action | js/ui.js:3041 |
| B/N | Bomber target mode | Choose bomb or napalm | js/ui.js:3043 |
| R, Shift+R | Placing blueprint, Mass Driver, Orbital Lift | Rotate; Shift reverses Orbital Lift rotation | js/ui.js:3065 |
| Alt+Enter | Game | Toggle fullscreen | js/ui.js:2999 |
| Shift+P | Game or Photo mode | Enter or exit Photo mode | js/photo.js:304 |
| F | Observer map | Follow the action | js/watch.js:683 |
| Enter / Escape / Tab | Multiplayer chat | Send / close / switch recipient | js/polish3.js:420 |
| Ctrl/Cmd+Enter | Feedback dialog | Send feedback | js/feedback.js:110 |
| Arrow keys, Escape | Contingency globe | Rotate globe; step back or close | js/contingency-ui.js:446 |

Panel button shortcuts take precedence over map bindings (`js/ui.js:3047`); for example, D can trigger Demolish on the relevant visible panel and otherwise pans. This is contextual priority, not by itself proof of a clash. The inventory still requires a complete tooltip and help comparison and a review of dynamic controls.

**Medium — Maglev Terminal L collision.** A Terminal with a missing far Terminal can show its rebuild button (`js/ui.js:5271`–`5276`) and, while it has fewer than three occupied slots and no active site, “Add a line from here” (`js/ui.js:5284`). Both first rebuild and add-line buttons are bound to L (`js/ui.js:2694`–`2695`). `sheetKeyButton` searches bindings in order (`js/ui.js:2721`), so the add-line button wins and L does not rebuild. Give the actions distinct keys or make the advertised key apply unambiguously to the intended button; also account for more than one missing Terminal, whose dynamically suffixed rebuild IDs are not in the binding table. The circumstances and handler order are confirmed from source; actual visual key labels during a live example remain unverified.

| Key | Context | Action | Source |
| --- | --- | --- | --- |
| X | Selected defence panel | Clear a manually aimed target | js/ui.js:2710 |
| Arrow keys | Main menu | Move focus among buttons | js/ui.js:790 |
| Arrow keys, Enter, Escape, Tab | Settings picker | Change choice, choose, close, or cycle focus | js/ui.js:1425 |
| Arrow keys, Home, End, Escape, Tab | Map and biome picker | Navigate cards, close, or cycle focus | js/ui.js:1553 |
| Left/Right, Escape | Lore guide | Turn pages; close enlarged atlas first | js/ui.js:4243 |
| Escape | Save and cloud dialogs | Close the active dialog | js/qol.js:381, js/cloud.js:111 |
| Any non-modifier key | End-result animation | Skip to the end screen | js/ui.js:11276 |
| Any key | Opening briefing | Close briefing and start | js/ui.js:149 |
| Tab, Shift+Tab | Modal screen | Cycle focus within the screen | js/ui.js:2371 |
| Arrow keys | Graphics, time of day, war scars or menu-background settings | Choose a radio option | js/ui.js:179 |
| Arrow keys | Feedback type | Move among feedback categories | js/feedback.js:97 |
| Escape | Records | Close the Records screen | js/goals.js:732 |
| Enter | Multiplayer code | Join the lobby | js/mpui.js:71 |
| Enter | Multiplayer lobby chat | Send message | js/polish3.js:433 |
| Enter, Escape | Army Group name field | Save name, or leave the field | js/ui.js:10952 |
| Enter, Escape | Blueprint name field | Finish editing the name | js/blueprint.js:138 |
| Enter | Workforce preset name field | Finish editing the name | js/workforce.js:297 |
