import { useState, useEffect } from 'preact/hooks';
import { store as theStore } from '../store';
import { useStore, app } from './ctx';
import { TopBar } from './TopBar';
import { Rail } from './Rail';
import { Dock } from './Dock';
import { Inspector } from './Inspector';
import { Ripple, ReadingChip, Hint, Toast } from './Feedback';
import { Panels } from './Panels';
import { Start } from './Start';
import { Visit } from './Visit';
import { ContextMenu } from './ContextMenu';

export function App() {
  const store = useStore();
  const [drop, setDrop] = useState(false);
  const visit = store.ui.mode === 'visit';
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      setDrop(true);
    };
    const leave = (e: DragEvent) => !e.relatedTarget && setDrop(false);
    const dropped = (e: DragEvent) => {
      e.preventDefault();
      setDrop(false);
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      if (/\.(glb|gltf)$/i.test(f.name)) app.importFile(f);
      else if (/\.json$/i.test(f.name)) f.text().then((t) => theStore.load(JSON.parse(t)));
      else theStore.toast('Drop a .glb, .gltf or a Vellum .json file');
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', dropped);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', dropped);
    };
  }, []);
  return (
    <div class="ui">
      {!visit && !store.ui.start && (
        <>
          <TopBar />
          <Rail />
          <Inspector />
          <Panels />
          <ReadingChip />
          <Ripple />
          <Dock />
          <Hint />
          <ContextMenu />
        </>
      )}
      <Visit />
      <Start />
      <Toast />
      {drop && <div class="dropzone">Drop a model from another tool</div>}
    </div>
  );
}
