# Native Form Lab

An exploratory browser prototype for drawing, editing and hosting generated
forms. It runs on its own, outside the production npm workspaces. Authored data
can be saved in this browser or exported/imported as JSON.

## Run

```sh
cd prototypes/native-form-lab
npm install
npm run dev
```

Run those commands from the repository root. Vite serves
`http://127.0.0.1:5193`. The prototype's `npm run typecheck`, `npm test` and
`npm run build` scripts are isolated to this directory. To check the built
preview, run `npm run build` and then `npm run preview`; it serves
`http://127.0.0.1:4193`.

The optional browser workflow runner expects a preview server that is already
running and `agent-browser` installed on `PATH`:

```sh
cd prototypes/native-form-lab
# Terminal 1
npm run build
npm run preview

# Terminal 2
cd prototypes/native-form-lab
npm run qa:browser
```

The runner uses its own `native-form-lab-check` session, drives the visible UI
with pointer and keyboard input, reads the QA snapshot for assertions, saves up
to three screenshots in `qa/evidence/`, and closes only its own session. It does
not start or stop a server. Pass a different preview URL as the first argument.

## Try

1. Choose **Blank form**, select **Draw**, and click the ground or a planar
   generated face. Place at least three corners and choose **Create form**.
   World X/Y/Z and host-local U/V locks constrain the profile stroke;
   **Escape** cancels the current drawing action.
2. Choose **Custom pedestal**, **Turned ornament**, or **Room trim** to revise an
   extrusion, revolution, or swept section. Drag the contextual handles or edit
   source values; invalid edits keep the last accepted shape and explain why.
   Sweep carrier XYZ fields are always available alongside dragging. Length
   inputs use metres only; there is no unit selector. Switching operation
   resets that operation's settings, and Undo restores the previous operation
   state.
3. Select **Face profile** to read the selected profile plane and **Return to
   perspective** to go back. **Review** compares contextual handles with
   explicit operation choices on the same authored model. In **Review**, load
   the 15° tilted slab to try a child profile on its planar cap. Save locally or
   export/import the authored document. To repair a retired marker, select its
   unresolved row, pick another planar face, then choose **Repair on selected
   face**.

## What is real, prepared, unsupported

- **Real:** Blank-profile drawing on ground or planar generated faces; editable
  extrude/revolve/sweep source; world and host-local axis locks; validated
  pointer and numeric edits; role-based paint, attachments and child hosts;
  local save/reload and JSON import/export.
- **Prepared:** The pedestal, turned ornament and room trim are starting models
  made from the same authored operations. Review's tilted slab is a fixture for
  child-profile host work.
- **Unsupported:** Free three-anchor planes, curved/nonplanar host surfaces,
  holes, general booleans, unconstrained 3D sketching and sharp spatial sweep
  corners. Child profiles and markers require planar roles. The prototype is
  not a robust CAD engine.

## Scope and limits

This design study is not a production editor, persisted-format authority, or
professional solid-modeling engine. Authored documents contain inputs only;
meshes, camera, selection, session and history are runtime state. Pointer and
numeric edits share validation, with snapshot undo as the prototype's history
implementation. These are limits of the study, not production requirements;
see **Unsupported** above for the geometric boundary.

This prototype explores the editable-form and identity questions in
[PR #192's proof agenda](https://github.com/Biskiq/spatial-sketch-editor/pull/192),
especially [P3, profile families](../../broad-research/native-creative-depth/proof-agenda.md#p3-profile-families-stay-editable)
and [P5, identity through revision](../../broad-research/native-creative-depth/proof-agenda.md#p5-identity-through-ordinary-revision).
It is separate from [Vellum (P3)](../p3-vellum/README.md), which is broader
spatial-authoring evidence. The production World authoring destination remains
[PLATE §0.8.4](../../docs/reference/design-system/editor-shell-and-visual-system.md#084-world-paper-authoring-destination);
this lab supplies no product or shell authority. See
[FINDINGS.md](./FINDINGS.md) for current evidence and open experiments.
