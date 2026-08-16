/**
 * The Messages Room: one continuous correspondence ledger.
 *
 * This module owns every interaction — glosses, the amber chain, the folio, the
 * camera policy — and hands the canvas nothing but band specs and requests. The
 * Messages design contract stays the single seam for selection, navigation and writes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './messages-ledger.css';
import type { ObjectRecord } from '../../../../object-graph/contract';
import { EmptyState } from '../../../../components/ui/ui';
import type { WorldViewport } from '../../../../components/canvas/world-camera';
import type { MessagesDesignProps } from '../../messages-design';
import { buildLedgerModel } from './ledger-model';
import { tickLengthPx } from './ledger-geometry';
import {
  frameBand,
  resolveLedgerTier,
  restoreViewport,
  type LedgerCameraRequest,
  type LedgerTier,
} from './ledger-camera';
import { FOLIO_ID, LedgerUiContext, type LedgerGloss, type LedgerUi } from './ledger-context';
import { LedgerCanvas, type LedgerBandSpec } from './LedgerCanvas';

const enteredLedgerRooms = new Set<string>();

export function MessagesLedger({ data, commands }: MessagesDesignProps) {
  const { graph, attentionSubjectId, initialThreadId } = data;

  const [tier, setTier] = useState<LedgerTier>('reading');
  const [gloss, setGloss] = useState<LedgerGloss | null>(null);
  const [activeBandId, setActiveBandId] = useState<string | null>(initialThreadId ?? null);
  const [folioOpen, setFolioOpen] = useState(false);
  const [threadPullBandId, setThreadPullBandId] = useState<string | null>(null);
  const [releasedBandIds, setReleasedBandIds] = useState<string[]>([]);
  const [cameraRequest, setCameraRequest] = useState<LedgerCameraRequest | null>(null);

  const viewportRef = useRef<WorldViewport>({ x: 0, y: 0, zoom: 0.78 });
  const folioReturn = useRef<WorldViewport | null>(null);
  const requestSequence = useRef(0);

  const reduceMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const model = useMemo(
    () => buildLedgerModel(graph, attentionSubjectId),
    [attentionSubjectId, graph],
  );
  const viewportKey = `ledger:${initialThreadId ?? 'messages'}`;

  const mintKey = (label: string) => {
    requestSequence.current += 1;
    return `${label}:${requestSequence.current}`;
  };

  /** Entry framing happens once per session per Room; afterwards memory wins. */
  useEffect(() => {
    if (enteredLedgerRooms.has(viewportKey)) return;
    enteredLedgerRooms.add(viewportKey);
    const target = initialThreadId ?? model.entryBandId;
    if (target) {
      setCameraRequest(frameBand(target, mintKey('entry'), 720));
      setActiveBandId((current) => current ?? target);
    }
  }, [initialThreadId, model.entryBandId, viewportKey]);

  useEffect(() => {
    if (!threadPullBandId) return;
    const timer = window.setTimeout(() => setThreadPullBandId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [threadPullBandId]);

  const roleOf = useCallback(
    (agent: ObjectRecord) => {
      const seat = graph.relatedBy(agent.id, 'occupies')[0];
      return (seat && graph.relatedBy(seat.id, 'requests')[0]?.title) || 'Unseated';
    },
    [graph],
  );

  const send = useCallback(
    (bandId: string, body: string) => {
      const band = model.bands.find((candidate) => candidate.id === bandId);
      if (!band) return;
      commands.send(bandId, body);
      // Addressing the amber band visibly releases the chain to settled sage.
      if (band.amber) {
        setReleasedBandIds((previous) =>
          previous.includes(bandId) ? previous : [...previous, bandId],
        );
      }
      if (folioReturn.current) {
        setCameraRequest(restoreViewport(folioReturn.current, mintKey('return')));
        folioReturn.current = null;
      }
    },
    [commands, model.bands],
  );

  const pickAgent = useCallback(
    (agent: ObjectRecord) => {
      const id = commands.startConversation(agent);
      setFolioOpen(false);
      setActiveBandId(id);
      setCameraRequest(frameBand(id, mintKey('folio-band'), 560));
    },
    [commands],
  );

  const ui: LedgerUi = {
    bandFor: (bandId) => model.bands.find((band) => band.id === bandId),
    tier,
    activeBandId,
    gloss,
    threadPullBandId,
    releasedBandIds,
    liveAgents: data.liveAgents,
    roleOf,
    openGloss: (next) => {
      setGloss(next);
      setActiveBandId(next.bandId);
    },
    closeGloss: () => setGloss(null),
    inspect: (id) => commands.select(graph.get(id) ?? null),
    openRecord: (record) => {
      if (commands.canOpen(record)) commands.open(record);
    },
    selectRow: (bandId, messageId) => {
      setActiveBandId(bandId);
      commands.select(graph.get(messageId) ?? null);
    },
    send,
    pickAgent,
  };

  const bandSpecs: LedgerBandSpec[] = model.bands.map((band) => {
    const name = band.agent?.title ?? 'Conversation';
    return {
      id: band.id,
      gapBefore: band.gapBefore,
      estimatedHeight: band.estimatedHeight,
      scene: {
        id: band.id,
        name,
        monogram: name.slice(0, 2).toUpperCase(),
        missionTitle: band.mission?.title ?? 'No mission',
        unread: band.unread,
        ghost: band.ghost,
        active: band.id === activeBandId,
        amber: Boolean(band.amber) && !releasedBandIds.includes(band.id),
        released: Boolean(band.amber) && releasedBandIds.includes(band.id),
        tick: tickLengthPx(band.turns.length),
      },
    };
  });
  if (folioOpen) {
    bandSpecs.push({
      id: FOLIO_ID,
      gapBefore: 140,
      estimatedHeight: 400,
      scene: {
        id: FOLIO_ID,
        name: 'New folio',
        monogram: '·+',
        missionTitle: '',
        unread: false,
        ghost: true,
        active: false,
        amber: false,
        released: false,
        tick: 8,
      },
    });
  }

  const onBandClick = useCallback(
    (bandId: string) => {
      if (tier === 'spine') {
        // The thread-pull: diving from the shelf draws the gold line as we land.
        if (bandId === model.amberBandId && !releasedBandIds.includes(bandId)) {
          setThreadPullBandId(bandId);
        }
        setCameraRequest(frameBand(bandId, mintKey('dive'), 720));
        setActiveBandId(bandId);
        return;
      }
      setActiveBandId(bandId);
    },
    [model.amberBandId, releasedBandIds, tier],
  );

  const onPaneClick = useCallback(() => {
    setGloss(null);
    setFolioOpen(false);
  }, []);

  const openFolio = () => {
    folioReturn.current = viewportRef.current;
    setFolioOpen(true);
    setCameraRequest(frameBand(FOLIO_ID, mintKey('folio'), 560));
  };

  if (model.bands.length === 0 && !folioOpen) {
    return (
      <div className="ledger ledger--empty">
        <EmptyState>Start the first conversation with an agent.</EmptyState>
        <button type="button" className="ledger__new" onClick={openFolio}>
          New folio
        </button>
      </div>
    );
  }

  return (
    <div
      className="ledger"
      onKeyDownCapture={(event) => {
        // Escape peels one layer at a time: gloss, then folio, then the shell's turn.
        if (event.key !== 'Escape') return;
        if (gloss) {
          setGloss(null);
          event.stopPropagation();
        } else if (folioOpen) {
          setFolioOpen(false);
          event.stopPropagation();
        }
      }}
    >
      <LedgerUiContext.Provider value={ui}>
        <LedgerCanvas
          viewportKey={viewportKey}
          bands={bandSpecs}
          tier={tier}
          cameraRequest={cameraRequest}
          reduceMotion={reduceMotion}
          onViewportChange={(viewport) => {
            viewportRef.current = viewport;
            setTier((previous) => resolveLedgerTier(viewport.zoom, previous));
          }}
          onBandClick={onBandClick}
          onPaneClick={onPaneClick}
        />
      </LedgerUiContext.Provider>
      {!folioOpen && (
        <button type="button" className="ledger__new" onClick={openFolio} title="Start a conversation">
          New folio
        </button>
      )}
    </div>
  );
}
