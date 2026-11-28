# Light & Sky UX

**Status:** Approved production visual target (owner ruling, 2026-11-13; Light & Sky phase 2,
rev 4). This is the visual authority for Light Cards, Environment and Sky controls, and their shell
placement — including the head-strip Sky dial, the World ⚙ environment popover and the selected-light
Card.

`index.html` is the finalized target, moved here from the former `gallery-ux-recovery` roadmap
folder. It is self-contained: open it directly or serve `prototypes/` and open
<http://127.0.0.1:8870/prototypes/light-and-sky-ux/>.

Feature composition, responsive states and the accepted controls come from this page. Shared shell
landmarks, coexistence, mark semantics and escape/return behavior come from
[`docs/design-system.md`](../../docs/design-system.md); the Light and Environment body toggles follow
the appearance target's D12 dock treatment in [`../appearance-ux/`](../appearance-ux/README.md).
Domain meaning and limits stay with [Scene](../../docs/reference/scene.md) and
[architecture](../../docs/reference/architecture.md).

## D8s amendment: fixtures and saved groups (awaiting owner)

[`index.html#fixtures`](./index.html#fixtures) (§9) is the T2 D8s design specimen: the Lights
Library's conditional Fixtures row, ceiling, overhead and wall placement, group-first selection, the
Group Card's Save to My Objects, and detached-copy insertion from My objects, all as one compound
placement journey. `fixtures.js` and `fixtures.css` hold it; the Light Card is reused from §3
unchanged. It needs explicit owner visual acceptance (D8 plan, P6) before D8p starts, and the
approval above does not cover it until then.

| Param | Effect |
| --- | --- |
| `d8=place&item=<lib id>` | Arm placement of a saved group, e.g. `lib-reading` |
| `d8=fixture&item=<fixture id>` | Arm a fixture, e.g. `fixture-wall-sconce` |

