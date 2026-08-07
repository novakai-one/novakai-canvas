import { describe, expect, it } from 'vitest';
import type { Node, NodeChange } from '@xyflow/react';
import { applyFrame, clearInFlight, mergeInFlight, takeInFlight, type InFlight } from './in-flight';

const node = (id: string, x = 0, y = 0): Node =>
  ({ id, position: { x, y }, width: 100, height: 80, data: {} }) as Node;

describe('in-flight overlay', () => {
  it('records position frames so a node moves while it is dragged', () => {
    const change = { id: 'a', type: 'position', position: { x: 40, y: 25 }, dragging: true } as NodeChange;
    const frames = applyFrame({}, change);
    const [drawn] = mergeInFlight([node('a')], frames);
    expect(drawn.position).toEqual({ x: 40, y: 25 });
  });

  it('records size frames only for user resizes, never initial measurements', () => {
    const measure = { id: 'a', type: 'dimensions', dimensions: { width: 100, height: 80 } } as NodeChange;
    const resize = { id: 'a', type: 'dimensions', dimensions: { width: 300, height: 200 }, resizing: true } as NodeChange;
    expect(applyFrame({}, measure)).toEqual({});
    const [drawn] = mergeInFlight([node('a')], applyFrame({}, resize));
    expect(drawn.width).toBe(300);
    expect(drawn.height).toBe(200);
  });

  it('leaves nodes with no frame untouched', () => {
    const frames = applyFrame({}, { id: 'a', type: 'position', position: { x: 9, y: 9 }, dragging: true } as NodeChange);
    const [untouched] = mergeInFlight([node('b', 1, 2)], frames);
    expect(untouched.position).toEqual({ x: 1, y: 2 });
  });

  it('forgets a node when it is removed mid-gesture', () => {
    let frames: InFlight = applyFrame({}, { id: 'a', type: 'position', position: { x: 5, y: 5 }, dragging: true } as NodeChange);
    frames = applyFrame(frames, { id: 'a', type: 'remove' } as NodeChange);
    expect(frames).toEqual({});
  });

  it('clears one entry without touching the rest', () => {
    let frames: InFlight = applyFrame({}, { id: 'a', type: 'position', position: { x: 5, y: 5 }, dragging: true } as NodeChange);
    frames = applyFrame(frames, { id: 'b', type: 'position', position: { x: 7, y: 7 }, dragging: true } as NodeChange);
    expect(Object.keys(clearInFlight(frames, 'a'))).toEqual(['b']);
  });

  it('takes the latest frame a gesture ended with, leaving the rest behind', () => {
    let frames: InFlight = applyFrame({}, { id: 'a', type: 'position', position: { x: 5, y: 5 }, dragging: true } as NodeChange);
    frames = applyFrame(frames, { id: 'a', type: 'position', position: { x: 50, y: 60 }, dragging: true } as NodeChange);
    frames = applyFrame(frames, { id: 'b', type: 'position', position: { x: 7, y: 7 }, dragging: true } as NodeChange);
    const taken = takeInFlight(frames, 'a');
    expect(taken.frame?.position).toEqual({ x: 50, y: 60 });
    expect(Object.keys(taken.rest)).toEqual(['b']);
  });

  it('takes nothing from a node with no frames, and changes nothing', () => {
    const frames: InFlight = applyFrame({}, { id: 'a', type: 'position', position: { x: 5, y: 5 }, dragging: true } as NodeChange);
    const taken = takeInFlight(frames, 'b');
    expect(taken.frame).toBeUndefined();
    expect(taken.rest).toBe(frames);
  });
});
