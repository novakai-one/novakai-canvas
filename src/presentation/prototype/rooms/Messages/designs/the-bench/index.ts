import type { MessagesDesign } from '../../messages-design';
import {
  CyanotypeEvidenceBench,
  CyanotypeScreenshotReadyBench,
  TheBench,
} from './TheBench';

/** Spatial Messages workbench with design-owned relationship inspection. */
export const theBenchMessagesDesign: MessagesDesign = {
  id: 'the-bench',
  label: 'The Bench',
  ownsInspector: true,
  View: TheBench,
};

/** First-pass Cyanotype presentation over the unchanged Bench capability. */
export const cyanotypeEvidenceFirstPassDesign: MessagesDesign = {
  id: 'cyanotype-evidence-first-pass',
  label: 'Cyanotype — Striking First Pass',
  ownsInspector: true,
  View: CyanotypeEvidenceBench,
};

/** Screenshot-ready Cyanotype finish over the unchanged Bench capability. */
export const cyanotypeEvidenceScreenshotReadyDesign: MessagesDesign = {
  id: 'cyanotype-evidence-screenshot-ready',
  label: 'Cyanotype — Screenshot-Ready',
  ownsInspector: true,
  View: CyanotypeScreenshotReadyBench,
};
