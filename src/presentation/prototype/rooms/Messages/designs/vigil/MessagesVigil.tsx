import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ObjectRecord } from '../../../../object-graph/contract';
import type { MessagesDesignCommands, MessagesDesignProps } from '../../messages-design';
import { LanternCore } from './LanternCore';
import { buildVigilModel, type VigilLantern, type VigilModel } from './vigil-model';
import { VigilFloor } from './VigilFloor';
import { VigilScreenLayer } from './VigilScreenLayer';
import './messages-vigil.css';

/**
 * Vigil — the Messages Room as a dark floor with you at its centre.
 *
 * Distance from you means time since it last spoke, at both scales: conversations sit
 * on the ring of their silence, and an opened conversation unfurls its messages
 * outward with the newest nearest. A conversation is first-class here; a Mission is
 * context it may or may not have.
 */
export function MessagesVigil({ data, commands }: MessagesDesignProps) {
  const model = useMemo(
    () => buildVigilModel(data.graph, data.threads, data.liveAgents, data.attentionSubjectId),
    [data.attentionSubjectId, data.graph, data.liveAgents, data.threads],
  );

  const { openedThreadId, openThread, closeCore, startConversation } = useOpenedThread(
    data.initialThreadId,
    commands,
  );

  const openedLantern = lanternById(model, openedThreadId);
  const activeLantern = lanternHolding(model, data.selected?.id ?? null) ?? openedLantern;

  return (
    <div className="vigil" data-focused={Boolean(data.selected)} data-opened={Boolean(openedLantern)}>
      <VigilFloor
        model={model}
        openedThreadId={openedThreadId}
        selectedRecordId={data.selected?.id ?? null}
        onOpen={openThread}
        onSelectRecord={commands.select}
      />
      <VigilScreenLayer
        agents={model.agents}
        silentMinutesEach={model.lanterns.map((lantern) => lantern.silentMinutes)}
        coreOpen={Boolean(activeLantern)}
        onStartConversation={startConversation}
      />
      <LanternCore
        lantern={activeLantern}
        selected={data.selected}
        graph={data.graph}
        commands={commands}
        unfurled={activeLantern?.record.id === openedThreadId}
        onShowExchange={openThread}
        onClose={closeCore}
      />
    </div>
  );
}

/**
 * Which conversation is unfurled on the floor, and the three ways that changes.
 *
 * Every one of them also clears the selection, because the Core should read out the
 * conversation you just acted on rather than whatever you were looking at before.
 */
function useOpenedThread(initialThreadId: string | undefined, commands: MessagesDesignCommands) {
  const [openedThreadId, setOpenedThreadId] = useState<string | null>(initialThreadId ?? null);

  useEffect(() => {
    if (initialThreadId) setOpenedThreadId(initialThreadId);
  }, [initialThreadId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') commands.select(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [commands]);

  const openThread = useCallback((threadId: string) => {
    setOpenedThreadId(threadId);
    commands.select(null);
  }, [commands]);

  const closeCore = useCallback(() => {
    setOpenedThreadId(null);
    commands.select(null);
  }, [commands]);

  const startConversation = useCallback((agent: ObjectRecord) => {
    setOpenedThreadId(commands.startConversation(agent));
    commands.select(null);
  }, [commands]);

  return { openedThreadId, openThread, closeCore, startConversation };
}

function lanternById(model: VigilModel, threadId: string | null): VigilLantern | null {
  return model.lanterns.find((lantern) => lantern.record.id === threadId) ?? null;
}

/** Selecting a conversation opens its Core; unfurling its ray is a second, explicit step. */
function lanternHolding(model: VigilModel, recordId: string | null): VigilLantern | null {
  if (!recordId) return null;
  return model.lanterns.find((lantern) => (
    lantern.record.id === recordId
    || lantern.moments.some((moment) => moment.record.id === recordId)
  )) ?? null;
}
