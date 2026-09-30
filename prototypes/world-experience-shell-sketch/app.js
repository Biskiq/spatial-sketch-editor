// Disposable interaction sketch. All data and behavior live in this page's memory.
const subjects = {
  orrery: { name: "Astral Engine", kind: "Kinetic model", icon: "◎", room: "North Hall", capability: "Turn the celestial rings", pose: "entry", detail: "A mechanical model of the night sky, set on its original stone plinth." },
  window: { name: "North window", kind: "Architecture", icon: "▥", room: "North Hall", capability: null, pose: "north", detail: "A tall window that brings cool light onto the gallery floor." },
  vessel: { name: "Ceramic vessel", kind: "Collection object", icon: "◯", room: "North Hall", capability: null, pose: "east", detail: "A hand-built vessel shown beside the engine." }
};
const poseNames = { entry: "Entry standpoint", east: "East gallery view", north: "Facing north wall" };
const state = {
  lens: "world", selected: null, workingPresentation: null, pose: "entry", mode: "spatial",
  presentations: [], stops: [], guideExists: false, deck: "none", previousDeck: "none", cardMode: "normal",
  search: { world: "", experience: "" }, indexScroll: { world: 0, experience: 0 },
  preview: null, nextPresentation: 1, nextStop: 1
};
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const presentation = id => state.presentations.find(item => item.id === id);
const stop = id => state.stops.find(item => item.id === id);
const selectedPresentation = () => state.selected?.type === "presentation" ? presentation(state.selected.id) : state.selected?.type === "stop" ? presentation(stop(state.selected.id)?.presentationId) : null;
const selectedSubject = () => state.selected?.type === "subject" ? subjects[state.selected.id] : null;
const currentPresentation = () => selectedPresentation() || presentation(state.workingPresentation);
const uses = id => state.stops.filter(item => item.presentationId === id).length;
let toastTimer;

function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.hidden = true, 3400);
}
function setSelection(type, id) {
  state.selected = { type, id };
  if (type === "presentation") state.workingPresentation = id;
  if (type === "stop") state.workingPresentation = stop(id)?.presentationId ?? state.workingPresentation;
  state.cardMode = "normal";
  render();
  $(".work-card").scrollTop = 0;
}
function setLens(lens) {
  state.indexScroll[state.lens] = $(".index-panel").scrollTop;
  state.lens = lens;
  $("#indexSearch").value = state.search[lens];
  render();
  $(".index-panel").scrollTop = state.indexScroll[lens];
  $(".work-card").scrollTop = 0;
}
function makePresentation(subjectId) {
  if (!subjects[subjectId]) return;
  const id = `p${state.nextPresentation++}`;
  state.presentations.push({ id, title: `About the ${subjects[subjectId].name}`, meaning: "", focus: subjectId, view: null, activity: false, interaction: false, direction: { framing: "Balanced", arrival: "Cut", duration: 4 } });
  state.lens = "experience";
  state.selected = { type: "presentation", id };
  state.workingPresentation = id;
  state.cardMode = "normal";
  render();
  $(".work-card").scrollTop = 0;
  $("#presentationTitle")?.focus();
  toast("New Presentation created. The world stays in place.");
}
function addStop(presentationId) {
  if (!presentation(presentationId)) return;
  state.guideExists = true;
  const id = `s${state.nextStop++}`;
  state.stops.push({ id, presentationId, entryView: "Presentation View", arrival: "Cut", pacing: "Visitor chooses Next" });
  state.selected = { type: "stop", id };
  state.workingPresentation = presentationId;
  state.deck = "guide";
  state.cardMode = "normal";
  render();
  $(".work-card").scrollTop = 0;
  toast(uses(presentationId) > 1 ? "Same Presentation, new Stop occurrence." : "Presentation added as a Guide Stop.");
}
function duplicateForThisStop(stopId) {
  const occurrence = stop(stopId);
  if (!occurrence) return;
  const source = presentation(occurrence.presentationId);
  const id = `p${state.nextPresentation++}`;
  state.presentations.push({ ...source, id, title: `${source.title} — variation`, direction: { ...source.direction }, view: source.view ? { ...source.view } : null });
  occurrence.presentationId = id;
  state.workingPresentation = id;
  render();
  toast("This Stop now refers to a distinct Presentation. The other Stop is unchanged.");
}

function renderIndex() {
  $("#indexEyebrow").textContent = state.lens === "world" ? "WORLD INDEX" : "EXPERIENCE INDEX";
  $("#indexTitle").textContent = state.lens === "world" ? "What exists" : "What visitors meet";
  $("#indexSearch").placeholder = state.lens === "world" ? "Find in World" : "Find Presentations";
  const q = state.search[state.lens].trim().toLowerCase();
  let html = "";
  if (state.lens === "world") {
    const rows = Object.entries(subjects).filter(([, value]) => `${value.name} ${value.kind}`.toLowerCase().includes(q));
    html += `<section class="index-section"><div class="index-section-title"><strong>North Hall</strong><small>${rows.length} subjects</small></div>`;
    html += rows.length ? rows.map(([id, value]) => `<button type="button" class="index-row ${state.selected?.type === "subject" && state.selected.id === id ? "selected" : ""}" data-action="select-subject" data-value="${id}"><span class="row-icon">${value.icon}</span><span class="row-copy"><strong>${escapeHTML(value.name)}</strong><small>${escapeHTML(value.kind)}</small></span></button>`).join("") : `<p class="index-hint">No World subject matches this search.</p>`;
    html += `</section><section class="index-section"><div class="index-section-title"><strong>Places</strong><small>1 level</small></div><div class="index-row"><span class="row-icon">⌂</span><span class="row-copy"><strong>North Hall</strong><small>Level 01 · three subjects</small></span></div></section>`;
  } else {
    if (state.selected?.type === "subject") {
      const s = subjects[state.selected.id];
      html += `<div class="index-pinned">SELECTED IN THE WORLD<strong>${escapeHTML(s.name)}</strong></div>`;
    }
    const rows = state.presentations.filter(item => `${item.title} ${subjects[item.focus]?.name}`.toLowerCase().includes(q));
    html += `<section class="index-section"><div class="index-section-title"><strong>Presentations</strong><small>${rows.length}</small></div>`;
    html += rows.length ? rows.map(item => `<button type="button" class="index-row ${state.selected?.type === "presentation" && state.selected.id === item.id ? "selected" : ""}" data-action="select-presentation" data-value="${item.id}"><span class="row-icon">◇</span><span class="row-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(subjects[item.focus]?.name)} · ${uses(item.id)} Guide ${uses(item.id) === 1 ? "use" : "uses"}</small></span></button>`).join("") : `<p class="index-hint">${q ? "No Presentation matches this search." : "No Presentations yet. Select a subject and choose Present this."}</p>`;
    html += `</section>`;
    if (state.guideExists) {
      html += `<section class="index-section"><div class="index-section-title"><strong>Guide</strong><small>${state.stops.length} ${state.stops.length === 1 ? "Stop" : "Stops"}</small></div><button type="button" class="index-row" data-action="open-guide"><span class="row-icon">↝</span><span class="row-copy"><strong>North Hall walk</strong><small>Open ordered Stops</small></span></button></section>`;
    }
    html += `<section class="index-section"><div class="index-section-title"><strong>Visitor offers</strong><small>0 global</small></div><p class="index-hint">Interactions can be offered across the Experience without a Guide.</p></section>`;
  }
  $("#indexContent").innerHTML = html;
}

function cardHeader(scope, title, subtitle) {
  return `<div class="card-header"><div class="card-scope"><i class="scope-line"></i>${escapeHTML(scope)}</div><h2>${escapeHTML(title)}</h2><p class="card-subtitle">${subtitle}</p></div>`;
}
function renderWorldCard() {
  const subject = selectedSubject();
  if (!subject) {
    if (state.selected?.type === "presentation" || state.selected?.type === "stop") {
      const p = selectedPresentation();
      return cardHeader("EXPERIENCE CONTEXT", p?.title || "Presentation", "Its visitor meaning remains selected while you inspect World source.") + `<div class="card-body"><div class="inline-relation">Focus in the World · <strong>${escapeHTML(subjects[p?.focus]?.name || "Unknown")}</strong></div><div class="button-stack"><button class="btn primary" data-action="select-subject" data-value="${p?.focus}">Select focus subject</button><button class="btn" data-action="lens" data-value="experience">Return to Presentation</button></div></div>`;
    }
    return `<div class="empty-card"><div class="card-scope">WORLD SOURCE</div><h2>Work from the room</h2><p class="card-copy">Select an object in the stage or Index. Its source facts and available work appear here.</p></div>`;
  }
  const related = state.presentations.filter(item => item.focus === state.selected.id);
  return cardHeader("WORLD SOURCE", subject.name, subject.detail) + `<div class="card-body"><section class="card-section"><span class="section-label">SOURCE FACTS</span><div class="fact"><span>Place</span><strong>${subject.room}</strong></div><div class="fact"><span>Kind</span><strong>${subject.kind}</strong></div><div class="fact"><span>Capability</span><strong>${subject.capability || "None authored"}</strong></div></section><section class="card-section"><span class="section-label">INSPECT IN SPACE</span><div class="button-row"><button type="button" class="btn" data-action="face-subject" data-value="${state.selected.id}">Face this</button><button type="button" class="btn" data-action="mode" data-value="plan">See in Plan</button></div><p class="card-copy">Inspection changes your standpoint; it does not change the source.</p></section><section class="card-section"><span class="section-label">VISITOR MEANING</span><p class="card-copy">${related.length ? `${related.length} Presentation${related.length === 1 ? "" : "s"} about this subject.` : "No Presentation about this subject yet."}</p><button type="button" class="btn primary" data-action="lens" data-value="experience">Work in Experience →</button></section></div>`;
}
function renderSubjectExperienceCard() {
  const id = state.selected.id;
  const subject = subjects[id];
  const related = state.presentations.filter(item => item.focus === id);
  return cardHeader("WORLD SUBJECT / EXPERIENCE", subject.name, "The source stays intact. Compose what a visitor understands about it.") + `<div class="card-body"><div class="inline-relation">World source · ${escapeHTML(subject.kind)} · read only here</div><section class="card-section"><span class="section-label">PRESENTATIONS ABOUT THIS</span>${related.length ? `<div class="mini-list">${related.map(item => `<button type="button" data-action="select-presentation" data-value="${item.id}">${escapeHTML(item.title)} <span>↗</span></button>`).join("")}</div>` : `<p class="card-copy">Nothing visitor-facing is attached yet.</p>`}</section><section class="card-section"><span class="section-label">MAKE MEANING</span><div class="button-stack"><button type="button" class="btn primary" data-action="present-this" data-value="${id}">${related.length ? "New Presentation" : "Present this"} →</button><button type="button" class="btn subtle" data-action="lens" data-value="world">Edit source in World</button></div></section>${subject.capability ? `<section class="card-section"><span class="section-label">SUPPORTED BY THE WORLD</span><p class="card-copy">${escapeHTML(subject.capability)} can be tried here before being used in a Presentation.</p><button type="button" class="btn" data-action="try-activity">Try control ↗</button></section>` : ""}</div>`;
}
function renderPresentationCard(p) {
  const focus = subjects[p.focus];
  const viewText = !p.view ? "No entry behavior chosen" : p.view.mode === "auto" ? "Suggested framing · adaptive" : p.view.mode === "captured" ? `Captured from ${poseNames[p.view.pose]}` : "Keep the visitor's current view";
  return cardHeader("PRESENTATION / SHARED MEANING", p.title, `Focus · ${escapeHTML(focus.name)} · ${uses(p.id)} Guide ${uses(p.id) === 1 ? "use" : "uses"}`) + `<div class="card-body"><div class="inline-relation">Focus in the World · <strong>${escapeHTML(focus.name)}</strong></div><section class="card-section"><span class="section-label">MEANING</span><label class="field"><span>Title</span><input id="presentationTitle" data-field="presentation-title" data-id="${p.id}" value="${escapeHTML(p.title)}" /></label><label class="field"><span>Why it matters</span><textarea data-field="presentation-meaning" data-id="${p.id}" placeholder="Give the visitor a reason to look closer.">${escapeHTML(p.meaning)}</textarea></label>${uses(p.id) > 1 ? `<div class="scope-note">Editing this explanation updates the same Presentation at all ${uses(p.id)} Stops.</div>` : ""}</section><section class="card-section"><span class="section-label">SHOW / CAMERA VIEW</span><p class="card-copy"><strong>${escapeHTML(viewText)}</strong></p><div class="button-stack"><button type="button" class="btn ${p.view?.mode === "auto" ? "primary" : ""}" data-action="choose-view" data-value="auto">Use suggested View</button><button type="button" class="btn ${p.view?.mode === "captured" ? "primary" : ""}" data-action="choose-view" data-value="captured">Use my current view · ${escapeHTML(poseNames[state.pose])}</button><button type="button" class="btn ${p.view?.mode === "keep" ? "primary" : ""}" data-action="choose-view" data-value="keep">Keep visitor view</button></div><button type="button" class="btn subtle" data-action="direction">Direction details →</button></section><section class="card-section"><span class="section-label">HAPPENS</span>${focus.capability ? `<p class="card-copy">World supports: ${escapeHTML(focus.capability)}.</p><div class="button-row"><button type="button" class="btn" data-action="try-activity">Try control</button><button type="button" class="btn" data-action="toggle-activity">${p.activity ? "Remove from Presentation" : "Use in Presentation"}</button></div>${p.activity ? `<p class="card-copy">The rings turn when this Presentation begins. Mock result only.</p>` : ""}` : `<p class="card-copy">No supported action on this subject.</p>`}</section><section class="card-section"><span class="section-label">VISITOR CAN</span>${focus.capability ? `<button type="button" class="btn" data-action="toggle-interaction">${p.interaction ? "Remove ring control" : "Offer ring control"}</button><p class="card-copy">${p.interaction ? "Visitors may turn the rings during this Presentation." : "Optional. The visitor can look without operating anything."}</p>` : `<p class="card-copy">This subject has no visitor control to offer.</p>`}</section><section class="card-section"><span class="section-label">NEXT USE</span><div class="button-stack"><button type="button" class="btn primary" data-action="preview">Preview this Presentation ↗</button><button type="button" class="btn" data-action="add-stop" data-value="${p.id}">Add to Guide</button></div><p class="card-copy">The Guide remains optional; this Presentation already stands on its own.</p></section></div>`;
}
function renderStopCard(s) {
  const p = presentation(s.presentationId);
  const appearance = state.stops.filter(item => item.presentationId === p.id).findIndex(item => item.id === s.id) + 1;
  return cardHeader("THIS STOP / LOCAL OCCURRENCE", `Stop ${state.stops.indexOf(s) + 1}`, `Appearance ${appearance} of “${escapeHTML(p.title)}”`) + `<div class="card-body"><div class="inline-relation">Shared Presentation · <strong>${escapeHTML(p.title)}</strong></div><section class="card-section"><span class="section-label">ARRIVAL HERE</span><label class="field"><span>Entry View for this Stop</span><select data-field="stop-entry" data-id="${s.id}"><option ${s.entryView === "Presentation View" ? "selected" : ""}>Presentation View</option><option ${s.entryView === "Keep current viewpoint" ? "selected" : ""}>Keep current viewpoint</option><option ${s.entryView === "Closer view" ? "selected" : ""}>Closer view</option></select></label><label class="field"><span>Movement</span><select data-field="stop-arrival" data-id="${s.id}"><option ${s.arrival === "Cut" ? "selected" : ""}>Cut</option><option ${s.arrival === "Travel" ? "selected" : ""}>Travel</option></select></label><p class="card-copy">${s.arrival === "Travel" ? "Mock supported hall path. Prototype V2 must evaluate a real Camera route." : "Cut changes the view without claiming a travel route."}</p><label class="field"><span>Continuation</span><select data-field="stop-pacing" data-id="${s.id}"><option ${s.pacing === "Visitor chooses Next" ? "selected" : ""}>Visitor chooses Next</option><option ${s.pacing === "Pause before Next" ? "selected" : ""}>Pause before Next</option></select></label><div class="scope-note">These settings affect only Stop ${state.stops.indexOf(s) + 1}. The Presentation's title and explanation are shared.</div></section><section class="card-section"><span class="section-label">SHARED MEANING</span><p class="card-copy">${escapeHTML(p.meaning || "No explanation yet.")}</p><button type="button" class="btn" data-action="select-presentation" data-value="${p.id}">Edit shared Presentation · ${uses(p.id)} ${uses(p.id) === 1 ? "Stop" : "Stops"}</button><button type="button" class="btn subtle" data-action="fork-stop" data-value="${s.id}">Make distinct Presentation for this Stop</button></section><section class="card-section"><span class="section-label">GUIDE</span><div class="button-stack"><button type="button" class="btn primary" data-action="preview">Preview from this Stop ↗</button><button type="button" class="btn" data-action="add-stop" data-value="${p.id}">Reuse same Presentation at another Stop</button></div></section></div>`;
}
function renderDirectionCard() {
  const p = currentPresentation();
  if (!p) return "";
  return cardHeader("CAMERA VIEW / DIRECTION", p.view?.mode === "captured" ? "Captured standpoint" : "Framing and arrival", `For “${escapeHTML(p.title)}” · Camera controls shown contextually`) + `<div class="card-body"><section class="card-section"><span class="section-label">VIEW INTENT</span><p class="card-copy">${p.view ? escapeHTML(p.view.mode === "captured" ? poseNames[p.view.pose] : p.view.mode === "auto" ? "Adaptive view of the focused subject" : "Keep visitor viewpoint") : "Choose an entry behavior in the Presentation card."}</p><div class="fact"><span>Observer</span><strong>${escapeHTML(poseNames[state.pose])}</strong></div><div class="fact"><span>Target</span><strong>${escapeHTML(subjects[p.focus].name)}</strong></div><div class="fact"><span>View use</span><strong>${uses(p.id)} Stop ${uses(p.id) === 1 ? "use" : "uses"}</strong></div></section><section class="card-section"><span class="section-label">PRECISION</span><p class="card-copy">The Direction deck exposes mock framing, arrival, and duration. Moving these controls changes only this sketch's local values.</p><button type="button" class="btn primary" data-action="close-direction">Done with Direction</button></section></div>`;
}
function renderCard() {
  let html;
  if (state.lens === "world") html = renderWorldCard();
  else if (state.cardMode === "direction") html = renderDirectionCard();
  else if (!state.selected) html = `<div class="empty-card"><div class="card-scope">EXPERIENCE</div><h2>Start with a subject</h2><p class="card-copy">Choose something in the hall. Presentations turn it into visitor-facing meaning.</p></div>`;
  else if (state.selected.type === "subject") html = renderSubjectExperienceCard();
  else if (state.selected.type === "presentation") html = renderPresentationCard(presentation(state.selected.id));
  else html = renderStopCard(stop(state.selected.id));
  $("#cardContent").innerHTML = html;
}

function renderDeck() {
  const deck = $("#deck");
  if (state.lens !== "experience" || state.deck === "none") { deck.hidden = true; return; }
  deck.hidden = false;
  if (state.deck === "guide") {
    deck.innerHTML = `<div class="deck-top"><div><span class="guide-kicker">OPTIONAL GUIDE</span><div class="deck-title">North Hall walk</div></div><div class="deck-actions"><button type="button" data-action="hide-deck">Close deck ×</button></div></div><div class="stop-strip">${state.stops.map((s, i) => `<button type="button" class="stop-card ${state.selected?.type === "stop" && state.selected.id === s.id ? "selected" : ""}" data-action="select-stop" data-value="${s.id}"><span class="guide-kicker">STOP ${i + 1}</span><strong>${escapeHTML(presentation(s.presentationId)?.title)}</strong><small>${escapeHTML(s.arrival)} · ${escapeHTML(s.entryView)}</small></button>`).join("")}</div>`;
  } else {
    const p = currentPresentation();
    deck.innerHTML = `<div class="deck-top"><div><span class="guide-kicker">CAMERA INSTRUMENT</span><div class="deck-title">Direction · ${escapeHTML(p?.title || "View")}</div></div><div class="deck-actions"><button type="button" data-action="close-direction">Return to composition ×</button></div></div><div class="direction-grid"><label>Framing <select data-field="direction-framing" data-id="${p?.id}"><option ${p?.direction.framing === "Balanced" ? "selected" : ""}>Balanced</option><option ${p?.direction.framing === "Closer" ? "selected" : ""}>Closer</option><option ${p?.direction.framing === "Wide" ? "selected" : ""}>Wide</option></select></label><label>Arrival <select data-field="direction-arrival" data-id="${p?.id}"><option ${p?.direction.arrival === "Cut" ? "selected" : ""}>Cut</option><option ${p?.direction.arrival === "Travel" ? "selected" : ""}>Travel</option></select></label><label>Duration <input type="range" min="1" max="12" value="${p?.direction.duration || 4}" data-field="direction-duration" data-id="${p?.id}" /> <output id="durationOutput">${p?.direction.duration || 4}s</output></label><span>Mock controls · no route evaluated</span></div>`;
  }
}
function renderStage() {
  const canvas = $("#stageCanvas");
  canvas.dataset.pose = state.pose;
  canvas.classList.toggle("plan", state.mode === "plan");
  $("#stageTitle").textContent = `North Hall · ${poseNames[state.pose]}`;
  $("#stageScale").textContent = state.mode === "plan" ? "Plan · 1 m mock grid" : "Spatial inspection · mock view";
  $("#viewTrailButton").textContent = `${poseNames[state.pose]} ↶`;
  $("#planButton").classList.toggle("active", state.mode === "plan");
  $("#spatialButton").classList.toggle("active", state.mode === "spatial");
  const linked = selectedPresentation()?.focus;
  document.querySelectorAll(".subject").forEach(element => {
    const id = element.dataset.subject;
    element.classList.toggle("selected", state.selected?.type === "subject" && state.selected.id === id);
    element.classList.toggle("related", state.selected?.type !== "subject" && linked === id);
  });
  let callout = "Select a subject to work from the world.";
  if (state.selected?.type === "subject") callout = `${subjects[state.selected.id].name} · selected in ${state.lens === "world" ? "World" : "Experience"}`;
  if (state.selected?.type === "presentation") callout = `Working on “${presentation(state.selected.id)?.title}” · focus outlined in the world`;
  if (state.selected?.type === "stop") callout = `Stop ${state.stops.findIndex(item => item.id === state.selected.id) + 1} · focus outlined in the world`;
  $("#stageCallout").textContent = callout;
  const p = selectedPresentation();
  $("#viewMarker").hidden = !(state.lens === "experience" && p?.view);
  if (p?.view) $("#viewMarker").textContent = p.view.mode === "captured" ? `Captured View · ${poseNames[p.view.pose]}` : p.view.mode === "auto" ? "Suggested View accepted" : "Keep visitor view";
}
function render() {
  $("#worldTab").classList.toggle("active", state.lens === "world");
  $("#experienceTab").classList.toggle("active", state.lens === "experience");
  $("#worldTab").setAttribute("aria-current", state.lens === "world" ? "page" : "false");
  $("#experienceTab").setAttribute("aria-current", state.lens === "experience" ? "page" : "false");
  $("#statusLeft").textContent = `Authoring · ${state.lens === "world" ? "World source" : state.cardMode === "direction" ? "Camera View" : "Experience"}`;
  $("#statusRight").textContent = `${poseNames[state.pose]} · ${state.mode === "plan" ? "Plan" : "Spatial"} · local mock only`;
  renderIndex(); renderCard(); renderDeck(); renderStage();
}

function preview() {
  const p = selectedPresentation() || state.presentations[0];
  if (!p) { toast("Create a Presentation before Preview."); return; }
  if (!p.view) { toast("Choose a View or Keep visitor view before Preview."); return; }
  clearTimeout(toastTimer);
  $("#toast").hidden = true;
  state.preview = { presentationId: p.id, stopId: state.selected?.type === "stop" ? state.selected.id : null, exploring: false, active: p.activity, autoplay: false };
  $("#app").hidden = true;
  $("#previewRoot").hidden = false;
  renderPreview();
}
function renderPreview() {
  const visitor = state.preview;
  if (!visitor) return;
  const p = presentation(visitor.presentationId);
  const s = visitor.stopId ? stop(visitor.stopId) : null;
  const place = s ? `North Hall walk · Stop ${state.stops.indexOf(s) + 1} of ${state.stops.length}` : "North Hall · free visit";
  $("#previewRoot").innerHTML = `<div class="preview-bar"><span>Draft Preview · The North Hall visit</span><button type="button" data-action="exit-preview">Exit Preview ×</button></div><div class="preview-scene"><div class="visitor-object ${p.focus} ${visitor.active ? "is-active" : ""} ${s?.entryView === "Closer view" ? "is-close" : ""}" aria-hidden="true"></div><span class="preview-watermark">North Hall / ${escapeHTML(subjects[p.focus].name)}</span>${visitor.exploring ? `<div class="visitor-context"><span>EXPLORING FREELY</span><strong>${escapeHTML(p.title)}</strong><p>Your place in the visit is held.</p><button type="button" class="btn" data-action="rejoin">Return to ${s ? `Stop ${state.stops.indexOf(s) + 1}` : "Presentation"}</button></div>` : ""}<div class="visitor-panel"><div class="visitor-location">${escapeHTML(visitor.exploring ? "Free exploration · " + place : place)}</div><h1>${visitor.exploring ? "Explore the hall" : escapeHTML(p.title)}</h1><p>${visitor.exploring ? "Look around and interact with the world. Return when you are ready to continue." : escapeHTML(p.meaning || `Look more closely at the ${subjects[p.focus].name}.`)}</p><div class="visitor-actions">${p.interaction && subjects[p.focus].capability ? `<button type="button" data-action="visitor-interact">${visitor.active ? "Set rings still" : "Turn the rings"}</button>` : ""}${visitor.exploring ? `<button type="button" class="secondary" data-action="rejoin">Return to ${s ? "Guide" : "Presentation"}</button>` : `<button type="button" class="secondary" data-action="explore">Explore freely</button>`}${s && !visitor.exploring ? `<button type="button" class="secondary" data-action="${state.stops.indexOf(s) < state.stops.length - 1 ? "visitor-next" : "end-guide"}">${state.stops.indexOf(s) < state.stops.length - 1 ? "Next Stop →" : "Finish visit"}</button>` : ""}</div></div></div>`;
}

document.addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (!control) {
    const picked = event.target.closest(".subject[data-subject]");
    if (picked) setSelection("subject", picked.dataset.subject);
    return;
  }
  const action = control.dataset.action;
  const value = control.dataset.value;
  if (action === "lens") setLens(value);
  else if (action === "select-subject") setSelection("subject", value);
  else if (action === "select-presentation") setSelection("presentation", value);
  else if (action === "select-stop") setSelection("stop", value);
  else if (action === "present-this") makePresentation(value);
  else if (action === "face-subject") { state.pose = subjects[value].pose; render(); }
  else if (action === "mode") { state.mode = value; render(); }
  else if (action === "turn-view") { const poses = Object.keys(poseNames); state.pose = poses[(poses.indexOf(state.pose) + 1) % poses.length]; render(); }
  else if (action === "reset-view") { state.pose = "entry"; render(); }
  else if (action === "choose-view") { const p = selectedPresentation(); if (p) { p.view = { mode: value, pose: state.pose }; render(); toast(value === "captured" ? `Captured ${poseNames[state.pose]} as mock View.` : value === "auto" ? "Suggested View accepted." : "Visitor viewpoint retained on entry."); } }
  else if (action === "direction") { state.previousDeck = state.deck; state.deck = "direction"; state.cardMode = "direction"; render(); }
  else if (action === "close-direction") { state.deck = state.previousDeck === "direction" ? "none" : state.previousDeck; state.cardMode = "normal"; render(); }
  else if (action === "try-activity") toast("The celestial rings turn briefly. This audition is not captured.");
  else if (action === "toggle-activity") { const p = selectedPresentation(); p.activity = !p.activity; render(); }
  else if (action === "toggle-interaction") { const p = selectedPresentation(); p.interaction = !p.interaction; render(); }
  else if (action === "add-stop") addStop(value);
  else if (action === "open-guide") { state.deck = "guide"; render(); }
  else if (action === "hide-deck") { state.deck = "none"; render(); }
  else if (action === "fork-stop") duplicateForThisStop(value);
  else if (action === "preview") preview();
  else if (action === "exit-preview") { state.preview = null; $("#previewRoot").hidden = true; $("#app").hidden = false; render(); toast("Back to the same authoring context."); }
  else if (action === "explore") { state.preview.exploring = true; state.preview.autoplay = false; renderPreview(); }
  else if (action === "rejoin") { state.preview.exploring = false; renderPreview(); }
  else if (action === "visitor-interact") { state.preview.active = !state.preview.active; renderPreview(); }
  else if (action === "visitor-next") { const i = state.stops.findIndex(item => item.id === state.preview.stopId); const next = state.stops[i + 1]; if (next) { state.preview.stopId = next.id; state.preview.presentationId = next.presentationId; state.preview.active = presentation(next.presentationId).activity; renderPreview(); } }
  else if (action === "end-guide") { state.preview.stopId = null; state.preview.exploring = true; renderPreview(); }
});
document.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".subject[data-subject]")) { event.preventDefault(); setSelection("subject", event.target.dataset.subject); }
  if (event.key === "Escape") {
    if (state.preview) { state.preview = null; $("#previewRoot").hidden = true; $("#app").hidden = false; render(); }
    else if (state.cardMode === "direction") { state.deck = state.previousDeck; state.cardMode = "normal"; render(); }
    else if (state.pose !== "entry") { state.pose = "entry"; render(); }
  }
});
document.addEventListener("input", event => {
  if (event.target.id === "indexSearch") { state.search[state.lens] = event.target.value; renderIndex(); return; }
  const field = event.target.dataset.field;
  const id = event.target.dataset.id;
  if (field === "presentation-title") { presentation(id).title = event.target.value; $(".card-header h2").textContent = event.target.value; renderIndex(); renderStage(); }
  if (field === "presentation-meaning") presentation(id).meaning = event.target.value;
  if (field === "direction-duration") { presentation(id).direction.duration = Number(event.target.value); $("#durationOutput").textContent = `${event.target.value}s`; }
});
document.addEventListener("change", event => {
  const field = event.target.dataset.field;
  const id = event.target.dataset.id;
  if (field === "stop-entry") stop(id).entryView = event.target.value;
  if (field === "stop-arrival") stop(id).arrival = event.target.value;
  if (field === "stop-pacing") stop(id).pacing = event.target.value;
  if (field === "direction-framing") presentation(id).direction.framing = event.target.value;
  if (field === "direction-arrival") presentation(id).direction.arrival = event.target.value;
  if (field && field !== "presentation-title" && field !== "presentation-meaning") render();
});

render();
