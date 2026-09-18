# Phase 5 — P25 Experience Capability Exploration

Conduct deep research into the external ecosystem to help define the **future Experience-authoring capability of Museum Editor**.

This research is intentionally an **exploration and capability-harvest exercise**.

Do **not** spend significant effort auditing or reconciling Museum Editor's current source code.

A separate follow-up review will compare this research against the live Museum Editor implementation.

Your job here is to investigate:

> **What can a strong, focused spatial Experience authoring product become, what capabilities matter most, how mature tools solve them, and where should the product boundary be?**

The goal is to expand the design space before implementation constraints narrow it.

---

# 1. Important research role

Treat the Museum Editor context below as **product constraints and orientation**, not as the subject of the research.

Do not:

```text
read Museum Editor context
→ infer current code
→ audit what already exists
→ spend most of the report reconciling implementation details
```

Instead:

```text
understand product direction
        ↓
explore mature external systems deeply
        ↓
identify patterns/capabilities
        ↓
compare approaches
        ↓
extract reusable product ideas
        ↓
rank what belongs in a focused spatial Experience editor
        ↓
identify experiments and unanswered questions
```

A later planning pass will perform:

```text
external research
+
actual Museum Editor repo
→ reconciliation
→ implementation scope
```

So **do not optimize this research around current implementation compatibility**.

Explore first.

---

# 2. Minimal Museum Editor context

Museum Editor is a web-native visual environment for creating interactive 3D spatial experiences.

Long-term product loop:

```text
Build
→ Stage
→ Direct
→ Experience
→ Preview
→ Publish
→ Revise
```

The product should let creators build a reusable semantic spatial project instead of hand-coding a bespoke Three.js application.

Long-term conceptual product hierarchy:

```text
Project
├─ Spatial
│  ├─ Build
│  ├─ Stage
│  └─ Camera / Direct
│
├─ Experience
│  ├─ Navigation
│  ├─ Content
│  └─ Interactions
│
├─ Assets
└─ Publish
```

Spatial work determines:

```text
what exists
where it exists
how it looks
where cameras can move
how authored camera movement behaves
```

Experience should determine:

```text
how the visitor understands the project
where the visitor can choose to go
what information is presented
what happens when visitors interact
how guided experiences unfold
```

The target user may include:

* artists creating spatial portfolios;
* exhibitions and museums;
* product showcases;
* architectural experiences;
* educational spatial experiences;
* interactive storytelling;
* future AI agents composing the same project semantically.

---

# 3. Product boundary

Museum Editor should be **more expressive than a plain 3D scene editor or virtual-tour viewer**, but substantially simpler and more opinionated than:

```text
Unity
Unreal
Godot
general visual scripting
generic no-code app builders
general website builders
full game engines
full CMS platforms
```

The desired product character is roughly:

> **A focused semantic spatial-experience authoring environment.**

Think:

```text
high-value reusable spatial primitives
+
strong defaults
+
direct manipulation
+
structured visitor experience
```

rather than:

```text
anything can trigger anything through arbitrary programming
```

A major research goal is determining exactly where that boundary should sit.

---

# 4. Architectural constraints to respect conceptually

You do not need to inspect repository code, but recommendations should respect these high-level principles.

## Spatial truth stays spatial

Experience should generally **reference spatial meaning**, not duplicate it.

Examples of useful identities may include:

```text
room
scene object
camera/view
camera path
tour stop
asset
```

Do not recommend storing duplicate XYZ/camera/path geometry merely to drive Experience behavior when semantic spatial references would suffice.

---

## Navigation and camera motion are existing product domains

Museum Editor already has a meaningful Camera/Direct concept.

Assume that:

```text
camera viewpoints
camera connectivity
camera paths
guided ordering
camera motion
```

have an existing spatial authoring domain.

Experience should generally **compose or invoke authored camera/navigation meaning**, not invent a completely separate camera animation engine.

However, feel free to research deeply what higher-level Experience concepts should exist **above** that foundation.

---

## Experience should remain semantic

Prefer concepts such as:

```text
Destination
Content
Tour Stop
Interaction
Trigger
Action
Narration
Chapter
Hotspot
Presentation
Visitor State
```

over arbitrary scripting.

But do not assume these names or abstractions are correct.

Research them.

---

## Human + future-agent authoring

The same authored concepts should eventually be understandable by both humans and AI agents.

A future agent should be able to express things such as:

```text
"Make the piano clickable and show its history."

"Create a guided journey through these five exhibits."

"Show this panel when the visitor arrives at the sculpture."

"Add narration to the Paris section."

"Make these destinations available from the visitor menu."
```

without generating custom frontend application code.

Use this as a test of whether a proposed abstraction is semantic enough.

---

# 5. Primary research question

Answer:

> **What is the strongest reusable Experience-authoring vocabulary for a spatial editor, and what is the smallest subset that creates a complete and compelling visitor experience?**

Explore broadly before narrowing.

---

# 6. Research the Experience landscape as product families

Do not just make a feature checklist.

Understand what different product families are optimized for and what Museum Editor can learn from each.

Deeply investigate:

## Virtual tours

Examples:

* Matterport
* Kuula
* 3DVista
* Pano2VR
* krpano
* Roundme
* similar current tools

Study:

* destinations;
* navigation menus;
* hotspots;
* guided tours;
* media;
* floor plans/minimaps;
* visitor orientation;
* mobile UX;
* sharing/deep links.

---

## Digital exhibitions and museums

Research current:

* virtual museum platforms;
* exhibition builders;
* cultural heritage viewers;
* digital gallery systems;
* educational exhibition experiences;
* open-source museum viewers.

Look especially for systems that combine:

```text
space
+
objects
+
interpretation
+
visitor journey
```

This category should receive more attention than generic game engines.

---

## Spatial storytelling

Research:

* StoryMap-style systems;
* scrollytelling;
* interactive documentary systems;
* location-based stories;
* narrative tours;
* virtual guided experiences;
* interactive cultural heritage projects.

Study:

```text
chapters
stops
story beats
progression
narration
branching
return/rejoin
content sequencing
```

---

## Narrative engines

Study systems such as:

* Ink
* Yarn Spinner
* Twine
* lightweight dialogue/story frameworks

Do not assume their variable/state-machine models belong in Museum Editor.

Extract only what is useful for:

```text
guided spatial narratives
visitor choices
content sequencing
event semantics
```

---

## Web 3D experience tools

Research:

* Spline
* PlayCanvas
* Babylon.js editor/tooling
* A-Frame ecosystem
* Three.js experience frameworks
* React Three Fiber ecosystem
* Threlte ecosystem
* web-native scene/interaction editors
* current AI/web-3D tools

Study how they expose:

```text
object interaction
camera transitions
events
content
animation
hotspots
runtime behavior
```

---

## Game engines

Study:

* Godot
* Unity
* Unreal

But use them as **capability and UX reference**, not as scope targets.

Focus on:

```text
event architecture
Inspector interaction authoring
signals
collision/trigger concepts
timeline/cutscene systems
camera direction
UI overlays
state
debugging
```

Ask:

> Which game-engine ideas are valuable when radically simplified?

---

## Interactive learning systems

Research:

* H5P
* ThingLink
* interactive lesson builders
* guided learning experiences
* branching educational content

These may provide particularly useful patterns for:

```text
hotspots
content
question/response
guided progression
multimedia
```

without game-engine complexity.

---

# 7. Go beyond the obvious reference list

Actively discover additional strong systems.

Search:

```text
GitHub
product documentation
engineering blogs
academic papers
YouTube demos
community discussions
Reddit
developer forums
conference talks
open-source projects
current commercial tools
```

Particularly valuable are systems where actual user workflows can be observed.

Do not restrict the research to the projects named in this prompt.

---

# 8. Navigation as an Experience capability

Explore deeply how mature products model visitor destinations.

Questions:

* What is a destination?
* Is it a camera/view?
* A room?
* An exhibit?
* A spatial location?
* A semantic section?
* Can one destination have several views?
* Can one view belong to several visitor-facing destinations?
* How are destinations labeled?
* Can destinations be grouped?
* How are they exposed through menus?
* Can destinations be hidden from navigation but still reachable?
* How does a creator choose the entry destination?
* How does Back work?
* How does Next work?
* How does navigation history work?
* What does “Home” mean?
* What happens when guided and free navigation coexist?

Explore multiple conceptual models.

---

# 9. Navigation UI

Study visitor navigation patterns:

```text
sidebar
drawer
bottom sheet
destination list
room list
section list
breadcrumbs
Next / Back
progress bar
minimap
floor plan
3D waypoint markers
search
table of contents
```

Research:

* discoverability;
* orientation;
* small screens;
* information density;
* accessibility;
* guided versus free experiences.

Rank which patterns are most reusable across:

```text
museum
portfolio
product showcase
architecture
education
storytelling
```

---

# 10. Guided experiences

Explore what “guided journey” should mean.

Compare:

```text
ordered destinations
chapters
tour stops
timeline
story steps
camera sequence
narrative sequence
```

Questions:

* Does a tour need a first-class `Stop`?
* Should content belong to a stop or destination?
* How should pause/rest time work?
* Should narration be part of the stop?
* Can a destination occur twice?
* Should a repeated destination have different content each time?
* How does the visitor deviate and rejoin?
* Can visitors skip stops?
* Can they resume?
* Should tours expose progress?
* Should multiple tours eventually exist?

Study strong examples deeply.

---

# 11. Chapters and storytelling structure

Explore whether spatial experiences benefit from higher-level structure:

```text
Experience
└─ Chapter
   └─ Stop
      └─ Destination
```

or whether this is unnecessary hierarchy.

Compare:

* flat destinations;
* grouped navigation;
* explicit chapters;
* narrative steps.

Identify which abstractions give genuine creator leverage.

---

# 12. Hotspots

Explore different hotspot concepts.

Potential forms:

```text
interactive Scene object
world-space marker
screen-space annotation
spatial point
camera-linked hotspot
room hotspot
surface hotspot
```

Study:

* visual affordance;
* hover/focus;
* occlusion;
* distance scaling;
* labels;
* clustering;
* overlap;
* mobile hit targets;
* gaze/VR;
* keyboard alternatives;
* authoring UX.

Question whether “hotspot” should be a dedicated entity or merely one presentation of a broader Interaction concept.

---

# 13. Object interaction

Explore semantic object interactions:

```text
click artwork
click product
click sculpture
click door
click sign
click display screen
```

Potential outcomes:

```text
show information
navigate
highlight
focus camera
play media
open link
reveal something
compare variants
```

Research what combinations occur frequently enough to deserve product primitives.

---

# 14. Trigger/event vocabulary

Explore triggers/events broadly.

Possible categories:

```text
visitor activates object
visitor reaches destination
visitor enters room
visitor enters proximity
visitor leaves area
camera reaches cue
tour stop begins
tour stop ends
content closes
audio finishes
timer
```

Do not assume all belong.

Determine:

```text
high-frequency semantic event
advanced but useful
game-engine creep
```

---

# 15. Actions

Explore action vocabularies across mature systems.

Possible:

```text
ShowContent
Navigate
OpenLink
PlayAudio
PlayVideo
Highlight
ShowObject
HideObject
ChangeMaterial
PlayAnimation
StartTour
PauseTour
ContinueTour
FocusObject
SetVariable
SendEvent
```

For each ask:

* how common is the use case?
* does it compose with spatial authoring?
* does it introduce runtime state?
* is it agent-friendly?
* does it require another subsystem?
* would normal creators understand it?
* does it create game-engine pressure?

Produce a strong ranked action vocabulary.

---

# 16. One action vs action sequences

Investigate whether interactions should support:

```text
one event → one action
```

or:

```text
one event → multiple actions
```

or:

```text
one event → ordered action sequence
```

Study real workflows.

Examples:

```text
reach exhibit
→ show panel
→ play narration
→ highlight object
```

Questions:

* Is ordering necessary?
* Is parallel execution sufficient?
* Should actions have duration?
* Can an action await another?
* When does this become visual scripting?

Identify the simplest useful model.

---

# 17. Conditions

Explore conditions without assuming they belong.

Examples:

```text
first visit only
if narration completed
if visitor chose A
if object currently visible
if destination visited
```

Classify:

```text
essential Experience semantics
advanced narrative capability
general programming/state-machine creep
```

Pay special attention to very small useful condition vocabularies such as:

```text
once
first visit
visited / not visited
```

which may provide high value without arbitrary variables.

---

# 18. Visitor state

Explore useful runtime state:

```text
current destination
visited destinations
tour progress
open panel
currently playing media
selected branch
revealed content
```

Distinguish:

```text
ephemeral session state
persisted browser state
account-backed state
authored project truth
```

Ask what P25-like foundations need versus later products.

---

# 19. Contextual content

Study how spatial experiences communicate information.

Possible content:

```text
title
subtitle
description
image
image gallery
audio
video
metadata
credits
link
CTA
download
3D comparison
```

Investigate:

* appropriate content density;
* reading in a 3D context;
* mobile presentation;
* reusable content resources;
* accessibility;
* distraction from the 3D scene.

---

# 20. Content presentation patterns

Compare:

```text
side panel
bottom sheet
modal
popover
floating card
world-space annotation
caption
full-screen story page
persistent HUD
```

Analyze which forms work for:

* desktop;
* mobile;
* VR/AR;
* keyboard;
* accessibility.

Determine whether a focused product should offer a **small presentation vocabulary** instead of arbitrary UI composition.

---

# 21. Info panels

Research the specific “exhibit info panel” primitive deeply.

What should it support?

Potential:

```text
title
subtitle
image
body
audio
CTA
credits
related destinations
```

How do current museum/tour products handle these?

Could one strong Info Panel primitive cover a large percentage of P25 value?

---

# 22. Audio

Research audio as a first-class spatial Experience capability.

Study:

```text
narration
ambient music
location-triggered audio
object audio
tour narration
voiceover
sound effects
spatial audio
```

Questions:

* autoplay restrictions;
* visitor consent;
* mute controls;
* play/pause;
* transcript;
* multiple audio sources;
* interruption policy;
* navigating away;
* resuming;
* mobile Safari;
* accessibility.

Compare museum audio-guide systems.

---

# 23. Narration

Treat narration separately from generic audio.

Potential primitive:

```text
Narration
├─ audio
├─ transcript
└─ associated destination/stop/content
```

Research whether this deserves a semantic first-class concept.

This is particularly relevant to exhibitions and guided storytelling.

---

# 24. Video

Study:

```text
overlay video
inline panel video
world-space screen
autoplay background video
```

These imply very different architectures.

Determine which belong in a focused Experience editor.

---

# 25. Image galleries

Investigate whether image galleries/carousels are frequently useful in exhibition/product contexts.

Could they belong in Info Panel rather than requiring generic layout tools?

---

# 26. External links / CTA

Research:

```text
Learn More
Buy
Download
Visit Website
Read Article
Open Related Project
```

This matters for artist portfolios and product showcases.

Consider:

* external destination safety;
* author UX;
* visitor trust;
* analytics;
* mobile behavior.

---

# 27. World-space labels and annotations

Deeply investigate:

```text
labels
captions
callouts
leader lines
object annotations
room signage
```

Consider:

* occlusion;
* density;
* distance;
* screen-space projection;
* camera orientation;
* collisions;
* accessibility;
* mobile.

Classify when a world-space annotation is better than a normal information panel.

---

# 28. Attention direction

Explore ways creators guide visitor attention without forcing navigation.

Examples:

```text
highlight object
spotlight
outline
dim surroundings
camera Look At
animated pulse
annotation
arrow
audio cue
```

This may become an important semantic layer between Stage and Experience.

Study museum/exhibition/product-showcase patterns.

---

# 29. Camera direction from an Experience perspective

Do not research basic camera implementation.

Instead investigate **higher-level visitor direction concepts** such as:

```text
reveal
push in
orbit
establishing view
hero shot
rest
hold
attention cue
cut
fade
```

Ask:

* which concepts should belong to Spatial/Camera?
* which should merely be invoked by Experience?
* which become semantic authored direction primitives?

Use Cinemachine, film-editing systems, virtual-production tools, product configurators and tour platforms as references.

---

# 30. Temporal cues

Research the concept of semantic cues emitted during camera/tour playback:

```text
arrived
transition halfway
reveal moment
stop begins
stop ends
```

Could Experience listen to such cues without owning the camera timeline?

Study similar systems.

---

# 31. Interaction authoring UX

Investigate authoring patterns:

```text
Inspector
table/list
wizard
property panel
behavior cards
rule builder
timeline
node graph
direct manipulation
```

Examples:

```text
When:
Visitor activates Piano

Do:
Show "Piano Information"
```

Compare usability for non-programmers.

Strongly identify where a node graph is unnecessary.

---

# 32. Interaction vocabulary UX

Study whether creators understand:

```text
Event
Trigger
Condition
Target
Action
Behavior
Interaction
Effect
```

Find vocabulary used by successful no-code/interactive systems.

Determine terminology that is:

```text
clear to creators
precise enough for agents
not excessively technical
```

---

# 33. Content authoring UX

Explore:

* create content from selected object;
* reusable content library;
* inline editing;
* asset picker;
* preview;
* content templates;
* duplication;
* reference usage;
* deleting referenced content.

Look for low-friction patterns.

---

# 34. Experience workspace design

Explore possible Experience-mode layouts.

Potential:

```text
Navigation / Content / Interactions
```

but do not assume those should literally be three tabs.

Study alternatives:

```text
Journey
Content
Behaviors
```

or:

```text
Experience tree
+
3D Preview
+
Inspector
```

or Inspector-first authoring.

Compare against mature tools.

---

# 35. Same-world editing

Explore UX where Experience authors look at the **same 3D project**, but through a different authoring lens.

Potential overlays:

```text
interactive target markers
destination markers
content badges
navigation badges
trigger visualization
tour progress
```

Study systems that overlay semantic authoring information on a scene without modifying the scene itself.

---

# 36. Preview and simulation

Research how creators test interactions.

Potential:

```text
Preview Experience
simulate trigger
jump to destination
show interaction targets
show event log
reset visitor
simulate first visit
simulate reduced motion
mobile preview
```

Find which debugging tools yield the biggest productivity gains.

---

# 37. Runtime debugging

Investigate lightweight authoring diagnostics.

Examples:

```text
event fired
action executed
missing target
content unavailable
navigation unreachable
```

Do not design developer consoles unless necessary.

Find creator-friendly alternatives.

---

# 38. Accessibility

Explore deeply, independently of Museum Editor's current state.

Research accessibility for spatial/WebGL experiences:

```text
keyboard
screen reader
focus
reduced motion
motion sickness
touch
zoom
contrast
captions
transcripts
audio descriptions
alternative navigation
```

Use:

* WCAG guidance;
* accessible WebGL/3D examples;
* Babylon accessibility work;
* model-viewer;
* accessible game/UI research;
* museum digital-accessibility guidance.

---

# 39. Semantic DOM companion experience

Investigate whether strong spatial runtimes should expose an accessible DOM representation alongside the 3D scene.

For example:

```text
3D destination
+
DOM navigation item

interactive object
+
DOM-accessible interaction

3D information
+
normal semantic article/panel
```

Evaluate benefits and limitations.

---

# 40. Reduced-motion semantics

Research what reduced motion should mean in spatial navigation.

Compare:

```text
instant jump
crossfade
very short transition
reduced rotation
fixed camera
alternative navigation
```

Find best practices.

---

# 41. Visitor comfort

Research:

* camera speeds;
* rotation;
* acceleration;
* FOV changes;
* vertical travel;
* unexpected motion;
* autoplay;
* camera takeover.

Determine what the platform should automatically constrain or warn about.

---

# 42. Mobile visitor UX

Deeply study:

```text
tap interactions
drag look
swipe navigation
bottom sheets
gesture conflicts
safe areas
orientation
fullscreen
browser chrome
performance
```

Do not assume desktop interaction simply shrinks down.

---

# 43. Onboarding visitors

How do successful 3D experiences teach controls?

Explore:

```text
first-run tutorial
control hints
interactive prompt
navigation menu as escape hatch
guided opening
```

Could platform-generated onboarding remove author burden?

---

# 44. Wayfinding and disorientation

Study why visitors get lost in virtual spaces.

Investigate:

```text
landmarks
room names
menu
breadcrumbs
minimap
progress
visited indicators
return home
history
```

Use research from:

* virtual museums;
* games;
* VR;
* architectural visualization;
* virtual tours.

---

# 45. Visitor map/minimap

Explore whether a visitor-facing Plan/map is useful.

Possible:

```text
full Plan
simplified map
room diagram
destination map
progress map
```

Study automatic derivation versus creator authoring.

---

# 46. Search

Investigate whether destination/content search is useful for larger experiences.

Likely later, but assess evidence.

---

# 47. Deep links and shareable destinations

Research:

```text
/project
/project#piano
/project/room/paris
```

Benefits:

* sharing;
* marketing;
* education;
* linking from external sites;
* browser history.

Determine semantic requirements.

---

# 48. Multiple tours

Explore:

```text
Main Tour
Kids Tour
Architecture Tour
Artist Commentary
```

This may become a major reuse capability.

Determine what schema pressure it creates and whether a first version should anticipate it.

---

# 49. Branching journeys

Explore:

```text
choose left/right
choose topic
skip ahead
optional detour
```

Study how spatial branching differs from dialogue branching.

Determine whether normal free navigation already covers most needs.

---

# 50. Rejoin/resume

If visitors leave a guided route:

* what happens?
* can they resume?
* where?
* should progress survive?

Explore strong patterns.

---

# 51. Experience templates

Investigate whether reusable Experience templates could become powerful:

```text
Gallery Tour
Product Showcase
Architecture Walkthrough
Artist Portfolio
Guided Story
```

What reusable structures could they bundle?

Potential:

```text
navigation pattern
content presentation
visitor chrome
camera semantics
interaction defaults
```

This is important to the long-term reuse thesis.

---

# 52. Experience presets versus templates

Distinguish:

```text
small behavior preset
```

from:

```text
whole experience template
```

Explore both.

---

# 53. Visitor UI themes

Research bounded presentation customization:

```text
accent
logo
typography
panel style
navigation placement
```

Where does useful branding end and website-builder complexity begin?

---

# 54. Product showcase patterns

Research current 3D product experiences:

* configurators;
* product launches;
* virtual showrooms;
* product inspection;
* ecommerce 3D.

Extract reusable primitives:

```text
hero view
feature hotspot
spec panel
variant
CTA
orbit
comparison
```

---

# 55. Artist portfolio patterns

Research immersive artist/creative portfolios.

What matters?

```text
artwork navigation
artist statement
caption
media
guided story
free exploration
contact/CTA
```

---

# 56. Architectural experience patterns

Research:

```text
guided walkthrough
room menu
floor plan
material information
design notes
before/after
section navigation
```

---

# 57. Museum/exhibition patterns

Go particularly deep here.

Study:

```text
curatorial narrative
object interpretation
audio guide
chronology
room sequencing
optional detail
wayfinding
credits
provenance
accessibility
```

Find which concepts generalize beyond museums.

---

# 58. Educational experiences

Explore:

```text
guided explanation
questions
progress
reveal
comparison
quiz
```

Determine which educational behaviors are broadly reusable versus domain-specific.

---

# 59. Calls to action / business utility

Spatial experiences need useful exits.

Research:

```text
contact
book visit
purchase
request information
open product page
download
share
```

This may matter for product-market usefulness more than exotic interactions.

---

# 60. Visitor analytics semantics

Research useful semantic events:

```text
experience entered
destination visited
content opened
tour completed
CTA activated
```

Do not design an analytics backend.

Determine whether the authored/runtime vocabulary naturally supports future analytics.

---

# 61. AI authorability

For every major proposed abstraction, test whether an AI could use it naturally.

Examples:

```text
"Create an info panel for every artwork."

"Make these five camera views into a tour."

"When the visitor reaches the final room, show the credits."

"Add narration to the first three stops."

"Create a navigation menu grouped by room."
```

Prefer abstractions that support intent like this without arbitrary code.

---

# 62. Agent inspection

Explore what semantic project information future agents would need:

```text
available destinations
available content
interactions
tour structure
missing references
visitor warnings
```

The goal is not to design an API now.

Use agent addressability as an abstraction-quality test.

---

# 63. Semantic operation vocabulary

At the conceptual level, explore useful operations such as:

```text
createDestination
createContent
attachContent
createInteraction
createTour
addTourStop
setEntryDestination
setNavigationGroup
```

Do not worry about current Museum Editor function names or implementation seams.

Research the right **domain verbs**.

---

# 64. Data model alternatives

Compare conceptual models.

For example:

### Model A

```text
Destination
Content
Interaction
```

### Model B

```text
Experience
→ Chapter
→ Stop
→ Behaviors
```

### Model C

```text
Entities
+
Events
+
Actions
```

### Model D

```text
Presentation graph
```

Compare:

* clarity;
* reuse;
* complexity;
* agent authorability;
* guided/free navigation;
* persistence;
* extension pressure.

---

# 65. Interaction model alternatives

Explicitly compare:

```text
Event → Action
Event → Target → Action
Trigger → Condition → Action
Behavior component
Rule
State machine
Node graph
```

Do not automatically select the most expressive model.

Find the smallest robust model.

---

# 66. Content model alternatives

Compare:

```text
content embedded on object
content resource referenced by object
content attached to destination
content attached to tour stop
content attached through interaction
```

Identify reuse and maintenance consequences.

---

# 67. Destination model alternatives

Compare:

```text
destination = camera
destination references camera
destination references arbitrary spatial identity
destination owns preferred view
destination = tour stop
```

Identify strengths and failure modes.

---

# 68. Story/tour model alternatives

Compare:

```text
ordered destinations
ordered stops
timeline
chapter graph
sequence + event bindings
```

Identify which remains simple while supporting compelling experiences.

---

# 69. State-model alternatives

Compare:

```text
no variables
fixed visitor state
small predefined conditions
arbitrary key/value variables
full state machine
```

Find the boundary where flexibility stops paying for itself.

---

# 70. Runtime representation

Research general best practices for keeping authored Experience semantics separate from renderer implementation.

Compare:

* JSON sidecar/domain model;
* glTF metadata;
* scene graph components;
* ECS-style behavior data;
* declarative rule models.

Do not recommend a format solely because it is standard.

Judge:

```text
portability
semantic clarity
tooling
versioning
cross-resource references
agent friendliness
```

---

# 71. Open standards

Investigate whether any meaningful standards exist for:

```text
3D annotations
tours
interactive scenes
museum metadata
guided experiences
hotspots
```

Examples may include:

* glTF extensions/extras;
* IIIF;
* Web Annotation;
* 3D Tiles metadata;
* KML tours;
* USD metadata;
* MPEG-related interactive media;
* cultural heritage schemas.

Identify useful interoperability opportunities without forcing standards where they fit poorly.

---

# 72. IIIF / cultural heritage

Research IIIF specifically if relevant to:

```text
images
annotations
metadata
museum content
```

Could it inform Experience content without becoming project architecture?

---

# 73. Web Annotation

Investigate W3C Web Annotation or similar models for:

```text
target
body
motivation
```

Potential parallels to:

```text
spatial target
content
interaction
```

Evaluate whether concepts are reusable.

---

# 74. Performance of Experience features

Explore performance implications of:

```text
many hotspots
DOM overlays
annotations
audio
video
interaction raycasts
proximity triggers
world labels
visitor map
```

Look for scalable architecture patterns.

Do not set Museum-specific budgets.

---

# 75. Progressive loading and Experience

Research whether content/navigation should remain usable while 3D assets load.

Potential:

```text
menu first
content first
progressively available destinations
low-detail geometry
```

This could be important for web usability.

---

# 76. Failure behavior

Study how strong visitor experiences behave when:

```text
asset fails
video fails
audio fails
destination unavailable
network slow
WebGL unavailable
```

Identify platform-level fallbacks.

---

# 77. Reset / restart

Explore whether spatial experiences should provide:

```text
Restart Tour
Return Home
Reset Experience
```

and what state should reset.

---

# 78. Session persistence

Research whether visitor progress commonly survives reload.

Classify:

```text
useful
nice-to-have
wrong complexity
```

---

# 79. Localization

Explore how spatial Experience content can later support multiple languages.

Do not design a translation platform.

Identify schema choices that would avoid painting the product into a corner.

---

# 80. Accessibility metadata

Study semantic content requirements such as:

```text
title
accessible label
alt text
transcript
audio description
```

Which can be derived?

Which should authors provide?

---

# 81. Visitor preferences

Research useful runtime preferences:

```text
reduced motion
mute
volume
text size
high contrast
navigation mode
```

Which should be automatic platform behavior versus project-specific settings?

---

# 82. WebXR / immersive modes

Explore sufficiently to understand future pressure from:

```text
VR
AR
gaze
controllers
teleport
```

But do not make WebXR a required target.

Ask which Experience abstractions remain valid across desktop/mobile/XR.

---

# 83. Input independence

A strong semantic model ideally maps:

```text
mouse click
touch tap
keyboard activation
gaze activation
controller activation
```

to one semantic event such as:

```text
Activate
```

Research whether this abstraction holds in practice.

---

# 84. Product-level automatic behavior

Identify things the platform should handle automatically rather than making authors configure them.

Examples:

```text
keyboard equivalents
focus management
reduced motion
responsive content panels
touch target sizing
navigation history
loading state
accessible labels
```

This is an important source of product value.

---

# 85. Creator burden

For every major capability ask:

> Does this make the creator configure implementation details, or express visitor intent?

Prefer:

```text
"When visitor reaches Piano, show Piano Info."
```

over:

```text
"Register callback on camera tween completion and mount component."
```

---

# 86. Progressive disclosure

Research how sophisticated authoring products expose depth without overwhelming users.

Potential levels:

```text
simple preset
Inspector controls
advanced rule
```

Determine useful patterns for Experience authoring.

---

# 87. Complexity cliffs

Identify features that appear small but force large architectural complexity.

Examples might include:

```text
arbitrary variables
action sequencing
persistent conditions
nested tours
custom scripting
timeline synchronization
world-space UI
video surfaces
```

Map these cliffs explicitly.

---

# 88. Reuse leverage

Rank capabilities by how reusable they are across projects.

High-value primitive example:

```text
Destination
```

might support:

```text
museum navigation
product feature navigation
architecture walkthrough
portfolio sections
guided tours
agent commands
```

Prefer reusable primitives.

---

# 89. Template leverage

Ask which combinations of primitives could later become templates.

Example:

```text
Product Showcase
= Hero Destination
+ Feature Hotspots
+ Specification Content
+ Orbit/inspection behavior
+ CTA
```

This helps test whether the vocabulary composes well.

---

# 90. Required deliverable A — Capability landscape

Produce a broad structured map of Experience capabilities.

Example:

```text
Experience
├─ Navigation
├─ Journey / Story
├─ Content
├─ Interaction
├─ Media
├─ Attention
├─ Visitor UI
├─ Accessibility
├─ State
├─ Preview / Debug
└─ Reuse / Templates
```

Improve this taxonomy based on evidence.

---

# 91. Required deliverable B — external reference ranking

Rank at least **20 high-value references**, if enough serious systems exist.

For each:

| System | Category | Key capability | Why it matters | Accessible source/evidence | Main lesson |

Include a mix of:

```text
open source
commercial products
research
museum-specific systems
game engines
web 3D
narrative tools
```

---

# 92. Required deliverable C — exact open-source implementation index

For important open-source references record:

```text
Repository
URL
Version / commit
License
Relevant files/modules/classes
Behavior studied
Reuse mode:
REUSE
ADAPT
STUDY
AVOID
```

This research may inspect implementation details of **external projects** extensively.

It does not need to inspect Museum Editor source code.

---

# 93. Required deliverable D — interaction taxonomy

Produce a researched taxonomy of:

```text
Events
Conditions
Actions
Targets
Runtime state
```

Rank each item:

```text
CORE
HIGH-VALUE DEPTH
FOLLOW-UP
WRONG PRODUCT
```

---

# 94. Required deliverable E — navigation taxonomy

Map:

```text
destinations
menus
groups
guided traversal
free traversal
history
Back/Next
Home
map/minimap
deep linking
multiple tours
```

Recommend conceptual relationships.

---

# 95. Required deliverable F — content taxonomy

Map and rank:

```text
text
image
gallery
audio
narration
video
links
CTA
credits
metadata
world annotations
```

---

# 96. Required deliverable G — guided-journey models

Compare at least **4 conceptual models** for guided spatial experiences.

For example:

```text
ordered destinations
tour stops
chapter/stop hierarchy
camera sequence + Experience bindings
narrative graph
```

Analyze:

* simplicity;
* expressiveness;
* branching;
* repeated destinations;
* authoring UX;
* agent usability.

---

# 97. Required deliverable H — Experience data-model alternatives

Propose **3–5 conceptual architectures**, not implementation schemas.

Evaluate:

```text
clarity
reuse
extension pressure
spatial-reference model
agent authorability
visitor runtime complexity
```

---

# 98. Required deliverable I — authoring UX alternatives

Compare:

```text
Inspector-first
Experience workspace
rule list
wizard
timeline
node graph
direct scene overlays
hybrid
```

Recommend which patterns suit which capability.

---

# 99. Required deliverable J — visitor UX patterns

Produce concrete visitor UX recommendations for:

```text
desktop
mobile
keyboard
reduced motion
screen reader
```

Include navigation and content presentation.

---

# 100. Required deliverable K — accessibility contract candidates

Separate possible platform responsibility into:

```text
AUTOMATIC RUNTIME GUARANTEE
AUTHOR-REQUIRED SEMANTIC INPUT
OPTIONAL AUTHOR ENHANCEMENT
```

---

# 101. Required deliverable L — museum/exhibition deep dive

Create a dedicated section specifically for:

```text
museum
gallery
cultural heritage
educational exhibition
```

Identify patterns that generic game-engine research misses.

---

# 102. Required deliverable M — portfolio/product/architecture comparison

Compare how the same Experience vocabulary would serve:

```text
artist portfolio
museum exhibition
product showcase
architecture walkthrough
educational experience
```

Highlight common primitives.

---

# 103. Required deliverable N — semantic operation vocabulary

Propose the high-level verbs a creator or future agent might use.

Example shape:

```text
createDestination
createInfo
attachInfo
createTour
addStop
bindInteraction
setEntry
groupNavigation
addNarration
```

Do not worry about code/API implementation.

---

# 104. Required deliverable O — capability value matrix

For every major capability rate:

```text
creator value
visitor value
reuse across project types
agent value
complexity
state complexity
runtime cost
accessibility cost
game-engine creep risk
```

Use relative ratings.

---

# 105. Required deliverable P — complexity-cliff analysis

Explicitly identify capabilities where apparently modest UX requires disproportionately large architecture.

Explain why.

---

# 106. Required deliverable Q — “automatic platform behavior” list

Identify what Museum Editor should ideally provide automatically rather than expose as author configuration.

This is important to keeping the product simple.

---

# 107. Required deliverable R — template opportunities

Propose **5–10 possible future experience templates** composed from the researched primitives.

Examples only:

```text
Guided Gallery
Artist Portfolio
Product Showcase
Architecture Tour
Historical Narrative
Educational Exhibit
```

Use them to test vocabulary completeness.

---

# 108. Required deliverable S — core vs advanced boundary

Create four explicit zones:

```text
ZONE 1 — Core reusable Experience primitives

ZONE 2 — High-value advanced spatial Experience tools

ZONE 3 — Later platform / specialist capabilities

ZONE 4 — Generic app/game-engine territory to reject
```

---

# 109. Required deliverable T — minimum coherent Experience hypothesis

After exploring broadly, propose the smallest set of capabilities that creates a **complete visitor experience**, not merely an interaction demo.

Do not optimize this minimum around Museum Editor's current implementation.

Optimize around:

```text
visitor usefulness
creator simplicity
semantic reuse
agent authorability
web delivery
```

---

# 110. Required deliverable U — “one level deeper” recommendation

After proposing the minimum, separately show:

> If the product invested **one additional level of Experience depth**, what capabilities would create the biggest jump in value?

This prevents overly conservative research.

---

# 111. Required deliverable V — unresolved research questions

List genuine questions that still require:

```text
prototype
UX test
performance test
accessibility test
owner product decision
```

Do not resolve uncertainty by guessing.

---

# 112. Required deliverable W — targeted prototypes

Recommend **5–10 prototypes** that would most efficiently validate the strongest ideas.

Examples:

```text
Destination navigation
Click object → Info Panel
Guided stops + narration
Visitor menu + free exploration
World-space annotation
Reduced-motion traversal
Multiple actions
Simple first-visit condition
Mobile Experience
```

Refine based on research.

---

# 113. Required deliverable X — final product thesis

Finish with:

> **What should a mature Museum Editor Experience mode allow someone to create that is difficult or tedious today, while remaining dramatically simpler than building the same thing in a game engine or custom web application?**

Then answer:

> **What small set of reusable concepts creates most of that advantage?**

---

# 114. Important source distinction

The Museum Editor context in this prompt is **not research evidence**.

It exists only to define:

```text
product goal
architectural philosophy
target users
scope boundary
```

The actual evidence should come from the external ecosystem.

Do not spend research budget attempting to prove what Museum Editor currently implements.

If a question depends specifically on current implementation, mark:

```text
REQUIRES LATER MUSEUM EDITOR RECONCILIATION
```

and continue the external exploration.

Do not stop or narrow the external research because current Museum Editor behavior is unknown.

---

# 115. Final workflow

Use:

```text
Museum Editor product context
        ↓
broad external capability discovery
        ↓
deep reference inspection
        ↓
cross-category synthesis
        ↓
capability taxonomy
        ↓
alternative conceptual models
        ↓
product-boundary analysis
        ↓
minimum + advanced hypotheses
        ↓
prototype recommendations
        ↓
questions for later repo reconciliation
```

Do **not** perform the final Museum Editor implementation reconciliation in this research.

That will happen separately.

The desired result is:

> **an ambitious but disciplined map of what Experience authoring could become, backed by external evidence, before current implementation constraints narrow the design space.**
