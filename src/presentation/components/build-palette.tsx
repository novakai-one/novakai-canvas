import { useState } from 'react';
import { allComponents } from '../../components/registry';
import type { CreatableNodeKind } from '../canvas-actions';
import { Flyout, PanelSection } from '../shell';

const entries = allComponents().flatMap((component) => component.creation ? [{
  id: component.kind as CreatableNodeKind,
  ...component.creation,
}] : []);
const SHAPE_KINDS = entries.filter((entry) => entry.category === 'shape');

function entry(category: 'text' | 'container' | 'annotation') {
  const found = entries.find((candidate) => candidate.category === category);
  if (!found) throw new Error(`missing-ui-creation-category:${category}`);
  return found;
}

export interface BuildPaletteProps {
  editable: boolean;
  addNode: (kind: CreatableNodeKind) => void;
  canUndo: boolean;
  undo: () => void;
}

/** Curated creation surface; registry-backed editors handle presentation after placement. */
export function BuildPalette(props: BuildPaletteProps) {
  const [kind, setKind] = useState<CreatableNodeKind>('module');
  const chosen = SHAPE_KINDS.find((entry) => entry.id === kind) ?? SHAPE_KINDS[0];
  const text = entry('text');
  const container = entry('container');
  const annotation = entry('annotation');
  return (
    <>
      <PanelSection title="Shape">
        <div className="build-rows">
          <div className="build-row build-row--primary">
            <button className="build-place" disabled={!props.editable}
              onClick={() => props.addNode(kind)} type="button">
              <span className="build-row-label">Shape</span>
              <span className="build-row-kind">{chosen.label}</span>
            </button>
            <Flyout current={kind} items={SHAPE_KINDS} label="What kind"
              onPick={(picked) => setKind(picked as CreatableNodeKind)}>
              <span className="build-row-change">Kind</span>
            </Flyout>
          </div>
          <div className="build-row">
            <button className="build-place" disabled={!props.editable}
              onClick={() => props.addNode(text.id)} type="button">
              <span className="build-row-label">{text.label}</span>
              <span className="build-row-kind">{text.hint}</span>
            </button>
          </div>
          <div className="build-row">
            <button className="build-place" disabled={!props.editable}
              onClick={() => props.addNode(container.id)} type="button">
              <span className="build-row-label">{container.label}</span>
              <span className="build-row-kind">{container.hint}</span>
            </button>
          </div>
          <div className="build-row">
            <button className="build-place" disabled={!props.editable}
              onClick={() => props.addNode(annotation.id)} type="button">
              <span className="build-row-label">{annotation.label}</span>
              <span className="build-row-kind">{annotation.hint}</span>
            </button>
          </div>
        </div>
      </PanelSection>
      <PanelSection title="History">
        <button className="panel-button" disabled={!props.editable || !props.canUndo}
          onClick={props.undo} type="button">Undo last change</button>
      </PanelSection>
    </>
  );
}
