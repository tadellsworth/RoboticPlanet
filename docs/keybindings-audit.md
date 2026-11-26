# Keyboard shortcuts audit

Status: In progress. This inventory covers static map and selected-panel tables. Build tabs, modes, modifiers, dynamic buttons and other handlers still need review.

| Severity | Finding | Location |
| --- | --- | --- |
| Unverified | Same-letter selected-panel buttons require contextual review for overlap. | `js/ui.js:2623` |

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
