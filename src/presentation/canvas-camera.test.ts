import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasCamera, publishCanvasCamera } from './canvas-camera';

afterEach(() => publishCanvasCamera(null));

describe('canvasCamera', () => {
  it('does nothing, safely, while no canvas is mounted', () => {
    expect(() => canvasCamera().centerOnNode('anything')).not.toThrow();
    expect(() => canvasCamera().fit()).not.toThrow();
  });

  it('hands callers the open canvas once it publishes one', () => {
    const centerOnNode = vi.fn();
    publishCanvasCamera({ centerOnNode, fit: vi.fn() });
    canvasCamera().centerOnNode('bs-broker');
    expect(centerOnNode).toHaveBeenCalledWith('bs-broker');
  });

  it('stops travelling once the canvas withdraws', () => {
    const centerOnNode = vi.fn();
    publishCanvasCamera({ centerOnNode, fit: vi.fn() });
    publishCanvasCamera(null);
    canvasCamera().centerOnNode('bs-broker');
    expect(centerOnNode).not.toHaveBeenCalled();
  });
});
